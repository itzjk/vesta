import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex } from '../../web/js/core/index.js';
import { decisionLog, run } from '../../web/js/core/officer.js';
import { createDecisionRecord, parseDecisionRecord, recheckDecisionRecord, MAX_RECORD_BYTES } from '../../web/js/core/replay.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw), { frames, meta } = db.scenario;
const copy = x => structuredClone(x);

test('portable log preserves all decisions, exact inputs, method, coverage, ranking and sources', async () => {
  const r = await createDecisionRecord(frames, db, meta);
  assert.equal(r.schema, 'vesta.decision-log/2');
  assert.deepEqual(r.steps, run(frames, db, meta));
  assert.deepEqual(r.input, { frames, meta });
  assert.deepEqual(r.method.playbook, db.playbook);
  assert.deepEqual(r.method.rules, db.rules);
  assert.equal(r.method.weights.atmosphere, 25);
  assert.equal(r.method.tolerances.pressure_kpa, 5);
  assert.match(r.scope, /no live language model/);
  assert.match(r.scope, /not independent scientific validation/);
  assert.equal(r.evidence.length, 8);
  const x3 = r.evidence.find(e => e.step === 'X3');
  assert.deepEqual(x3.frame, frames.find(f => f.t === 20));
  assert.ok(x3.findings.some(f => f.id === 'FX-EARTH'));
  assert.ok(x3.ranked_findings.every(f => f.parts && f.terms && f.match));
  assert.deepEqual(r.evidence.find(e => e.step === 'X8').rows[0].row, db.testById['FX-PSI-1:2']);
});

test('JSON export and reload matches, and the collection inside the file alone rebuilds the same decisions', async () => {
  const r = await createDecisionRecord(frames, db, meta);
  const checked = await recheckDecisionRecord(JSON.stringify(r), db);
  assert.equal(checked.status, 'MATCH'); assert.equal(checked.matches, true);
  assert.deepEqual(checked.replay.steps, r.steps);
  const offline = buildIndex({ ...r.collection, ...r.method });
  assert.deepEqual(run(r.input.frames, offline, r.input.meta), r.steps);
  assert.deepEqual(await createDecisionRecord(frames, db, meta), r);
});

test('changed playbook threshold, ranking weight or method version reports METHOD_CHANGED', async () => {
  const r = await createDecisionRecord(frames, db, meta);
  for (const change of [x => { x.method.playbook.steps[0].when[0][2] = 999999; }, x => { x.method.weights.atmosphere = 2; }, x => { x.method.id = 'future/3'; }]) {
    const altered = copy(r); change(altered);
    const checked = await recheckDecisionRecord(altered, db);
    assert.equal(checked.status, 'METHOD_CHANGED'); assert.ok(checked.changed.includes('method')); assert.equal(checked.matches, false);
  }
  const changed = copy(raw); changed.rules.rules[0].vesta_decides = 'Changed rule action.';
  assert.equal((await recheckDecisionRecord(r, buildIndex(changed))).status, 'METHOD_CHANGED');
});

test('changed loaded collection reports BASIS_CHANGED even when no decision used the changed record', async () => {
  const r = await createDecisionRecord(frames, db, meta), changed = copy(raw);
  changed.findings.findings.push({ ...copy(db.findings[0]), id: 'UNUSED-SOURCE' });
  const checked = await recheckDecisionRecord(r, buildIndex(changed));
  assert.equal(checked.status, 'BASIS_CHANGED'); assert.ok(checked.changed.includes('basis'));
});

test('altered action, state, source, coverage reason or clock reports RESULT_CHANGED', async () => {
  const r = await createDecisionRecord(frames, db, meta);
  for (const change of [x => { x.steps[0].action = 'Tampered action'; }, x => { x.steps[0].state = 'NO_SOURCE'; },
    x => { x.evidence[0].findings[0].source.url = 'https://example.invalid'; },
    x => { x.steps[0].coverage.reasons = []; }, x => { x.clock.heard = 2; }, x => { x.scope = 'Altered scope'; }, x => { x.evidence[0].ranked_findings[0].total = 100; }]) {
    const altered = copy(r); change(altered);
    assert.equal((await recheckDecisionRecord(altered, db)).status, 'RESULT_CHANGED');
  }
});

