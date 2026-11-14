import { match, TOL } from './match.js';
import { CONCERNS } from './index.js';

const nearest = (a, b) => a.fail.length - b.fail.length || Math.abs(a.delta.o2 ?? 99) - Math.abs(b.delta.o2 ?? 99)
                       || Math.abs(a.delta.p ?? 999) - Math.abs(b.delta.p ?? 999) || a.r.id.localeCompare(b.r.id);

export function cell(material, concern, q, db) {
  const rows  = (db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(concern));
  const finds = db.findings.filter(f => f.pillar === concern && (f.n.material_ids ?? []).includes(material));
  const out   = { material, concern, rows: rows.length, finding_ids: finds.map(f => f.id) };
  if (!rows.length && !finds.length)
    return { ...out, status: 'NEVER_TESTED', reasons: ['no_row_no_finding'], elsewhere: db.pillarsByMaterial[material] ?? [] };
  if (!rows.length) return { ...out, status: 'EXTRAPOLATED', reasons: ['finding_without_rows'] };
  const ms = rows.map(r => ({ r, ...match(r.n, q, db.base) })).sort(nearest), hits = ms.filter(m => m.fail.length === 0);
  if (hits.length) return { ...out, status: 'PROVEN', reasons: [], hit_ids: hits.map(m => m.r.id), observed: observed(hits.map(m => m.r)),
                            qualifier: hits.every(m => m.note.includes('pressure_inferred')) ? 'pressure_inferred' : null };
  return { ...out, status: 'EXTRAPOLATED', reasons: ms[0].fail, nearest: { id: ms[0].r.id, delta: ms[0].delta, note: ms[0].note } };
}

export function observed(rows) {
  const by = {};
  for (const r of rows) for (const [name, o] of Object.entries(r.outcomes ?? {})) (by[name] ||= []).push(o);
  return Object.entries(by).map(([name, os]) => { const v = os.map(o => o.value).filter(x => typeof x === 'number');
    return v.length ? { name, n: os.length, min: Math.min(...v), max: Math.max(...v), unit: os[0].unit }
                    : { name, n: os.length, texts: [...new Set(os.map(o => o.raw))].slice(0, 3) }; });
}

export function axes(q, db) {
  const inO2 = r => r.n.o2 != null && Math.abs(r.n.o2 - q.o2) <= TOL.o2 + 1e-9;
  const pOf  = r => r.n.p ?? r.n.p_inferred, inP = r => pOf(r) != null && Math.abs(pOf(r) - q.p) <= TOL.p + 1e-9;
  const c = db.cabinRows, m = db.modelRows, o2s = c.map(r => r.n.o2).filter(x => x != null);
  return { gravity:  { cabin: c.filter(r => r.n.gclass === q.gclass).length, all: db.tests.filter(r => r.n.gclass === q.gclass).length },
           o2:       { cabin: c.filter(inO2).length, model: m.filter(inO2).length,
                       cabin_min: o2s.length ? Math.min(...o2s) : null, cabin_max: o2s.length ? Math.max(...o2s) : null },
           pressure: { cabin: c.filter(inP).length, cabin_inferred: c.filter(r => r.n.p == null && inP(r)).length, model: m.filter(inP).length },
           joint:    { cabin: c.filter(r => inO2(r) && inP(r)).length, model: m.filter(r => inO2(r) && inP(r)).length } };
}

const EXPERIMENT = ['flight', 'ground_lowg', 'normal_g'];
export function findingStatus(f, q, db, ask = {}) {
  const m = match(f.n, q, db.base), reasons = [...m.fail];
  if (!EXPERIMENT.includes(f.n.work)) reasons.unshift('not_an_experiment');
  if (ask.fuel_class && f.n.fuel_class && f.n.fuel_class !== ask.fuel_class) reasons.push('different_fuel_class');
  return { status: reasons.length ? 'EXTRAPOLATED' : 'PROVEN', reasons, note: m.note, delta: m.delta };
}


export { CONCERNS };

export function cells(q, db, materials = Object.keys(db.materials)) {
  const out = [];
  for (const m of materials) for (const c of CONCERNS) out.push(cell(m, c, q, db));
  return out;
}

export function tally(list) {
  const t = { PROVEN: 0, EXTRAPOLATED: 0, NEVER_TESTED: 0 };
  for (const c of list) t[c.status]++;
  return t;
}

export function matrix(q, db) {
  const rows = Object.keys(db.materials).map(m => {
    const cs = CONCERNS.map(c => cell(m, c, q, db));
    return { material: m, label: db.materials[m].label, rows: db.materials[m].rows, cells: cs,
             never: cs.filter(c => c.status === 'NEVER_TESTED').length, proven: cs.filter(c => c.status === 'PROVEN').length };
  });
  return rows.sort((a, b) => b.never - a.never || a.proven - b.proven || b.rows - a.rows || a.material.localeCompare(b.material));
}

export function nearestRow(material, concern, q, db) {
  const rows = (db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(concern));
  if (!rows.length) return null;
  const m = rows.map(r => ({ r, ...match(r.n, q, db.base) })).sort(nearest)[0];
  return { row: m.r, fail: m.fail, note: m.note, delta: m.delta };
}
