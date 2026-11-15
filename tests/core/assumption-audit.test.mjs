import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { match } from '../../web/js/core/match.js';
import { coverage, question } from '../../web/js/world/coverage.js';
import { pressureBasis, pressureDependence, pressureAudit, pressureDependenceText, pressureAuditText,
  PRESSURE_DEPENDENCE_SCOPE } from '../../web/js/core/assumption-audit.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const station = presetPoint(db, 'station'), lunar = presetPoint(db, 'lunar-base');

// Independent of the helper: recount each hit from the row record and the matcher's own note.
const recount = (cell, q) => {
  const rows = (cell.hit_ids ?? []).map(id => db.testById[id]);
  return { nearby: rows.length,
    reported: rows.filter(r => r.n.p !== null && r.n.p !== undefined).length,
    inferred: rows.filter(r => match(r.n, q, db.base).note.includes('pressure_inferred')).length };
};

test('missing, zero and range pressures keep distinct bases', () => {
  assert.equal(pressureBasis({ p: 101.3, p_inferred: null }), 'reported');
  assert.equal(pressureBasis({ p: 0, p_inferred: 101.3 }), 'reported');
  assert.equal(pressureBasis({ p: [55, 70] }), 'reported');
  assert.equal(pressureBasis({ p: null, p_inferred: 101.3 }), 'facility_inferred');
  assert.equal(pressureBasis({ p: undefined, p_inferred: 0 }), 'facility_inferred');
  assert.equal(pressureBasis({ p: null, p_inferred: null }), 'unknown');
  assert.equal(pressureBasis({}), 'unknown');
  assert.equal(pressureBasis(undefined), 'unknown');
});

