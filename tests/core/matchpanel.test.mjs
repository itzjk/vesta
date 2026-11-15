import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { nearestRow } from '../../web/js/core/status.js';
import { match, TOL } from '../../web/js/core/match.js';
import { matchPanel } from '../../web/js/core/matchpanel.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const rowAt = q => nearestRow('pmma', 'prevention', q, db).row;

test('station PMMA compares all three parameters and labels facility-inferred pressure', () => {
  const q = presetPoint(db, 'station'), row = rowAt(q), panel = matchPanel(row, q, db);
  assert.equal(panel.rowId, row.id);
  assert.deepEqual(panel.compared.map(r => r.state), ['matched', 'matched', 'matched']);
  assert.equal(panel.compared[2].inferred, true);
  assert.match(panel.compared[2].detail, /facility-inferred/);
  assert.deepEqual(panel.comparison, match(row.n, q, db.base));
  assert.deepEqual(panel.notCompared.map(r => r.key), ['airflow', 'geometry', 'thickness', 'ignition', 'suppressant']);
  assert.ok(panel.notCompared.every(r => r.state === 'not-compared'));
  assert.equal(panel.warning, 'A match does not establish safety.');
});

test('lunar PMMA distinguishes collection gravity gap and signed atmospheric differences', () => {
  const q = presetPoint(db, 'lunar-base'), row = rowAt(q), panel = matchPanel(row, q, db);
  assert.deepEqual(panel.compared.map(r => r.state), ['different', 'different', 'different']);
  assert.match(panel.compared[0].detail, /No rows at this gravity class in this collection/);
  assert.equal(panel.compared[1].delta, 11.8);
  assert.match(panel.compared[1].detail, /\+11\.8 pp/);
  assert.match(panel.compared[1].detail, new RegExp(`±${TOL.o2} pp`));
  assert.match(panel.compared[2].detail, new RegExp(`±${TOL.p} kPa`));
});

test('missing pressure stays not matched, never becomes not compared or zero', () => {
  const q = presetPoint(db, 'station'), row = structuredClone(rowAt(q));
  row.n.p = null; row.n.p_inferred = null;
  const pressure = matchPanel(row, q, db).compared[2];
  assert.equal(pressure.state, 'different');
  assert.equal(pressure.delta, null);
  assert.equal(pressure.inferred, false);
  assert.match(pressure.detail, /Row: not reported/);
  assert.match(pressure.detail, /comparison unavailable/);
  assert.doesNotMatch(pressure.detail, /Δ 0/);
});

test('no source row creates no per-parameter comparisons', () => {
  const panel = matchPanel(null, presetPoint(db, 'station'), db);
  assert.equal(panel.rowId, null);
  assert.deepEqual(panel.compared, []);
  assert.deepEqual(panel.notCompared, []);
  assert.match(panel.empty, /No source row to compare/);
});

test('range, tolerance boundary, missing oxygen/gravity and inferred notes follow match without mutation', () => {
  const q = presetPoint(db, 'station'), original = rowAt(q);
  const cases = [
    { ...original.n, o2: [20, 22], p: [100, 102], p_inferred: null },
    { ...original.n, o2: q.o2 - TOL.o2 - 0.01 },
    { ...original.n, o2: q.o2 - TOL.o2, p: q.p - TOL.p },
    { ...original.n, o2: null, gclass: null },
    { ...original.n, p: q.p, p_inferred: 30 }
  ];
  for (const n of cases) {
    const row = { ...original, n }, before = JSON.stringify({ row, q, base: db.base });
    const panel = matchPanel(row, q, db), actual = match(n, q, db.base);
    assert.deepEqual(panel.comparison, actual);
    for (const [i, codes] of [['gravity_not_reported', 'gravity_never_tested', 'gravity_differs'], ['o2_not_reported', 'o2_outside'], ['pressure_not_reported', 'pressure_outside']].entries())
      assert.equal(panel.compared[i].state, codes.some(code => actual.fail.includes(code)) ? 'different' : 'matched');
    assert.equal(JSON.stringify({ row, q, base: db.base }), before);
  }
});

test('display tolerances stay live when the matching authority changes', () => {
  const q = presetPoint(db, 'station'), row = rowAt(q), before = { ...TOL };
  try {
    TOL.o2 = 0.25; TOL.p = 2;
    const panel = matchPanel(row, q, db);
    assert.match(panel.compared[1].detail, /±0.25 pp/);
    assert.match(panel.compared[2].detail, /±2 kPa/);
    assert.deepEqual(panel.comparison, match(row.n, q, db.base));
  } finally { Object.assign(TOL, before); }
});

test('a normal-gravity collection gap is visible without changing match gravity_differs', () => {
  const q = { ...presetPoint(db, 'station'), gclass: 'normal' }, row = rowAt(q);
  const panel = matchPanel(row, q, db);
  assert.equal(db.tests.filter(r => r.n.gclass === q.gclass).length, 0);
  assert.match(panel.compared[0].detail, /No rows at this gravity class in this collection/);
  assert.ok(panel.comparison.fail.includes('gravity_differs'));
  assert.deepEqual(panel.comparison, match(row.n, q, db.base));
});
