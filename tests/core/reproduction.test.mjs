import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createReceipt, recheckReceipt } from '../../web/js/core/receipt.js';
import { createReproduction, recheckReproduction, resultDigest, REPRODUCTION_SCHEMA, MAX_REPRODUCTION_BYTES } from '../../web/js/core/reproduction.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
db.meta = { ...db.meta, generated_at: '2026-11-14T21:01:46-05:00', built_display: '2026-11-14 21:01 EST' };
const q = presetPoint(db, 'station', 'prevention', 'fx-alpha');
const copy = value => structuredClone(value);

test('reproduction exports unchanged receipt /1 and reproduces identical fingerprints after JSON reload', async () => {
  const bundle = await createReproduction(db, q);
  assert.equal(bundle.schema, REPRODUCTION_SCHEMA);
  assert.deepEqual(bundle.receipt, await createReceipt(db, q));
  assert.deepEqual(await createReproduction(db, q), bundle);
  const result = await recheckReproduction(JSON.stringify(bundle), db);
  assert.equal(result.status, 'MATCH');
  assert.equal(result.matches, true);
  assert.equal(result.calculation_matches, true);
  assert.equal(result.saved_digest, result.current_digest);
  assert.deepEqual(result.current, bundle);
  assert.notEqual(bundle.integrity.digest, bundle.receipt.basis.digest);
});

test('canonical result digest ignores JSON object key order, preserves array order and includes query', async () => {
  const r = await createReceipt(db, q);
  const reordered = Object.fromEntries(Object.entries(r).reverse());
  reordered.query = Object.fromEntries(Object.entries(r.query).reverse());
  assert.equal(await resultDigest(reordered), await resultDigest(r));
  const differentInput = await createReceipt(db, { ...q, o2: 40 });
  assert.notEqual(await resultDigest(differentInput), await resultDigest(r));
  assert.equal(differentInput.basis.digest, r.basis.digest);
  const arrayOrder = copy(r);
  assert.ok(arrayOrder.result.cells.length > 1);
  arrayOrder.result.cells.reverse();
  assert.notEqual(await resultDigest(arrayOrder), await resultDigest(r));
});

test('changing file inputs, result, evidence, method or basis without changing digest is rejected', async () => {
  const original = await createReproduction(db, q);
  const changes = [
    r => { r.query.oxygen_percent = 40; },
    r => { r.result.coverage.PROVEN += 1; },
    r => { r.evidence.rows[0].row.fuel = 'Altered source'; },
    r => { r.method.tolerances.pressure_kpa = 50; },
    r => { r.basis.findings += 1; }
  ];
  for (const change of changes) {
    const altered = copy(original); change(altered.receipt);
    const result = await recheckReproduction(altered, db);
    assert.equal(result.status, 'HASH_MISMATCH');
    assert.equal(result.matches, false);
    assert.equal(result.current, undefined);
  }
});

test('a self-consistent file hash does not bypass recomputation of evidence, inputs, method or basis', async () => {
  const original = await createReproduction(db, q);
  const changes = [
    ['RESULT_CHANGED', r => { r.result.coverage.PROVEN += 1; }],
    ['RESULT_CHANGED', r => { r.evidence.rows.pop(); }],
    ['RESULT_CHANGED', r => { r.query.oxygen_percent = 40; }],
    ['METHOD_CHANGED', r => { r.method.tolerances.pressure_kpa = 50; }],
    ['BASIS_CHANGED', r => { r.basis.findings += 1; }]
  ];
  for (const [expected, change] of changes) {
    const altered = copy(original); change(altered.receipt);
    altered.integrity.digest = await resultDigest(altered.receipt);
    const result = await recheckReproduction(altered, db);
    assert.equal(result.status, expected);
    assert.equal(result.matches, false);
    assert.notEqual(result.saved_digest, result.current_digest);
  }
});

test('a changed loaded collection cannot pass even when its counts stay the same', async () => {
  const saved = await createReproduction(db, q);
  const changed = copy(raw);
  const rows = Array.isArray(changed.tests) ? changed.tests : changed.tests.tests ?? changed.tests.rows;
  rows[0].n.o2 = 90;
  const changedDb = buildIndex(changed); changedDb.meta = db.meta;
  const result = await recheckReproduction(saved, changedDb);
  assert.equal(result.status, 'BASIS_CHANGED');
  assert.equal(result.matches, false);
  assert.equal(result.current.receipt.basis.source_table_rows, saved.receipt.basis.source_table_rows);
  assert.notEqual(result.current.receipt.basis.digest, saved.receipt.basis.digest);
});

