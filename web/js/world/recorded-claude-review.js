import { G } from '../core/index.js';

export const RECORDED_REVIEW_SCHEMA = 'vesta.recorded-model-review/1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const strings = (value, pattern) => Array.isArray(value) && value.length > 0 && value.every(id => typeof id === 'string' && pattern.test(id)) && new Set(value).size === value.length;
const sorted = values => [...values].sort();
const equalSet = (a, b) => a.length === b.length && sorted(a).every((value, i) => value === sorted(b)[i]);
const decision = (status, message, extra = {}) => ({ matches: status === 'MATCH', status, message, ...extra });
const validQuery = q => object(q) && Number.isFinite(q.o2) && q.o2 >= 0 && q.o2 <= 100
  && Number.isFinite(q.p) && q.p > 0 && typeof q.g === 'string' && Object.hasOwn(G, q.g) && G[q.g].gclass === q.gclass;
const validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const safeText = (value, maximum) => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;

function reportSourceIds(report) {
  const ids = new Set();
  for (const question of report.questions || []) {
    for (const source of [...(question.sources?.rows || []), ...(question.sources?.findings || [])]) if (typeof source.id === 'string') ids.add(source.id);
    for (const id of [...(question.cell?.hit_ids || []), ...(question.cell?.finding_ids || [])]) if (typeof id === 'string') ids.add(id);
    if (question.cell?.nearest?.id) ids.add(question.cell.nearest.id);
  }
  return ids;
}
function sourceExists(db, id) {
  return Object.hasOwn(db?.findingById || {}, id) && db.findingById[id]?.id === id
    || Object.hasOwn(db?.testById || {}, id) && db.testById[id]?.id === id
    || Array.isArray(db?.findings) && db.findings.some(record => record.id === id)
    || Array.isArray(db?.tests) && db.tests.some(record => record.id === id);
}

/** Applicability only: this neither executes a model nor proves the saved interpretation correct. */
export function matchRecordedReview(record, report, db) {
  if (!object(record) || record.schema !== RECORDED_REVIEW_SCHEMA || !validQuery(record.query)
    || !strings(record.materials, /^[a-z0-9][a-z0-9-]{0,99}$/)
    || !strings(record.question_ids, /^[a-z0-9][a-z0-9-]*\/(?:prevention|detection|suppression)$/)
    || !strings(record.cited_ids, /^[A-Za-z0-9][A-Za-z0-9:._-]{0,149}$/)
    || !/^[a-f0-9]{64}$/.test(record.collection_digest || '')
    || !validTime(record.recorded_at) || !Number.isSafeInteger(record.tool_calls) || record.tool_calls < 1
    || !safeText(record.summary, 5000) || !safeText(record.review_question, 2000) || !safeText(record.scope, 3000)
    || record.query.habitat != null && typeof record.query.habitat !== 'string')
    return decision('INVALID_RECORD', 'The recorded review is incomplete or has an unsupported format.');
  if (report?.schema !== 'vesta.inventory-review/1' || report.status !== 'complete')
    return decision('REPORT_INCOMPLETE', 'Complete this inventory review before applying a recorded external analysis.');
  const q = report.input?.query, materials = report.input?.materials, questions = report.questions;
  if (!validQuery(q) || !strings(materials, /^[a-z0-9][a-z0-9-]{0,99}$/) || !Array.isArray(questions)
    || questions.length === 0 || report.counts?.questions !== questions.length || report.counts?.completed_questions !== questions.length
    || !/^[a-f0-9]{64}$/.test(report.collection?.digest || ''))
    return decision('INVALID_REPORT', 'The completed review is missing its exact inputs, question count or collection fingerprint.');
  const changed = ['o2', 'p', 'g', 'gclass'].filter(key => record.query[key] !== q[key]);
  if (record.query.habitat != null && record.query.habitat !== q.habitat) changed.push('habitat');
  if (changed.length) return decision('QUERY_CHANGED', 'This recorded analysis applies to a different saved cabin. It is not reused for these conditions.', { changed });
  if (!equalSet(record.materials, materials)) return decision('MATERIALS_CHANGED', 'This recorded analysis applies to a different material inventory.');
  if (record.collection_digest !== report.collection.digest) return decision('COLLECTION_CHANGED', 'The recorded analysis uses a different evidence collection.');
  const questionIds = questions.map(question => question.id);
  if (!strings(questionIds, /^[a-z0-9][a-z0-9-]*\/(?:prevention|detection|suppression)$/) || !equalSet(record.question_ids, questionIds))
    return decision('QUESTION_MISMATCH', 'The recorded analysis and completed report do not contain the same material/concern questions.');
  const available = db ? null : reportSourceIds(report);
  const missing = record.cited_ids.filter(id => db ? !sourceExists(db, id) : !available.has(id));
  if (missing.length) return decision('SOURCE_MISSING', 'A cited record cannot be resolved in the supplied evidence index. The recorded interpretation is unavailable.', { missing_ids: missing });
  return decision('MATCH', 'This recorded external analysis matches the saved cabin, inventory, question set and collection; its cited IDs resolve. This is applicability, not independent scientific validation.');
}

