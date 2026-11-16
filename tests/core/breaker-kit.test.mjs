// Adversarial tests for the virtual kit state machine (web/js/world/kit-mission.js).
// The question throughout: can an approval outlive the cabin, inventory or evidence it was given for?
// Tests marked { todo: ... } FAIL TODAY on a confirmed defect; node:test reports them without failing the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createInventoryReviewSession } from '../../web/js/core/inventory-review.js';
import { KIT_TIMING, KIT_PHASES, proposeKitMission, kitInputSignature, createKitMission, advanceKitMission, kitMissionReport } from '../../web/js/world/kit-mission.js';

const raw = Object.fromEntries(['meta', 'tests', 'findings', 'investigations', 'presets'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw), MATERIALS = ['pmma', 'kapton', 'silicone'];
const review = query => createInventoryReviewSession({ db, query, materials: MATERIALS, yieldTurn: () => Promise.resolve() }).run();
const reports = Object.fromEntries(await Promise.all(db.presets.map(async p => [p.id, await review(presetPoint(db, p.id))])));
const report = reports['lunar-base'], QID = 'pmma/prevention';
const plan = proposeKitMission(report, QID), sig = plan.input_signature;
const total = Object.values(KIT_TIMING).reduce((a, b) => a + b, 0);

// Drive a fresh mission to a named phase using only legitimate events.
function at(phase, p = plan) {
  const m = createKitMission(p), s = p.input_signature;
  if (phase === 'ready') return m;
  m.advance({ type: 'approve', inputSignature: s });
  if (phase === 'approved') return m;
  m.advance({ type: 'tick', dt: 0, inputSignature: s });
  for (const name of KIT_PHASES.slice(2)) { if (m.snapshot().phase === phase) break; m.advance({ type: 'tick', dt: KIT_TIMING[name], inputSignature: s }); }
  assert.equal(m.snapshot().phase, phase);
  return m;
}
const revoked = s => { assert.equal(s.phase, 'cancelled'); assert.equal(s.approval.granted, false); assert.equal(s.plan_valid, false);
  assert.equal(s.virtual_object_state, 'docked'); assert.equal(s.successful_staging, false); };

// One changed report per thing that can change under an approval. Each keeps the report self-consistent,
// so the only thing standing between the old approval and the new input is the signature.
const sel = r => r.questions.find(q => q.id === QID);
const CHANGES = {
  oxygen: r => { r.input.query.o2 += 0.1; sel(r).request.requested_conditions.oxygen_percent = r.input.query.o2; },
  'oxygen by the smallest step': r => { r.input.query.o2 += 1e-9; sel(r).request.requested_conditions.oxygen_percent = r.input.query.o2; },
  pressure: r => { r.input.query.p = 101.3; sel(r).request.requested_conditions.pressure_kpa = 101.3; },
  gravity: r => { r.input.query.g = 'mars'; sel(r).request.requested_conditions.gravity = 'mars'; },
  'gravity class': r => { r.input.query.gclass = 'micro'; sel(r).request.requested_conditions.gravity_class = 'micro'; },
  'gravity label': r => { r.input.query.g_label = '3/8 g'; },
  habitat: r => { r.input.query.habitat = 'station'; },
  'inventory grows': r => { r.input.materials.push('nomex'); },
  'collection fingerprint': r => { r.collection.digest = r.collection.digest.replace(/^./, c => c === 'a' ? 'b' : 'a'); },
  'matching tolerance': r => { r.method = structuredClone(r.method); r.method.coverage.tolerances.pressure_kpa += 1; },
  'evidence status': r => { const q = sel(r); q.status = q.cell.status = q.request.status = 'PROVEN'; },
  'nearest row': r => { sel(r).cell.nearest = { ...sel(r).cell.nearest, id: 'PSI-0:0' }; },
  'request wording': r => { sel(r).request.reason = 'No further review needed.'; }
};
const changedSignatures = Object.fromEntries(Object.entries(CHANGES).map(([name, change]) => {
  const r = structuredClone(report); change(r); return [name, kitInputSignature(r, QID)];
}));

test('every changed cabin, inventory, collection, method or evidence field yields a different signature', () => {
  for (const [name, changed] of Object.entries(changedSignatures)) assert.notEqual(changed, sig, name);
  assert.equal(kitInputSignature(structuredClone(report), QID), sig, 'an untouched copy keeps the signature');
  const reordered = structuredClone(report); reordered.input.query = Object.fromEntries(Object.entries(reordered.input.query).reverse());
  assert.equal(kitInputSignature(reordered, QID), sig, 'key order is not a change');
});

test('a changed input revokes the approval from every phase, through every event that carries a signature', () => {
  for (const phase of KIT_PHASES.filter(p => p !== 'ready')) for (const [name, inputSignature] of Object.entries(changedSignatures))
    for (const event of [{ type: 'input_changed' }, { type: 'tick', dt: 0.016 }, { type: 'tick', dt: 0, still: true }, { type: 'approve' }]) {
      const m = at(phase), s = m.advance({ ...event, inputSignature });
      revoked(s);
      assert.match(s.revoked_reason, /changed/, `${phase} / ${name} / ${event.type}`);
      assert.throws(() => m.exportReport(), /Only a completed/);
      // Nothing brings it back: not the original signature, not a fresh approve, not time.
      for (const again of [{ type: 'approve', inputSignature: sig }, { type: 'input_changed', inputSignature: sig }, { type: 'tick', dt: total * 2, inputSignature: sig }]) revoked(m.advance(again));
      assert.throws(() => m.exportReport(), /Only a completed/);
    }
});

test('the signatures of the five mission cabins are pairwise different, so no approval transfers between cabins', () => {
  const byPreset = Object.fromEntries(Object.entries(reports).map(([id, r]) => [id, kitInputSignature(r, QID)]));
  assert.equal(new Set(Object.values(byPreset)).size, db.presets.length);
  for (const [id, other] of Object.entries(byPreset)) {
    if (id === 'lunar-base') continue;
    const m = at('carry'); revoked(m.advance({ type: 'input_changed', inputSignature: other }));
    const completed = at('complete'); revoked(completed.advance({ type: 'input_changed', inputSignature: other }));
    assert.throws(() => completed.exportReport(), /Only a completed/);
  }
});

test('an approval for one question cannot move a kit planned for another', () => {
  const ids = report.questions.map(q => q.id), plans = Object.fromEntries(ids.map(id => [id, proposeKitMission(report, id)]));
  assert.equal(new Set(Object.values(plans).map(p => p.input_signature)).size, ids.length);
  for (const id of ids.filter(id => id !== QID)) {
    const m = createKitMission(plans[id]);
    revoked(m.advance({ type: 'approve', inputSignature: sig }));
    assert.equal(m.snapshot().history.some(h => h.event === 'approve'), false);
  }
});

test('without a current signature nothing moves, and without an approve event nothing is ever granted', () => {
  for (const phase of KIT_PHASES.filter(p => !['ready', 'complete'].includes(p))) {
    const m = at(phase), before = m.snapshot();
    for (const inputSignature of [undefined, null, 0, {}, [sig], Symbol.iterator]) {
      const s = m.advance({ type: 'tick', dt: total * 2, inputSignature });
      assert.deepEqual([s.phase, s.elapsed, s.virtual_object_state], [before.phase, before.elapsed, before.virtual_object_state]);
      assert.match(s.last_rejection, /signature is required/);
    }
    revoked(m.advance({ type: 'input_changed' })); // an unverifiable input is treated as changed
  }
  const ready = createKitMission(plan);
  const pretenders = [{ type: 'tick', dt: 1e9, inputSignature: sig }, { type: 'tick', dt: 0, still: true, inputSignature: sig }, { type: 'input_changed', inputSignature: sig },
    { type: 'approved', inputSignature: sig }, { type: 'APPROVE', inputSignature: sig }, { type: 'complete', inputSignature: sig }, { type: ['approve'], inputSignature: sig },
    { inputSignature: sig, approval: { granted: true } }, { type: 'tick', dt: 1, inputSignature: sig, approval: { granted: true }, phase: 'complete' }, {}, 'approve', 7, undefined];
  for (const event of pretenders) {
    const s = ready.advance(event);
    assert.deepEqual([s.phase, s.approval.granted, s.approval.source, s.virtual_object_state, s.successful_staging], ['ready', false, null, 'docked', false]);
  }
  assert.throws(() => ready.exportReport(), /Only a completed/);
});

test('time alone, in any slicing, ends exactly at completion and never past it', () => {
  for (const dt of [1 / 240, 1 / 60, 0.1, 0.37, total / 3, total, total * 1e6, Number.MAX_VALUE]) {
    const m = at('approved'); let guard = 0;
    while (m.snapshot().phase !== 'complete' && guard++ < 1e5) m.advance({ type: 'tick', dt, inputSignature: sig });
    const s = m.snapshot();
    assert.equal(s.phase, 'complete');
    assert.ok(Math.abs(s.elapsed - total) < 1e-6, `dt ${dt}: ${s.elapsed}`);
    assert.deepEqual(s.history.map(h => h.phase), KIT_PHASES);
    assert.equal(m.advance({ type: 'tick', dt: 100, inputSignature: sig }), s, 'a completed mission ignores further time');
  }
  const m = at('approved');
  for (const dt of [-1, -1e-12, NaN, Infinity, -Infinity, '1', null, undefined, [1], {}]) {
    const s = m.advance({ type: 'tick', dt, inputSignature: sig });
    assert.equal(s.phase, 'approved', String(dt)); assert.equal(s.elapsed, 0);
    assert.match(s.last_rejection, /finite nonnegative/);
  }
});

test('snapshots and reports are deep-frozen: no caller can flip an approval or an evidence status in place', () => {
  const m = at('complete'), s = m.snapshot(), out = m.exportReport();
  for (const mutate of [() => { s.approval.granted = false; }, () => { s.phase = 'ready'; }, () => { s.history.push({}); }, () => { s.history[0].event = 'x'; },
    () => { s.plan.evidence_status = 'PROVEN'; }, () => { s.plan.query.o2 = 21; }, () => { out.crew_work_authorized = true; },
    () => { out.human_approval.granted = false; }, () => { out.evidence_cell.status = 'PROVEN'; }, () => { out.source_ids.rows.push('x'); }])
    assert.throws(mutate, TypeError);
  assert.deepEqual([out.crew_review_required, out.crew_work_authorized, out.hardware_connected, out.sensor_measurements, out.physical_test_executed], [true, false, false, null, false]);
  assert.equal(out.evidence_status, report.questions.find(q => q.id === QID).status);
  assert.match(out.scope, /No hardware control, sensor measurement, physical test, autonomous AI decision or safety clearance/);
  assert.doesNotMatch(JSON.stringify([out.label, out.scope, out.signature_scope, out.virtual_object]), /\bsafe\b|validated|certified|proven|autonomously|verified/i);
});

test('staging never changes the evidence it is linked to, for every question of every mission cabin', () => {
  for (const [id, r] of Object.entries(reports)) for (const q of r.questions) {
    const p = proposeKitMission(r, q.id), m = createKitMission(p);
    m.advance({ type: 'approve', inputSignature: p.input_signature });
    m.advance({ type: 'tick', dt: 0, still: true, inputSignature: p.input_signature });
    const out = m.exportReport();
    assert.deepEqual([out.evidence_status, out.evidence_cell.status, out.request.status], [q.status, q.status, q.status], `${id} ${q.id}`);
    assert.deepEqual(out.query, r.input.query);
    assert.deepEqual(out.source_ids.rows, q.sources.rows.map(row => row.id));
    assert.equal(out.animation_elapsed_seconds, 0);
  }
});

test('incomplete or self-contradicting reports cannot be proposed, whatever is missing', () => {
  const broken = {
    'no collection': r => { delete r.collection; }, 'short digest': r => { r.collection.digest = 'abc'; }, 'no cabin': r => { delete r.input.query; },
    'count mismatch': r => { r.counts.completed_questions -= 1; }, 'duplicate question': r => { r.questions.push(structuredClone(sel(r))); r.counts.questions++; r.counts.completed_questions++; },
    'material not in inventory': r => { r.input.materials = r.input.materials.filter(m => m !== 'pmma'); }, 'cell status disagrees': r => { sel(r).cell.status = 'PROVEN'; },
    'cell for another material': r => { sel(r).cell.material = 'kapton'; }, 'no request': r => { delete sel(r).request; }, 'no sources': r => { delete sel(r).sources; },
    'cabin pressure differs from request': r => { r.input.query.p += 1; }, 'cabin gravity differs from request': r => { r.input.query.gclass = 'micro'; }
  };
  for (const [name, change] of Object.entries(broken)) {
    const r = structuredClone(report); change(r);
    assert.throws(() => proposeKitMission(r, QID), Error, name);
    assert.throws(() => kitInputSignature(r, QID), Error, name);
  }
  for (const id of [undefined, null, '', '__proto__', 'pmma', 'pmma/', 'nomex/prevention', 'pmma/prevention ']) assert.throws(() => proposeKitMission(report, id), Error, String(id));
});

// ---------------------------------------------------------------- confirmed defects

test('DEFECT kit: a plan whose evidence status contradicts its own evidence cell cannot be staged and exported', { todo: 'kit-mission.js:71 and :139 accept any object with the plan schema; nothing re-checks status against cell/request' }, () => {
  const tampered = { ...structuredClone(plan), evidence_status: 'PROVEN', evidence_label: 'Nearby evidence' };
  assert.notEqual(tampered.evidence_cell.status, tampered.evidence_status);
  assert.throws(() => {
    const m = createKitMission(tampered);
    m.advance({ type: 'approve', inputSignature: sig }); m.advance({ type: 'tick', dt: 0, still: true, inputSignature: sig });
    return m.exportReport();
  }, Error);
});

test('DEFECT kit: the pure report function refuses a state that no approve event produced', { todo: 'kit-mission.js:139 trusts approval.granted on a hand-built state; history is never consulted' }, () => {
  const forged = { schema: 'vesta.virtual-kit-state/1', plan, phase: 'complete', plan_valid: true, approval: { granted: true, source: null, scope: plan.approval_scope },
    virtual_object_state: 'staged', successful_staging: true, elapsed: 0, motion_mode: 'illustrative-animation', history: [] };
  assert.throws(() => kitMissionReport(forged), Error);
});

test('DEFECT kit: a null event is ignored like any other unknown event instead of throwing a TypeError', { todo: 'kit-mission.js:95 — the default parameter covers undefined only; event.type on null throws' }, () => {
  const state = createKitMission(plan).snapshot();
  assert.equal(advanceKitMission(state, null), state);
});
