// Which nearby source rows report a pressure, and which only match because a nominal
// facility pressure is assumed. Reads the existing coverage cells and row records;
// it changes no match, rank, status or receipt.

const present = value => value !== null && value !== undefined;

// A zero or a [min, max] range is a reported value. Only null/undefined is missing.
export const pressureBasis = n => present(n?.p) ? 'reported' : present(n?.p_inferred) ? 'facility_inferred' : 'unknown';

const freeze = value => Object.freeze(value);

export function pressureDependence(cell, db) {
  const reported = [], inferred = [], unknown = [], sources = new Map();
  for (const id of cell?.hit_ids ?? []) {
    const n = db.testById?.[id]?.n, basis = pressureBasis(n);
    (basis === 'reported' ? reported : basis === 'facility_inferred' ? inferred : unknown).push(id);
    const source = basis === 'facility_inferred' ? n.p_inferred_source : null;
    if (source) sources.set(source.id ?? source.url ?? source.title, { id: source.id ?? null, title: source.title ?? null,
      url: source.url ?? null, assumption: source.assumption ?? null });
  }
  const nearby = reported.length + inferred.length + unknown.length;
  return freeze({ nearby, reported: reported.length, inferred: inferred.length, unknown: unknown.length,
    state: !nearby ? 'no_nearby_rows' : inferred.length === nearby ? 'all_inferred'
      : reported.length === nearby ? 'all_reported' : 'mixed',
    reported_row_ids: freeze(reported), inferred_row_ids: freeze(inferred), unknown_row_ids: freeze(unknown),
    inference_sources: freeze([...sources.values()].map(freeze)) });
}

export function pressureAudit(cells, db) {
  const out = { questions: 0, questions_all_inferred: 0, nearby: 0, reported: 0, inferred: 0, unknown: 0 };
  for (const cell of cells ?? []) {
    const d = pressureDependence(cell, db);
    if (!d.nearby) continue;
    out.questions++; if (d.state === 'all_inferred') out.questions_all_inferred++;
    out.nearby += d.nearby; out.reported += d.reported; out.inferred += d.inferred; out.unknown += d.unknown;
  }
  return freeze(out);
}

const rows = n => `${n} nearby row${n === 1 ? '' : 's'}`;

export function pressureDependenceText(d) {
  if (!d?.nearby) return '';
  const parts = [`${d.reported} with pressure reported in the row`, `${d.inferred} matched on a facility-inferred pressure`];
  if (d.unknown) parts.push(`${d.unknown} without a pressure basis`);
  return `Pressure basis of ${rows(d.nearby)}: ${parts.join(' · ')}.`;
}

export function pressureAuditText(audit) {
  if (!audit?.nearby) return '';
  const matches = `${audit.nearby} nearby row match${audit.nearby === 1 ? '' : 'es'}`;
  return `Pressure basis of ${matches} across these questions: ${audit.reported} reported in the row · ${audit.inferred} facility-inferred`
    + `${audit.unknown ? ` · ${audit.unknown} without a pressure basis` : ''}.`;
}

export const PRESSURE_DEPENDENCE_SCOPE = 'An inferred pressure is a nominal facility value assumed for the run, not a measurement in the source row. This count shows dependence on that assumption; it is not a safety probability.';