test('build metadata is explicitly compared but cannot change the stable result digest', async () => {
  const original = await createReproduction(db, q);
  const rebuilt = { ...db, meta: { generated_at: '2026-11-15T12:00:00Z', built_display: '2026-11-15 12:00 UTC' } };
  const newer = await createReproduction(rebuilt, q);
  assert.equal(newer.integrity.digest, original.integrity.digest);
  const result = await recheckReproduction(original, rebuilt);
  assert.equal(result.status, 'BUILD_CHANGED');
  assert.equal(result.matches, false);
  assert.equal(result.calculation_matches, true);
  assert.deepEqual(result.changed, ['collection_build']);
  assert.equal(result.saved_digest, result.current_digest);
  const altered = copy(original); altered.collection_build.display = 'Forged build label';
  assert.equal((await recheckReproduction(altered, db)).status, 'BUILD_CHANGED');
});

test('legacy receipt remains byte-structure compatible and can still be rechecked by both readers', async () => {
  const legacy = await createReceipt(db, q), serialized = JSON.stringify(legacy);
  const oldResult = await recheckReceipt(serialized, db);
  const result = await recheckReproduction(serialized, db);
  assert.equal(result.status, oldResult.status);
  assert.equal(result.matches, true);
  assert.equal(result.legacy, true);
  assert.equal(result.build_matches, null);
  assert.equal(result.saved_build, null);
  assert.deepEqual(result.current.receipt, legacy);
  assert.equal(JSON.stringify(legacy), serialized);
});

test('unsupported envelope shape, canonicalization, build metadata, hash and oversized files are rejected', async () => {
  const original = await createReproduction(db, q);
  const bad = [null, '{broken', 'x'.repeat(MAX_REPRODUCTION_BYTES + 1),
    { ...original, schema: 'vesta.reproduction/99' }, { ...original, certified: true }];
  for (const [section, field, value] of [
    ['integrity', 'scope', 'result only'], ['integrity', 'canonicalization', 'another-format'],
    ['integrity', 'digest', [original.integrity.digest]], ['integrity', 'extra', 'ignored?'],
    ['collection_build', 'display', 123], ['collection_build', 'extra', 'ignored?']
  ]) { const altered = copy(original); altered[section][field] = value; bad.push(altered); }
  for (const file of bad) {
    const result = await recheckReproduction(file, db);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.matches, false);
  }
});

test('unknown inputs stay null and unreported collection build stays unknown', async () => {
  const bundle = await createReproduction({ ...db, meta: null }, { ...q, o2: null, p: null, g: null, gclass: null });
  assert.deepEqual(bundle.collection_build, { generated_at: null, display: null });
  assert.equal(bundle.receipt.query.oxygen_percent, null);
  assert.equal(bundle.receipt.query.pressure_kpa, null);
  assert.equal((await recheckReproduction(bundle, { ...db, meta: null })).status, 'MATCH');
});

test('actual station and Moon collection exports preserve their distinct coverage and source evidence', async () => {
  const names = ['meta', 'tests', 'findings', 'investigations', 'presets'];
  const real = buildIndex(Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))])));
  for (const [preset, expected] of [['station', { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21 }], ['lunar-base', { PROVEN: 0, EXTRAPOLATED: 24, NEVER_TESTED: 21 }]]) {
    const bundle = await createReproduction(real, presetPoint(real, preset, 'prevention', 'pmma'));
    assert.deepEqual(bundle.receipt.result.coverage, expected);
    assert.equal(bundle.receipt.result.cells.length, 45);
    assert.equal(bundle.receipt.basis.source_table_rows, 1989);
    assert.equal(bundle.collection_build.generated_at, real.meta.generated_at);
    assert.ok(bundle.receipt.evidence.rows.every(row => /^https:\/\//.test(row.source_url)));
    const result = await recheckReproduction(JSON.stringify(bundle), real);
    assert.equal(result.status, 'MATCH');
    assert.equal(result.saved_digest, result.current_digest);
  }
});
