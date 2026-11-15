// Virtual choreography only. Evidence calculations and physical hardware remain separate.
export const KIT_TIMING = Object.freeze({ approach: 2.4, retrieve: 0.9, carry: 2.6, place: 0.8, handoff: 0.6 });
export const KIT_PHASES = Object.freeze(['ready', 'approved', 'approach', 'retrieve', 'carry', 'place', 'handoff', 'complete']);
export const KIT_COMPLETE_LABEL = 'Virtual kit staged — crew review required';
const MATERIALS = ['pmma', 'kapton', 'silicone'];
const CONCERNS = ['prevention', 'detection', 'suppression'];
const STATUSES = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];
const SCOPE = 'Illustrative virtual kit staging linked to an evidence-review request. No hardware control, sensor measurement, physical test, autonomous AI decision or safety clearance.';
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const copy = value => freeze(clone(value));
const canonicalValue = value => Array.isArray(value) ? value.map(canonicalValue)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonicalValue(value[k])])) : value;
const canonical = value => JSON.stringify(canonicalValue(value));
const same = (a, b) => canonical(a) === canonical(b);
const ids = values => [...values].sort();
const require = (condition, message) => { if (!condition) throw new Error(message); };

function selection(report, questionId) {
  require(report?.schema === 'vesta.inventory-review/1' && report.status === 'complete', 'A complete inventory evidence review is required.');
  require(Array.isArray(report.questions) && report.counts?.questions === report.questions.length
    && report.counts?.completed_questions === report.questions.length && report.questions.length > 0,
  'The report must contain every completed inventory question.');
  require(report.collection?.algorithm === 'SHA-256' && /^[a-f0-9]{64}$/.test(report.collection.digest), 'The collection fingerprint is missing.');
  require(report.input?.query && Array.isArray(report.input.materials), 'The saved cabin and material inventory are required.');
  const matching = report.questions.filter(q => q.id === questionId);
  require(matching.length === 1, 'Select exactly one question from this completed report.');
  const q = matching[0];
  require(MATERIALS.includes(q.material_id) && report.input.materials.includes(q.material_id)
    && CONCERNS.includes(q.concern) && q.id === `${q.material_id}/${q.concern}`, 'The selected question must refer to a linked PMMA, Kapton or silicone component.');
  require(STATUSES.includes(q.status) && q.cell?.status === q.status && q.cell.material === q.material_id && q.cell.concern === q.concern,
    'The selected question and its calculated evidence status disagree.');
  require(q.request?.kind === 'human_review_request' && q.request.question_id === q.id && q.request.status === q.status,
    'The selected question must retain its own human-review request.');
  require(Array.isArray(q.sources?.rows) && Array.isArray(q.sources?.findings)
    && Array.isArray(q.request.evidence_row_ids) && Array.isArray(q.request.evidence_finding_ids), 'Source associations are missing.');
  require(same(ids(q.sources.rows.map(r => r.id)), ids(q.request.evidence_row_ids))
    && same(ids(q.sources.findings.map(f => f.id)), ids(q.request.evidence_finding_ids)), 'The request refers to different evidence records.');
  const cabin = report.input.query, requested = q.request.requested_conditions;
  require(requested && requested.oxygen_percent === cabin.o2 && requested.pressure_kpa === cabin.p
    && requested.gravity === cabin.g && requested.gravity_class === cabin.gclass, 'The request and saved cabin conditions disagree.');
  return q;
}

/** Canonical equality token, not a cryptographic signature or independent report verification. */
export function kitInputSignature(report, questionId) {
  const q = selection(report, questionId);
  return canonical({ schema: 'vesta.virtual-kit-input/1', input: report.input, collection: report.collection,
    method: report.method, question: { id: q.id, material_id: q.material_id, concern: q.concern,
      status: q.status, cell: q.cell, sources: q.sources, comparisons: q.comparisons, request: q.request } });
}

export function proposeKitMission(report, questionId) {
  const q = selection(report, questionId);
  return copy({ schema: 'vesta.virtual-kit-plan/1', id: `virtual-review-kit/${q.id}`, question_id: q.id,
    material_id: q.material_id, material: q.material, concern: q.concern,
    query: report.input.query, inventory: report.input.materials, collection: report.collection,
    evidence_status: q.status, evidence_label: q.label, evidence_cell: q.cell,
    source_ids: { rows: q.sources.rows.map(r => r.id), findings: q.sources.findings.map(f => f.id), nearby_rows: q.cell.hit_ids || [] },
    sources: q.sources, comparisons: q.comparisons, request: q.request,
    input_signature: kitInputSignature(report, questionId), signature_scope: 'Canonical equality token for this saved input, collection, method and selected question; not proof of scientific validity.',
    kit: { id: `virtual-review-kit/${q.material_id}`, kind: 'illustrative review kit', target_material_id: q.material_id,
      purpose: 'Stage a virtual review kit at the crew-review fixture for the linked concept component.' },
    requires_explicit_approval: true, approval_scope: 'This virtual staging sequence only', scope: SCOPE });
}

