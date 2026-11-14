import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createReceipt, parseReceipt, recheckReceipt, receiptQuery, MAX_RECEIPT_BYTES } from '../../web/js/core/receipt.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const q = presetPoint(db, 'station', 'prevention', 'fx-alpha');
const copy = x => structuredClone(x);

test('receipt preserves exact nearby row ids, inferred pressure and source evidence', async () => {
  const r = await createReceipt(db, q);
  assert.equal(r.schema, 'vesta.evidence-receipt/1');
  assert.deepEqual(r.result.selected.hit_ids, ['FX-PSI-1:1', 'FX-PSI-1:3']);
  assert.equal(r.result.selected.qualifier, 'pressure_inferred');
  for (const id of r.result.selected.hit_ids) {
    const evidence = r.evidence.rows.find(row => row.id === id);
    assert.deepEqual(evidence.row, db.testById[id]);
    assert.equal(evidence.pressure_basis, 'inferred');
    assert.deepEqual(evidence.match.fail, []);
  }
  assert.equal(r.method.tolerances.oxygen_percentage_points, 1);
  assert.equal(r.method.tolerances.pressure_kpa, 5);
  assert.match(r.method.scope, /not a safety certification/);
  assert.match(r.method.limits.join(' '), /geometry/);
});

test('receipt JSON round trip reruns the calculation and is deterministic', async () => {
  const r = await createReceipt(db, q);
  assert.deepEqual(await createReceipt(db, q), r);
  const replay = await recheckReceipt(JSON.stringify(r), db);
  assert.equal(replay.status, 'MATCH');
  assert.equal(replay.matches, true);
  assert.deepEqual(replay.changed, []);
  assert.deepEqual(receiptQuery(r.query).o2, q.o2);
});

test('partial gravity keeps extrapolation and an empty matching field', async () => {
  const r = await createReceipt(db, presetPoint(db, 'lunar-base', 'prevention', 'fx-alpha'));
  assert.equal(r.query.gravity, 'moon');
  assert.equal(r.result.coverage.PROVEN, 0);
  assert.deepEqual(r.result.nearby_cabin_row_ids, []);
  assert.equal(r.result.selected.status, 'EXTRAPOLATED');
  assert.ok(r.evidence.rows.some(row => row.id === r.result.selected.nearest.id));
  assert.equal((await recheckReceipt(r, db)).status, 'MATCH');
});

test('missing conditions stay unknown instead of falling back to a favourable preset', async () => {
  const r = await createReceipt(db, { ...q, o2: null, p: null, g: null, gclass: null });
  assert.equal(r.query.oxygen_percent, null);
  assert.equal(r.query.pressure_kpa, null);
  assert.equal(r.result.coverage.PROVEN, 0);
  assert.deepEqual(r.result.nearby_cabin_row_ids, []);
  assert.equal((await recheckReceipt(r, db)).status, 'MATCH');
});

test('saved coverage, row snapshots and removed evidence cannot pass recheck', async () => {
  const r = await createReceipt(db, q);
  const altered = [copy(r), copy(r), copy(r)];
  altered[0].result.coverage.PROVEN += 1;
  altered[1].evidence.rows[0].row.fuel = 'Changed material';
  altered[2].evidence.rows.pop();
  for (const fake of altered) {
    const result = await recheckReceipt(fake, db);
    assert.equal(result.status, 'RESULT_CHANGED');
    assert.equal(result.matches, false);
  }
});

test('changed collection is reported even when aggregate counts stay the same', async () => {
  const r = await createReceipt(db, q);
  const modified = copy(raw);
  const rows = Array.isArray(modified.tests) ? modified.tests : modified.tests.tests ?? modified.tests.rows;
  rows[0].n.o2 = 90;
  const result = await recheckReceipt(r, buildIndex(modified));
  assert.equal(result.status, 'BASIS_CHANGED');
  assert.equal(result.matches, false);
  assert.ok(result.changed.includes('basis'));
  assert.notEqual(result.current.basis.digest, r.basis.digest);
});

test('changed matching policy and removed limits cannot pass recheck', async () => {
  const r = await createReceipt(db, q);
  r.method.tolerances.oxygen_percentage_points = 20;
  r.method.limits = [];
  const result = await recheckReceipt(r, db);
  assert.equal(result.status, 'METHOD_CHANGED');
  assert.equal(result.matches, false);
});

test('bad versions, malformed files, oversized payloads and unexpected sections are rejected', async () => {
  const r = await createReceipt(db, q);
  const unknown = { ...r, schema: 'vesta.evidence-receipt/99' };
  for (const value of ['{broken', null, 'x'.repeat(MAX_RECEIPT_BYTES + 1), unknown, { ...r, certificate: 'safe' }, { ...r, evidence: null }]) {
    assert.equal((await recheckReceipt(value, db)).status, 'INVALID');
  }
  assert.throws(() => parseReceipt({ ...r, result: {} }), /lists/);
});

test('queries are strict: no silent coercion, unit conversion or contradictory gravity', async () => {
  for (const change of [{ o2: '21' }, { o2: 101 }, { p: 0 }, { p: NaN }, { g: 'moon', gclass: 'micro' }, { concern: 'unknown' }]) {
    await assert.rejects(createReceipt(db, { ...q, ...change }));
  }
  const r = await createReceipt(db, q);
  r.query.pressure_psi = 14.7;
  assert.equal((await recheckReceipt(r, db)).status, 'INVALID');
});

test('unlisted material remains an explicit collection gap', async () => {
  const r = await createReceipt(db, { ...q, material: 'unlisted-material' });
  assert.equal(r.result.selected.status, 'NEVER_TESTED');
  assert.deepEqual(r.result.selected.finding_ids, []);
  assert.equal((await recheckReceipt(r, db)).status, 'MATCH');
});

test('real collection: station and Moon receipts recheck with known coverage and live source links', async () => {
  const names = ['meta', 'tests', 'findings', 'investigations', 'presets'];
  const real = buildIndex(Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))])));
  for (const [preset, expected] of [['station', { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21 }], ['lunar-base', { PROVEN: 0, EXTRAPOLATED: 24, NEVER_TESTED: 21 }]]) {
    const r = await createReceipt(real, presetPoint(real, preset, 'prevention', 'pmma'));
    assert.deepEqual(r.result.coverage, expected);
    assert.equal(r.basis.source_table_rows, 1989);
    assert.ok(r.evidence.rows.every(row => /^https:\/\//.test(row.source_url)));
    assert.ok(Buffer.byteLength(JSON.stringify(r)) < MAX_RECEIPT_BYTES);
    assert.equal((await recheckReceipt(r, real)).status, 'MATCH');
  }
});
