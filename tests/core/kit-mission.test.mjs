import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createInventoryReviewSession } from '../../web/js/core/inventory-review.js';
import { KIT_TIMING, KIT_COMPLETE_LABEL, proposeKitMission, kitInputSignature, createKitMission, advanceKitMission } from '../../web/js/world/kit-mission.js';

const raw = Object.fromEntries(['meta', 'tests', 'findings', 'investigations', 'presets'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw), query = presetPoint(db, 'lunar-base');
const report = await createInventoryReviewSession({ db, query, materials: ['pmma', 'kapton', 'silicone'], yieldTurn: () => Promise.resolve() }).run();
const plan = proposeKitMission(report, 'pmma/prevention');
const sig = plan.input_signature;
const seconds = Object.values(KIT_TIMING).reduce((a, b) => a + b, 0);
const tick = (mission, dt, extra = {}) => mission.advance({ type: 'tick', dt, inputSignature: sig, ...extra });

test('proposal retains exact completed question, cabin, collection, source associations and request', () => {
  const q = report.questions.find(q => q.id === 'pmma/prevention');
  assert.equal(plan.evidence_status, 'EXTRAPOLATED');
  assert.deepEqual(plan.query, report.input.query);
  assert.deepEqual(plan.inventory, report.input.materials);
  assert.equal(plan.collection.digest, report.collection.digest);
  assert.deepEqual(plan.source_ids.rows, q.sources.rows.map(r => r.id));
  assert.deepEqual(plan.source_ids.findings, q.sources.findings.map(f => f.id));
  assert.deepEqual(plan.request, q.request);
  assert.ok(Object.isFrozen(plan.request));
  assert.throws(() => { plan.query.o2 = 99; }, TypeError);
  assert.match(plan.signature_scope, /not proof of scientific validity/);
});

test('invalid, partial, wrong-material and cross-associated reports cannot create a plan', () => {
  for (const status of ['idle', 'running', 'cancelled', 'error']) assert.throws(() => proposeKitMission({ ...report, status }, 'pmma/prevention'), /complete/);
  assert.throws(() => proposeKitMission(report, 'nomex/prevention'), /Select exactly/);
  const wrong = structuredClone(report), q = wrong.questions.find(q => q.id === 'pmma/prevention');
  q.request.question_id = 'kapton/detection';
  assert.throws(() => proposeKitMission(wrong, q.id), /own human-review request/);
  q.request.question_id = q.id; q.request.evidence_row_ids = ['PSI-101:1'];
  assert.throws(() => proposeKitMission(wrong, q.id), /different evidence/);
  q.request.evidence_row_ids = q.sources.rows.map(r => r.id); q.request.requested_conditions.oxygen_percent = 99;
  assert.throws(() => proposeKitMission(wrong, q.id), /conditions disagree/);
});

test('clock, large elapsed time and reduced-motion events cannot grant approval', () => {
  const mission = createKitMission(plan), ready = mission.snapshot();
  assert.equal(tick(mission, 100000).phase, 'ready');
  assert.equal(tick(mission, 0, { still: true }).phase, 'ready');
  assert.equal(mission.snapshot().approval.granted, false);
  assert.equal(mission.snapshot().virtual_object_state, 'docked');
  assert.deepEqual(mission.snapshot(), ready);
  assert.throws(() => mission.exportReport(), /Only a completed/);
  assert.equal(mission.advance({ type: 'approve' }).phase, 'ready');
  assert.equal(mission.snapshot().approval.granted, false);
});

test('explicit approval and phase timing produce the exact docked-attached-staged handoffs', () => {
  const mission = createKitMission(plan);
  assert.equal(mission.advance({ type: 'approve', inputSignature: sig }).phase, 'approved');
  assert.equal(mission.snapshot().virtual_object_state, 'docked');
  assert.equal(tick(mission, 0).phase, 'approach');
  assert.equal(tick(mission, KIT_TIMING.approach - 0.01).phase, 'approach');
  assert.equal(tick(mission, 0.01).phase, 'retrieve');
  assert.equal(mission.snapshot().virtual_object_state, 'docked');
  assert.equal(tick(mission, KIT_TIMING.retrieve).phase, 'carry');
  assert.equal(mission.snapshot().virtual_object_state, 'attached');
  assert.equal(tick(mission, KIT_TIMING.carry).phase, 'place');
  assert.equal(mission.snapshot().virtual_object_state, 'attached');
  assert.throws(() => mission.exportReport(), /Only a completed/);
  assert.equal(tick(mission, KIT_TIMING.place).phase, 'handoff');
  assert.equal(mission.snapshot().virtual_object_state, 'staged');
  assert.throws(() => mission.exportReport(), /Only a completed/);
  assert.equal(tick(mission, KIT_TIMING.handoff).phase, 'complete');
  const output = mission.exportReport();
  assert.equal(output.label, KIT_COMPLETE_LABEL);
  assert.equal(output.evidence_status, 'EXTRAPOLATED');
  assert.deepEqual(output.source_ids, plan.source_ids);
  assert.equal(output.hardware_connected, false);
  assert.equal(output.sensor_measurements, null);
  assert.equal(output.physical_test_executed, false);
  assert.equal(output.crew_work_authorized, false);
  assert.equal(output.crew_review_required, true);
});

test('cancel during carrying or after completion revokes staging, and reset requires a new plan', () => {
  for (const complete of [false, true]) {
    const m = createKitMission(plan); m.advance({ type: 'approve', inputSignature: sig });
    tick(m, complete ? seconds + 1 : KIT_TIMING.approach + KIT_TIMING.retrieve);
    const stopped = m.advance({ type: 'cancel', reason: 'User stopped this sequence' });
    assert.equal(stopped.phase, 'cancelled'); assert.equal(stopped.virtual_object_state, 'docked');
    assert.equal(stopped.plan_valid, false); assert.equal(stopped.approval.granted, false);
    assert.equal(stopped.successful_staging, false);
    assert.throws(() => m.exportReport(), /Only a completed/);
    assert.equal(tick(m, 100).phase, 'cancelled');
  }
  const m = createKitMission(plan); m.advance({ type: 'approve', inputSignature: sig }); tick(m, seconds + 1);
  const reset = m.advance({ type: 'reset' });
  assert.equal(reset.phase, 'ready'); assert.equal(reset.plan_valid, false); assert.equal(reset.virtual_object_state, 'docked');
  assert.equal(m.advance({ type: 'approve', inputSignature: sig }).approval.granted, false);
  assert.throws(() => m.exportReport(), /Only a completed/);
});

test('new cabin, inventory, source association or selected question invalidates the approval', () => {
  const changes = [];
  const cabin = structuredClone(report); cabin.input.query.o2 = 35;
  cabin.questions.find(q => q.id === 'pmma/prevention').request.requested_conditions.oxygen_percent = 35;
  changes.push(kitInputSignature(cabin, 'pmma/prevention'));
  const inventory = structuredClone(report); inventory.input.materials.push('nomex');
  changes.push(kitInputSignature(inventory, 'pmma/prevention'));
  const source = structuredClone(report), sq = source.questions.find(q => q.id === 'pmma/prevention');
  sq.sources.rows = sq.sources.rows.slice(1); sq.request.evidence_row_ids = sq.sources.rows.map(r => r.id);
  changes.push(kitInputSignature(source, 'pmma/prevention'));
  changes.push(kitInputSignature(report, 'kapton/detection'));
  for (const inputSignature of changes) {
    const m = createKitMission(plan); m.advance({ type: 'approve', inputSignature: sig });
    const s = m.advance({ type: 'input_changed', inputSignature });
    assert.equal(s.phase, 'cancelled'); assert.equal(s.approval.granted, false); assert.equal(s.virtual_object_state, 'docked');
  }
  const m = createKitMission(plan);
  assert.equal(m.advance({ type: 'approve', inputSignature: 'old' }).phase, 'cancelled');
});

test('reduced motion commits the same virtual object lifecycle only after explicit approval', () => {
  const m = createKitMission(plan); m.advance({ type: 'approve', inputSignature: sig });
  const done = tick(m, 0, { still: true });
  assert.equal(done.phase, 'complete'); assert.equal(done.virtual_object_state, 'staged');
  assert.equal(done.elapsed, 0); assert.equal(done.motion_mode, 'reduced-motion-poses');
  assert.deepEqual(done.history.map(h => h.phase), ['ready', 'approved', 'approach', 'retrieve', 'carry', 'place', 'handoff', 'complete']);
  assert.equal(m.exportReport().successful_virtual_staging, true);
});

test('no-source evidence remains no-source after kit staging, and pure transitions do not mutate their input', () => {
  const p = proposeKitMission(report, 'kapton/prevention'), m = createKitMission(p), ready = m.snapshot();
  const approved = advanceKitMission(ready, { type: 'approve', inputSignature: p.input_signature });
  assert.equal(ready.phase, 'ready'); assert.equal(ready.approval.granted, false);
  assert.equal(approved.phase, 'approved');
  assert.equal(approved.plan, ready.plan); // frame updates share frozen evidence; no full source copy per tick
  m.advance({ type: 'approve', inputSignature: p.input_signature });
  m.advance({ type: 'tick', dt: 100, inputSignature: p.input_signature });
  const output = m.exportReport();
  assert.equal(output.evidence_status, 'NEVER_TESTED');
  assert.deepEqual(output.source_ids.rows, []); assert.deepEqual(output.source_ids.findings, []);
  assert.equal(output.virtual_object.state, 'staged');
  assert.match(output.request.reason, /No row or finding/);
});

test('invalid elapsed values and repeated approval cannot create progress or duplicate approval', () => {
  const m = createKitMission(plan); m.advance({ type: 'approve', inputSignature: sig });
  for (const dt of [-1, Infinity, NaN, '2']) assert.equal(tick(m, dt).phase, 'approved');
  assert.equal(m.snapshot().elapsed, 0);
  m.advance({ type: 'approve', inputSignature: sig });
  assert.equal(m.snapshot().history.filter(h => h.event === 'approve').length, 1);
  assert.equal(tick(m, 0).phase, 'approach');
});