function initial(plan) {
  require(plan?.schema === 'vesta.virtual-kit-plan/1' && typeof plan.input_signature === 'string', 'A proposed virtual kit plan is required.');
  return copy({ schema: 'vesta.virtual-kit-state/1', plan, phase: 'ready', plan_valid: true,
    approval: { granted: false, source: null, scope: plan.approval_scope },
    virtual_object_state: 'docked', elapsed: 0, phase_elapsed: 0, phase_progress: 0,
    motion_mode: 'illustrative-animation', successful_staging: false, revoked_reason: null, last_rejection: null,
    history: [{ event: 'propose', phase: 'ready', virtual_object_state: 'docked', elapsed: 0 }] });
}
const log = (state, event) => state.history.push({ event, phase: state.phase, virtual_object_state: state.virtual_object_state, elapsed: state.elapsed });
function revoke(state, phase, reason) {
  state.phase = phase; state.plan_valid = false; state.approval.granted = false; state.approval.source = null;
  state.virtual_object_state = 'docked'; state.phase_elapsed = state.phase_progress = 0;
  state.successful_staging = false; state.revoked_reason = reason; state.last_rejection = null;
  log(state, phase === 'ready' ? 'reset' : 'cancel'); return freeze(state);
}
function nextPhase(state) {
  state.phase = KIT_PHASES[KIT_PHASES.indexOf(state.phase) + 1];
  state.phase_elapsed = 0; state.phase_progress = state.phase === 'complete' ? 1 : 0;
  if (state.phase === 'carry') state.virtual_object_state = 'attached';
  if (state.phase === 'handoff' || state.phase === 'complete') state.virtual_object_state = 'staged';
  if (state.phase === 'complete') state.successful_staging = true;
  log(state, 'transition');
}

/** No timers, DOM, renderer or commands. Only the host's explicit approve event grants approval. */
export function advanceKitMission(current, event = {}) {
  require(current?.schema === 'vesta.virtual-kit-state/1', 'A virtual kit state is required.');
  // Keep the immutable evidence plan and existing history records by reference.
  // A render-frame tick must not copy the source quotes or collection payload.
  const state = { ...current, approval: { ...current.approval }, history: [...current.history] };
  if (event.type === 'cancel') return state.phase === 'cancelled' ? current : revoke(state, 'cancelled', String(event.reason || 'Cancelled by user'));
  if (event.type === 'reset') return revoke(state, 'ready', 'Reset: propose a new plan and obtain new approval.');
  if (!['approve', 'tick', 'input_changed'].includes(event.type)) return current;
  if (!state.plan_valid) return current;
  if (typeof event.inputSignature !== 'string') {
    if (event.type === 'input_changed') return revoke(state, 'cancelled', 'The current review input could not be verified.');
    state.last_rejection = 'A current input signature is required.'; return freeze(state);
  }
  if (event.inputSignature !== state.plan.input_signature) return revoke(state, 'cancelled', 'Cabin, inventory, collection or selected evidence question changed.');
  state.last_rejection = null;
  if (event.type === 'input_changed') return freeze(state);
  if (event.type === 'approve') {
    if (state.phase !== 'ready') return current;
    state.phase = 'approved'; state.approval.granted = true; state.approval.source = 'explicit_approve_event';
    log(state, 'approve'); return freeze(state);
  }
  if (!state.approval.granted || state.phase === 'ready' || state.phase === 'complete') return current;
  if (!Number.isFinite(event.dt) || event.dt < 0) {
    state.last_rejection = 'Elapsed time must be a finite nonnegative number of seconds.'; return freeze(state);
  }
  if (event.still === true) state.motion_mode = 'reduced-motion-poses';
  if (state.phase === 'approved') nextPhase(state);
  let remaining = event.dt;
  // At most five finite motion phases. Reduced motion commits the same virtual
  // object handoffs, but records no elapsed animation time and never grants approval.
  for (let n = 0; n < KIT_PHASES.length && state.phase !== 'complete'; n++) {
    const duration = KIT_TIMING[state.phase];
    if (event.still === true) { nextPhase(state); continue; }
    const needed = Math.max(0, duration - state.phase_elapsed), consumed = Math.min(remaining, needed);
    state.phase_elapsed += consumed; state.elapsed += consumed; remaining -= consumed;
    state.phase_progress = Math.min(1, state.phase_elapsed / duration);
    if (state.phase_elapsed + 1e-9 < duration) break;
    nextPhase(state);
    if (remaining <= 0) break;
  }
  return freeze(state);
}

export function kitMissionReport(state) {
  require(state?.schema === 'vesta.virtual-kit-state/1' && state.phase === 'complete' && state.plan_valid
    && state.approval.granted && state.successful_staging && state.virtual_object_state === 'staged',
  'Only a completed, approved and still-current virtual staging can be exported as successful.');
  return copy({ schema: 'vesta.virtual-kit-report/1', label: KIT_COMPLETE_LABEL, scope: SCOPE,
    question_id: state.plan.question_id, material_id: state.plan.material_id, concern: state.plan.concern,
    query: state.plan.query, inventory: state.plan.inventory, collection: state.plan.collection,
    evidence_status: state.plan.evidence_status, evidence_label: state.plan.evidence_label, evidence_cell: state.plan.evidence_cell,
    source_ids: state.plan.source_ids, sources: state.plan.sources, comparisons: state.plan.comparisons, request: state.plan.request,
    input_signature: state.plan.input_signature, signature_scope: state.plan.signature_scope,
    virtual_object: { ...state.plan.kit, state: 'staged' }, motion_mode: state.motion_mode,
    human_approval: state.approval, crew_review_required: true, crew_work_authorized: false,
    hardware_connected: false, sensor_measurements: null, physical_test_executed: false,
    successful_virtual_staging: true, animation_elapsed_seconds: state.elapsed, history: state.history });
}

export function createKitMission(plan) {
  let state = initial(plan);
  return Object.freeze({ advance(event) { state = advanceKitMission(state, event); return state; },
    snapshot() { return state; }, exportReport() { return kitMissionReport(state); } });
}
