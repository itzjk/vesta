import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex } from '../../web/js/core/index.js';
import { evaluateCase } from '../../web/js/world/proof.js';
import { createProofSession, proofComparisons } from '../../web/js/world/proof-session.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const file = read('../../web/data/proof-cases.json');
const names = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'engine'];
const db = buildIndex(Object.fromEntries(names.map(name => [name, read(`../../web/data/${name}.json`)])));
function setup(options = {}) {
  const queue = new Map(), updates = []; let sequence = 0, loads = 0;
  const session = createProofSession({
    load: async () => { loads++; return file; }, evaluate: c => evaluateCase(c, db), onChange: value => updates.push(value),
    setTimer: fn => { const id = ++sequence; queue.set(id, fn); return id; }, clearTimer: id => queue.delete(id), ...options
  });
  const tick = async () => {
    const next = queue.entries().next().value; assert.ok(next, 'One real case should be queued'); queue.delete(next[0]); next[1](); await Promise.resolve();
  };
  const begin = async () => { const done = session.run(); await Promise.resolve(); return { done }; };
  return { session, queue, updates, tick, begin, get loads() { return loads; } };
}

test('one start evaluates actual reviewed cases once and retains their results after completion', async () => {
  const before = JSON.stringify(db), h = setup(), { done } = await h.begin();
  assert.equal(await h.session.run(), false, 'A second click cannot overlap the run');
  assert.equal(h.session.snapshot().phase, 'running'); assert.equal(h.session.snapshot().completed, 0);
  assert.equal(h.session.snapshot().runNumber, 1, 'A blocked overlapping click does not count as another run');
  for (let i = 0; i < 10; i++) { await h.tick(); assert.equal(h.session.snapshot().completed, i + 1); }
  assert.equal(await done, true); const result = h.session.snapshot();
  assert.equal(result.phase, 'complete'); assert.equal(result.passed, 10); assert.equal(result.failed, 0);
  assert.deepEqual(result.results.map(r => r.id), file.cases.map(c => c.id));
  assert.equal(result.results[0].actual.hits, 16); assert.equal(result.results[0].actual.qualifier, 'pressure_inferred');
  assert.deepEqual(Object.fromEntries(['o2', 'p', 'g', 'gclass', 'material', 'concern', 'habitat'].map(key => [key, result.results[0].cabin[key]])),
    { o2: 21, p: 101.4, g: '0g', gclass: 'micro', material: 'pmma', concern: 'prevention', habitat: 'station' });
  assert.equal(result.results.find(r => r.id === 'lunar-pmma').cabin.gclass, 'partial');
  assert.equal(result.results.find(r => r.id === 'restart-refusal').actual.status, 'NO_SOURCE');
  assert.equal(h.queue.size, 0); assert.equal(h.session.stop(), false);
  assert.deepEqual(h.session.snapshot(), result, 'Closing or reopening a completed report must not discard outcomes');
  result.results.pop(); assert.equal(h.session.snapshot().results.length, 10, 'Snapshots do not expose the mutable results array');
  assert.equal(JSON.stringify(db), before); h.session.dispose();
});

test('stop retains checked cases and cancels work; explicit rerun starts afresh from cached cases', async () => {
  const h = setup(), { done } = await h.begin();
  for (let i = 0; i < 3; i++) await h.tick();
  assert.equal(h.session.stop(), true); assert.equal(await done, false);
  assert.equal(h.queue.size, 0); assert.equal(h.session.snapshot().phase, 'stopped'); assert.equal(h.session.snapshot().completed, 3);
  const next = h.session.run(); assert.equal(h.session.snapshot().completed, 0);
  for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await next, true); assert.equal(h.session.snapshot().runNumber, 2); assert.equal(h.loads, 1); assert.equal(h.session.snapshot().completed, 10); h.session.dispose();
});

test('incorrect expectations and execution failures are reported as failures without suppressing later checks', async () => {
  const changed = structuredClone(file); changed.cases[0].expected.hits = 17;
  const h = setup({ load: async () => changed, evaluate: c => { if (c.id === 'station-sibal') throw new Error('Test execution unavailable'); return evaluateCase(c, db); } });
  const { done } = await h.begin(); for (let i = 0; i < 10; i++) await h.tick(); await done;
  const result = h.session.snapshot(); assert.equal(result.failed, 2); assert.equal(result.passed, 8);
  assert.deepEqual(result.results[0].mismatches, ['hits']);
  assert.equal(result.results[1].actual.status, 'UNAVAILABLE'); assert.equal(result.results[1].pass, false);
  assert.deepEqual(result.results[1].mismatches, ['execution']); h.session.dispose();
});

test('stopped or disposed pending loads cannot publish stale progress or arm timers', async () => {
  for (const action of ['stop', 'dispose']) {
    let resolve; const h = setup({ load: () => new Promise(done => { resolve = done; }) });
    const done = h.session.run(); assert.equal(h.session.snapshot().phase, 'loading');
    h.session[action](); const emitted = h.updates.length; resolve(file); await done;
    assert.equal(h.updates.length, emitted); assert.equal(h.queue.size, 0); assert.equal(h.session.snapshot().completed, 0);
  }
});

test('malformed case files remain an explicit loading error with no fabricated pass results', async () => {
  const h = setup({ load: async () => ({ ...file, cases: file.cases.slice(1) }) });
  assert.equal(await h.session.run(), false); assert.equal(h.session.snapshot().phase, 'error');
  assert.match(h.session.snapshot().error, /ten cases/); assert.equal(h.session.snapshot().passed, 0); assert.equal(h.queue.size, 0); h.session.dispose();
});

