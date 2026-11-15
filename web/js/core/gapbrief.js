import { buildIndex, G, CONCERNS } from './index.js';
import { createReceipt, receiptQuery } from './receipt.js';
import { nearestRow } from './status.js';
import { rank } from './rank.js';
import { gap, isMeasure } from './match.js';

export const GAP_BRIEF_SCHEMA = 'vesta.gap-brief/1';
export const MAX_GAP_BRIEF_BYTES = 2 * 1024 * 1024;
export const GAP_LABELS = { NEVER_TESTED: 'No evidence in this collection', EXTRAPOLATED: 'Depends on extrapolation', PROVEN: 'Nearby evidence' };
const ORDER = ['NEVER_TESTED', 'EXTRAPOLATED', 'PROVEN'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const byId = (a, b) => compare(a.id, b.id);
const sorted = xs => [...xs].sort(byId);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, stable(value[k])])) : value;
const canonical = value => JSON.stringify(stable(value));
const decimalPlaces = n => { const [whole, exponent = '0'] = String(n).toLowerCase().split('e'); return Math.max(0, (whole.split('.')[1]?.length ?? 0) - Number(exponent)); };
const difference = (source, cabin) => {
  if (!isMeasure(source) || !Number.isFinite(cabin)) return null;
  const places = Math.min(15, Math.max(decimalPlaces(cabin), ...[source].flat().map(decimalPlaces)));
  return Number(gap(source, cabin).toFixed(places));
};
const priority = (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
  || b.related_findings - a.related_findings || b.related_rows - a.related_rows || compare(a.question_id, b.question_id);
const RULE = 'Unanswered questions first, extrapolated questions second; nearby questions are excluded. Within each group: more findings about the same material, then more counted source-table rows about that material, then question ID in ascending code-point order. Take the first three. Related evidence is context, not an answer to the missing concern. This is a research agenda, not a risk score.';
const SCOPE = 'Coverage within the loaded VESTA collection, not a safety verdict or a NASA review.';
const DISCLOSURE = 'Prepared with SI assistance. Deterministic calculation, no model at runtime.';

function rowSource(row, db, role, findingId = null) {
  return { role, finding_id: findingId, row_id: row.id, investigation_id: row.psi_id ?? null,
    investigation: row.investigation ?? db.invById[row.psi_id]?.name ?? null,
    table_file: row.table_file ?? null, row: row.row ?? null,
    source_url: row.psi_url || db.invById[row.psi_id]?.psi_url || null };
}

function findingSources(finding, db, role) {
  const ids = [...new Set([...(finding.row_ids ?? []), ...(finding.cells ?? []).map(c => c.row_id)])].sort(compare);
  if (ids.length) return ids.map(id => {
    const row = db.testById[id];
    if (!row) throw new Error(`Missing source row: ${id}`);
    return rowSource(row, db, role, finding.id);
  });
  return [{ role, finding_id: finding.id, row_id: null, investigation_id: finding.n.psi_id ?? null,
    investigation: finding.investigation ?? null, table_file: null, row: null, source_url: finding.source?.url ?? null }];
}

function comparison(record, q, origin) {
  const n = record.n, pressure = n.p ?? n.p_inferred ?? null;
  return { origin, id: record.id,
    oxygen: { source: n.o2 ?? null, cabin: q.o2, delta_percentage_points: difference(n.o2, q.o2) },
    pressure: { source: pressure, cabin: q.p, delta_kpa: difference(pressure, q.p),
      basis: n.p != null ? 'reported' : n.p_inferred != null ? 'inferred' : 'unknown', inference_source: n.p_inferred_source ?? null },
    gravity: { source: record.gravity ?? record.conditions?.gravity ?? null, source_class: n.gclass ?? null,
      cabin: q.g, cabin_class: q.gclass, cabin_label: G[q.g]?.label ?? null, delta_g: null,
      note: 'Gravity is compared by class. A numeric gravity difference is not available from these normalized records.' } };
}

export async function createGapBrief(db, q) {
  const ordered = buildIndex({ tests: sorted(db.tests), findings: sorted(db.findings),
    investigations: [...db.investigations].sort((a, b) => compare(a.psi_id, b.psi_id)), presets: db.presets, meta: db.meta });
  const receipt = await createReceipt(ordered, { ...q, material: null, concern: CONCERNS[0] }), point = receiptQuery(receipt.query);
  const questions = receipt.result.cells.map(c => {
    const related = ordered.findings.filter(f => (f.n.material_ids ?? []).includes(c.material));
    const rows = ordered.rowsByMaterial[c.material] ?? [];
    const ranked = rank(related, { ...point, material: c.material, concern: c.concern }, ordered);
    const direct = ranked.find(r => c.finding_ids.includes(r.f.id));
    const context = ranked[0];
    const nearest = nearestRow(c.material, c.concern, point, ordered);
    const sources = [];
    if (nearest) sources.push(rowSource(nearest.row, ordered, c.status === 'PROVEN' ? 'nearby_row' : 'nearest_row'));
    if (direct) sources.push(...findingSources(direct.f, ordered, 'finding_for_question'));
    if (c.status === 'NEVER_TESTED') {
      if (context) sources.push(...findingSources(context.f, ordered, 'related_only'));
      if (rows[0]) sources.push(rowSource(rows[0], ordered, 'related_only'));
    }
    const unique = [...new Map(sources.map(s => [canonical(s), s])).values()].sort((a, b) => compare(canonical(a), canonical(b)));
    return { id: `${c.material}/${c.concern}`, material_id: c.material, material: ordered.materials[c.material]?.label ?? c.material,
      concern: c.concern, status: c.status, reasons: c.reasons, coverage_source: 'design-coverage',
      row_count: c.rows, nearby_row_ids: [...(c.hit_ids ?? [])].sort(compare), finding_ids: [...c.finding_ids].sort(compare),
      nearest_row_id: nearest?.row.id ?? null,
      comparison: nearest ? comparison(nearest.row, point, 'row') : direct ? comparison(direct.f, point, 'finding') : null,
      related_findings: related.length, related_rows: rows.length,
      lead_finding: direct ? { id: direct.f.id, text: direct.f.claim || direct.f.quote || direct.f.title, relevance: direct.total }
        : context && c.status === 'NEVER_TESTED' ? { id: context.f.id, text: context.f.claim || context.f.quote || context.f.title, relevance: context.total, related_only: true } : null,
      sources: unique };
  }).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || compare(a.id, b.id));
  const agenda = questions.filter(c => c.status !== 'PROVEN').map(c => ({ question_id: c.id, status: c.status,
    related_findings: c.related_findings, related_rows: c.related_rows })).sort(priority).slice(0, 3);
  return stable({ schema: GAP_BRIEF_SCHEMA, scope: SCOPE, disclosure: DISCLOSURE, query: receipt.query,
    basis: receipt.basis, method: { ...receipt.method, priority_id: 'vesta.research-agenda/1', priority_rule: RULE,
      difference: 'Cabin minus source, without the matching method rounding. For a source interval: distance to the nearest endpoint, or zero inside. Null means not available. Gravity classes are categorical, not numeric acceleration measurements.',
      priority_limit: 'Related findings and rows favour a starting point with context. They do not measure fire severity, independence of evidence, research cost or scientific importance.',
      universe: 'All indexed cabin materials crossed with the core concerns. Related counts use all loaded findings with the same material ID and all counted rows indexed for that material, across concerns. Counts are rows, not experiments.' },
    coverage: receipt.result.coverage, agenda, questions });
}

