import { proofComparisons } from './proof-session.js?v=expert-20261115-1';

const node = (tag, text, cls = '') => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const details = (label, content) => { const d = node('details'); d.append(node('summary', label), content); return d; };
export function ensureTrustReportStyles() {
  if (document.querySelector('link[data-trust-report]')) return;
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('../../css/trust-report.css?v=expert-20261115-1', import.meta.url).href;
  link.dataset.trustReport = ''; document.head.append(link);
}
const fieldNames = { status: 'Outcome', qualifier: 'Pressure qualifier', hits: 'Nearby source rows', rows: 'Relevant source rows', reasons: 'Reasons', coverage: 'Condition coverage', gap: 'Evidence gap', protocol: 'Conditional fallback', rule: 'Rule' };
const scope = 'Regression checks of software behavior, not independent scientific validation or safety certification.';
function valueText(key, value, text) {
  if (value === undefined) return 'Not returned'; if (value === null) return 'None';
  if (Array.isArray(value)) return value.length ? value.join(' · ') : 'No reasons';
  if (['status', 'coverage'].includes(key)) return `${text.status(value)} (${value})`;
  if (key === 'qualifier' && value === 'pressure_inferred') return 'Facility pressure inferred (pressure_inferred)';
  return String(value);
}
export function createProofReport({ db, core, cite, onRun, onStop, onRejected, rawLink }) {
  ensureTrustReportStyles();
  const element = node('section', null, 'trust-check-report'); element.dataset.checkReport = '';
  const title = node('h2', 'Evidence check results'), summary = node('p', '', 'trust-check-summary');
  summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite'); summary.dataset.checkSummary = '';
  const progress = node('progress'); progress.max = 10; progress.value = 0; progress.setAttribute('aria-label', 'Reviewed cases completed');
  const actions = node('div', null, 'trust-check-actions');
  const button = (label, fn) => { const b = node('button', label); b.type = 'button'; b.onclick = fn; actions.append(b); return b; };
  const run = button('Run 10 reviewed cases', onRun); run.dataset.trust = 'start';
  const stop = button('Stop', onStop); stop.hidden = true;
  button(`${db.engine?.verifier?.rejected?.length ?? 0} rejected excerpts`, onRejected);
  const explanation = node('p', scope, 'trust-report-scope');
  const list = node('ol', null, 'trust-check-results'); list.dataset.trust = 'results';
  const advancedContent = node('div'); advancedContent.append(node('p', scope), rawLink('Download reviewed cases · JSON', 'data/proof-cases.json', 'vesta-proof-cases.json'));
  const advanced = details('Advanced: scope and reviewed case file', advancedContent);
  const error = node('p', '', 'trust-check-error'); error.hidden = true;
  element.append(title, summary, progress, actions, explanation, error, list, advanced);
  const cards = new Map();
  function resultCard(result, reviewed, ordinal) {
    const row = node('li', null, 'trust-check-result'); row.dataset.proofId = result.id; row.dataset.pass = String(result.pass);
    let q = result.cabin; try { q ??= core.index.designPoint(reviewed.cabin, db); } catch { /* an unavailable cabin remains explicit */ }
    row.append(node('p', `${result.pass ? 'PASS' : 'FAIL'} · case ${ordinal} · ${result.machine}`, 'trust-case-verdict'), node('h3', result.question));
    if (q) row.append(node('p', `Case cabin: ${db.presetById[q.preset]?.label ?? q.preset} · ${core.text.oxygen(q.o2)} · ${core.text.pressure(q.p)} · ${q.g_label || core.text.gravity(q.gclass)}.`, 'trust-case-cabin'));
    row.append(node('p', result.answer, 'trust-case-answer'));
    row.append(node('p', `Expected ${core.text.status(result.expected.status)}. Observed ${core.text.status(result.actual.status)}.`, 'trust-case-outcome'));
    row.append(node('p', reviewed.rationale, 'trust-case-why'));
    const sources = node('div', null, 'trust-case-sources');
    for (const id of result.refs ?? []) sources.append(cite(`Inspect source ${id}`, id, q));
    if (!result.refs?.length) sources.append(node('p', result.mismatches.includes('execution') ? 'No source result: this case could not execute.' : 'No matching source is returned for this case; that absence is part of the check.'));
    const fallback = result.result.protocol;
    if (fallback?.finding_id) {
      sources.append(node('p', 'Separate conditional fallback; it does not fill the evidence gap.', 'trust-report-limit'), cite(`Inspect fallback source ${fallback.finding_id}`, fallback.finding_id, q));
    }
    row.append(sources);
    const body = node('div');
    if (reviewed.without_findings?.length) body.append(node('p', `Counterfactual: ${reviewed.without_findings.join(', ')} removed from a separate index. The loaded collection remains unchanged.`, 'trust-report-limit'));
    if (reviewed.kind === 'officer') body.append(node('p', 'Scripted drill input; no live telemetry or physics model.', 'trust-report-limit'));
    const table = node('table'), caption = node('caption', 'Expected versus observed values'), head = node('thead'), hr = node('tr');
    for (const label of ['Check', 'Expected', 'Observed']) { const th = node('th', label); th.scope = 'col'; hr.append(th); } head.append(hr);
    const rows = node('tbody');
    for (const field of proofComparisons(result)) {
      const tr = node('tr'), th = node('th', fieldNames[field.key] || field.key); th.scope = 'row';
      const expected = node('td', valueText(field.key, field.expected, core.text));
      const observed = node('td', `${field.pass ? 'MATCH' : 'MISMATCH'}: ${valueText(field.key, field.actual, core.text)}`);
      tr.append(th, expected, observed); rows.append(tr);
    }
    table.append(caption, head, rows); body.append(table, node('p', 'Reason-list checks require every expected reason; additional returned reasons are allowed.', 'trust-report-scope'));
    if (result.actual.qualifier) body.append(node('p', core.text.reasonSentence(result.actual.qualifier, { q, n: db })));
    for (const reason of result.actual.reasons ?? []) body.append(node('p', core.text.reasonSentence(reason, { q, n: db, delta: result.result.nearest?.delta ?? result.result.delta })));
    if (result.actual.gap) body.append(node('p', core.text.reasonSentence(result.actual.gap, { q, n: db })));
    if (result.limits) body.append(node('p', result.limits, 'trust-report-limit'));
    if (!result.pass) body.append(node('p', `Mismatch: ${result.mismatches.join(', ')}.`, 'trust-check-error'));
    const why = details('Why this result · full comparison', body); if (!result.pass) why.open = true;
    row.append(why); return row;
  }
  function update(state) {
    const busy = ['loading', 'running'].includes(state.phase);
    run.disabled = busy; run.textContent = busy ? 'Running…' : state.results.length || state.phase === 'complete' ? 'Run again' : 'Run 10 reviewed cases';
    stop.hidden = !busy; progress.max = state.total; progress.value = state.completed;
    progress.hidden = !busy; title.hidden = explanation.hidden = state.results.length > 0;
    summary.textContent = state.phase === 'idle' ? 'Run the reviewed cases against the loaded collection.'
      : state.phase === 'loading' ? 'Loading the reviewed expected outcomes…'
      : state.phase === 'error' ? 'Checks unavailable. Retry to load the reviewed cases.'
      : `${state.completed} of ${state.total} checked · ${state.passed} passed · ${state.failed} failed${state.phase === 'stopped' ? ' · stopped' : state.phase === 'complete' ? ' · complete' : ''}.`;
    element.dataset.checkPhase = state.phase; error.hidden = !state.error; error.textContent = state.error || '';
    if (!state.results.length && cards.size) { cards.clear(); list.replaceChildren(); }
    state.results.forEach((result, i) => {
      if (cards.has(result.id)) return;
      const reviewed = state.file.cases.find(c => c.id === result.id), card = resultCard(result, reviewed, i + 1); cards.set(result.id, card); list.append(card);
    });
    // Existing nodes (including expanded comparisons and focused source buttons)
    // survive progress updates and tab changes, including the final completion.
  }
  return { element, update };
}

