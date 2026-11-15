import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createInventoryReviewSession } from '../../web/js/core/inventory-review.js';
import { matchRecordedReview, createRecordedReviewPanel } from '../../web/js/world/recorded-claude-review.js';

const raw = Object.fromEntries(['meta', 'tests', 'findings', 'investigations', 'presets'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw), report = await createInventoryReviewSession({ db, query: presetPoint(db, 'lunar-base'), materials: ['pmma', 'kapton', 'silicone'], yieldTurn: () => Promise.resolve() }).run();
const record = {
  schema: 'vesta.recorded-model-review/1', query: { o2: 34, p: 56.5, g: 'moon', gclass: 'partial', habitat: 'lunar-base' },
  materials: ['kapton', 'pmma', 'silicone'], collection_digest: report.collection.digest,
  question_ids: report.questions.map(q => q.id), cited_ids: ['OPERATIONS-054', 'OPERATIONS-242', 'PSI-25:1', 'PSI-99:2'],
  recorded_at: '2026-11-15T18:41:50.757502+00:00', tool_calls: 12,
  summary: 'Fixture text for applicability tests, not a published model answer.',
  review_question: 'Which material-specific conditions still require review?', scope: 'External recorded interpretation, not a runtime model or safety clearance.'
};

test('exact real report matches with unordered material/question sets and global contextual citations', () => {
  assert.equal(matchRecordedReview(record, report, db).status, 'MATCH');
  const reordered = { ...record, materials: [...record.materials].reverse(), question_ids: [...record.question_ids].reverse() };
  assert.equal(matchRecordedReview(reordered, report, db).matches, true);
  assert.ok(db.findingById['OPERATIONS-054']);
  assert.ok(!report.questions.some(q => q.sources.findings.some(f => f.id === 'OPERATIONS-054')));
  assert.match(matchRecordedReview(record, report, db).message, /not independent scientific validation/);
});

test('the curated public Claude record matches the real saved lunar inventory and resolves every citation', () => {
  const curated = JSON.parse(fs.readFileSync(new URL('../../web/data/claude-review.json', import.meta.url), 'utf8'));
  const result = matchRecordedReview(curated, report, db);
  assert.equal(result.status, 'MATCH', result.message);
  assert.equal(curated.tool_calls, 12);
  assert.equal(curated.query.g, 'moon');
  assert.equal(curated.query.habitat, 'lunar-base');
  assert.equal(curated.question_ids.length, 9);
  assert.match(curated.editorial_label, /paraphrase/i);
});

test('every changed numeric condition, gravity token/class, habitat and material set refuses reuse', () => {
  for (const patch of [{ o2: 34.00001 }, { p: 56.50001 }, { g: 'mars', gclass: 'partial' }, { g: '0g', gclass: 'micro' }, { habitat: 'station' }]) {
    const changed = structuredClone(report); Object.assign(changed.input.query, patch);
    const result = matchRecordedReview(record, changed, db);
    assert.equal(result.matches, false); assert.equal(result.status, 'QUERY_CHANGED');
  }
  const changed = structuredClone(report); changed.input.materials = ['pmma', 'kapton'];
  assert.equal(matchRecordedReview(record, changed, db).status, 'MATERIALS_CHANGED');
  assert.equal(matchRecordedReview({ ...record, query: { ...record.query, g: 1 / 6 } }, report, db).status, 'INVALID_RECORD');
});

test('exact collection digest is required even with identical headline counts', () => {
  const changed = structuredClone(report); changed.collection.digest = '0'.repeat(64);
  assert.deepEqual(changed.counts, report.counts);
  assert.equal(matchRecordedReview(record, changed, db).status, 'COLLECTION_CHANGED');
});

test('partial/reset/cancelled/error results and malformed completed reports never match', () => {
  for (const status of ['idle', 'running', 'cancelled', 'error']) assert.equal(matchRecordedReview(record, { ...report, status }, db).status, 'REPORT_INCOMPLETE');
  assert.equal(matchRecordedReview(record, null, db).status, 'REPORT_INCOMPLETE');
  const bad = structuredClone(report); bad.counts.completed_questions--;
  assert.equal(matchRecordedReview(record, bad, db).status, 'INVALID_REPORT');
});

test('question IDs must match the actual completed inventory, with no duplicate or missing question', () => {
  const altered = { ...record, question_ids: [...record.question_ids.slice(1), 'nomex/prevention'] };
  assert.equal(matchRecordedReview(altered, report, db).status, 'QUESTION_MISMATCH');
  assert.equal(matchRecordedReview({ ...record, question_ids: record.question_ids.slice(1) }, report, db).status, 'QUESTION_MISMATCH');
  assert.equal(matchRecordedReview({ ...record, question_ids: [...record.question_ids, record.question_ids[0]] }, report, db).status, 'INVALID_RECORD');
});

test('missing citations fail closed; optional db resolves global IDs without pretending they are material matches', () => {
  const invalid = { ...record, cited_ids: [...record.cited_ids, 'DOES-NOT-EXIST'] };
  const missing = matchRecordedReview(invalid, report, db);
  assert.equal(missing.status, 'SOURCE_MISSING'); assert.deepEqual(missing.missing_ids, ['DOES-NOT-EXIST']);
  assert.equal(matchRecordedReview(record, report).status, 'SOURCE_MISSING');
  const local = { ...record, cited_ids: ['PSI-25:1', 'PSI-99:2'] };
  assert.equal(matchRecordedReview(local, report).matches, true);
  assert.equal(matchRecordedReview(local, report, { findings: [], tests: [] }).status, 'SOURCE_MISSING');
  assert.equal(matchRecordedReview(record, report, { findings: db.findings, tests: db.tests }).matches, true);
});

test('unsupported schema, duplicate materials, nonnumeric conditions and incomplete record metadata fail closed', () => {
  for (const patch of [{ schema: 'vesta.recorded-model-review/99' }, { tool_calls: 0 }, { tool_calls: 12.5 }, { recorded_at: 'yesterday' },
    { materials: ['pmma', 'pmma', 'silicone'] }, { cited_ids: [] }, { summary: '' }, { collection_digest: 'not-a-digest' },
    { query: { ...record.query, o2: '34' } }, { query: { ...record.query, gclass: 'micro' } }])
    assert.equal(matchRecordedReview({ ...record, ...patch }, report, db).status, 'INVALID_RECORD');
});

test('pure applicability checks have no browser dependency and do not mutate record/report', () => {
  const before = JSON.stringify(record), result = matchRecordedReview(record, report, db);
  assert.equal(result.matches, true); assert.equal(JSON.stringify(record), before);
  assert.equal(typeof document, 'undefined');
  assert.throws(() => createRecordedReviewPanel({ record, db }), /browser document/);
});
