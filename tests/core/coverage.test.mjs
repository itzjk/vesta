import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, designPoint, presetPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { rank } from '../../web/js/core/rank.js';
import { coverage, headline, question } from '../../web/js/world/coverage.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const lunar = presetPoint(db, 'lunar-base');

test('coverage derives the lunar wall from all material and concern pairs', () => {
  const wall = coverage(lunar, db);
  assert.deepEqual(wall.counts, { PROVEN: 0, EXTRAPOLATED: 24, NEVER_TESTED: 21 });
  assert.equal(wall.total, 45);
  assert.equal(wall.cabin, db.presetById['lunar-base'].label);
  assert.equal(wall.sentence, '0 of 45 questions have nearby-condition evidence');
  assert.equal(new Set(wall.cells.map(c => `${c.material}:${c.concern}`)).size, wall.total);
});

test('every preset and a custom cabin use the current query, without mutations', () => {
  const custom = designPoint({ preset: 'custom', o2: 22.2, p: 101.3, g: '0g' }, db);
  const queries = [...db.presets.map(p => presetPoint(db, p.id)), custom];
  const before = JSON.stringify({ db, queries });
  for (const q of queries) {
    const wall = coverage(q, db);
    assert.deepEqual(wall.cells, status.cells(q, db));
    assert.deepEqual(wall.counts, status.tally(wall.cells));
    assert.equal(Object.values(wall.counts).reduce((a, b) => a + b, 0), wall.total);
    assert.match(headline(q, db), new RegExp(`${wall.counts.PROVEN}/${wall.total}`));
  }
  assert.notDeepEqual(coverage(lunar, db).counts, coverage(custom, db).counts);
  assert.equal(coverage(custom, db).cabin, 'Custom cabin');
  assert.equal(JSON.stringify({ db, queries }), before);
});

test('nearest row and signed differences come from core, including inferred pressure', () => {
  const detail = question('pmma', 'prevention', lunar, db);
  assert.deepEqual(detail.nearest, status.nearestRow('pmma', 'prevention', lunar, db));
  assert.equal(detail.nearest.delta.o2, 11.8);
  assert.ok(detail.nearest.fail.includes('gravity_never_tested'));
  assert.ok(detail.nearest.note.includes('pressure_inferred'));
  const nearby = question('pmma', 'prevention', presetPoint(db, 'station'), db);
  assert.equal(nearby.cell.status, 'PROVEN');
  assert.equal(nearby.nearest.fail.length, 0);
});

test('findings are ranked for this material and concern, never borrowed to fill a gap', () => {
  for (const c of status.cells(lunar, db)) {
    const detail = question(c.material, c.concern, lunar, db);
    const candidates = c.finding_ids.map(id => db.findingById[id]);
    assert.deepEqual(detail.findings, rank(candidates, { ...lunar, material: c.material, concern: c.concern }, db).slice(0, 3));
    assert.ok(detail.findings.every(({ f }) => f.pillar === c.concern && f.n.material_ids.includes(c.material)));
    if (c.status === 'NEVER_TESTED') {
      assert.equal(detail.nearest, null);
      assert.deepEqual(detail.findings, []);
    }
  }
});

test('empty data produces an honest zero denominator, no manufactured questions or rows', () => {
  const empty = buildIndex({});
  const wall = coverage({ ...lunar, preset: 'custom' }, empty);
  assert.equal(wall.total, 0);
  assert.deepEqual(wall.counts, { PROVEN: 0, EXTRAPOLATED: 0, NEVER_TESTED: 0 });
  assert.equal(question('missing', 'suppression', lunar, empty).nearest, null);
  assert.deepEqual(question('missing', 'suppression', lunar, empty).findings, []);
});
