import { CONCERNS, G } from './index.js';
import { cell, nearestRow } from './status.js';
import { rank } from './rank.js';
import { matchPanel } from './matchpanel.js';
import { TOL } from './match.js';
import { pressureDependence } from './assumption-audit.js';
import { status as statusLabel } from './text.js';

const queryFields = ['preset', 'habitat', 'o2', 'p', 'g', 'gclass', 'material', 'concern'];
const copyQuery = q => Object.fromEntries(queryFields.map(key => [key, q?.[key] ?? null]));
export const questionNoteKey = q => JSON.stringify(copyQuery(q));
export const questionNoteMatches = (note, q) => note?.schema === 'vesta.question-note/1' && questionNoteKey(note.query) === questionNoteKey(q);
const safeUrl = value => typeof value === 'string' && /^https:\/\//.test(value) ? value : null;
const copy = value => JSON.parse(JSON.stringify(value));

// A derived, readable snapshot of one existing coverage calculation. This is
// not a replay envelope and does not introduce matching or ranking rules.
export function createQuestionNote(db, q) {
  if (!db?.materials?.[q?.material] || !CONCERNS.includes(q?.concern)) throw new Error('Select an indexed material and concern.');
  if (!Number.isFinite(q.o2) || !Number.isFinite(q.p) || !G[q.g] || G[q.g].gclass !== q.gclass) throw new Error('The cabin conditions are incomplete or inconsistent.');
  const query = copyQuery(q), result = cell(q.material, q.concern, q, db);
  const nearest = nearestRow(q.material, q.concern, q, db), row = nearest?.row ?? null;
  const findings = rank(result.finding_ids.map(id => db.findingById[id]).filter(Boolean), query, db).slice(0, 3);
  const pressure = pressureDependence(result, db);
  const sources = findings.map(({ f }) => ({ id: f.id, kind: 'finding', title: f.source?.title || f.title || f.id, url: safeUrl(f.source?.url) }));
  if (row) sources.unshift({ id: row.id, kind: 'source row', title: db.invById[row.psi_id]?.name || row.investigation || row.id,
    url: safeUrl(row.psi_url || db.invById[row.psi_id]?.psi_url), table: row.table_file ?? null, row: row.row ?? null });
  const inference = row?.n?.p == null ? row?.n?.p_inferred_source : null;
  if (inference?.url) sources.push({ id: inference.id || 'pressure-basis', kind: 'pressure assumption', title: inference.title || 'Facility pressure basis', url: safeUrl(inference.url) });
  const nextReview = result.status === 'NEVER_TESTED'
    ? 'Identify evidence for this exact material and concern. Evidence about another concern does not fill this gap.'
    : result.status === 'EXTRAPOLATED'
      ? 'Review the different or missing conditions before transferring this evidence to the cabin. Define what additional evidence would address the gap.'
      : 'Review the untested dimensions and any pressure assumptions before judging applicability. Nearby rows alone do not establish material safety.';
  return copy({ schema: 'vesta.question-note/1', query, material_label: db.materials[q.material].label,
    status: result.status, label: statusLabel(result.status), reasons: result.reasons,
    source_rows: result.rows, finding_ids: result.finding_ids, nearby_row_ids: result.hit_ids || [],
    pressure_basis: pressure, comparison: matchPanel(row, query, db), nearest_id: row?.id || null, sources,
    collection: { generated_at: db.meta?.generated_at || null, investigations: db.investigations.length, source_rows: db.tests.length, findings: db.findings.length },
    matching: { oxygen_percentage_points: TOL.o2, pressure_kpa: TOL.p, gravity: 'Same gravity class on the same material-and-concern row.' },
    next_review: nextReview,
    limits: ['Coverage is scoped to the loaded VESTA collection; absence here is not absence across NASA research.',
      'Airflow, sample geometry, thickness, ignition and suppressant configuration are not matched by the coverage rules.',
      'Facility-inferred pressure is a nominal assumption, not a pressure measurement in the source row.',
      'Source rows may describe a day or series; row counts are not independent experiment counts.',
      'This derived review note is not a safety assessment or a verified replay receipt. Save the evidence JSON separately to recheck its calculation.'] });
}

const clean = value => String(value ?? 'not reported').replace(/[\r\n]+/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
export function questionNoteMarkdown(note, currentQuery = note?.query) {
  if (!questionNoteMatches(note, currentQuery)) throw new Error('The selected question or cabin changed. Prepare a new review note.');
  const q = note.query;
  const lines = ['# VESTA question review', '', `Question: ${clean(note.material_label)} · ${q.concern} [${q.material}/${q.concern}]`, '',
    `Cabin: ${clean(q.preset)}; habitat ${clean(q.habitat)}; oxygen ${q.o2}%; pressure ${q.p} kPa; gravity ${G[q.g].label} (${q.gclass}).`, '',
    `Result: ${note.label}.`, '', `${note.source_rows} source-table rows and ${note.finding_ids.length} findings for this question; ${note.nearby_row_ids.length} nearby rows.`, '',
    `Nearby row IDs: ${note.nearby_row_ids.join(', ') || 'none'}.`, `Finding IDs: ${note.finding_ids.join(', ') || 'none'}.`, '',
    '## Source conditions', '', `Nearest source row: ${note.nearest_id || 'none for this question in the collection'}.`];
  for (const item of note.comparison.compared) lines.push(`- ${item.label}: ${item.state}. ${item.detail}`);
  if (note.comparison.deltaLegend) lines.push('', note.comparison.deltaLegend);
  if (!note.nearest_id) lines.push('No source-row comparison is available. Findings, if listed, remain findings rather than matched experiments.');
  if (note.pressure_basis.nearby) lines.push('', `Pressure basis of nearby rows: ${note.pressure_basis.reported} reported; ${note.pressure_basis.inferred} facility-inferred; ${note.pressure_basis.unknown} unknown.`);
  lines.push('', '## Original sources', '');
  if (!note.sources.length) lines.push('No direct source is indexed for this material-and-concern question.');
  for (const source of note.sources) lines.push(`- ${clean(source.id)} · ${source.kind}: ${clean(source.title)}${source.table ? `; table ${clean(source.table)}; row ${source.row ?? 'not reported'}` : ''}. ${source.url || 'Original URL not reported.'}`);
  lines.push('', '## Next human review', '', note.next_review, '', '## Method and limits', '',
    `Nearby rules: ${note.matching.gravity} Oxygen ±${note.matching.oxygen_percentage_points} percentage point; pressure ±${note.matching.pressure_kpa} kPa. Nearest means fewest failed conditions, then oxygen gap, pressure gap and row ID; it does not establish physical similarity.`, '',
    ...note.limits.map(line => `- ${line}`), '',
    `Loaded collection: ${note.collection.investigations} investigations; ${note.collection.source_rows} source-table rows; ${note.collection.findings} findings. Build timestamp: ${note.collection.generated_at || 'not reported'}.`, '',
    'Prepared from deterministic software outputs. Human interpretation and independent domain review remain necessary.', '');
  return lines.join('\n');
}
