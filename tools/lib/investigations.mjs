// VESTA build · investigations.mjs
// The 24 Investigation records of DESIGN.md 4.3: the PSI record, joined with what the test rows show (computed, never typed),
// the fact-sheet facts, and the reviewed SI-written summaries (labelled as such). Records with no PSI id are kept apart as `related`.
import { key } from './normalize.mjs';

const yearOf = s => { const m = String(s ?? '').match(/(\d{4})\s*$/); return m ? Number(m[1]) : null; };          // "01-01-2010" -> 2010
const stat = (rows, get, multiKey) => {
  const v = rows.map(get).filter(x => typeof x === 'number');
  const multi = [];
  for (const r of rows) { const m = r.multi?.[multiKey]; if (m && Array.isArray(m.values)) multi.push(m); }
  if (!v.length && !multi.length) return null;
  const out = { min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, n: v.length };
  out.min_row_ids = out.min == null ? [] : rows.filter(r => get(r) === out.min).map(r => r.id);
  out.max_row_ids = out.max == null ? [] : rows.filter(r => get(r) === out.max).map(r => r.id);
  if (multi.length) {
    const vals = [...new Set(multi.flatMap(m => m.values).filter(x => typeof x === 'number'))].sort((a, b) => a - b);
    out.multi = { rows: multi.length, kinds: [...new Set(multi.map(m => m.kind))].sort(), values: vals };
  }
  return out;
};
const count = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return m; };

