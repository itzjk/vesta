import { buildIndex, CONCERNS } from './index.js';
import { cell } from './status.js';
import { nearestSourceRows, COLLECTION_LIMITS } from './evidence-register.js';
import { matchPanel } from './matchpanel.js';
import { rank, W, SPAN, PARTIAL_SUPPORT } from './rank.js';
import { createReceipt, receiptQuery } from './receipt.js';
import { status as statusLabel } from './text.js';

export const INVENTORY_REVIEW_SCHEMA = 'vesta.inventory-review/1';
const MAX_MATERIALS = 24;
const UNMATCHED = ['airflow', 'geometry', 'thickness', 'ignition', 'suppressant'];
const ORDER = ['NOT_INDEXED', 'NEVER_TESTED', 'EXTRAPOLATED', 'PROVEN'];
const SCOPE = 'A deterministic evidence workflow over the selected inventory and loaded collection. No model at runtime, hardware control, safety clearance or independent scientific validation.';
const PRIORITY = 'Resolve unindexed materials first, then questions with no source, then other conditions, then nearby evidence. Within a group: more unavailable cabin/source comparisons first, then question ID in ascending code-point order. This is a review queue, not a physical-risk or scientific-importance ranking.';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const copy = value => freeze(clone(value));
const byId = (a, b) => compare(a.id, b.id);
const missingCabin = q => [q.o2 == null && 'oxygen', q.p == null && 'pressure', q.gclass == null && 'gravity'].filter(Boolean);

function inputs(query, materials) {
  if (!query || typeof query !== 'object') throw new Error('A cabin query is required.');
  if (!Array.isArray(materials) || !materials.length || materials.length > MAX_MATERIALS)
    throw new Error(`Select 1 to ${MAX_MATERIALS} material IDs; an empty inventory is not a completed review.`);
  if (materials.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)))
    throw new Error('Each material must be an explicit lowercase material ID.');
  const q = receiptQuery({ oxygen_percent: query.o2 ?? null, pressure_kpa: query.p ?? null,
    gravity: query.g ?? null, gravity_class: query.gclass ?? null, material_id: null, concern: CONCERNS[0] });
  q.habitat = typeof query.habitat === 'string' ? query.habitat : null;
  return copy({ query: q, materials: [...new Set(materials)].sort(compare), concerns: [...CONCERNS] });
}

function sourceRows(material, concern, query, db) {
  return nearestSourceRows(material, concern, query, db, 3).map(({ row, fail, note, delta }) => ({
    id: row.id, investigation_id: row.psi_id ?? null, table_file: row.table_file ?? null, row: row.row ?? null,
    source_url: row.psi_url || db.invById[row.psi_id]?.psi_url || null,
    role: fail.length ? 'nearest_row_other_conditions' : 'nearby_row',
    fail, note, delta, conditions: clone(row.n),
    pressure_basis: row.n.p != null ? 'reported' : row.n.p_inferred != null ? 'facility_inferred' : 'unknown',
    pressure_inference_source: row.n.p_inferred_source ?? null
  }));
}

function sourceFindings(material, concern, query, db) {
  const direct = db.findings.filter(f => f.pillar === concern && (f.n.material_ids || []).includes(material));
  return rank(direct, { ...query, material, concern }, db).slice(0, 3).map(({ f, total }) => ({
    id: f.id, claim: f.claim ?? null, quote: f.quote ?? null, source_url: f.source?.url ?? null,
    source: f.source ?? null, row_ids: [...new Set([...(f.row_ids || []), ...(f.cells || []).map(c => c.row_id)])].sort(compare),
    role: 'finding_for_material_and_concern', relevance: total, conditions: clone(f.n)
  }));
}

