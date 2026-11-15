// Presentation only: the host validates approval, current inputs and report export.
const STATES = Object.freeze({
  ready: 'Awaiting approval · stage this virtual kit for crew review', approved: 'Approved · ready to move',
  approach: 'Approaching the kit', retrieve: 'Collecting the virtual kit',
  carry: 'Carrying the virtual kit', place: 'Placing the virtual kit',
  handoff: 'Preparing the crew handoff', complete: 'Review package ready · virtual kit staged',
  cancelled: 'Cancelled · approval cleared'
});
const EVIDENCE = Object.freeze({
  PROVEN: 'Nearby evidence', EXTRAPOLATED: 'Other or incomplete conditions',
  NEVER_TESTED: 'No source in this collection'
});
const RUNNING = new Set(['approved', 'approach', 'retrieve', 'carry', 'place', 'handoff']);
const PHASE_STEP = Object.freeze({ approach: 1, retrieve: 2, carry: 3, place: 4, handoff: 5 });
const node = (tag, text = '', cls = '') => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (cls) element.className = cls;
  return element;
};
const text = (element, value) => {
  const next = String(value ?? '');
  if (element.textContent !== next) element.textContent = next;
};
const sourceIds = values => Array.isArray(values)
  ? [...new Set(values.filter(value => typeof value === 'string' && value.trim()))] : [];
const titleCase = value => typeof value === 'string' && value
  ? value[0].toUpperCase() + value.slice(1) : 'Question unavailable';

function ensureStyles() {
  if (document.querySelector('link[data-kit-mission-styles]')) return;
  const sheet = node('link'); sheet.rel = 'stylesheet';
  sheet.href = new URL('../../css/kit-mission.css?v=review-workbench-20261115-1', import.meta.url).href;
  sheet.dataset.kitMissionStyles = ''; document.head.append(sheet);
}

/**
 * update receives createKitMission().snapshot() unchanged; null hides the strip.
 * Action callbacks receive that current snapshot. onEvidence receives
 * { material, concern, questionId }, then the snapshot. No action runs on update.
 */
