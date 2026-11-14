// WP2 · core/status.js on the synthetic fixture: cell, observed, axes, findingStatus (DESIGN.md 3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cell, observed, axes, findingStatus, cells, tally, matrix, nearestRow, CONCERNS } from '../../web/js/core/status.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const station = presetPoint(db, 'station'), lunar = presetPoint(db, 'lunar-base'), rover = presetPoint(db, 'rover'), craft = presetPoint(db, 'spacecraft');

test('PROVEN: rows of the material at the cabin; every hit inferred gives the qualifier', () => {
  const c = cell('fx-alpha', 'prevention', station, db);
  assert.equal(c.status, 'PROVEN');
  assert.deepEqual(c.reasons, []);
  assert.deepEqual(c.hit_ids, ['FX-PSI-1:1', 'FX-PSI-1:3']);          // 22.0 and 20.0 pass; 22.1 and 19.9 do not
  assert.equal(c.qualifier, 'pressure_inferred');
  assert.equal(c.rows, 4);
  assert.deepEqual(c.finding_ids, []);
});

test('PROVEN: one hit with a reported pressure removes the qualifier', () => {
  const c = cell('fx-beta', 'prevention', station, db);
  assert.equal(c.status, 'PROVEN');
  assert.deepEqual(c.hit_ids, ['FX-PSI-1:5', 'FX-PSI-1:6']);
  assert.equal(c.qualifier, null);
});

test('PROVEN lists what the table recorded for the rows that hit, never a verdict', () => {
  const c = cell('fx-alpha', 'prevention', station, db);
  assert.deepEqual(c.observed, [
    { name: 'burn_length_cm', n: 2, min: 3, max: 12, unit: 'cm' },
    { name: 'result', n: 2, texts: ['burned', 'self-extinguished'] } ]);
  assert.deepEqual(observed([]), []);
  assert.deepEqual(observed([{ outcomes: null }, {}]), []);
});

test('EXTRAPOLATED: the reasons and the nearest row with its differences', () => {
  const c = cell('fx-alpha', 'prevention', lunar, db);
  assert.equal(c.status, 'EXTRAPOLATED');
  assert.deepEqual(c.reasons, ['gravity_never_tested', 'o2_outside', 'pressure_outside']);
  assert.equal(c.nearest.id, 'FX-PSI-1:2');                           // 22.1 % is the closest oxygen to 34 %
  assert.deepEqual(c.nearest.delta, { o2: 11.9, p: -44.8 });
  assert.deepEqual(c.nearest.note, ['pressure_inferred']);
  assert.equal(c.hit_ids, undefined);
});

test('EXTRAPOLATED: gravity not reported, oxygen not reported (a burner-stream value never counts)', () => {
  assert.deepEqual(cell('fx-delta', 'prevention', station, db).reasons, ['gravity_not_reported']);
  const e = cell('fx-epsilon', 'prevention', station, db);
  assert.equal(e.status, 'EXTRAPOLATED');
  assert.deepEqual(e.reasons, ['o2_not_reported']);
  assert.deepEqual(e.nearest.delta, { p: 0.1 });
});

test('NEVER_TESTED: no row and no finding; elsewhere says where the material does appear', () => {
  const c = cell('fx-kappa', 'prevention', station, db);
  assert.equal(c.status, 'NEVER_TESTED');
  assert.deepEqual(c.reasons, ['no_row_no_finding']);
  assert.deepEqual(c.elsewhere, ['detection']);
  assert.equal(c.rows, 0);
  const unknown = cell('fx-not-a-material', 'prevention', station, db);
  assert.equal(unknown.status, 'NEVER_TESTED');
  assert.deepEqual(unknown.elsewhere, []);
});

test('the same material in the pillar its table speaks to is EXTRAPOLATED when the table has no oxygen and no pressure', () => {
  const c = cell('fx-kappa', 'detection', station, db);
  assert.equal(c.status, 'EXTRAPOLATED');
  assert.equal(c.rows, 2);                                            // a test_group_reference row counts
  assert.deepEqual(c.reasons, ['o2_not_reported', 'pressure_not_reported']);
});

test('a row that is not a test (test_day) never makes a cell; a finding alone gives finding_without_rows', () => {
  assert.equal(db.rowsByMaterial['fx-gamma'], undefined);
  const c = cell('fx-gamma', 'prevention', station, db);
  assert.equal(c.status, 'EXTRAPOLATED');
  assert.deepEqual(c.reasons, ['finding_without_rows']);
  assert.deepEqual(c.finding_ids, ['FX-C']);
  assert.equal(cell('fx-gamma', 'detection', station, db).status, 'NEVER_TESTED');
});

test('no cell is PROVEN at partial gravity while the base holds no partial row', () => {
  assert.equal(db.base.partial_rows, 0);
  for (const q of [lunar, rover]) assert.equal(tally(cells(q, db)).PROVEN, 0);
});