export function renderRejectedExcerpts({ records, sources, locator, rawLink }) {
  ensureTrustReportStyles(); const element = node('section', null, 'trust-rejected-report');
  element.append(node('h2', `${records.length} rejected excerpts`), node('p', 'These candidates were rejected during source-text checks and are not accepted findings. Inspect each reason and the context below.', 'trust-report-scope'));
  const list = node('ol');
  for (const record of records) {
    const source = sources.get(record.id), item = node('li', null, 'trust-rejected-excerpt'); item.dataset.rejectedId = record.id;
    item.append(node('h3', record.id), node('p', record.why === 'cut_before_qualifier' ? 'Rejected: the quotation stopped before a qualifier.' : `Rejected: ${String(record.why ?? 'reason not reported').replaceAll('_', ' ')}.`));
    item.append(node('h4', 'Candidate excerpt'), node('blockquote', record.quote));
    if (source) {
      item.append(node('h4', 'Omitted qualifier'), node('blockquote', source.context_after.trim(), 'trust-omitted-qualifier'));
      item.append(rawLink(`Read original: ${source.source.title}`, source.source.url), locator(source));
    } else item.append(node('p', 'Source details unavailable. This excerpt remains rejected; no source match is claimed.', 'trust-report-limit'));
    list.append(item);
  }
  element.append(list, details('Advanced: rejection records and build report', (() => {
    const d = node('div'); d.append(rawLink('Rejected excerpts · JSON', 'data/rejected-excerpts.json', 'vesta-rejected-excerpts.json'), rawLink('Build report · JSON', 'data/engine.json', 'vesta-engine.json')); return d;
  })()));
  return element;
}
