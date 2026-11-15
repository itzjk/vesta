import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cells, tally } from '../../web/js/core/status.js';
import { rank } from '../../web/js/core/rank.js';
import { buildRowComparison } from '../../web/js/core/row-comparison.js';

const raw = Object.fromEntries(['meta', 'tests', 'findings', 'investigations', 'presets'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw), station = { ...presetPoint(db, 'station'), material: 'pmma', concern: 'prevention' };
const pair = ['PSI-25:10', 'PSI-25:11'];
const dim = (model, key) => model.dimensions.find(d => d.key === key);
const variant = change => {
  const rows = pair.map(id => structuredClone(db.testById[id])); change(rows);
  return { ...db, testById: { ...db.testById, ...Object.fromEntries(rows.map(row => [row.id, row])) } };
};

test('real BASS-II rows preserve specimen differences and explicit facility-pressure assumptions', () => {
  const model = buildRowComparison(db, pair, station);
  assert.equal(dim(model, 'oxygen').label, 'Ambient oxygen');
  assert.equal(dim(model, 'oxygen').state, 'same');
  assert.deepEqual(dim(model, 'oxygen').values.map(v => v.value), [21, 21]);
  assert.equal(dim(model, 'pressure').state, 'same');
  assert.equal(dim(model, 'pressure').comparison_label, 'Same inferred value');
  assert.ok(dim(model, 'pressure').values.every(v => v.value === 101.3 && v.basis === 'facility-inferred' && /not measured/.test(v.note)));
  assert.equal(dim(model, 'specimen').state, 'different');
  assert.deepEqual(dim(model, 'specimen').values.map(v => v.raw), pair.map(id => db.testById[id].fuel_raw));
  assert.equal(model.records[0].label, 'B10');
  assert.equal(model.records[0].row, 10);
  assert.equal(model.records[0].source_url, 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25');
  assert.match(model.records[0].pressure_inference_url, /^https:\/\/www\.nasa\.gov\//);
  assert.ok(model.records.every(r => r.comparison.comparison.fail.length === 0));
  assert.match(model.scope, /not a controlled experiment/);
});

test('all-unknown flow, ignition and suppressant remain visible; fan settings never become velocity', () => {
  const model = buildRowComparison(db, pair, station);
  for (const key of ['airflow', 'ignition_power', 'ignition_time', 'suppressant']) {
    const d = dim(model, key); assert.equal(d.state, 'unknown'); assert.equal(d.used_by_cabin_match, false);
    assert.ok(d.values.every(v => v.value === null && v.basis === 'unknown'));
  }
  const fan = model.settings.find(s => s.key === 'fan_display');
  assert.equal(fan.values[0].raw, db.testById['PSI-25:10'].conditions.fan_display.raw);
  assert.notEqual(fan.values[0].unit, 'cm/s');
  assert.deepEqual(model.dimensions.filter(d => d.used_by_cabin_match).map(d => d.key), ['gravity', 'oxygen', 'pressure']);
});

test('the same silicone material wording cannot hide different source specimen thicknesses', () => {
  const model = buildRowComparison(db, ['PSI-99:1', 'PSI-99:2'], station);
  assert.equal(dim(model, 'specimen').label, 'Material / source wording');
  assert.equal(dim(model, 'specimen').state, 'same');
  assert.equal(dim(model, 'size').state, 'different');
  assert.match(dim(model, 'size').values[0].value, /0\.27/);
  assert.match(dim(model, 'size').values[1].value, /0\.61/);
  assert.deepEqual(dim(model, 'size').values.map(v => v.value), ['PSI-99:1', 'PSI-99:2'].map(id => db.testById[id].fuel_size));
});

test('real lunar comparison shows actual mismatches and original outcomes without changing them', () => {
  const lunar = { ...presetPoint(db, 'lunar-base'), material: 'pmma', concern: 'prevention' };
  const model = buildRowComparison(db, ['PSI-25:1', 'PSI-25:10'], lunar);
  assert.equal(dim(model, 'oxygen').state, 'different');
  assert.deepEqual(dim(model, 'oxygen').values.map(v => v.value), [22.2, 21]);
  assert.deepEqual(model.records[0].comparison.comparison.fail, ['gravity_never_tested', 'o2_outside', 'pressure_outside']);
  assert.equal(model.records[0].comparison.comparison.delta.o2, 11.8);
  assert.equal(model.records[0].comparison.comparison.delta.p, -44.8);
  const co = model.outcomes.find(d => d.key === 'co_final_ppm');
  assert.deepEqual(co.values.map(v => v.value), [6, 23]);
  assert.ok(co.values.every(v => v.unit === 'ppm'));
  assert.match(model.outcome_limit, /without pooling, fitting or predicting/);
});

test('equal numeric pressure with different provenance never becomes the same reported basis', () => {
  const model = buildRowComparison(variant(rows => { rows[0].n.p = 101.3; rows[0].pressure_raw = '101.3'; }), pair, station);
  assert.equal(dim(model, 'pressure').state, 'different_basis');
  assert.deepEqual(dim(model, 'pressure').values.map(v => v.basis), ['reported', 'facility-inferred']);
});

test('zero, ranges and partial missingness remain distinct from absent values', () => {
  const data = variant(rows => { rows[0].flow_cm_s = 0; rows[0].flow_raw = '0'; rows[0].n.p = [100, 102]; rows[0].pressure_raw = '100–102'; });
  const model = buildRowComparison(data, pair, station);
  assert.equal(dim(model, 'airflow').state, 'incomplete');
  assert.equal(dim(model, 'airflow').values[0].value, 0);
  assert.equal(dim(model, 'airflow').values[0].text, '0 cm/s');
  assert.equal(dim(model, 'airflow').values[1].value, null);
  assert.deepEqual(dim(model, 'pressure').values[0].value, [100, 102]);
  assert.equal(dim(model, 'pressure').values[0].text, '100–102 kPa');
});

test('burner oxygen is not silently treated as ambient cabin oxygen', () => {
  const model = buildRowComparison(variant(rows => { rows[0].n.o2 = null; rows[0].o2_basis = 'burner_stream'; rows[0].o2_percent = 21; }), pair, station);
  assert.equal(dim(model, 'oxygen').state, 'incomplete');
  assert.equal(dim(model, 'oxygen').values[0].value, null);
  assert.match(dim(model, 'oxygen').values[0].note, /not an ambient/);
});

test('cross-investigation records preserve their own locators and cannot imply experimental control', () => {
  const model = buildRowComparison(db, ['PSI-25:10', 'PSI-99:2'], station);
  assert.equal(model.cross_investigation, true);
  assert.equal(model.records[1].investigation_id, 'PSI-99');
  assert.equal(dim(model, 'pressure').state, 'incomplete');
  assert.equal(model.records[1].source_url, 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-99');
});

test('comparison cannot change coverage, relevance, source records or the saved query', () => {
  const before = JSON.stringify({ rows: pair.map(id => db.testById[id]), query: station, coverage: tally(cells(station, db)), rank: rank(db.findings, station, db) });
  const model = buildRowComparison(db, pair, station);
  model.query.o2 = 99; dim(model, 'oxygen').values[0].value = 99;
  assert.equal(JSON.stringify({ rows: pair.map(id => db.testById[id]), query: station, coverage: tally(cells(station, db)), rank: rank(db.findings, station, db) }), before);
});

test('invalid, duplicate, single or excessive source selections are refused', () => {
  for (const ids of [[], [pair[0]], [pair[0], pair[0]], [pair[0], 'NOT-A-SOURCE'], [...pair, 'PSI-25:1', 'PSI-25:2']]) {
    assert.throws(() => buildRowComparison(db, ids, station));
  }
  assert.throws(() => buildRowComparison(db, pair));
});