test('altered embedded collection is rejected before replay; changed sources in loaded collection are identified', async () => {
  const r = await createDecisionRecord(frames, db, meta), altered = copy(r);
  altered.collection.findings[0].claim = 'Altered evidence';
  const checked = await recheckDecisionRecord(altered, db);
  assert.equal(checked.status, 'INVALID'); assert.match(checked.message, /fingerprint/);
  const changed = copy(raw); changed.findings.findings[0].source.url = 'https://example.invalid';
  assert.equal((await recheckDecisionRecord(r, buildIndex(changed))).status, 'BASIS_CHANGED');
});

test('invalid, incomplete, oversized, unordered and unsafe predicate files are rejected without throwing', async () => {
  const r = await createDecisionRecord(frames, db, meta);
  for (const input of ['{broken', 'null', '{}', JSON.stringify(frames[0]), ' '.repeat(MAX_RECORD_BYTES + 1)]) {
    assert.equal((await recheckDecisionRecord(input, db)).status, 'INVALID');
  }
  for (const change of [x => { delete x.input; }, x => { delete x.method.weights; }, x => { x.input.frames[0].t = 999; },
    x => { x.input.frames[0].fans_on = 'yes'; }, x => { x.method.playbook.steps[0].when[0][1] = 'constructor'; },
    x => { x.evidence.pop(); }, x => { x.evidence[0] = {}; }, x => { x.basis.digest = 'bad'; },
    x => { x.collection.tests.push(copy(x.collection.tests[0])); }]) {
    const altered = copy(r); change(altered);
    assert.equal((await recheckDecisionRecord(altered, db)).status, 'INVALID');
  }
});

test('legacy /1 remains readable with an explicit non-reproducible warning', async () => {
  const legacy = decisionLog(frames, db, meta);
  assert.deepEqual(parseDecisionRecord(legacy), legacy);
  const checked = await recheckDecisionRecord(legacy, db);
  assert.equal(checked.status, 'LEGACY'); assert.equal(checked.matches, false);
  assert.match(checked.message, /no saved inputs, method or collection/);
  assert.deepEqual(checked.saved.steps, legacy.steps);
});

test('telemetry with no fired rule remains reproducible and preserves unknown cabin measurements', async () => {
  const empty = [{ schema: 'vesta.telemetry/1', t: -100 }];
  const record = await createDecisionRecord(empty, db, meta);
  assert.equal(record.steps.length, 0); assert.equal(record.cabin.o2_percent, null);
  assert.equal((await recheckDecisionRecord(record, db)).status, 'MATCH');
});

test('two different frames at the same timestamp retain the exact frame that triggered each decision', async () => {
  const duplicateTime = frames.map(f => ({ ...f, t: 0 }));
  const record = await createDecisionRecord(duplicateTime, db, meta);
  const evidence = record.evidence.find(e => e.step === 'X3');
  assert.notDeepEqual(evidence.frame, duplicateTime[0]);
  assert.deepEqual(evidence.frame, duplicateTime[3]);
  assert.equal((await recheckDecisionRecord(record, db)).status, 'MATCH');
});

test('source order is retained for the original officer output; collection digest is independent of ordering', async () => {
  const source = copy(raw); source.findings.findings.reverse(); source.tests.tests.reverse();
  const reversed = buildIndex(source), record = await createDecisionRecord(frames, reversed, meta);
  assert.deepEqual(record.steps, run(frames, reversed, meta));
  assert.deepEqual(record.collection.findings, reversed.findings);
  assert.deepEqual(record.basis, (await createDecisionRecord(frames, db, meta)).basis);
  assert.equal((await recheckDecisionRecord(record, reversed)).status, 'MATCH');
});

test('own telemetry keeps its file simulation labels without changing the scenario metadata', async () => {
  const own = frames.map(f => ({ ...f, simulated: false }));
  const record = await createDecisionRecord(own, db, meta);
  assert.equal(record.simulated, false);
  assert.deepEqual(record.input.meta, meta);
  assert.deepEqual(record.steps, run(own, db, meta));
  assert.equal((await recheckDecisionRecord(record, db)).status, 'MATCH');
});