export function createKitMissionPanel({ onApprove, onCancel, onReset, onDownload, onEvidence } = {}) {
  ensureStyles();
  let current = null, disposed = false, lastSignature = null, callbackError = '';
  const cleanups = [];
  const motionPreference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const element = node('section', '', 'kit-mission-strip');
  element.setAttribute('aria-label', 'Evidence-linked virtual task'); element.hidden = true;
  const eyebrow = node('p', 'EVIDENCE-LINKED ROBOTICS', 'kit-mission-eyebrow');
  const heading = node('h3', '', 'kit-mission-title');
  const evidence = node('p', '', 'kit-mission-evidence');
  const task = node('p', '', 'kit-mission-phase');
  task.setAttribute('role', 'status'); task.setAttribute('aria-live', 'polite'); task.setAttribute('aria-atomic', 'true');
  const purpose = node('p', '', 'kit-mission-purpose');
  const coverage = node('p', '', 'kit-mission-coverage');
  const details = node('details', '', 'kit-mission-details');
  const summary = node('summary', 'Review request & sources');
  const conditions = node('p', '', 'kit-mission-conditions');
  const reason = node('p', '', 'kit-mission-request');
  const nextStep = node('p');
  const count = node('p', '', 'kit-mission-source-count');
  const rows = node('p', '', 'kit-mission-source-ids');
  const findings = node('p', '', 'kit-mission-source-ids');
  const error = node('p', '', 'kit-mission-error'); error.hidden = true;
  error.setAttribute('role', 'alert');
  const motionNote = node('p', '', 'kit-mission-motion-note'); motionNote.hidden = true;
  const actions = node('div', '', 'kit-mission-actions');
  const hasPlan = () => !disposed && current?.schema === 'vesta.virtual-kit-state/1'
    && current.plan?.schema === 'vesta.virtual-kit-plan/1';
  const canApprove = () => hasPlan() && current.plan_valid === true && current.phase === 'ready'
    && current.approval?.granted === false && typeof onApprove === 'function';
  const canDownload = () => hasPlan() && current.plan_valid === true && current.phase === 'complete'
    && current.approval?.granted === true && current.successful_staging === true
    && current.virtual_object_state === 'staged' && typeof onDownload === 'function';
  function call(callback, ...args) {
    const savedSignature = current?.plan?.input_signature, savedPhase = current?.phase;
    const failed = failure => {
      if (disposed || current?.plan?.input_signature !== savedSignature || current?.phase !== savedPhase) return;
      callbackError = failure instanceof Error ? failure.message : 'The action could not be completed.';
      showMessage();
    };
    try {
      const result = callback(...args);
      if (result && typeof result.then === 'function') result.catch(failed);
    } catch (failure) { failed(failure); }
  }
  const button = (label, id, action, parent = actions) => {
    const b = node('button', label); b.type = 'button'; b.dataset.kitAction = id;
    b.addEventListener('click', action); cleanups.push(() => b.removeEventListener('click', action));
    parent.append(b); return b;
  };
  const source = button('Open source comparison', 'evidence', () => {
    if (!hasPlan() || current.plan_valid !== true || typeof onEvidence !== 'function') return;
    call(onEvidence, { material: current.plan.material_id, concern: current.plan.concern,
      questionId: current.plan.question_id }, current);
  });
  details.prepend(summary, evidence, coverage, purpose, conditions, reason, nextStep, count, rows, findings);
  const approve = button('Approve & run animation', 'approve', () => {
    if (canApprove()) call(onApprove, current);
  }); approve.className = 'kit-mission-primary';
  const cancel = button('Cancel task', 'cancel', () => {
    if (hasPlan() && RUNNING.has(current.phase) && typeof onCancel === 'function') call(onCancel, current);
  });
  // Put the deliberate approval/cancel action before secondary source controls.
  // Source comparisons remain available without occupying the first task view.
  actions.insertBefore(approve,source);actions.insertBefore(cancel,source);
  const download = button('Save handoff package', 'download', () => {
    if (canDownload()) call(onDownload, current);
  });
  download.title = 'Selected-question handoff plus the full inventory evidence report.';
  const reset = button('Prepare replay', 'reset', () => {
    if (hasPlan() && !RUNNING.has(current.phase) && typeof onReset === 'function') {
      details.open = false;
      call(onReset, current);
      if (canApprove()) approve.focus();
    }
  });
  reset.title = 'Reset this task, then approve it again before any movement.';
  actions.insertBefore(reset, download);
  const scope = node('p', 'Simulated task · evidence unchanged.', 'kit-mission-scope');
  const fullScope = node('p', '', 'kit-mission-source-ids');details.append(fullScope);
  element.append(eyebrow, heading, task, actions, scope, motionNote, error, details);

  function showMessage() {
    const message = callbackError || current?.revoked_reason || current?.last_rejection || '';
    text(error, message); error.hidden = !message;
  }
  function update(snapshot) {
    if (disposed) return;
    const focused = document.activeElement;
    if (snapshot?.plan?.input_signature !== current?.plan?.input_signature || snapshot?.phase !== current?.phase) callbackError = '';
    current = snapshot || null;
    element.hidden = !hasPlan();
    if (!hasPlan()) { lastSignature = null; return; }
    const plan = current.plan;
    // The signature covers the saved question, source associations and request.
    // Tick updates preserve every button, disclosure and source node.
    if (plan.input_signature !== lastSignature) {
      lastSignature = plan.input_signature;
      text(heading, `${plan.material || titleCase(plan.material_id)} · ${titleCase(plan.concern)}`);
      text(evidence, `Evidence · ${plan.evidence_label || EVIDENCE[plan.evidence_status] || 'Status unavailable'}`);
      text(conditions, `Saved cabin: ${plan.query?.o2 ?? 'unavailable'}% oxygen · ${plan.query?.p ?? 'unavailable'} kPa · gravity: ${plan.query?.g ?? 'unavailable'}.`);
      text(reason, plan.request?.reason || 'Review request unavailable.');
      text(nextStep, plan.request?.next_step || ''); nextStep.hidden = !plan.request?.next_step;
      const rowIds = sourceIds(plan.source_ids?.rows), findingIds = sourceIds(plan.source_ids?.findings);
      const totalRows = Number.isInteger(plan.evidence_cell?.rows) ? plan.evidence_cell.rows : null;
      const nearbyRows = sourceIds(plan.source_ids?.nearby_rows).length;
      text(coverage, `${totalRows == null ? 'Unknown number of' : totalRows} indexed rows · ${nearbyRows} nearby`);
      const difference = plan.request?.condition_differences?.find(item => item.record_id && item.detail);
      text(purpose, difference
        ? `${difference.record_kind === 'finding' ? 'Finding' : 'Row'} ${difference.record_id}\n${difference.detail.replace(/^Row: /, 'Source: ')}`
        : plan.evidence_status === 'NEVER_TESTED'
          ? 'No row or finding answers this question in the loaded collection. The request is to locate an attributable source.'
          : 'Review the source assumptions and the variables outside matching: airflow, geometry, thickness, ignition and suppressant.');
      text(summary, 'Evidence & review request');
      text(count, `Selected for inspection: ${rowIds.length} source ${rowIds.length === 1 ? 'row' : 'rows'} · ${findingIds.length} ${findingIds.length === 1 ? 'finding' : 'findings'}. Up to three of each; not the entire evidence set.`);
      text(rows, rowIds.length ? `Row IDs: ${rowIds.join(', ')}` : 'No source row linked.');
      text(findings, findingIds.length ? `Finding IDs: ${findingIds.join(', ')}` : 'No finding linked.');
      text(fullScope, plan.scope || 'Illustrative virtual task. No hardware control, sensor measurements or physical tests.');
    }
    const valid = current.plan_valid === true, running = RUNNING.has(current.phase);
    const staged = valid && current.phase === 'complete' && current.approval?.granted === true
      && current.successful_staging === true && current.virtual_object_state === 'staged';
    const phaseLabel = !valid && current.phase === 'ready' ? 'New plan and approval required'
      : current.phase === 'complete' && !staged ? 'Completion unavailable'
      : STATES[current.phase] || 'Stage unavailable';
    const step = PHASE_STEP[current.phase];
    text(task, step ? `${step}/5 · ${phaseLabel}` : phaseLabel);
    element.dataset.kitPhase = current.phase;
    const reduced = motionPreference?.matches || current.motion_mode === 'reduced-motion-poses';
    text(approve, reduced ? 'Approve & show final pose' : 'Approve & run animation');
    text(motionNote, motionPreference?.matches
      ? 'Reduced motion is on. Approval shows the final pose without animation.'
      : 'This run used still poses; no continuous animation was shown.');
    motionNote.hidden = !reduced;
    approve.hidden = current.phase !== 'ready'; approve.disabled = !canApprove();
    cancel.hidden = !running; cancel.disabled = !valid || typeof onCancel !== 'function';
    download.hidden = current.phase !== 'complete'; download.disabled = !canDownload();
    reset.hidden = running || (valid && current.phase === 'ready'); reset.disabled = typeof onReset !== 'function';
    text(reset, staged ? 'Prepare replay' : 'Prepare new task');
    reset.classList.remove('kit-mission-primary');
    source.classList.toggle('kit-mission-primary', staged);
    source.disabled = !valid || typeof onEvidence !== 'function';
    showMessage();
    // Keep keyboard focus on a usable control when a deliberate action changes phase.
    if ([approve, cancel, reset].includes(focused) && focused.hidden) {
      const nextControl = [approve, cancel, source, reset, download].find(control => !control.hidden && !control.disabled);
      nextControl?.focus({ preventScroll: true });
    }
  }
  const preferenceChanged = () => { if (current) update(current); };
  motionPreference?.addEventListener?.('change', preferenceChanged);
  cleanups.push(() => motionPreference?.removeEventListener?.('change', preferenceChanged));
  return { element, update, dispose() {
    if (disposed) return;
    disposed = true; cleanups.splice(0).forEach(remove => remove()); current = null; element.remove();
  } };
}
