import { reviewToMarkdown, reviewToCsv } from '../core/inventory-review.js?v=pressure-basis-20261115-1';
import { createRowComparison } from './row-comparison.js?v=review-workbench-20261115-1';
import { pressureDependence } from '../core/assumption-audit.js';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const disclosure = label => { const d = node('details'), s = node('summary', label); d.append(s); return d; };
const number = value => value == null ? 'unknown' : String(value);
const human = value => String(value ?? '').replaceAll('_', ' ');
const concernName = value => value.charAt(0).toUpperCase() + value.slice(1);
const taskNames = { plan: 'Plan review', check_coverage: 'Check coverage', inspect_sources: 'Inspect sources', compare_conditions: 'Compare conditions',
  draft_request: 'Draft human-review request', complete: 'Review complete', cancel: 'Review cancelled', error: 'Review failed' };
const keyFor = ids => [...ids].sort().join('|');
function ensureStyles() {
  if (document.querySelector('link[data-inventory-review-styles]')) return;
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('../../css/inventory-review.css?v=habitat-20261115-1', import.meta.url).href;
  link.dataset.inventoryReviewStyles = ''; document.head.append(link);
}
function sourceAnchor(label, url) {
  try {
    const href = new URL(url);
    if (!['https:', 'http:'].includes(href.protocol)) return null;
    const a = node('a', label); a.href = href.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  } catch { return null; }
}
function conditionList(query) {
  return `${number(query.o2)}% O2 · ${number(query.p)} kPa · ${query.g ?? 'unknown gravity'}${query.gclass ? ` (${query.gclass})` : ''}`;
}
function appendValue(parent, label, value) {
  const p = node('p'); p.append(node('strong', `${label}: `), document.createTextNode(String(value))); parent.append(p);
}

