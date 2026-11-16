// core/tolerance-sensitivity.js on the built data: every expectation is recomputed from web/data, none is hard-coded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, CONCERNS } from '../../web/js/core/index.js';
import { TOL, match, gap } from '../../web/js/core/match.js';
import { cells, tally } from '../../web/js/core/status.js';
import { SCALES, tolerancesAt, distance, within, sensitivity, sensitivityView } from '../../web/js/core/tolerance-sensitivity.js';

const DATA = new URL('../../web/data/', import.meta.url);
const FILES = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets'];
const present = FILES.every(n => fs.existsSync(new URL(n + '.json', DATA)));
const skip = present ? false : 'web/data is not built';
const db = present ? buildIndex(Object.fromEntries(FILES.map(n => [n, JSON.parse(fs.readFileSync(new URL(n + '.json', DATA), 'utf8'))]))) : null;
const SHIPPED = { o2: 1.0, p: 5.0 };

// An independent recount that does not call the module under test.
function bruteForce(preset, tol) {
  const q = { o2: preset.o2, p: preset.p_kpa, gclass: preset.gclass };
  let n = 0;
  for (const material of Object.keys(db.materials)) for (const concern of CONCERNS) {
    const rows = (db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(concern));
    if (rows.some(r => {
      const p = r.n.p ?? r.n.p_inferred;
      if (r.n.gclass == null || r.n.gclass !== q.gclass) return false;
      const one = v => Number.isFinite(v) || (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite));
      if (!one(r.n.o2) || !one(p)) return false;
      return Math.abs(gap(r.n.o2, q.o2)) <= tol.o2 + 1e-9 && Math.abs(gap(p, q.p)) <= tol.p + 1e-9;
    })) n++;
  }
  return n;
}

test('scales are half, shipped, double and quadruple of the shipped TOL, which stays untouched', () => {
  assert.deepEqual(SCALES, [0.5, 1, 2, 4]);
  assert.deepEqual(SCALES.map(tolerancesAt).map(t => [t.o2, t.p, t.shipped]), SCALES.map(k => [TOL.o2 * k, TOL.p * k, k === 1]));
  assert.deepEqual(TOL, SHIPPED);
});

test('distance defers to the matcher for gravity and unreported conditions', () => {
  const base = { partial_rows: 0 }, q = { o2: 21, p: 100, gclass: 'micro' };
  assert.equal(distance({ gclass: 'normal', o2: 21, p: 100 }, q, base), null);
  assert.equal(distance({ gclass: null, o2: 21, p: 100 }, q, base), null);
  assert.equal(distance({ gclass: 'micro', o2: null, p: 100 }, q, base), null);
  assert.equal(distance({ gclass: 'micro', o2: 21, p: null, p_inferred: null }, q, base), null);
  const d = distance({ gclass: 'micro', o2: [23, 25], p: null, p_inferred: 92 }, q, base);
  assert.deepEqual(d, { o2: 2, p: 8 });
  assert.equal(within(d, tolerancesAt(1)), false);
  assert.equal(within(d, tolerancesAt(2)), true);
  // at the shipped scale the verdict is exactly the matcher's
  for (const c of [{ gclass: 'micro', o2: 22, p: 95 }, { gclass: 'micro', o2: 22.1, p: 95 }, { gclass: 'micro', o2: 22, p: 94.9 }])
    assert.equal(within(distance(c, q, base), tolerancesAt(1)), match(c, q, base).fail.length === 0);
});

test('the shipped column equals the coverage the app reports for every preset', { skip }, () => {
  const s = sensitivity(db), at = s.tolerances.findIndex(t => t.shipped);
  assert.equal(s.questions, Object.keys(db.materials).length * CONCERNS.length);
  assert.equal(s.presets.length, db.presets.length);
  for (const p of s.presets) {
    const list = cells(presetPoint(db, p.id), db);
    assert.equal(list.length, s.questions);
    assert.equal(p.counts[at], tally(list).PROVEN, p.id);
  }
});

