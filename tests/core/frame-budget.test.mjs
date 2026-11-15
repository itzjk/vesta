import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFrameBudget, evaluateFrameWindow, FRAME_BUDGET } from '../../web/js/scene/frame-budget.js';

function driver(options = {}) {
  const budget = createFrameBudget(options); let at = 0;
  const frames = (count, interval = 50, state = {}) => {
    const decisions = [];
    for (let i = 0; i < count; i++) { at += interval; const value = budget.sample({ at, mode: 'high', settled: true, context: 'robotics', ...state }); if (value) decisions.push(value); }
    return decisions;
  };
  return { budget, frames, setTime(value) { at = value; }, get time() { return at; } };
}

test('decision uses an actual median, sample count, duration and strict slow-majority threshold', () => {
  const actual = evaluateFrameWindow(Array(90).fill(50));
  assert.deepEqual(actual, { ready: true, count: 90, durationMs: 4500, medianMs: 50, slowFraction: 1, shouldLower: true });
  assert.equal(evaluateFrameWindow(Array(89).fill(50)).shouldLower, false);
  assert.equal(evaluateFrameWindow(Array(90).fill(20)).ready, false);
  assert.equal(evaluateFrameWindow([...Array(45).fill(16), ...Array(45).fill(100)]).shouldLower, false);
  assert.equal(evaluateFrameWindow(Array(90).fill(33)).shouldLower, false);
  assert.equal(evaluateFrameWindow([...Array(46).fill(34), ...Array(44).fill(16)]).shouldLower, true);
  assert.equal(evaluateFrameWindow([...Array(81).fill(16.7), ...Array(9).fill(240)]).shouldLower, false);
  assert.deepEqual(evaluateFrameWindow([]), { ready: false, count: 0, durationMs: 0, medianMs: null, slowFraction: 0, shouldLower: false });
});

test('default high falls back once only after uninterrupted settling plus90 slow intervals', () => {
  const d = driver();
  assert.deepEqual(d.frames(41), []); // first frame +2 seconds of settling
  assert.deepEqual(d.frames(89), []);
  const decisions = d.frames(1); assert.equal(decisions.length, 1); assert.equal(decisions[0].mode, 'low');
  assert.equal(decisions[0].reason, 'sustained-frame-budget'); assert.equal(decisions[0].stats.medianMs, 50);
  assert.deepEqual(d.frames(300), []); d.budget.reset(); assert.deepEqual(d.frames(300), []);
  assert.equal(d.budget.snapshot().fired, true);
});

test('a transient burst or outliers do not lower a smoothly running scene', () => {
  const d = driver(); assert.deepEqual(d.frames(150, 16.7), []);
  assert.deepEqual(d.frames(35, 55), []); assert.deepEqual(d.frames(150, 16.7), []);
  for (let i = 0; i < 20; i++) { assert.deepEqual(d.frames(9, 16.7), []); assert.deepEqual(d.frames(1, 240), []); }
  assert.equal(d.budget.snapshot().fired, false);
});

test('a later sustained degradation can trigger after fast frames leave the bounded window', () => {
  const d = driver(); assert.deepEqual(d.frames(240, 16.7), []);
  const decision = d.frames(120, 50); assert.equal(decision.length, 1);
  assert.ok(decision[0].stats.count <= FRAME_BUDGET.minSamples);
});

test('explicit quality, capture, still and any manual choice override adaptation permanently', () => {
  for (const options of [{ explicitQuality: true }, { explicitQuality: 'high' }, { capture: true }, { still: true }]) {
    const d = driver(options); assert.deepEqual(d.frames(300), []); d.budget.reset(); assert.deepEqual(d.frames(300), []);
  }
  const d = driver(); d.frames(120); d.budget.manual();
  assert.deepEqual(d.frames(300), []); d.budget.reset(); assert.deepEqual(d.frames(300), []);
  assert.equal(d.budget.snapshot().locked, 'manual-quality');
});

test('loading, flight, warming, hidden, unset settled and capture samples discard prior history', () => {
  for (const state of [{ loading: true }, { flying: true }, { warming: true }, { visible: false }, { hidden: true }, { settled: false }, { capture: true }, { still: true }, { mode: 'low' }, { mode: 'still' }]) {
    const d = driver(); assert.deepEqual(d.frames(120), []); assert.deepEqual(d.frames(1, 50, state), []);
    assert.equal(d.budget.snapshot().sampleCount, 0);
    assert.deepEqual(d.frames(130), []); assert.equal(d.frames(1).length, 1);
  }
  const budget = createFrameBudget();
  for (let at = 0; at < 30000; at += 50) assert.equal(budget.sample({ at, mode: 'high' }), null);
});

test('station changes, pauses, long scheduling gaps and non-monotonic clocks restart settling', () => {
  const d = driver(); d.frames(120); assert.deepEqual(d.frames(1, 50, { context: 'evidence' }), []);
  assert.equal(d.budget.snapshot().sampleCount, 0);
  d.frames(120, 50, { context: 'evidence' });
  assert.deepEqual(d.frames(1, 1000, { context: 'evidence' }), []);
  assert.equal(d.budget.snapshot().sampleCount, 0);
  d.frames(120, 50, { context: 'evidence' }); d.setTime(0);
  assert.deepEqual(d.frames(1, 50, { context: 'evidence' }), []); assert.equal(d.budget.snapshot().sampleCount, 0);
  d.budget.reset(); assert.deepEqual(d.frames(130), []); assert.equal(d.frames(1).length, 1);
});

test('invalid intervals fail closed, and callers cannot mutate internal diagnostics or decisions', () => {
  for (const values of [[NaN], [Infinity], [-1], [0], [FRAME_BUDGET.maxGapMs + 1]]) assert.throws(() => evaluateFrameWindow(values), /finite, positive and continuous/);
  const d = driver(); d.frames(120); assert.equal(d.budget.sample({ at: NaN, mode: 'high', settled: true }), null);
  assert.equal(d.budget.snapshot().sampleCount, 0);
  const decision = d.frames(131)[0]; decision.stats.medianMs = 0;
  const snapshot = d.budget.snapshot(); assert.equal(snapshot.assessment.medianMs, 50);
  snapshot.assessment.medianMs = 1; assert.equal(d.budget.snapshot().assessment.medianMs, 50);
});
