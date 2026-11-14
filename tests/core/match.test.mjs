// WP2 · core/match.js: the one comparison shared by rows and findings (DESIGN.md 3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { match, gap, TOL } from '../../web/js/core/match.js';

const base0 = { partial_rows: 0 };
const station = { o2: 21, p: 101.4, gclass: 'micro' };
const lunar   = { o2: 34, p: 56.5, gclass: 'partial' };
const row = (o2, extra = {}) => ({ gclass: 'micro', o2, p: null, p_inferred: 101.3, ...extra });

test('tolerances are 1 point of oxygen and 5 kPa', () => {
  assert.deepEqual(TOL, { o2: 1.0, p: 5.0 });
});

test('tolerance edge: 22.0 % passes at a 21 % cabin, 22.1 % fails', () => {
  assert.deepEqual(match(row(22.0), station, base0).fail, []);
  assert.deepEqual(match(row(22.1), station, base0).fail, ['o2_outside']);
  assert.deepEqual(match(row(20.0), station, base0).fail, []);
  assert.deepEqual(match(row(19.9), station, base0).fail, ['o2_outside']);
});

test('tolerance edge on pressure: 5.0 kPa passes, 5.1 kPa fails', () => {
  const q = { o2: 21, p: 100, gclass: 'micro' };
  assert.deepEqual(match({ gclass: 'micro', o2: 21, p: 95 }, q, base0).fail, []);
  assert.deepEqual(match({ gclass: 'micro', o2: 21, p: 105 }, q, base0).fail, []);
  assert.deepEqual(match({ gclass: 'micro', o2: 21, p: 94.9 }, q, base0).fail, ['pressure_outside']);
  assert.deepEqual(match({ gclass: 'micro', o2: 21, p: 105.1 }, q, base0).fail, ['pressure_outside']);
});

test('delta is cabin minus test, rounded to one decimal', () => {
  const m = match(row(22.2), lunar, base0);
  assert.equal(m.delta.o2, 11.8);
  assert.equal(m.delta.p, -44.8);
  assert.deepEqual(m.fail, ['gravity_never_tested', 'o2_outside', 'pressure_outside']);
});

test('inferred pressure passes with a note; reported pressure carries no note', () => {
  assert.deepEqual(match(row(21), station, base0).note, ['pressure_inferred']);
  assert.deepEqual(match({ gclass: 'micro', o2: 21, p: 101.3, p_inferred: null }, station, base0).note, []);
  // a reported pressure wins over an inferred one
  const m = match({ gclass: 'micro', o2: 21, p: 56.5, p_inferred: 101.3 }, station, base0);
  assert.deepEqual(m.fail, ['pressure_outside']);
  assert.deepEqual(m.note, []);
});

test('a condition that is not reported never counts as a match', () => {
  const m = match({ gclass: null, o2: null, p: null, p_inferred: null }, station, base0);
  assert.deepEqual(m.fail, ['gravity_not_reported', 'o2_not_reported', 'pressure_not_reported']);
  assert.deepEqual(m.delta, {});
  assert.deepEqual(match({ gclass: 'micro' }, station, base0).fail, ['o2_not_reported', 'pressure_not_reported']);   // missing keys read as not reported
});

test('gravity: never tested only when the cabin is partial and the base holds no partial row', () => {
  assert.deepEqual(match(row(34, { p: 56.5 }), lunar, base0).fail, ['gravity_never_tested']);
  assert.deepEqual(match(row(34, { p: 56.5 }), lunar, { partial_rows: 3 }).fail, ['gravity_differs']);
  assert.deepEqual(match(row(21), { ...station, gclass: 'normal' }, base0).fail, ['gravity_differs']);
  assert.deepEqual(match({ gclass: 'partial', o2: 34, p: 56.5 }, lunar, { partial_rows: 1 }).fail, []);
});

test('gap: a range is 0 inside, signed outside; a number is cabin minus test', () => {
  assert.equal(gap([30, 36], 34), 0);
  assert.equal(gap([30, 36], 30), 0);
  assert.equal(gap([30, 36], 36), 0);
  assert.equal(gap([30, 36], 21), -9);
  assert.equal(gap([30, 36], 40), 4);
  assert.equal(gap(22.2, 34), 34 - 22.2);
});

test('a finding with a range of oxygen matches a cabin inside the range, plus the tolerance outside it', () => {
  const f = { gclass: 'micro', o2: [17, 21], p: [95, 105] };
  assert.deepEqual(match(f, { o2: 19, p: 101.4, gclass: 'micro' }, base0).fail, []);
  assert.deepEqual(match(f, { o2: 22, p: 110, gclass: 'micro' }, base0).fail, []);
  assert.deepEqual(match(f, { o2: 22.1, p: 110.1, gclass: 'micro' }, base0).fail, ['o2_outside', 'pressure_outside']);
});

test('match does not change its inputs and returns fresh objects', () => {
  const c = Object.freeze(row(22.2)), q = Object.freeze({ ...lunar });
  const a = match(c, q, base0), b = match(c, q, base0);
  assert.deepEqual(a, b);
  assert.notEqual(a.fail, b.fail);
});
