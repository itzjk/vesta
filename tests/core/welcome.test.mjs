import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as index from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { readQ, patchQ, parseHash, withSticky } from '../../web/js/router.js';
import { destinations, cabinSummary, headline, stationHash, reviewQuestion, reviewQuestionText } from '../../web/js/world/welcome.js';

const names = ['tests', 'findings', 'presets'];
const raw = Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = index.buildIndex(raw);
const core = { index, status };

test('a missing or invalid material offers a labelled suggestion and preserves a valid concern', () => {
  for (const material of [null, '', 'not-indexed']) {
    const q = { ...index.presetPoint(db, 'lunar-base'), material, concern: 'detection' };
    const before = JSON.stringify(q);
    assert.deepEqual(reviewQuestion(q, db), { material: 'pmma', concern: 'detection' });
    assert.match(reviewQuestionText(q, db), /^Suggested starting question: PMMA · detection$/);
    assert.equal(JSON.stringify(q), before, 'A suggestion must not silently select a material or change the cabin.');
  }
  const invalid = { material: null, concern: 'not-a-concern' };
  assert.deepEqual(reviewQuestion(invalid, db), { material: 'pmma', concern: 'prevention' });
  const chosen = { material: 'kapton', concern: 'suppression' };
  assert.deepEqual(reviewQuestion(chosen, db), chosen);
  assert.doesNotMatch(reviewQuestionText(chosen, db), /Suggested/);
  assert.equal(reviewQuestion(invalid, { materials: {} }), null);
});

test('welcome offers only the real cabin presets, excluding markers and incomplete records', () => {
  assert.deepEqual(destinations(db).map(p => p.id), db.presets.map(p => p.id));
  assert.equal(destinations(db).length, 5);
  assert.deepEqual(destinations({ presets: [db.markers[0], { id: 'missing', label: 'Missing' }] }), []);
  assert.deepEqual(destinations(null), []);
});

test('every destination uses all material-concern cells and the exact core tally', () => {
  for (const preset of destinations(db)) {
    const q = index.presetPoint(db, preset.id);
    const cells = status.cells(q, db);
    const result = cabinSummary(q, db, core);
    assert.equal(result.total, cells.length);
    assert.equal(result.total, 45);
    assert.deepEqual(result.counts, status.tally(cells));
    assert.equal(result.label, preset.label);
    assert.equal(Object.values(result.counts).reduce((a, b) => a + b), result.total);
    assert.ok(result.conditions.includes(String(q.o2)));
    assert.ok(result.conditions.includes(String(q.p)));
    assert.ok(result.conditions.includes(q.g_label));
  }
  const station = cabinSummary(index.presetPoint(db, 'station'), db, core);
  const lunar = cabinSummary(index.presetPoint(db, 'lunar-base'), db, core);
  assert.notDeepEqual(station.counts, lunar.counts);
});

test('question totals follow collection changes rather than a fixed denominator', () => {
  const subset = { ...db, materials: { pmma: db.materials.pmma } };
  assert.equal(cabinSummary(index.presetPoint(db, 'station'), subset, core).total, status.CONCERNS.length);
});

test('incomplete query or missing collection never becomes zero evidence', () => {
  const q = index.presetPoint(db, 'station');
  for (const bad of [null, {}, { ...q, o2: null }, { ...q, p: NaN }, { ...q, gclass: null }]) {
    assert.equal(cabinSummary(bad, db, core), null);
  }
  assert.equal(cabinSummary(q, { ...db, materials: {} }, core), null);
  assert.equal(cabinSummary(q, null, core), null);
  assert.equal(cabinSummary(q, db, {}), null);
  assert.equal(headline({}), 'Cabin conditions unavailable.');
});

test('resting headline follows custom atmosphere and gravity, in twelve words or fewer', () => {
  const q = { ...index.presetPoint(db, 'rover'), preset: 'custom', o2: 28, p: 68 };
  const line = headline(q);
  assert.ok(line.includes('28% O₂'));
  assert.ok(line.includes('68 kPa'));
  assert.ok(line.includes(q.g_label));
  assert.ok(line.split(/\s+/).length <= 12);
  assert.ok(!/safe|proven|minutes|experiment/i.test(line));
});

test('all station links use real routes and preserve the selected journey cabin', () => {
  const params = patchQ({ preset: 'custom', o2: 25, p: 70, g: '1g', mat: 'cotton', concern: 'detection' }, { preset: 'rover' }, readQ({ preset: 'station' }, db));
  const expected = { flame: 'brief', evidence: 'design', drill: 'incident', trust: 'engine' };
  for (const [station, route] of Object.entries(expected)) {
    const target = parseHash(withSticky(stationHash(station), params));
    assert.equal(target.route, route);
    assert.equal(target.params.station, station);
    assert.equal(readQ(target.params, db).preset, 'rover');
    assert.equal(readQ(target.params, db).material, 'cotton');
    assert.equal(readQ(target.params, db).concern, 'detection');
  }
  assert.equal(stationHash('unknown'), null);
});


test('modified-click hrefs carry the cabin without a sticky host adapter', () => {
  for (const preset of destinations(db)) {
    const q = index.presetPoint(db, preset.id, 'suppression', 'cotton');
    const direct = readQ(parseHash(stationHash('evidence', q)).params, db);
    assert.equal(direct.preset, preset.id);
    assert.equal(direct.material, 'cotton');
    assert.equal(direct.concern, 'suppression');
  }
  const custom = { ...index.presetPoint(db, 'rover'), preset: 'custom', o2: 28, p: 68 };
  const direct = readQ(parseHash(stationHash('flame', custom)).params, db);
  assert.equal(direct.o2, 28);
  assert.equal(direct.p, 68);
  assert.equal(direct.g, custom.g);
  assert.equal(direct.habitat, custom.habitat);
});