test('expert comparison exposes all actual assertions and distinguishes partial reason-list checks', () => {
  const material = evaluateCase(file.cases[0], db), fields = proofComparisons(material);
  assert.deepEqual(fields.map(f => f.key), ['status', 'qualifier', 'hits']);
  assert.equal(fields.find(f => f.key === 'hits').actual, 16); assert.ok(fields.every(f => f.pass));
  const refusal = evaluateCase(file.cases.find(c => c.id === 'restart-refusal'), db);
  assert.ok(proofComparisons(refusal).some(f => f.key === 'protocol' && f.actual === 'PROT-03'));
  assert.ok(db.findingById[refusal.result.protocol.finding_id], 'Separate fallback source remains inspectable');
  const lunar = evaluateCase(file.cases.find(c => c.id === 'lunar-pmma'), db);
  assert.match(proofComparisons(lunar).find(f => f.key === 'reasons').comparison, /additional reasons are allowed/);
  const failed = evaluateCase({ ...file.cases[0], expected: { ...file.cases[0].expected, hits: 17 } }, db);
  assert.equal(proofComparisons(failed).find(f => f.key === 'hits').pass, false);
});

test('a failed first UI update cannot strand the session busy or reject the Run action', async () => {
  let broken = true, failures = 0;
  const h = setup({ onChange() { if (broken) throw new Error('Detached view'); }, onError() { failures++; } });
  assert.equal(await h.session.run(), false);
  assert.equal(h.session.snapshot().phase, 'error');
  assert.match(h.session.snapshot().error, /could not be displayed/);
  assert.equal(h.session.snapshot().completed, 0); assert.equal(h.queue.size, 0); assert.equal(h.loads, 0);
  assert.equal(failures, 1);
  broken = false;
  const { done } = await h.begin(); for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await done, true); assert.equal(h.session.snapshot().passed, 10); h.session.dispose();
});

test('a result renderer failure preserves actual evaluations, allows retry and contains a failing error view', async () => {
  let broken = true, failures = 0;
  const h = setup({ onChange(state) { if (broken && state.completed >= 3) throw new Error('Source view unavailable'); },
    onError() { failures++; throw new Error('Fallback view unavailable'); } });
  const { done } = await h.begin(); for (let i = 0; i < 3; i++) await h.tick();
  assert.equal(await done, false); const interrupted = h.session.snapshot();
  assert.equal(interrupted.phase, 'error'); assert.equal(interrupted.completed, 3);
  assert.equal(interrupted.passed, 3); assert.equal(interrupted.failed, 0, 'A presentation failure is not a failed scientific assertion');
  assert.equal(h.queue.size, 0); assert.equal(failures, 1);
  broken = false; const retry = h.session.run();
  for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await retry, true); assert.equal(h.session.snapshot().passed, 10); h.session.dispose();
});

test('cancel settles a hung load immediately and its late response cannot replace a new run', async () => {
  let resolveOld, oldSignal, loads = 0;
  const h = setup({ load: ({ signal }) => {
    if (++loads === 1) { oldSignal = signal; return new Promise(resolve => { resolveOld = resolve; }); }
    return Promise.resolve(file);
  } });
  const old = h.session.run(); assert.equal(h.session.stop(), true);
  assert.equal(oldSignal.aborted, true); assert.equal(await old, false);
  const { done } = await h.begin();
  resolveOld({ schema: 'wrong', cases: [] }); await Promise.resolve();
  assert.equal(h.session.snapshot().phase, 'running'); assert.equal(h.session.snapshot().file, file);
  for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await done, true); assert.equal(h.session.snapshot().passed, 10); h.session.dispose();
});

test('a timed-out load is retryable without fabricated results even if the loader ignores abort', async () => {
  const deadlines = new Map(); let sequence = 0, loads = 0, oldSignal, resolveOld;
  const h = setup({ load: ({ signal }) => {
    if (++loads === 1) { oldSignal = signal; return new Promise(resolve => { resolveOld = resolve; }); }
    return Promise.resolve(file);
  }, setLoadTimer: fn => { deadlines.set(++sequence, fn); return sequence; }, clearLoadTimer: id => deadlines.delete(id) });
  const done = h.session.run(); deadlines.values().next().value();
  assert.equal(await done, false); assert.equal(oldSignal.aborted, true);
  assert.equal(h.session.snapshot().phase, 'error'); assert.match(h.session.snapshot().error, /timed out/);
  assert.equal(h.session.snapshot().completed, 0); assert.equal(deadlines.size, 0);
  const { done: retry } = await h.begin(); resolveOld({ schema: 'wrong', cases: [] }); await Promise.resolve();
  for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await retry, true); assert.equal(h.session.snapshot().passed, 10); assert.equal(deadlines.size, 0); h.session.dispose();
});

test('a rejected fetch has an explicit retry path and no cached failure', async () => {
  let loads = 0;
  const h = setup({ load: async () => { if (++loads === 1) throw new Error('Network unavailable'); return file; } });
  assert.equal(await h.session.run(), false); assert.equal(h.session.snapshot().phase, 'error');
  assert.equal(h.session.snapshot().file, null); assert.equal(h.session.snapshot().passed, 0);
  const { done } = await h.begin(); for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(await done, true); assert.equal(loads, 2); assert.equal(h.session.snapshot().passed, 10); h.session.dispose();
});