function requestFor(question, query) {
  const reason = question.status === 'NOT_INDEXED'
    ? 'Confirm this inventory material and map it to a supported source material, or supply an attributable source. Its absence from this index is not evidence that NASA has never tested it.'
    : question.status === 'NEVER_TESTED'
      ? 'Locate attributable evidence for this material and concern. No row or finding in the loaded collection answers this question.'
      : question.status === 'EXTRAPOLATED'
        ? 'Review the cited condition differences or missing experimental rows before transferring this evidence to the requested cabin.'
        : 'Review source applicability and the variables outside the matching method. Nearby rows do not establish experimental equivalence or cabin safety.';
  return {
    question_id: question.id, kind: 'human_review_request', status: question.status, reason,
    requested_conditions: { basis: 'user_requested_cabin_not_measured_telemetry', oxygen_percent: query.o2,
      pressure_kpa: query.p, gravity: query.g, gravity_class: query.gclass },
    missing_cabin_fields: missingCabin(query),
    variables_to_specify: UNMATCHED.map(key => ({ key, state: 'not_supplied_or_compared_by_this_workflow' })),
    evidence_row_ids: question.sources.rows.map(r => r.id), evidence_finding_ids: question.sources.findings.map(f => f.id),
    condition_differences: question.comparisons.flatMap(c => c.panel.compared.filter(v => v.state !== 'matched')
      .map(v => ({ record_id: c.id, record_kind: c.kind, key: v.key, detail: v.detail }))),
    next_step: question.status === 'NOT_INDEXED' ? 'Resolve the material identity before proposing a study.'
      : 'A qualified reviewer must define a test question, applicable specimen and boundary conditions, measurement method and acceptance criteria before any experiment.',
    scope: 'A source-linked request for human review, not an experimental protocol, instruction to run a test, predicted outcome or safety clearance.'
  };
}

const unavailable = question => question.comparisons.reduce((sum, c) => sum + c.panel.compared.filter(p =>
  p.detail.includes('not reported') || p.detail.includes('comparison unavailable')).length, 0);