export function buildInvestigations({ psi, tests, rows, facts, factPass, families, names, findings, research, tableNotes }) {
  const kept = psi.filter(p => p.in_combustion_science_area === true);
  const famOf = new Map(); for (const f of families.families ?? []) for (const id of f.psi_ids ?? []) famOf.set(id, f);
  const summaryOf = new Map((tests.summaries ?? []).map(s => [s.psi_id, s]));
  const tablesOf = new Map(); for (const t of tests.tables ?? []) (tablesOf.get(t.psi_id) ?? tablesOf.set(t.psi_id, []).get(t.psi_id)).push(t);
  const rowsOf = new Map(); for (const r of rows) (rowsOf.get(r.psi_id) ?? rowsOf.set(r.psi_id, []).get(r.psi_id)).push(r);
  const findingsOf = new Map(); for (const f of findings) if (f.n.psi_id) (findingsOf.get(f.n.psi_id) ?? findingsOf.set(f.n.psi_id, []).get(f.n.psi_id)).push(f.id);
  const researchOf = new Map(); for (const r of research) if (r.psi_id && !researchOf.has(r.psi_id)) researchOf.set(r.psi_id, r);
  const factsOf = new Map(), factsOther = new Map();
  for (const f of facts) {
    if (!factPass(f.id)) continue;
    const id = names.get(f.investigation);
    const fact = { id: f.id, field: f.field, fact: f.fact, quote: f.quote, source: f.source, context: f.context ?? null };
    if (id) (factsOf.get(id) ?? factsOf.set(id, []).get(id)).push(fact);
    else (factsOther.get(f.investigation) ?? factsOther.set(f.investigation, []).get(f.investigation)).push(fact);
  }

  const investigations = kept.map(p => {
    const rs = rowsOf.get(p.psi_id) ?? [], sum = summaryOf.get(p.psi_id) ?? null, fam = famOf.get(p.psi_id) ?? null, ts = tablesOf.get(p.psi_id) ?? [];
    const fuels = [...count(rs.map(r => r.fuel))].map(([fuel, n]) => ({ fuel, n })).sort((a, b) => (a.fuel == null) - (b.fuel == null) || b.n - a.n || String(a.fuel).localeCompare(String(b.fuel)));
    const forms = [...count(rs.map(r => r.fuel_form).filter(x => x != null))].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(x => x[0]);
    const ambient = rs.filter(r => r.o2_basis === 'ambient'), burner = rs.filter(r => r.o2_basis === 'burner_stream');
    const conditions = { o2: stat(ambient, r => r.o2_percent, 'o2_percent'), pressure_kpa: stat(rs, r => r.pressure_kpa, 'pressure_kpa'), flow_cm_s: stat(rs, r => r.flow_cm_s, 'flow_cm_s') };
    const burnerStat = stat(burner, r => r.o2_percent, null);
    if (burnerStat) conditions.o2_burner_stream = burnerStat;
    const si = researchOf.get(p.psi_id) ?? null;
    return {
      psi_id: p.psi_id, name: p.short_name || p.title, full_name: p.title, psi_url: p.url, doi: p.doi || null, license: p.license || null,
      family: fam?.id ?? null, family_label: fam?.label ?? null, project_type: p.project_type ?? null, platform: p.platform || null, hardware: p.hardware || null,
      years: p.dates && (yearOf(p.dates.investigation_start) != null || yearOf(p.dates.investigation_end) != null) ? [yearOf(p.dates.investigation_start), yearOf(p.dates.investigation_end)] : null,
      pi: p.pi || null, organization: p.organization || null,
      objectives: p.objectives || null, approach: p.description || null, hypothesis: p.hypothesis || null,
      n_tests: rs.length,
      tables: ts.map(t => ({ table_file: t.table_file, table_key: t.table_key || null, rows: t.rows, row_kind: t.row_kind, o2_basis: t.o2_basis || null, note: tableNotes.get(p.psi_id)?.id ?? null })),
      fuels, fuel_forms: forms, conditions,
      varied: (sum?.varied ?? []).map(v => ({ field: v.field, distinct: v.distinct, min: v.min ?? null, max: v.max ?? null, ...(v.values ? { values: v.values } : {}) })),
      constant: (sum?.constant ?? []).map(c => ({ field: c.field, value: c.value })),
      not_in_table: sum?.not_in_table ?? null,
      outcome_fields: (sum?.outcomes ?? []).map(o => o.name),
      psi_measurement_sentences: (p.measurements ?? []).map(m => m.text).filter(Boolean),
      facts: factsOf.get(p.psi_id) ?? [],
      publications: (p.publications ?? []).map(x => ({ title: x.title, doi: x.doi || null, authors: x.authors || null })),
      finding_ids: findingsOf.get(p.psi_id) ?? [],
      si_summary: si ? { label: 'summary written by the Extractor (SI)', from: si._file ?? null, fuels: si.fuels ?? null, sample_geometry: si.sample_geometry ?? null,
                         variables: si.variables ?? null, measurements: si.measurements ?? null, conditions: si.conditions ?? null } : null,
    };
  });

  // related: NASA investigations with no PSI record. Never rows, never counted among the 24.
  const relName = new Map(), relByName = new Map();
  for (const r of families.related ?? []) for (const a of [r.name, ...(r.aliases ?? [])]) relName.set(key(a), r.name);
  const rel = name => { const n = relName.get(key(name)); if (!n) return null;
    if (!relByName.has(n)) relByName.set(n, { name: n, full_name: null, tag: 'NASA page or report, not PSI data', finding_ids: [], facts: [], si_summary: null }); return relByName.get(n); };
  for (const r of families.related ?? []) rel(r.name);
  const unattached = new Map();
  for (const f of findings) { if (f.n.psi_id || f.investigation == null) continue; const x = rel(f.investigation); if (x) x.finding_ids.push(f.id); else unattached.set(f.investigation, (unattached.get(f.investigation) || 0) + 1); }
  for (const [name, list] of factsOther) { const x = rel(name); if (x) x.facts.push(...list); }
  for (const r of research) { if (r.psi_id) continue; const x = rel(r.name); if (!x) continue;
    x.full_name ??= r.full_name ?? null;
    x.si_summary ??= { label: 'summary written by the Extractor (SI)', from: r._file ?? null, fuels: r.fuels ?? null, sample_geometry: r.sample_geometry ?? null, variables: r.variables ?? null,
                       measurements: r.measurements ?? null, conditions: r.conditions ?? null, platform: r.platform ?? null, years: r.years ?? null }; }
  const related = [...relByName.values()].filter(x => x.finding_ids.length || x.facts.length || x.si_summary);

  const excluded = (tests.excluded ?? []).map(e => ({ psi_id: e.psi_id, name: e.investigation, research_area: e.research_area, why: e.reason }));
  return { investigations, related, excluded, unattached: [...unattached].map(([name, n]) => ({ name, findings: n })),
           facts_shipped: [...factsOf.values()].reduce((a, l) => a + l.length, 0), facts_related: related.reduce((a, x) => a + x.facts.length, 0),
           families: (families.families ?? []).map(f => ({ id: f.id, label: f.label, grouping: f.grouping, psi_ids: f.psi_ids, n: f.psi_ids.length, source: f.source ?? null })) };
}