test('station prevention questions depend wholly on facility-inferred pressure', () => {
  const expected = { pmma: 16, sibal: 6, nomex: 2 };
  for (const [material, inferred] of Object.entries(expected)) {
    const cell = status.cell(material, 'prevention', station, db), d = pressureDependence(cell, db);
    assert.equal(cell.status, 'PROVEN');
    assert.deepEqual({ nearby: d.nearby, reported: d.reported, inferred: d.inferred }, recount(cell, station));
    assert.deepEqual([d.nearby, d.reported, d.inferred, d.unknown, d.state], [inferred, 0, inferred, 0, 'all_inferred']);
    assert.deepEqual([...d.inferred_row_ids], cell.hit_ids);
    assert.equal(cell.qualifier, 'pressure_inferred');
    assert.ok(d.inference_sources.length >= 1 && d.inference_sources.every(s => /^https:\/\/www\.nasa\.gov\//.test(s.url) && s.assumption));
    assert.equal(pressureDependenceText(d),
      `Pressure basis of ${inferred} nearby rows: 0 with pressure reported in the row · ${inferred} matched on a facility-inferred pressure.`);
  }
});

test('every preset: the audit equals an independent recount and never exceeds the nearby rows', () => {
  for (const preset of db.presets) {
    const q = presetPoint(db, preset.id), cells = status.cells(q, db), total = { nearby: 0, reported: 0, inferred: 0 };
    for (const cell of cells) {
      const d = pressureDependence(cell, db), again = recount(cell, q);
      assert.deepEqual({ nearby: d.nearby, reported: d.reported, inferred: d.inferred }, again, `${preset.id} ${cell.material} ${cell.concern}`);
      assert.equal(d.reported + d.inferred + d.unknown, d.nearby);
      assert.equal(d.unknown, 0);
      assert.equal(d.nearby > 0, cell.status === 'PROVEN');
      assert.equal(d.state === 'all_inferred', cell.qualifier === 'pressure_inferred');
      for (const key of Object.keys(total)) total[key] += again[key];
    }
    const audit = pressureAudit(cells, db);
    assert.deepEqual({ nearby: audit.nearby, reported: audit.reported, inferred: audit.inferred }, total);
    assert.equal(audit.questions, status.tally(cells).PROVEN);
  }
});

test('lunar nearby coverage stays zero and produces no disclosure text', () => {
  const wall = coverage(lunar, db);
  assert.equal(wall.counts.PROVEN, 0);
  assert.deepEqual({ ...wall.pressureAudit }, { questions: 0, questions_all_inferred: 0, nearby: 0, reported: 0, inferred: 0, unknown: 0 });
  assert.equal(pressureAuditText(wall.pressureAudit), '');
  const detail = question('pmma', 'prevention', lunar, db);
  assert.equal(detail.pressureDependence.state, 'no_nearby_rows');
  assert.equal(pressureDependenceText(detail.pressureDependence), '');
});

test('coverage exposes the audit without changing cells, counts or statuses', () => {
  const before = JSON.stringify(db);
  const wall = coverage(station, db);
  assert.deepEqual(wall.cells, status.cells(station, db));
  assert.deepEqual(wall.counts, status.tally(wall.cells));
  assert.deepEqual({ ...wall.pressureAudit }, { questions: 3, questions_all_inferred: 3, nearby: 24, reported: 0, inferred: 24, unknown: 0 });
  assert.equal(pressureAuditText(wall.pressureAudit), 'Pressure basis of 24 nearby row matches across these questions: 0 reported in the row · 24 facility-inferred.');
  assert.equal(pressureAuditText({ nearby: 4, reported: 1, inferred: 2, unknown: 1 }),
    'Pressure basis of 4 nearby row matches across these questions: 1 reported in the row · 2 facility-inferred · 1 without a pressure basis.');
  assert.equal(pressureAuditText({ nearby: 1, reported: 1, inferred: 0, unknown: 0 }),
    'Pressure basis of 1 nearby row match across these questions: 1 reported in the row · 0 facility-inferred.');
  assert.deepEqual(question('pmma', 'prevention', station, db).pressureDependence, pressureDependence(status.cell('pmma', 'prevention', station, db), db));
  assert.equal(JSON.stringify(db), before);
});

test('a mixed synthetic cell separates reported, zero, range, inferred and unresolved rows', () => {
  const source = { id: 'facility', title: 'Facility guide', url: 'https://example.invalid/guide', assumption: 'Nominal pressure assumed.' };
  const fake = { testById: {
    a: { n: { p: 101.3 } }, b: { n: { p: 0, p_inferred: 101.3 } }, c: { n: { p: [95, 105] } },
    d: { n: { p: null, p_inferred: 101.3, p_inferred_source: source } }, e: { n: { p: null, p_inferred: 101.3, p_inferred_source: source } },
    f: { n: { p: null, p_inferred: null } } } };
  const d = pressureDependence({ hit_ids: ['a', 'b', 'c', 'd', 'e', 'f', 'absent'] }, fake);
  assert.deepEqual([d.nearby, d.reported, d.inferred, d.unknown, d.state], [7, 3, 2, 2, 'mixed']);
  assert.deepEqual([...d.reported_row_ids], ['a', 'b', 'c']);
  assert.deepEqual([...d.unknown_row_ids], ['f', 'absent']);
  assert.deepEqual(d.inference_sources.map(s => ({ ...s })), [source]);
  assert.match(pressureDependenceText(d), /^Pressure basis of 7 nearby rows: 3 with pressure reported in the row · 2 matched on a facility-inferred pressure · 2 without a pressure basis\.$/);
  assert.equal(pressureDependence({ hit_ids: ['a'] }, fake).state, 'all_reported');
  assert.equal(pressureDependenceText(pressureDependence({ hit_ids: ['d'] }, fake)), 'Pressure basis of 1 nearby row: 0 with pressure reported in the row · 1 matched on a facility-inferred pressure.');
  assert.equal(pressureDependence({}, fake).nearby, 0);
  assert.equal(pressureDependence(null, fake).state, 'no_nearby_rows');
  assert.throws(() => { d.reported_row_ids.push('x'); });
});

test('the wording states dependence, not safety', () => {
  assert.match(PRESSURE_DEPENDENCE_SCOPE, /not a measurement in the source row/);
  assert.match(PRESSURE_DEPENDENCE_SCOPE, /not a safety probability/);
  assert.doesNotMatch(PRESSURE_DEPENDENCE_SCOPE + pressureAuditText({ nearby: 2, reported: 1, inferred: 1 }), /\bsafe\b|validated|proven/i);
});