const node = (tag, text, className = '') => {
  const element = document.createElement(tag); if (text != null) element.textContent = text;
  if (className) element.className = className; return element;
};
function scenarioText(record) {
  if (!validQuery(record?.query) || !Array.isArray(record?.materials)) return 'A complete review of the exact recorded scenario and collection is required.';
  return `Requires ${record.query.o2}% O2, ${record.query.p} kPa, ${record.query.g} (${record.query.gclass})${record.query.habitat ? `, ${record.query.habitat}` : ''}; materials ${sorted(record.materials).join(', ')}; the identical collection fingerprint and a completed review.`;
}
function ensureStyles() {
  if (document.querySelector('link[data-inventory-review-styles]')) return;
  const sheet = node('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/inventory-review.css', import.meta.url).href;
  sheet.dataset.inventoryReviewStyles = ''; document.head.append(sheet);
}

/** onEvidence receives {id,query}; query is the exact saved scenario, with no invented material-specific match. */
export function createRecordedReviewPanel({ record, db, onEvidence }) {
  if (typeof document === 'undefined') throw new Error('The recorded-review panel requires a browser document.');
  ensureStyles();
  // Curated text is fixed for this panel. An external mutation cannot alter a checked result.
  const saved = record == null ? null : JSON.parse(JSON.stringify(record));
  const element = node('section', null, 'inventory-review recorded-claude-review');
  element.setAttribute('aria-label', 'Recorded Claude review');
  element.style.borderTop = '1px solid var(--ir-rule,#6c797566)'; element.style.paddingTop = '16px'; element.style.marginTop = '16px';
  const heading = node('h3', 'Recorded Claude review');
  const provenance = node('p', '', 'inventory-small');
  const note = node('p', 'External recorded analysis · not a live model in this website.', 'inventory-scope');
  const unavailable = node('p'), requirement = node('p', scenarioText(saved), 'inventory-small');
  unavailable.setAttribute('role', 'status'); unavailable.setAttribute('aria-live', 'polite');
  const result = node('div'), editorial = node('p', '', 'inventory-small'), summary = node('p'), question = node('p');
  const sources = node('div', null, 'inventory-actions');
  const details = node('details'), detailsTitle = node('summary', 'Recorded review: scope and limits'), limits = node('p'), matchScope = node('p');
  details.append(detailsTitle, limits, matchScope, requirement); result.append(editorial, summary, node('h4', 'Question for human review'), question, sources);
  element.append(heading, provenance, note, unavailable, result, details);
  let report = null, disposed = false, verdict = null;
  const cleanups = [];
  if (saved) {
    const stamp = validTime(saved.recorded_at) ? new Date(saved.recorded_at).toISOString().replace('T', ' ').replace('Z', ' UTC') : 'timestamp unavailable';
    provenance.textContent = `${Number.isSafeInteger(saved.tool_calls) ? saved.tool_calls : 'Unverified count of'} read-only tool calls · external session · ${stamp}`;
    editorial.textContent = safeText(saved.editorial_label, 500) ? saved.editorial_label : 'Reviewer-audited paraphrase of a recorded external review; not a verbatim quotation.';
    summary.textContent = typeof saved.summary === 'string' ? saved.summary : '';
    question.textContent = typeof saved.review_question === 'string' ? saved.review_question : '';
    limits.textContent = typeof saved.scope === 'string' ? saved.scope : 'The recorded review is unavailable.';
    const ids = Array.isArray(saved.cited_ids) ? [...new Set(saved.cited_ids.filter(id => typeof id === 'string'))] : [];
    for (const id of ids) {
      const button = node('button', `Inspect ${id}`); button.type = 'button'; button.disabled = typeof onEvidence !== 'function';
      const click = () => {
        if (disposed || !verdict?.matches || !report) return;
        onEvidence?.({ id, query: { ...report.input.query } });
      };
      button.addEventListener('click', click); cleanups.push(() => button.removeEventListener('click', click)); sources.append(button);
    }
  }
  function update(next) {
    if (disposed) return;
    report = next || null; verdict = matchRecordedReview(saved, report, db);
    element.dataset.recordedReview = verdict.status;
    result.hidden = !verdict.matches; unavailable.hidden = verdict.matches;
    unavailable.textContent = verdict.matches ? '' : `${verdict.message} ${scenarioText(saved)}`;
    matchScope.textContent = verdict.matches ? verdict.message : 'No recorded interpretation is applied to the current review.';
    // Buttons and open disclosure nodes survive all updates. The interpretation
    // itself is hidden immediately when a run resets or its exact scenario differs.
  }
  update(null);
  return { element, update, dispose() { if (disposed) return; disposed = true; cleanups.splice(0).forEach(remove => remove()); report = null; verdict = null; element.remove(); } };
}