const value = (x, unit = '') => x == null ? 'unknown' : `${Array.isArray(x) ? x.join(' to ') : x}${unit}`;
const delta = (x, unit) => x == null ? 'unknown' : `${x > 0 ? '+' : ''}${x} ${unit}`;
export function gapComparisonText(c) {
  if (!c) return 'No source conditions to compare.';
  return `Oxygen ${value(c.oxygen.source, '%')} → ${value(c.oxygen.cabin, '%')}, difference ${delta(c.oxygen.delta_percentage_points, 'percentage points')}; pressure ${value(c.pressure.source, ' kPa')} (${c.pressure.basis}) → ${value(c.pressure.cabin, ' kPa')}, difference ${delta(c.pressure.delta_kpa, 'kPa')}; gravity ${c.gravity.source_class ?? 'unknown'} → ${c.gravity.cabin_label ?? c.gravity.cabin_class ?? 'unknown'} (${c.gravity.cabin_class ?? 'unknown'}). Numeric gravity difference unavailable.`;
}

export function gapQuestionText(c) {
  return `${c.material}: ${c.concern}. ${GAP_LABELS[c.status]}.`;
}

const clean = text => String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
const refText = source => `Finding ${source.finding_id ?? 'none'}; PSI ${source.investigation_id ?? 'not stated'}; table ${source.table_file ?? 'not applicable'}; row ${source.row ?? 'not applicable'}; row ID ${source.row_id ?? 'none'}; ${source.role}${source.source_url ? `; ${source.source_url}` : ''}`;