const reviewOrder = (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
  || unavailable(b) - unavailable(a) || compare(a.id, b.id);

/** Read-only, bounded work. yieldTurn yields to the host; it never adds a minimum animation duration. */
export function createInventoryReviewSession({ db, query, materials, onEvent, yieldTurn = () => new Promise(resolve => setTimeout(resolve, 0)) }) {
  const input = inputs(query, materials);
  // Snapshot the actual collection as well as the query: an asynchronous run cannot mix two builds.
  const data = buildIndex(clone({ tests: [...db.tests].sort(byId), findings: [...db.findings].sort(byId),
    investigations: [...db.investigations].sort((a, b) => compare(a.psi_id, b.psi_id)), meta: db.meta }));
  const state = {
    schema: INVENTORY_REVIEW_SCHEMA, status: 'idle', scope: SCOPE, input,
    collection: { build: data.meta?.generated_at ?? null, digest: null, algorithm: null,
      investigations: data.investigations.length, source_table_rows: data.tests.length, findings: data.findings.length },
    method: { id: 'vesta.inventory-review-method/1', coverage: null, selection: 'Only the explicitly selected material IDs, each crossed with prevention, detection and suppression.',
      source_limit_per_kind: 3, source_selection: 'Rows use the existing nearestSourceRows ordering; findings use the existing relevance rank, restricted to the exact material and concern. The displayed three are representative, not an exhaustive evidence review.',
      finding_rank: { weights: { ...W }, spans: { ...SPAN }, partial_support: PARTIAL_SUPPORT },
      priority_rule: PRIORITY, limits: [...COLLECTION_LIMITS], unmatched_variables: [...UNMATCHED] },
    progress: { completed: 0, total: 1 + input.materials.length * CONCERNS.length * 4 }, current_task: null,
    counts: { questions: input.materials.length * CONCERNS.length, completed_questions: 0, PROVEN: 0, EXTRAPOLATED: 0, NEVER_TESTED: 0, NOT_INDEXED: 0 },
    questions: [], requests: [], priority: [], trace: [], error: null
  };
  let job = null;
  const snapshot = () => copy(state);
  const active = () => state.status === 'running';
  function emit(type, questionId, eventInput, output, increment = false) {
    if (increment) state.progress.completed++;
    state.current_task = { type, question_id: questionId };
    const event = copy({ sequence: state.trace.length + 1, type, question_id: questionId, input: eventInput, output });
    state.trace.push(event);
    // A view is an observer, not a scientific tool. Its exception cannot change calculated evidence.
    try { onEvent?.(event); } catch { /* The caller owns presentation error handling. */ }
  }
  async function step(type, questionId, eventInput, output) {
    if (!active()) return false;
    emit(type, questionId, eventInput, output, true);
    if (!active()) return false;
    await yieldTurn();
    return active();
  }
  function cancel(reason = 'Cancelled by user') {
    if (!['idle', 'running'].includes(state.status)) return snapshot();
    state.status = 'cancelled';
    emit('cancel', null, {}, { reason: String(reason), completed_questions: state.counts.completed_questions });
    return snapshot();
  }
  function run() {
    if (job) return job;
    if (state.status !== 'idle') return Promise.resolve(snapshot());
    state.status = 'running';
    job = (async () => {
      try {
        const receipt = await createReceipt(data, input.query);
        if (!active()) return snapshot();
        state.collection = { build: data.meta?.generated_at ?? null, ...receipt.basis };
        state.method.coverage = receipt.method;
        if (!await step('plan', null, input, { questions: state.counts.questions,
          indexed_materials: input.materials.filter(m => Object.hasOwn(data.materials, m)),
          unindexed_materials: input.materials.filter(m => !Object.hasOwn(data.materials, m)), collection: state.collection })) return snapshot();
        for (const material of input.materials) for (const concern of CONCERNS) {
          if (!active()) return snapshot();
          const q = { ...input.query, material, concern }, rawCell = clone(cell(material, concern, q, data));
          rawCell.finding_ids.sort(compare); rawCell.hit_ids?.sort(compare); rawCell.elsewhere?.sort(compare);
          const indexed = Object.hasOwn(data.materials, material), status = indexed ? rawCell.status : 'NOT_INDEXED';
          const question = { id: `${material}/${concern}`, material_id: material, material: data.materials[material]?.label ?? material,
            concern, inventory_state: indexed ? 'indexed_cabin_material' : 'not_indexed_cabin_material', status,
            label: indexed ? statusLabel(status, rawCell.qualifier) : 'MATERIAL NOT INDEXED', cell: rawCell,
            sources: { rows: [], findings: [] }, comparisons: [], request: null };
          state.questions.push(question); state.counts[status]++;
          if (!await step('check_coverage', question.id, { query: q }, { status, label: question.label, inventory_state: question.inventory_state, cell: rawCell })) return snapshot();
          question.sources = { rows: sourceRows(material, concern, q, data), findings: sourceFindings(material, concern, q, data) };
          if (!await step('inspect_sources', question.id, { material, concern, query: q, limit_per_kind: 3 }, question.sources)) return snapshot();
          question.comparisons = [
            ...question.sources.rows.map(r => ({ id: r.id, kind: 'row', panel: matchPanel(data.testById[r.id], q, data) })),
            ...question.sources.findings.map(f => ({ id: f.id, kind: 'finding', panel: matchPanel(data.findingById[f.id], q, data) }))
          ];
          if (!await step('compare_conditions', question.id, { query: q, row_ids: question.sources.rows.map(r => r.id), finding_ids: question.sources.findings.map(f => f.id) }, question.comparisons)) return snapshot();
          question.request = requestFor(question, q); state.requests.push(question.request); state.counts.completed_questions++;
          if (!await step('draft_request', question.id, { query: q, status, source_row_ids: question.sources.rows.map(r => r.id), source_finding_ids: question.sources.findings.map(f => f.id) }, question.request)) return snapshot();
        }
        state.priority = [...state.questions].sort(reviewOrder).map((q, i) => ({ position: i + 1, question_id: q.id, status: q.status,
          unavailable_comparisons: unavailable(q) }));
        state.status = 'complete';
        emit('complete', null, { method: state.method.id, collection_digest: state.collection.digest }, { counts: state.counts, priority: state.priority });
      } catch (error) {
        if (active()) {
          state.status = 'error'; state.error = error instanceof Error ? error.message : String(error);
          emit('error', null, {}, { message: state.error });
        }
      }
      return snapshot();
    })();
    return job;
  }
  return Object.freeze({ run, cancel, snapshot });
}

function complete(report) {
  if (report?.schema !== INVENTORY_REVIEW_SCHEMA || report.status !== 'complete'
    || report.counts.completed_questions !== report.counts.questions || report.questions.some(q => !q.request))
    throw new Error('Only a completed inventory review can be exported. Cancelled, partial or failed runs are not completed reports.');
}
const plain = value => String(value ?? 'not reported').replace(/[\r\n]+/g, ' ');
const md = value => plain(value).replace(/([\\`*_[\]<>|])/g, '\\$1');
const conditionText = q => `${q.o2 ?? 'unknown'}% O2; ${q.p ?? 'unknown'} kPa; ${q.g ?? 'unknown'} (${q.gclass ?? 'unknown'} gravity class)`;
export function reviewToMarkdown(report) {
  complete(report);
  const lines = ['# VESTA cabin inventory evidence review', '', report.scope, '',
    `Requested cabin: ${conditionText(report.input.query)}.`, `Selected material IDs: ${report.input.materials.map(md).join(', ')}.`,
    `Collection build metadata: ${md(report.collection.build)}; SHA-256 ${report.collection.digest}.`,
    `Method: ${report.method.id}; coverage: ${report.method.coverage.id}.`,
    `Questions: ${report.counts.questions}; nearby ${report.counts.PROVEN}; other conditions ${report.counts.EXTRAPOLATED}; no source ${report.counts.NEVER_TESTED}; material not indexed ${report.counts.NOT_INDEXED}.`, '',
    '## Human-review queue', '', report.method.priority_rule, ''];
  for (const item of report.priority) {
    const q = report.questions.find(q => q.id === item.question_id);
    lines.push(`${item.position}. ${md(q.material)} / ${q.concern}: ${q.label}. [${q.id}]`);
  }
  for (const q of report.questions) {
    lines.push('', `## ${md(q.material)} / ${q.concern}`, '', q.label, '', q.request.reason,
      `Question ${q.id}: ${q.cell.rows} counted source-table rows; ${q.cell.finding_ids.length} findings; ${(q.cell.hit_ids || []).length} nearby rows. Rows are not independent burns.`,
      `Coverage reasons: ${q.cell.reasons.join(', ') || 'no compared-condition mismatch'}.`, '');
    if (!q.sources.rows.length && !q.sources.findings.length) lines.push('No source for this exact material and concern in the loaded collection.');
    for (const r of q.sources.rows) lines.push(`- Row ${md(r.id)}: ${md(r.table_file)}, row ${r.row ?? 'not reported'}; ${r.role}; pressure ${r.pressure_basis}. ${md(r.source_url)}`);
    for (const f of q.sources.findings) lines.push(`- Finding ${md(f.id)}: ${md(f.claim || f.quote)}; relevance ${f.relevance}, not probability. ${md(f.source_url)}`);
    for (const c of q.comparisons) {
      lines.push('', `Comparison for ${c.kind} ${md(c.id)}: ${c.panel.warning}`);
      for (const p of c.panel.compared) lines.push(`- ${p.label}: ${p.state}. ${md(p.detail)}`);
      lines.push(c.panel.deltaLegend);
    }
    lines.push('', '### Request for human review', '', q.request.scope,
      `Requested conditions (user input, not measured telemetry): ${conditionText(report.input.query)}.`,
      `Missing cabin inputs: ${q.request.missing_cabin_fields.join(', ') || 'none among oxygen, pressure and gravity class'}.`,
      `Specify and review: ${report.method.unmatched_variables.join(', ')}. These variables were not supplied or compared by this workflow.`, q.request.next_step);
  }
  lines.push('', '## Method and limits', '', report.method.selection, report.method.source_selection,
    `Matching tolerances: oxygen ±${report.method.coverage.tolerances.oxygen_percentage_points} percentage point; pressure ±${report.method.coverage.tolerances.pressure_kpa} kPa; same gravity class on the same row.`,
    ...report.method.limits.map(limit => `- ${limit}`), '', 'The JSON report retains the actual tool-input/output trace. No physical test or hardware action was executed.', '');
  return lines.join('\n');
}

// RFC-style quoting plus spreadsheet formula neutralization. The JSON report retains original text.
const csv = value => {
  let text = plain(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export function reviewToCsv(report) {
  complete(report);
  const header = ['question_id', 'material', 'concern', 'coverage_status', 'meaning', 'requested_oxygen_percent', 'requested_pressure_kpa', 'requested_gravity',
    'source_table_rows', 'nearby_row_ids', 'finding_ids', 'inspected_row_ids', 'inspected_finding_ids', 'source_urls', 'condition_comparisons',
    'human_review_request', 'unmatched_variables', 'review_position', 'collection_build', 'collection_sha256', 'method', 'scope'];
  const rows = report.questions.map(q => [q.id, q.material, q.concern, q.status, q.label, report.input.query.o2, report.input.query.p, report.input.query.g,
    q.cell.rows, (q.cell.hit_ids || []).join('; '), q.cell.finding_ids.join('; '), q.sources.rows.map(r => r.id).join('; '), q.sources.findings.map(f => f.id).join('; '),
    [...new Set([...q.sources.rows, ...q.sources.findings].map(s => s.source_url).filter(Boolean))].join('; '),
    q.comparisons.map(c => `${c.kind} ${c.id}: ${c.panel.compared.map(p => `${p.label} ${p.state}: ${p.detail}`).join(' | ')}`).join(' || '),
    q.request.reason, report.method.unmatched_variables.join('; '), report.priority.find(p => p.question_id === q.id).position,
    report.collection.build, report.collection.digest, report.method.id, report.scope]);
  return [header, ...rows].map(row => row.map(csv).join(',')).join('\r\n') + '\r\n';
}
