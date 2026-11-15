import { CONCERNS } from './index.js';
import { cells, tally, findingStatus } from './status.js';
import { match } from './match.js';
import { score, W, PARTIAL_SUPPORT } from './rank.js';

export const COLLECTION_LIMITS = [
  'This is the loaded VESTA collection, not the complete NASA archive.',
  'Source-table rows can represent tests, days, series, references, sessions or dataset entries; their sum is not a count of independent burns.',
  'Nearby conditions compare gravity class, oxygen and pressure. Airflow, geometry, thickness, ignition and suppressant configuration are not matched.',
  'Relevance weights are VESTA choices, not physical-risk weights. Missing conditions do not become measurements.',
  'Quote checks establish correspondence with cached source text, not independent scientific validation.'
];
export const CLAIMS_NOT_MADE = [
  'A nearby match certifies a material or cabin as safe.',
  'No source in this collection means no experiment exists elsewhere.',
  'Microgravity evidence is a measured lunar or Martian result.',
  'A relevance score predicts fire probability, severity or operational success.',
  'The illustrative flame, scripted drill or robotics concept is validated flight hardware or a physical simulation.'
];
const countBy = (values, key) => {
  const out = {};
  for (const value of values) { const k = key(value) || 'not reported'; out[k] = (out[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
};
const range = values => values.length ? [values.reduce((a, b) => a < b ? a : b), values.reduce((a, b) => a > b ? a : b)] : null;
export function collectionSummary(db) {
  const uniqueSources = new Map();
  for (const s of db.sources.length ? db.sources : db.findings.map(f => f.source)) {
    if (s) uniqueSources.set(s.key || `${s.kind}:${s.id || s.url}`, s);
  }
  const sources = [...uniqueSources.values()];
  const years = sources.map(s => s.year).filter(y => Number.isInteger(y) && y >= 1000 && y <= 9999);
  const dated = db.tests.filter(r => typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && !Number.isNaN(Date.parse(r.date)) && new Date(r.date).toISOString().slice(0, 10) === r.date);
  const dates = dated.map(r => r.date), buildDate = db.meta?.generated_at?.slice(0, 10) ?? null;
  const afterBuild = buildDate ? dated.filter(r => r.date > buildDate) : [];
  const withinBuild = buildDate ? dated.filter(r => r.date <= buildDate) : dated;
  return {
    schema: 'vesta.collection-summary/1', build: db.meta?.generated_at ?? null,
    investigations: db.investigations.length, source_table_rows: db.tests.length,
    source_tables: new Set(db.tests.map(r => `${r.psi_id}:${r.table_file}`)).size,
    findings: db.findings.length, sources: sources.length, source_types: countBy(sources, s => s.kind),
    source_year_range: range(years), sources_without_year: sources.length - years.length,
    row_date_range: range(dates), row_date_range_not_after_build: range(withinBuild.map(r => r.date)),
    row_dates_after_build: afterBuild.map(r => ({ id: r.id, date: r.date, source_date: r.date_raw ?? null })),
    rows_without_date: db.tests.length - dates.length,
    row_kinds: countBy(db.tests, r => r.row_kind), counting_rows: db.tests.filter(r => r.n.counts).length,
    cabin_rows: db.cabinRows.length, material_questions: Object.keys(db.materials).length * CONCERNS.length,
    excluded_investigations: db.excluded.map(i => ({ id: i.psi_id, name: i.name, reason: i.why || i.reason || 'Not reported' })),
    quote_gate: { checked: db.engine?.verifier?.quotes_checked ?? null, verified: db.engine?.verifier?.quotes_verified ?? null, rejected: db.engine?.verifier?.rejected?.length ?? null },
    limits: [...COLLECTION_LIMITS], claims_not_made: [...CLAIMS_NOT_MADE]
  };
}

// Identical ordering to status.nearestRow; no new physical-distance metric.
export function nearestSourceRows(material, concern, q, db, limit = 3) {
  return (db.rowsByMaterial[material] || []).filter(r => r.n.pillars.includes(concern))
    .map(row => ({ row, ...match(row.n, q, db.base) }))
    .sort((a, b) => a.fail.length - b.fail.length || Math.abs(a.delta.o2 ?? 99) - Math.abs(b.delta.o2 ?? 99)
      || Math.abs(a.delta.p ?? 999) - Math.abs(b.delta.p ?? 999) || a.row.id.localeCompare(b.row.id))
    .slice(0, Math.max(0, limit));
}

export function evidenceRegister(db, q, filters = {}) {
  const mode = ['questions', 'findings', 'rows'].includes(filters.mode) ? filters.mode : 'questions';
  let entries;
  const allCells = cells(q, db);
  if (mode === 'questions') entries = allCells.map(c => ({ id: `${c.material}:${c.concern}`, kind: 'question', materials: [c.material], concerns: [c.concern], status: c.status, sourceType: 'question', cell: c }));
  else if (mode === 'findings') entries = db.findings.map(f => ({ id: f.id, kind: 'finding', materials: f.n.material_ids || [], concerns: [f.pillar],
    status: findingStatus(f, q, db).status, sourceType: f.source?.kind || 'not reported', record: f }));
  else entries = db.tests.map(r => ({ id: r.id, kind: 'row', materials: r.n.material_id ? [r.n.material_id] : [], concerns: r.n.pillars || [],
    status: !r.n.counts ? 'NOT_COUNTED' : match(r.n, q, db.base).fail.length ? 'EXTRAPOLATED' : 'PROVEN', sourceType: 'psi-table', record: r }));
  const total = entries.length;
  entries = entries.filter(e => (!filters.material || e.materials.includes(filters.material))
    && (!filters.concern || e.concerns.includes(filters.concern)) && (!filters.coverage || e.status === filters.coverage)
    && (!filters.sourceType || e.sourceType === filters.sourceType));
  return { mode, total, count: entries.length, entries, questions: allCells.length, coverage: tally(allCells),
    filteredCoverage: countBy(entries, e => e.status) };
}

export function scoreFactors(f, q, db) {
  const current = score(f, q, db);
  return { total: current.total, multiplier: f.n.support === 'direct' ? 1 : PARTIAL_SUPPORT,
    factors: Object.entries(W).map(([key, maximum]) => ({ key, maximum, contribution: current.parts[key] })),
    explanation: 'The concern, cabin oxygen/pressure, gravity, selected material and habitat affect relevance. Evidence type and support come from the finding. A closer query is not stronger evidence.',
    excluded: 'Airflow, geometry, thickness, ignition and suppressant configuration have no score component; they are not compared.' };
}
