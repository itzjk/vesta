import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cells, tally, nearestRow, findingStatus } from '../../web/js/core/status.js';
import { score } from '../../web/js/core/rank.js';
import { collectionSummary, evidenceRegister, nearestSourceRows, scoreFactors } from '../../web/js/core/evidence-register.js';
const names = ['meta', 'tests', 'findings', 'sources', 'investigations', 'presets', 'engine'];
const db = buildIndex(Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))])));
const q = presetPoint(db, 'lunar-base', 'prevention', 'pmma');

test('full register preserves every source row/finding once and reconciles different counting units', () => {
  for (const [mode, data] of [['findings', db.findings], ['rows', db.tests]]) {
    const r = evidenceRegister(db, q, { mode });
    assert.equal(r.count, data.length); assert.equal(r.total, data.length);
    assert.equal(new Set(r.entries.map(e => e.id)).size, data.length);
    assert.deepEqual(r.entries.map(e => e.id), data.map(e => e.id));
  }
  const r = evidenceRegister(db, q);
  assert.equal(r.total, 45); assert.equal(r.count, 45);
  assert.deepEqual(r.coverage, tally(cells(q, db)));
  assert.equal(Object.values(r.coverage).reduce((a, b) => a + b, 0), r.questions);
});

test('filters preserve exact material/concern/type and no-source is a question state, not a search miss', () => {
  const absent = evidenceRegister(db, q, { material: 'kapton', concern: 'prevention', coverage: 'NEVER_TESTED' });
  assert.equal(absent.count, 1); assert.equal(absent.entries[0].cell.rows, 0);
  assert.equal(evidenceRegister(db, q, { mode: 'findings', coverage: 'NEVER_TESTED' }).count, 0);
  const found = evidenceRegister(db, q, { mode: 'findings', material: 'pmma', concern: 'prevention' });
  assert.ok(found.count > 0);
  assert.ok(found.entries.every(e => e.record.n.material_ids.includes('pmma') && e.record.pillar === 'prevention'));
  const row = evidenceRegister(db, q, { mode: 'rows', sourceType: 'psi-table' }); assert.equal(row.count, db.tests.length);
  const none = evidenceRegister(db, q, { mode: 'rows', sourceType: 'pdf' }); assert.equal(none.count, 0);
  for (const e of evidenceRegister(db, q, { mode: 'findings' }).entries) assert.equal(e.status, findingStatus(e.record, q, db).status);
});

test('nearest three exactly preserve existing nearest ordering over each material question and cabin', () => {
  const before = JSON.stringify(db.tests.map(r => r.id));
  for (const preset of ['station', 'lunar-base']) {
    const cabin = presetPoint(db, preset, 'prevention', 'pmma');
    for (const c of cells(cabin, db)) {
      const list = nearestSourceRows(c.material, c.concern, cabin, db);
      assert.ok(list.length <= 3); assert.equal(new Set(list.map(e => e.row.id)).size, list.length);
      assert.deepEqual(list[0] ?? null, nearestRow(c.material, c.concern, cabin, db));
      for (const e of list) assert.ok(e.row.n.material_id === c.material && e.row.n.pillars.includes(c.concern));
    }
  }
  assert.equal(JSON.stringify(db.tests.map(r => r.id)), before);
});

test('collection summary uses actual row kinds, missing dates and source years without calling rows burns', () => {
  const m = collectionSummary(db);
  assert.equal(m.source_table_rows, 1989); assert.equal(m.source_tables, 22); assert.equal(m.findings, db.findings.length);
  assert.equal(Object.values(m.row_kinds).reduce((a, b) => a + b, 0), db.tests.length);
  assert.equal(Object.values(m.source_types).reduce((a, b) => a + b, 0), m.sources);
  assert.equal(m.row_dates_after_build.length, 1);
  assert.deepEqual(m.row_dates_after_build[0], { id: 'PSI-26:110', date: '2103-05-15', source_date: '5/15/2103' });
  assert.equal(db.testById['PSI-26:110'].date, '2103-05-15');
  assert.ok(m.row_date_range_not_after_build[1] < m.row_dates_after_build[0].date);
  assert.ok(m.rows_without_date > 0); assert.ok(m.sources_without_year > 0);
  assert.ok(m.row_date_range[0] <= m.row_date_range[1]); assert.ok(m.source_year_range[0] <= m.source_year_range[1]);
  assert.equal(m.excluded_investigations.length, db.excluded.length);
  assert.ok(m.limits.some(s => s.includes('not a count of independent burns')));
  const missing = collectionSummary({ ...db, tests: db.tests.map(r => ({ ...r, date: null })), sources: db.sources.map(s => ({ ...s, year: null })) });
  assert.equal(missing.row_date_range, null); assert.equal(missing.rows_without_date, db.tests.length);
  assert.equal(missing.source_year_range, null); assert.equal(missing.sources_without_year, db.sources.length);
});

test('score explanation reports actual six factors only and preserves rounding/support', () => {
  for (const f of db.findings) {
    const m = scoreFactors(f, q, db), expected = score(f, q, db);
    assert.equal(m.total, expected.total);
    assert.equal(m.total, Math.round(m.factors.reduce((sum, x) => sum + x.contribution, 0) * m.multiplier));
    assert.deepEqual(m.factors.map(x => x.key), ['pillar', 'atmosphere', 'gravity', 'level', 'material', 'habitat']);
    assert.ok(m.excluded.includes('no score component'));
  }
});
