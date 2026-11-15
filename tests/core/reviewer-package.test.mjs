import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createReproduction, recheckReproduction } from '../../web/js/core/reproduction.js';
import { createReviewerPackage, recheckReviewerPackage, reviewerDigest, REVIEWER_SCHEMA } from '../../web/js/core/reviewer-package.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'));
const db = buildIndex(Object.fromEntries(['meta', 'tests', 'findings', 'sources', 'investigations', 'presets', 'engine'].map(n => [n, read(n)])));
const rejected = read('rejected-excerpts'), q = presetPoint(db, 'lunar-base', 'prevention', 'pmma');
const copy = x => structuredClone(x);
const payload = p => ({ schema: p.schema, reproduction: p.reproduction, review_context: p.review_context });

test('review package round-trips actual reproduction, all three rejected sources/reasons, collection and limits', async () => {
  const p = await createReviewerPackage(db, q, rejected);
  assert.equal(p.schema, REVIEWER_SCHEMA);
  assert.deepEqual(p.reproduction, await createReproduction(db, q));
  assert.deepEqual(p.review_context.rejected_excerpts, rejected);
  assert.equal(p.review_context.rejected_excerpts.records.length, 3);
  assert.equal(p.review_context.collection.findings, db.findings.length);
  assert.ok(p.review_context.collection.claims_not_made.length);
  const result = await recheckReviewerPackage(JSON.stringify(p), db, rejected);
  assert.equal(result.status, 'MATCH'); assert.equal(result.matches, true); assert.equal(result.context_matches, true);
  assert.deepEqual(result.current, p.reproduction);
  assert.equal((await recheckReproduction(p.reproduction, db)).status, 'MATCH');
  assert.equal((await recheckReproduction(p.reproduction.receipt, db)).status, 'MATCH');
});

test('altered auxiliary source, reason, qualifier, collection count or limit cannot inherit receipt verification', async () => {
  const p = await createReviewerPackage(db, q, rejected);
  for (const mutate of [
    x => { x.review_context.rejected_excerpts.records[0].source.url = 'https://example.com/forged'; },
    x => { x.review_context.rejected_excerpts.records[0].why = 'invented'; },
    x => { x.review_context.rejected_excerpts.records[0].context_after = ''; },
    x => { x.review_context.collection.source_table_rows++; },
    x => { x.review_context.collection.limits = ['Certified safe']; }
  ]) {
    const altered = copy(p); mutate(altered);
    assert.equal((await recheckReviewerPackage(altered, db, rejected)).status, 'HASH_MISMATCH');
    altered.integrity.digest = await reviewerDigest(payload(altered));
    const result = await recheckReviewerPackage(altered, db, rejected);
    assert.equal(result.status, 'REVIEW_CONTEXT_CHANGED'); assert.equal(result.matches, false); assert.equal(result.calculation_matches, true);
  }
});

test('query tampering cannot bypass reproduction even if the outer package is rehashed', async () => {
  const p = await createReviewerPackage(db, q, rejected); p.reproduction.receipt.query.oxygen_percent = 99;
  p.integrity.digest = await reviewerDigest(payload(p));
  const result = await recheckReviewerPackage(p, db, rejected);
  assert.equal(result.status, 'HASH_MISMATCH'); assert.equal(result.matches, false);
});

test('unavailable/mismatched rejected metadata fails closed and never silently omits an excerpt', async () => {
  for (const change of [x => x.records.pop(), x => { x.records[0].quote += ' changed'; }, x => { x.records[0].context_after = 'omitted'; }, x => { x.records[0] = x.records[1]; }]) {
    const bad = copy(rejected); change(bad);
    await assert.rejects(createReviewerPackage(db, q, bad), /do not match/);
  }
  const p = await createReviewerPackage(db, q, rejected);
  assert.equal((await recheckReviewerPackage(p, db, null)).status, 'INVALID');
  assert.equal((await recheckReviewerPackage({ ...p, extra: true }, db, rejected)).status, 'INVALID');
});