test('every column equals an independent recount, and counts never fall as limits widen', { skip }, () => {
  const s = sensitivity(db);
  for (const p of s.presets) {
    const preset = db.presetById[p.id];
    assert.deepEqual(p.counts, s.tolerances.map(t => bruteForce(preset, t)), p.id);
    assert.equal(p.reachable, bruteForce(preset, { o2: Infinity, p: Infinity }), p.id);
    for (let i = 1; i < p.counts.length; i++) assert.ok(p.counts[i] >= p.counts[i - 1], p.id);
    assert.ok(p.reachable >= p.counts.at(-1) && p.reachable <= s.questions - s.without_rows, p.id);
    assert.equal(p.fixed, new Set(p.counts).size === 1);
  }
});

test('what tolerance cannot change is read from the data', { skip }, () => {
  const s = sensitivity(db);
  const partialRows = db.tests.filter(r => r.n.gclass === 'partial').length;
  assert.equal(s.partial_rows, partialRows);
  const partial = s.presets.filter(p => p.gclass === 'partial');
  assert.deepEqual(partial.map(p => p.id), db.presets.filter(p => p.gclass === 'partial').map(p => p.id));
  if (partialRows === 0) for (const p of partial) { assert.deepEqual(p.counts, SCALES.map(() => 0), p.id); assert.equal(p.reachable, 0); }
  let withoutRows = 0;
  for (const m of Object.keys(db.materials)) for (const c of CONCERNS)
    if (!(db.rowsByMaterial[m] ?? []).some(r => r.n.pillars.includes(c))) withoutRows++;
  assert.equal(s.without_rows, withoutRows);
  // a much wider sweep still cannot exceed the ceiling
  for (const p of sensitivity(db, [1, 1000]).presets) assert.equal(p.counts[1], p.reachable, p.id);
});

test('computing the view changes no shipped tolerance and no coverage label', { skip }, () => {
  const before = db.presets.map(p => JSON.stringify(cells(presetPoint(db, p.id), db)));
  sensitivityView(db);
  assert.deepEqual(TOL, SHIPPED);
  assert.deepEqual(db.presets.map(p => JSON.stringify(cells(presetPoint(db, p.id), db))), before);
});

test('the view states the numbers it computed and keeps the wording rules', { skip }, () => {
  const v = sensitivityView(db), s = v.data;
  assert.equal(v.columns.length, s.tolerances.length + 2);
  assert.equal(v.columns.filter(c => c.includes('(shipped)')).length, 1);
  assert.ok(v.columns.find(c => c.includes('(shipped)')).includes(`±${TOL.o2} pt`) && v.columns.find(c => c.includes('(shipped)')).includes(`±${TOL.p} kPa`));
  assert.ok(v.caption.includes(`of ${s.questions}`));
  v.rows.forEach((row, i) => {
    assert.ok(row.label.startsWith(db.presets[i].label));
    assert.deepEqual(row.cells, [...s.presets[i].counts, s.presets[i].reachable].map(String));
  });
  const text = v.notes.join(' ');
  assert.match(text, /team's choice/); assert.match(text, /not a NASA criterion/);
  assert.ok(text.includes(`${s.without_rows} of ${s.questions} questions`));
  const partial = db.presets.filter(p => p.gclass === 'partial');
  const claimsZero = /stay at 0 because this collection has no partial-gravity source-table rows/.test(text);
  assert.equal(claimsZero, s.partial_rows === 0 && partial.length > 0);
  if (claimsZero) for (const p of partial) assert.ok(text.includes(p.label), p.label);
  assert.doesNotMatch([v.summary, v.caption, ...v.columns, text].join(' '), /\b(safe|proven|validated|certified)\b|NASA never|nobody has tested/i);
});

test('without partial-gravity presets or with partial rows, the zero claim is not made', { skip }, () => {
  const fake = { ...db, base: { partial_rows: 1 } };
  assert.doesNotMatch(sensitivityView(fake).notes.join(' '), /stay at 0/);
});
