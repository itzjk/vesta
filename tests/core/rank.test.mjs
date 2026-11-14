// WP2 · core/rank.js on the synthetic fixture: the worked examples of DESIGN.md 3.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { score, rank, rankInvestigations, W, LEVEL, SPAN } from '../../web/js/core/rank.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const station = presetPoint(db, 'station'), lunar = presetPoint(db, 'lunar-base');
const F = id => db.findingById[id];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('the weights sum to 100 and the constants are the published ones', () => {
  assert.equal(Object.values(W).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(W, { pillar: 30, atmosphere: 25, gravity: 15, level: 15, material: 10, habitat: 5 });
  assert.deepEqual(LEVEL, { flight: 1, ground_lowg: 0.8, normal_g: 0.6, summary: 0.5, operations: 0.5, model: 0.4 });
  assert.deepEqual(SPAN, { o2: 15, p: 50 });
});

test('FX-A scores 95 at the station and 64 at the lunar base (no material picked)', () => {
  assert.equal(station.material, null);
  const s = score(F('FX-A'), station, db);
  assert.equal(s.total, 95);
  assert.equal(s.parts.pillar, 30); assert.equal(s.parts.gravity, 15); assert.equal(s.parts.level, 15);
  assert.equal(s.parts.material, 5); assert.equal(s.parts.habitat, 5);
  close(s.parts.atmosphere, 25 * (0.7 + 0.3 * (1 - 0.1 / 50)));
  const l = score(F('FX-A'), lunar, db);
  assert.equal(l.total, 64);
  close(l.parts.atmosphere, 25 * (0.7 * (1 - 13 / 15) + 0.3 * (1 - 44.8 / 50)));
  assert.equal(l.parts.gravity, 6);
});

test('a finding shaped like S-VENT-01 (summary, micro, oxygen and pressure not stated) scores 70 and 61', () => {
  const s = score(F('FX-S-VENT'), station, db);
  assert.equal(s.total, 70);
  assert.deepEqual(s.parts, { pillar: 30, atmosphere: 7.5, gravity: 15, level: 7.5, material: 5, habitat: 5 });
  const l = score(F('FX-S-VENT'), lunar, db);
  assert.equal(l.total, 61);
  assert.deepEqual(l.parts, { pillar: 30, atmosphere: 7.5, gravity: 6, level: 7.5, material: 5, habitat: 5 });
});

test('partial support multiplies the total by 0.85', () => {
  const a = score(F('FX-A'), station, db), sum = Object.values(a.parts).reduce((x, y) => x + y, 0);
  assert.equal(score(F('FX-B'), station, db).total, Math.round(sum * 0.85));
  assert.equal(score(F('FX-B'), station, db).total, 81);
});

test('the parts add up to the total before rounding, and every part stays inside its weight', () => {
  for (const q of [station, lunar]) for (const f of db.findings) {
    const s = score(f, q, db), sum = Object.values(s.parts).reduce((a, b) => a + b, 0);
    assert.equal(s.total, Math.round(sum * (f.n.support === 'direct' ? 1 : 0.85)));
    for (const k in W) assert.ok(s.parts[k] >= 0 && s.parts[k] <= W[k] + 1e-9, `${f.id} ${k}`);
    assert.deepEqual(Object.keys(s.parts), Object.keys(W));
  }
});

test('pillar term: the concern 1, design or response 0.5, another pillar 0.2', () => {
  assert.equal(score(F('FX-A'), station, db).terms.pillar, 1);
  assert.equal(score(F('FX-COMM-1'), station, db).terms.pillar, 0.5);
  assert.equal(score(F('FX-PROT-1'), station, db).terms.pillar, 0.5);
  assert.equal(score(F('FX-D'), station, db).terms.pillar, 0.2);
});

test('atmosphere term: a range counts as 1 inside it; not stated counts 0.3; zero at the span', () => {
  assert.equal(score(F('FX-C'), lunar, db).terms.atmosphere, 1);                         // 34 % sits in [30, 36]; 56.5 kPa
  close(score(F('FX-S-VENT'), lunar, db).terms.atmosphere, 0.3);
  const far = { ...F('FX-A'), n: { ...F('FX-A').n, o2: 36, p: 151.4 } };
  assert.equal(score(far, station, db).terms.atmosphere, 0);                             // 15 points and 50 kPa away
});

test('gravity term: same class 1, another class 0.4, not stated 0.3', () => {
  assert.equal(score(F('FX-A'), station, db).terms.gravity, 1);
  assert.equal(score(F('FX-A'), lunar, db).terms.gravity, 0.4);
  assert.equal(score(F('FX-COMM-1'), lunar, db).terms.gravity, 0.3);
});

test('material term: picked material 1, same fuel class 0.5, general statement 0.3, another class 0, none picked 0.5', () => {
  const q = { ...station, material: 'fx-alpha' };                                        // a solid
  assert.equal(score({ ...F('FX-A'), n: { ...F('FX-A').n, material_ids: ['fx-alpha'] } }, q, db).terms.material, 1);
  assert.equal(score(F('FX-F'), q, db).terms.material, 0.5);                             // fuel_class solid, no material named
  assert.equal(score(F('FX-A'), q, db).terms.material, 0.3);                             // no material, no class
  assert.equal(score(F('FX-D'), q, db).terms.material, 0);                               // liquid droplet
  assert.equal(score(F('FX-A'), station, db).terms.material, 0.5);
  assert.equal(score(F('FX-F'), { ...station, material: 'fx-unknown' }, db).terms.material, 0);   // a material the base does not hold
});

test('habitat term: 1 when the finding is tagged for the habitat, else 0', () => {
  assert.equal(score(F('FX-C'), lunar, db).terms.habitat, 1);
  assert.equal(score(F('FX-C'), station, db).terms.habitat, 0);
  assert.equal(score(F('FX-A'), { ...station, habitat: null }, db).terms.habitat, 0);    // a custom point with no habitat
});

test('rank orders by total, then level, then year, then id', () => {
  const r = rank(db.findings, station, db);
  assert.deepEqual(r.slice(0, 3).map(x => [x.f.id, x.total]), [['FX-A', 95], ['FX-B', 81], ['FX-S-VENT', 70]]);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].total >= r[i].total);
  const pos = id => r.findIndex(x => x.f.id === id);
  assert.equal(score(F('FX-COMM-1'), station, db).total, score(F('FX-COMM-2'), station, db).total);
  assert.ok(pos('FX-COMM-1') < pos('FX-COMM-2'));                                        // same total and level: 2023 before 2013
  assert.ok(pos('FX-PROT-1') < pos('FX-PROT-2'));                                        // same total, level and year: id order
  const mk = (id, work, year) => ({ ...F('FX-S-VENT'), id, source: { year }, n: { ...F('FX-S-VENT').n, work } });
  const tie = [mk('FX-T2', 'summary', 2001), mk('FX-T1', 'operations', 2001), mk('FX-T3', 'summary', 2020)];
  assert.deepEqual(rank(tie, station, db).map(x => x.f.id), ['FX-T3', 'FX-T1', 'FX-T2']);
  assert.equal(rank(tie, station, db)[0].f, tie[2]);                                     // the entry carries the finding itself
});

test('rank does not reorder its input and gives the same list twice', () => {
  const input = [...db.findings], ids = input.map(f => f.id);
  const a = rank(input, lunar, db), b = rank(input, lunar, db);
  assert.deepEqual(input.map(f => f.id), ids);
  assert.deepEqual(a.map(x => [x.f.id, x.total]), b.map(x => [x.f.id, x.total]));
  assert.deepEqual(rank([], lunar, db), []);
});

test('rankInvestigations: mean of the three best findings; null when there is no finding; rows break ties', () => {
  const r = rankInvestigations(db, station);
  assert.deepEqual(r, [
    { psi_id: 'FX-PSI-1', score: 77, findings: 4, rows: 10, rows_at_cabin: 6 },          // (95 + 81 + 54) / 3
    { psi_id: 'FX-PSI-3', score: 45, findings: 2, rows: 4, rows_at_cabin: 1 },           // (49 + 41) / 2
    { psi_id: 'FX-PSI-2', score: null, findings: 0, rows: 2, rows_at_cabin: 0 },
    { psi_id: 'FX-PSI-10', score: null, findings: 0, rows: 0, rows_at_cabin: 0 } ]);
  assert.equal(r.some(x => x.score === 0), false);                                       // never shown as 0
});