/** A view only. The host owns sessions, cancellation on cabin changes and actual downloads. */
export function createInventoryReviewPanel({ db, onRun, onCancel, onReset, onEvidence, onDownload, onMaterialsChange, onFocus }) {
  ensureStyles();
  let disposed = false, report = null, runKey = null, selectionTouched = false;
  const cleanups = [], cards = new Map(), traceNodes = new Map();
  const listen = (target, type, fn, removals = cleanups) => { target.addEventListener(type, fn); removals.push(() => target.removeEventListener(type, fn)); };
  const element = node('section', null, 'inventory-review'); element.setAttribute('aria-label', 'Cabin inventory evidence review');
  const heading = node('h2', 'Cabin evidence review');
  const intro = node('p', 'Review material evidence and draft source-linked requests for human review.', 'inventory-intro');
  const scope = node('p', 'Deterministic analysis · simulated robot', 'inventory-scope');
  const methodLimits = disclosure('Method & limits'); methodLimits.className = 'inventory-method-limits';
  methodLimits.append(node('p', 'This is a deterministic evidence workflow, with no model call or hardware control. The robot is an illustrative interface, not a physical inspection or source of sensor measurements. Coverage is not safety clearance.'),
    node('p', 'Nearby evidence compares gravity class, oxygen and pressure on the same source row. Airflow, geometry, thickness, ignition and suppressant configuration are not matched.'),
    node('p', 'Use the source-linked requests with a qualified reviewer to assess applicability and define any study. They are not validated test procedures. Collection totals and the actual tool-input/output trace are available below.'));
  const selection = disclosure('Choose materials'), selectionSummary = selection.querySelector('summary');
  selection.className = 'inventory-selection';
  const fieldset = node('fieldset'), legend = node('legend', 'Materials in this review'); fieldset.append(legend);
  const choices = node('div', null, 'inventory-choices'), checkboxes = new Map();
  const defaults = ['pmma', 'kapton', 'silicone'];
  for (const [id, material] of Object.entries(db.materials).sort(([a], [b]) => a.localeCompare(b))) {
    const label = node('label'), check = node('input'); check.type = 'checkbox'; check.value = id; check.checked = defaults.includes(id);
    label.append(check, node('span', material.label || id)); choices.append(label); checkboxes.set(id, check);
    listen(check, 'change', () => {
      selectionTouched = true; refreshControls(); onMaterialsChange?.(selected());
    });
  }
  fieldset.append(choices); selection.append(fieldset);
  const selected = () => [...checkboxes].filter(([, box]) => box.checked).map(([id]) => id).sort();
  const cabin = node('p', 'Cabin conditions appear here when a review is prepared.', 'inventory-cabin');
  const summary = node('p', 'Choose an inventory and run the review.', 'inventory-summary');
  summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite'); summary.setAttribute('aria-atomic', 'true');
  const current = node('p', '', 'inventory-current'), progress = node('progress'); progress.setAttribute('aria-label', 'Completed evidence workflow operations'); progress.hidden = true;
  const actions = node('div', null, 'inventory-actions');
  const button = (label, fn, parent = actions, removals = cleanups) => { const b = node('button', label); b.type = 'button'; listen(b, 'click', fn, removals); parent.append(b); return b; };
  const run = button('Run inventory review', () => onRun?.(selected())); run.className = 'inventory-primary';
  const cancel = button('Cancel review', () => onCancel?.()); cancel.hidden = true;
  const reset = button('Reset review', () => onReset?.());
  const changed = node('p', '', 'inventory-warning'); changed.hidden = true;
  const error = node('p', '', 'inventory-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const counts = node('p', '', 'inventory-counts'); counts.hidden = true;
  const queue = disclosure('Human-review order'), queueList = node('ol', null, 'inventory-queue'), priorityRule = node('p');
  queue.append(priorityRule, queueList); queue.hidden = true;
  const results = node('div', null, 'inventory-results');
  const exports = disclosure('Export review'); exports.className = 'inventory-export';
  const exportActions = node('div', null, 'inventory-actions');
  const download = format => {
    if (!canExport()) return;
    try {
      const markdown = format === 'markdown';
      onDownload?.({ format, content: markdown ? reviewToMarkdown(report) : reviewToCsv(report),
        mime: markdown ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8', filename: `vesta-inventory-review.${markdown ? 'md' : 'csv'}`, report });
    } catch (failure) { error.textContent = failure.message || 'The report could not be exported.'; error.hidden = false; }
  };
  const markdown = button('Report · Markdown', () => download('markdown'), exportActions);
  const csv = button('Comparison · CSV', () => download('csv'), exportActions);
  const exportHelp = node('p', 'Exports require a complete review of the selected inventory.', 'inventory-small');
  exports.append(exportActions, exportHelp);
  const provenance = disclosure('Collection, method and actual tool trace');
  const collectionText = node('p'), digest = node('p', '', 'inventory-digest'), methodText = node('p'), limits = node('ul'), trace = node('ol', null, 'inventory-trace');
  provenance.append(collectionText, digest, methodText, limits, node('h3', 'Completed operations'), trace);
  element.append(heading, intro, summary, counts, exports, scope, methodLimits, node('h3', 'Input · cabin and inventory', 'inventory-section-title'), selection, cabin, actions, current, progress, changed, error, queue, results, provenance);

  const selectionMatches = () => !report || keyFor(selected()) === keyFor(report.input.materials);
  const canExport = () => !disposed && report?.status === 'complete' && selectionMatches();
  function refreshControls() {
    const ids = selected(), busy = report?.status === 'running';
    selectionSummary.textContent = `Materials · ${ids.length} selected`;
    run.disabled = !ids.length || busy; cancel.hidden = !busy;
    run.textContent = busy ? 'Review running…' : report?.status === 'complete' ? 'Run again' : 'Run inventory review';
    reset.disabled = !report || report.status === 'idle';
    markdown.disabled = csv.disabled = !canExport() || typeof onDownload !== 'function';
    changed.hidden = selectionMatches() && ids.length > 0;
    changed.textContent = !ids.length ? 'Select at least one material.' : 'The selection changed. Run a new review; the displayed result belongs to the saved inventory.';
  }
  function rowView(q) {
    const removals = [];
    const outer = node('section', null, 'inventory-question'); outer.dataset.questionId = q.id;
    const title = node('h3', `${q.material} · ${concernName(q.concern)}`), verdict = node('p', q.label, 'inventory-verdict');
    title.tabIndex = -1;
    const numbers = node('p', '', 'inventory-source-count'), description = node('p', '', 'inventory-question-description');
    const evidence = disclosure('Inspect evidence and condition differences'), sourceBody = node('div', null, 'inventory-source-list'); evidence.append(sourceBody);
    const rowComparison = createRowComparison({ db, onOpen: typeof onEvidence === 'function'
      ? rowId => onEvidence({ material: q.material_id, concern: q.concern, rowId }) : null });
    rowComparison.element.hidden = true; evidence.insertBefore(rowComparison.element, sourceBody);
    const request = disclosure('Draft request for human review'), requestBody = node('div'); request.append(requestBody);
    outer.append(title, verdict, numbers, description, evidence, request);
    if (['pmma', 'kapton', 'silicone'].includes(q.material_id)) {
      const locate = button('Locate component', () => onFocus?.({ material: q.material_id, concern: q.concern }), outer, removals);
      locate.disabled = typeof onFocus !== 'function'; locate.className = 'inventory-locate';
      outer.insertBefore(locate, evidence);
    }
    const view = { outer, title, verdict, numbers, description, evidence, sourceBody, rowComparison, request, requestBody, removals, sourceKey: '', requestKey: '' };
    cards.set(q.id, view); results.append(outer); return view;
  }
  function updateQuestion(q) {
    const view = cards.get(q.id) || rowView(q);
    view.verdict.textContent = q.label; view.outer.dataset.coverage = q.status;
    const dependence = pressureDependence(q.cell, db);
    view.numbers.textContent = `${q.cell.rows} source-table rows · ${(q.cell.hit_ids || []).length} nearby`
      + `${dependence.nearby ? ` (pressure: ${dependence.reported} reported, ${dependence.inferred} facility-inferred)` : ''} · ${q.cell.finding_ids.length} findings for this question`;
    view.description.textContent = q.status === 'NOT_INDEXED' ? 'This material ID is outside the cabin-material index. Resolve its identity before drawing a conclusion.'
      : q.status === 'NEVER_TESTED' ? 'No source for this material and concern in this collection.'
      : q.status === 'EXTRAPOLATED' ? 'Evidence exists, but conditions differ, are incomplete, or have no matching experimental row.'
      : 'Nearby evidence under the matching rules; omitted variables still need review.';
    const hasInspected = report.trace.some(e => e.type === 'inspect_sources' && e.question_id === q.id);
    const sourceKey = JSON.stringify([q.sources, q.comparisons, hasInspected]);
    if (sourceKey !== view.sourceKey) {
      view.sourceKey = sourceKey;
      view.rowComparison.update(q.sources.rows.map(source => source.id), { ...report.input.query, material: q.material_id, concern: q.concern });
      // A question acquires sources once and comparisons once. Keep every existing
      // button/details node when comparisons arrive, so a reader never loses focus.
      let message = view.sourceBody.querySelector('.inventory-source-message');
      if (!message) { message = node('p', '', 'inventory-source-message'); view.sourceBody.prepend(message); }
      message.textContent = !hasInspected ? 'Source inspection pending.' : !q.sources.rows.length && !q.sources.findings.length
        ? 'No source row or finding returned for this exact material and concern.' : 'Up to three nearest source rows and three relevant findings are inspected. Counts above describe all matching material/concern records.';
      for (const [kind, sources] of [['row', q.sources.rows], ['finding', q.sources.findings]]) for (const source of sources) {
        const key = `${kind}:${source.id}`;
        let block = [...view.sourceBody.children].find(n => n.dataset?.sourceKey === key);
        if (!block) {
          block = node('div', null, 'inventory-source'); block.dataset.sourceKey = key;
          if (kind === 'row') {
            const open = button(`Inspect row ${source.id}`, () => onEvidence?.({ material: q.material_id, concern: q.concern, rowId: source.id }), block, view.removals);
            open.disabled = typeof onEvidence !== 'function';
            appendValue(block, 'Source', `${source.investigation_id ?? 'PSI investigation not stated'} · ${source.table_file ?? 'table not stated'} · row ${source.row ?? 'not stated'}`);
            appendValue(block, 'Pressure basis', human(source.pressure_basis));
          } else {
            block.append(node('h4', `Finding ${source.id}`), node('p', source.claim || source.quote || 'No excerpt supplied'));
            appendValue(block, 'Relevance', `${source.relevance} under VESTA weights; not probability`);
          }
          const original = sourceAnchor('Open original source', source.source_url); if (original) block.append(original);
          view.sourceBody.append(block);
        }
        const comparison = q.comparisons.find(c => c.kind === kind && c.id === source.id);
        if (comparison && !block.querySelector('.inventory-condition-comparison')) {
          const list = node('dl', null, 'inventory-condition-comparison');
          for (const p of comparison.panel.compared) list.append(node('dt', `${p.label} · ${human(p.state)}`), node('dd', p.detail));
          list.append(node('dt', 'Not compared'), node('dd', comparison.panel.notCompared.map(p => p.label).join(', ')));
          block.append(list, node('p', comparison.panel.deltaLegend, 'inventory-small'));
        }
      }
    }
    view.request.hidden = !q.request;
    const requestKey = JSON.stringify(q.request);
    if (q.request && requestKey !== view.requestKey) {
      view.requestKey = requestKey;
      view.requestBody.replaceChildren(node('p', q.request.reason), node('p', q.request.next_step));
      appendValue(view.requestBody, 'Requested cabin', `${conditionList(report.input.query)}. User input, not measured telemetry.`);
      appendValue(view.requestBody, 'Missing cabin inputs', q.request.missing_cabin_fields.join(', ') || 'None among oxygen, pressure and gravity class');
      appendValue(view.requestBody, 'Still to specify and assess', q.request.variables_to_specify.map(v => v.key).join(', '));
      view.requestBody.append(node('p', q.request.scope, 'inventory-small'));
    }
  }
  function traceEntry(event) {
    const item = node('li'), d = disclosure(`${event.sequence}. ${taskNames[event.type] || event.type}${event.question_id ? ` · ${event.question_id}` : ''}`);
    const input = node('dl'), output = node('div');
    input.append(node('dt', 'Input'), node('dd', event.input.query ? conditionList(event.input.query) : event.input.materials ? event.input.materials.join(', ') : 'Current run snapshot'));
    if (event.input.material || event.question_id) input.append(node('dt', 'Question'), node('dd', event.question_id || event.input.material));
    const out = event.output;
    if (event.type === 'plan') appendValue(output, 'Planned', `${out.questions} questions; indexed materials ${out.indexed_materials.join(', ') || 'none'}; unindexed ${out.unindexed_materials.join(', ') || 'none'}`);
    else if (event.type === 'check_coverage') appendValue(output, 'Returned', `${out.label}; ${out.cell.rows} rows; reasons ${out.cell.reasons.join(', ') || 'none among compared conditions'}`);
    else if (event.type === 'inspect_sources') { appendValue(output, 'Rows', out.rows.map(r => r.id).join(', ') || 'none'); appendValue(output, 'Findings', out.findings.map(f => f.id).join(', ') || 'none'); }
    else if (event.type === 'compare_conditions') for (const c of out) appendValue(output, `${c.kind} ${c.id}`, c.panel.compared.map(p => `${p.label}: ${p.state}`).join('; '));
    else if (event.type === 'draft_request') output.append(node('p', out.reason));
    else if (event.type === 'complete') appendValue(output, 'Completed', `${out.counts.completed_questions} questions; review order calculated under the disclosed rule`);
    else output.append(node('p', out.reason || out.message || human(event.type)));
    const exact = disclosure('Exact tool input and output'), payload = node('pre', JSON.stringify({ input: event.input, output: event.output }, null, 2));
    exact.className = 'inventory-exact'; exact.append(payload);
    d.append(input, output, exact); item.append(d); return item;
  }
  function clearResults() {
    for (const view of cards.values()) { view.rowComparison.dispose(); view.removals.splice(0).forEach(remove => remove()); }
    cards.clear(); traceNodes.clear(); results.replaceChildren(); trace.replaceChildren(); queueList.replaceChildren();
  }
  function update(next) {
    if (disposed) return;
    const previous = report;
    report = next || null;
    const key = report ? JSON.stringify([report.input, report.collection.build]) : null;
    if (key !== runKey || !report || !report.questions.length && cards.size || report && previous && report.trace.length < previous.trace.length) {
      clearResults(); runKey = key;
    }
    if (!selectionTouched && report) for (const [id, check] of checkboxes) check.checked = report.input.materials.includes(id);
    if (!report) {
      cabin.textContent = 'Cabin conditions appear here when a review is prepared.';
      summary.textContent = 'Choose an inventory and run the review.'; current.textContent = '';
      progress.hidden = counts.hidden = queue.hidden = error.hidden = true; exports.open = false;
      collectionText.textContent = `Loaded collection: ${db.investigations.length} investigations, ${db.tests.length} source-table rows and ${db.findings.length} findings. These are collection totals, not this inventory’s results.`;
      digest.textContent = ''; methodText.textContent = 'The review uses the existing VESTA coverage, source selection and comparison functions.'; limits.replaceChildren();
    } else {
      const busy = report.status === 'running'; element.dataset.reviewStatus = report.status;
      cabin.textContent = `Saved cabin · ${conditionList(report.input.query)}`;
      summary.textContent = report.status === 'complete' ? `${report.counts.completed_questions}/${report.counts.questions} questions reviewed · ready for human review.`
        : report.status === 'cancelled' ? `Cancelled · ${report.counts.completed_questions} of ${report.counts.questions} questions completed. Partial work is not an exportable report.`
        : report.status === 'error' ? 'The review stopped with an error. No completed report is available.'
        : busy ? `${report.counts.completed_questions} of ${report.counts.questions} questions completed.` : `${report.counts.questions} inventory questions prepared.`;
      current.textContent = busy && report.current_task ? `${taskNames[report.current_task.type] || report.current_task.type}${report.current_task.question_id ? ` · ${report.current_task.question_id}` : ''}` : '';
      progress.hidden = !busy; progress.max = report.progress.total; progress.value = report.progress.completed;
      error.hidden = !report.error; error.textContent = report.error || '';
      counts.hidden = report.questions.length === 0;
      counts.textContent = `${report.status === 'complete' ? '' : 'Coverage checked: '}${report.counts.PROVEN} nearby · ${report.counts.EXTRAPOLATED} other conditions · ${report.counts.NEVER_TESTED} no source · ${report.counts.NOT_INDEXED} material not indexed.`;
      // An answer is the result; export controls remain a deliberate secondary
      // action rather than expanding above every completed question.
      report.questions.forEach(updateQuestion);
      queue.hidden = !report.priority.length;
      if (report.priority.length && !queueList.children.length) for (const p of report.priority) {
        const q = report.questions.find(q => q.id === p.question_id);
        queueList.append(node('li', `${q.material} / ${q.concern} · ${q.label}`));
      }
      priorityRule.textContent = report.method.priority_rule;
      const c = report.collection;
      collectionText.textContent = `Full collection: ${c.investigations} investigations, ${c.source_table_rows} source-table rows and ${c.findings} findings. This report reviews only ${report.input.materials.length} selected materials × 3 concerns. Rows are not independent burns.`;
      digest.textContent = `Build metadata: ${c.build ?? 'not stated'}. Collection SHA-256: ${c.digest ?? 'not calculated yet'}. This is a collection fingerprint, not a report-result verification.`;
      methodText.textContent = `${report.method.id}. ${report.method.source_selection}`;
      if (!limits.children.length) for (const limit of report.method.limits) limits.append(node('li', limit));
      for (const event of report.trace) if (!traceNodes.has(event.sequence)) { const item = traceEntry(event); traceNodes.set(event.sequence, item); trace.append(item); }
    }
    refreshControls();
  }
  function focusQuestion(questionId, { expandSources = true } = {}) {
    if (disposed || !report?.questions.some(q => q.id === questionId)) return false;
    const view = cards.get(questionId);
    if (!view?.outer.isConnected) return false;
    if (expandSources) { view.evidence.open = true; view.rowComparison.expand(); }
    // The containing workspace has a sticky Back control. Its actual height may
    // wrap on a phone, so reserve that measured space before scrolling a title.
    const scroller=element.closest('.inventory-review-workspace'),back=scroller?.querySelector('.inventory-review-back');
    if(scroller&&back)scroller.style.scrollPaddingTop=`${Math.ceil(back.getBoundingClientRect().height)+14}px`;
    view.title.focus({ preventScroll: true });
    view.title.scrollIntoView({ block: 'start', behavior: 'auto' });
    return true;
  }
  function setMaterials(ids) {
    if (disposed || !Array.isArray(ids) || ids.some(id => !checkboxes.has(id))) return false;
    const wanted = new Set(ids);
    for (const [id, check] of checkboxes) check.checked = wanted.has(id);
    selectionTouched = true;
    refreshControls();
    return true;
  }
  update(null);
  return { element, update, focusQuestion, setMaterials, dispose() { if (disposed) return; disposed = true; clearResults(); cleanups.splice(0).forEach(remove => remove()); report = null; element.remove(); } };
}