test('axes at the station fixture cabin', () => {
  assert.deepEqual(axes(station, db), {
    gravity:  { cabin: 10, all: 15 },
    o2:       { cabin: 6, model: 1, cabin_min: 19.9, cabin_max: 22.1 },
    pressure: { cabin: 9, cabin_inferred: 8, model: 2 },
    joint:    { cabin: 6, model: 1 } });
});

test('axes at the rover fixture cabin: zero cabin rows on every axis, model rows counted apart', () => {
  assert.deepEqual(axes(rover, db), {
    gravity:  { cabin: 0, all: 0 },
    o2:       { cabin: 0, model: 2, cabin_min: 19.9, cabin_max: 22.1 },
    pressure: { cabin: 0, cabin_inferred: 0, model: 2 },
    joint:    { cabin: 0, model: 2 } });
});

test('axes on an index with no cabin oxygen value gives null bounds, not Infinity', () => {
  const empty = buildIndex({ tests: { tests: raw.tests.tests.filter(r => r.psi_id === 'FX-PSI-2') } });
  const a = axes(station, empty);
  assert.equal(a.o2.cabin_min, null);
  assert.equal(a.o2.cabin_max, null);
  assert.equal(JSON.stringify(a).includes('null'), true);
});

test('findingStatus: PROVEN only for a test result whose own conditions match', () => {
  assert.deepEqual(findingStatus(db.findingById['FX-A'], station, db), { status: 'PROVEN', reasons: [], note: [], delta: { o2: 0, p: 0.1 } });
  assert.deepEqual(findingStatus(db.findingById['FX-A'], lunar, db).reasons, ['gravity_never_tested', 'o2_outside', 'pressure_outside']);
});

test('findingStatus: a summary is never PROVEN; reasons in the order the API example prints them', () => {
  const s = findingStatus(db.findingById['FX-S-VENT'], lunar, db);
  assert.equal(s.status, 'EXTRAPOLATED');
  assert.deepEqual(s.reasons, ['not_an_experiment', 'gravity_never_tested', 'o2_not_reported', 'pressure_not_reported']);
  // a model whose stated conditions sit at the cabin is still not an experiment
  assert.deepEqual(findingStatus(db.findingById['FX-C'], { ...lunar, gclass: 'partial' }, { ...db, base: { partial_rows: 1 } }).reasons, ['not_an_experiment']);
});

test('findingStatus: different_fuel_class only when both sides name a class and they differ', () => {
  const d = db.findingById['FX-D'];
  assert.deepEqual(findingStatus(d, craft, db, { fuel_class: 'solid' }).reasons, ['o2_not_reported', 'pressure_not_reported', 'different_fuel_class']);
  assert.deepEqual(findingStatus(d, craft, db, { fuel_class: 'liquid_droplet' }).reasons, ['o2_not_reported', 'pressure_not_reported']);
  assert.deepEqual(findingStatus(d, craft, db).reasons, ['o2_not_reported', 'pressure_not_reported']);
  assert.equal(findingStatus(db.findingById['FX-S-VENT'], craft, db, { fuel_class: 'solid' }).reasons.includes('different_fuel_class'), false);
});

test('NEVER_TESTED is never the status of a finding', () => {
  for (const q of [station, lunar, rover, craft]) for (const f of db.findings)
    assert.notEqual(findingStatus(f, q, db, { fuel_class: 'solid' }).status, 'NEVER_TESTED');
});

test('cells, tally and matrix: every material x concern, gaps first', () => {
  const list = cells(station, db);
  assert.equal(list.length, Object.keys(db.materials).length * CONCERNS.length);
  const t = tally(list);
  assert.equal(t.PROVEN + t.EXTRAPOLATED + t.NEVER_TESTED, list.length);
  assert.deepEqual(t, { PROVEN: 2, EXTRAPOLATED: 3, NEVER_TESTED: 10 });
  const m = matrix(station, db);
  assert.deepEqual(m.map(r => r.material), ['fx-kappa', 'fx-delta', 'fx-epsilon', 'fx-alpha', 'fx-beta']);
  assert.deepEqual(m[0].cells.map(c => c.status), ['NEVER_TESTED', 'EXTRAPOLATED', 'NEVER_TESTED']);
});

test('nearestRow gives the closest row of the material for the concern, or null', () => {
  const n = nearestRow('fx-alpha', 'prevention', lunar, db);
  assert.equal(n.row.id, 'FX-PSI-1:2');
  assert.deepEqual(n.delta, { o2: 11.9, p: -44.8 });
  assert.equal(nearestRow('fx-kappa', 'prevention', lunar, db), null);
});

test('the status functions are deterministic and leave the index untouched', () => {
  const before = JSON.stringify(db.tests);
  assert.deepEqual(cells(lunar, db), cells(lunar, db));
  assert.deepEqual(axes(lunar, db), axes(lunar, db));
  assert.equal(JSON.stringify(db.tests), before);
});
