import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { scoreFactors } from '../../web/js/core/evidence-register.js';
import { tally, cells } from '../../web/js/core/status.js';
import { browseEvidence, collectionAvailability, conditionAvailability, registerQuery } from '../../web/js/core/evidence-browser.js';

const db = buildIndex(Object.fromEntries(['meta', 'tests', 'findings', 'sources', 'investigations', 'presets', 'engine']
  .map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))])));
const q = presetPoint(db, 'lunar-base', 'prevention', 'pmma');

test('the browser preserves the complete collection and its three distinct counting units', () => {
  const snapshot = JSON.stringify([db.tests, db.findings]);
  for (const [mode, expected] of [['questions', 45], ['findings', 822], ['rows', 1989]]) {
    const model = browseEvidence(db, q, { mode });
    assert.equal(model.total, expected); assert.equal(model.count, expected);
    assert.equal(new Set(model.entries.map(e => e.id)).size, expected);
    assert.equal(Object.values(model.filteredCoverage).reduce((a, b) => a + b, 0), expected);
    assert.deepEqual(model.coverage, tally(cells(q, db)));
  }
  assert.equal(JSON.stringify([db.tests, db.findings]), snapshot);
});

test('reported, inferred and missing conditions form a complete nonoverlapping partition without promoting evidence', () => {
  for (const mode of ['rows', 'findings']) {
    const all = browseEvidence(db, q, { mode });
    const parts = ['reported', 'inferred', 'missing'].map(conditions => browseEvidence(db, q, { mode, conditions }));
    assert.equal(parts.reduce((sum, x) => sum + x.count, 0), all.count);
    assert.equal(new Set(parts.flatMap(x => x.entries.map(e => e.id))).size, all.count);
    const previousStatus = new Map(all.entries.map(e => [e.id, e.status]));
    for (const part of parts) for (const entry of part.entries) assert.equal(entry.status, previousStatus.get(entry.id));
    assert.ok(parts[2].count > 0);
  }
  const completeButOther = browseEvidence(db, q, { mode: 'rows', conditions: 'reported', coverage: 'EXTRAPOLATED' });
  assert.ok(completeButOther.count > 0, 'recorded fields must not imply lunar compatibility');
});

test('zero and ranges are recorded measurements; null, NaN and unsupported inference remain missing', () => {
  assert.equal(conditionAvailability({ n: { gclass: 'micro', o2: 0, p: [40, 80] } }).state, 'reported');
  assert.equal(conditionAvailability({ n: { gclass: 'micro', o2: 21, p: null, p_inferred: 101.3 } }).state, 'inferred');
  assert.equal(conditionAvailability({ n: { gclass: 'micro', o2: 21, p: null } }).state, 'missing');
  assert.equal(conditionAvailability({ n: { gclass: null, o2: 21, p: 101.3 } }).state, 'missing');
  assert.equal(conditionAvailability({ n: { gclass: 'micro', o2: NaN, p: 101.3 } }).state, 'missing');
  assert.equal(conditionAvailability({ n: { gclass: 'micro', o2: 21, p: NaN, p_inferred: 101.3 } }).state, 'missing');
});

test('collection missingness reconciles source rows, preserving measured pressure separately from inference', () => {
  const m = collectionAvailability(db);
  assert.equal(m.total, db.tests.length);
  assert.equal(m.complete_reported + m.complete_inferred + m.incomplete, m.total);
  assert.ok(m.pressure + m.pressure_inferred <= m.total);
  assert.equal(m.pressure_inferred, db.tests.filter(r => r.n.p == null && Number.isFinite(r.n.p_inferred)).length);
  assert.equal(m.oxygen, db.tests.filter(r => Number.isFinite(r.n.o2) || Array.isArray(r.n.o2)).length);
  assert.ok(m.incomplete > 0);
});

test('investigation and evidence-type filters use recorded identifiers and compose with material filters', () => {
  for (const mode of ['rows', 'findings']) {
    const model = browseEvidence(db, q, { mode, investigation: 'PSI-69' });
    assert.ok(model.count > 0);
    assert.ok(model.entries.every(e => (e.record.psi_id || e.record.n.psi_id) === 'PSI-69'));
    assert.equal(Object.values(model.filteredCoverage).reduce((a, b) => a + b, 0), model.count);
  }
  const model = browseEvidence(db, q, { mode: 'findings', material: 'pmma', concern: 'prevention', level: 'flight' });
  assert.ok(model.count > 0);
  assert.ok(model.entries.every(e => e.record.n.work === 'flight' && e.materials.includes('pmma') && e.concerns.includes('prevention')));
});

test('identifier/text search is normalized and a zero-result search does not become scientific absence', () => {
  const model = browseEvidence(db, q, { mode: 'rows', search: 'ＰＳＩ－６９：１１４' });
  assert.ok(model.entries.some(e => e.id === 'PSI-69:114'));
  const none = browseEvidence(db, q, { mode: 'findings', search: 'unmatched-deliberate-zzzz-term' });
  assert.equal(none.count, 0); assert.equal(none.total, 822); assert.deepEqual(none.filteredCoverage, {});
  assert.deepEqual(none.coverage, tally(cells(q, db)));
  const question = browseEvidence(db, q, { mode: 'questions', material: 'kapton', concern: 'prevention' });
  assert.equal(question.count, 1); assert.equal(question.entries[0].status, 'NEVER_TESTED');
});

test('source inspection uses the exact register question while preserving the station cabin', () => {
  const initial = { ...q }, filters = { mode: 'findings', material: 'kapton', concern: 'detection', investigation: 'PSI-101', level: 'normal_g' };
  const entry = browseEvidence(db, q, filters).entries[0]; assert.ok(entry);
  const effective = registerQuery(q, filters);
  assert.equal(effective.material, 'kapton'); assert.equal(effective.concern, 'detection');
  for (const key of ['o2', 'p', 'g', 'gclass', 'habitat']) assert.equal(effective[key], q[key]);
  assert.deepEqual(q, initial);
  assert.ok(entry.record.n.material_ids.includes(effective.material));
  const card = scoreFactors(entry.record, effective, db), openedSource = scoreFactors(entry.record, { ...effective }, db);
  assert.deepEqual(card, openedSource);
  assert.notEqual(card.total, scoreFactors(entry.record, q, db).total, 'fixture distinguishes the register context from the previous PMMA question');
  assert.equal(registerQuery(q, {}).material, null, 'all-material register must not silently inherit selected PMMA');
});