export function gapBriefMarkdown(brief) {
  const q = brief.query;
  const lines = ['# VESTA cabin research gaps', '', brief.scope, '', brief.disclosure, '',
    `Cabin: oxygen ${value(q.oxygen_percent, '%')}; pressure ${value(q.pressure_kpa, ' kPa')}; gravity ${G[q.gravity]?.label ?? q.gravity_class ?? 'unknown'}.`, '',
    `Collection: ${brief.basis.investigations} investigations; ${brief.basis.source_table_rows} source-table rows; ${brief.basis.findings} findings. SHA-256 ${brief.basis.digest}.`, '',
    `Coverage: ${brief.coverage.NEVER_TESTED} without evidence; ${brief.coverage.EXTRAPOLATED} extrapolated; ${brief.coverage.PROVEN} nearby.`, '',
    '## Questions to test first', '', brief.method.priority_rule, '', brief.method.priority_limit, ''];
  if (!brief.agenda.length) lines.push('No unanswered or extrapolated questions in the indexed material set.', '');
  for (const a of brief.agenda) {
    const c = brief.questions.find(c => c.id === a.question_id);
    lines.push(`- ${clean(gapQuestionText(c))} Related context: ${a.related_findings} findings; ${a.related_rows} source-table rows. See ${c.id} below for provenance.`);
  }
  for (const state of ORDER) {
    const questions = brief.questions.filter(c => c.status === state);
    lines.push('', `## ${GAP_LABELS[state]} (${questions.length})`, '');
    if (!questions.length) lines.push('None.');
    for (const c of questions) {
      lines.push(`- **${clean(c.material)}: ${c.concern}** [${c.id}]. ${c.row_count} rows; ${c.finding_ids.length} findings for this question. Coverage basis above.`);
      if (c.comparison) lines.push(`  ${gapComparisonText(c.comparison)} Reference ${c.comparison.id}.`);
      if (c.lead_finding) lines.push(`  ${c.lead_finding.related_only ? 'Related only, does not answer this question' : 'Relevant finding'}: [${c.lead_finding.id}]. Relevance ${c.lead_finding.relevance}, not probability. Full finding in JSON and source drawer.`);
      if (!c.sources.length) lines.push('  No matching source; collection coverage calculation only.');
      for (const s of c.sources) lines.push(`  Source: ${clean(refText(s))}`);
    }
  }
  lines.push('', '## Method and limits', '', `Schema: ${brief.schema}. Matching: ${brief.method.id}.`, '', brief.method.universe, '',
    `Nearby means oxygen within ${brief.method.tolerances.oxygen_percentage_points} percentage points and pressure within ${brief.method.tolerances.pressure_kpa} kPa on the same row at the same gravity class.`, '', brief.method.difference, '',
    ...brief.method.limits.map(s => `- ${s}`), '', 'Keep the evidence receipt for reproducibility of the underlying coverage calculation. This brief does not replace it.', '');
  return lines.join('\n');
}

export const gapBriefJson = brief => JSON.stringify(stable(brief), null, 2) + '\n';

export function parseGapBrief(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_GAP_BRIEF_BYTES) throw new Error('Gap brief is missing or exceeds 2 MB.');
  let brief;
  try { brief = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!brief || brief.schema !== GAP_BRIEF_SCHEMA) throw new Error(`Expected ${GAP_BRIEF_SCHEMA}.`);
  if (!Array.isArray(brief.questions) || !Array.isArray(brief.agenda) || !brief.basis || !brief.method || !brief.coverage) throw new Error('Gap brief sections are missing.');
  receiptQuery(brief.query);
  return brief;
}

export async function recheckGapBrief(input, db) {
  let brief;
  try { brief = parseGapBrief(input); }
  catch (error) { return { status: 'INVALID', message: error.message }; }
  const current = await createGapBrief(db, receiptQuery(brief.query));
  return { status: canonical(current) === canonical(brief) ? 'MATCH' : 'CHANGED', current };
}
