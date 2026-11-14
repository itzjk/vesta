export const TOL = { o2: 1.0, p: 5.0 };
const EPS = 1e-9, r1 = x => Math.round(x * 10) / 10;
export const isMeasure = v => Number.isFinite(v) || (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && v[0] <= v[1]);

export const gap = (v, x) => Array.isArray(v) ? (x < v[0] ? x - v[0] : x > v[1] ? x - v[1] : 0) : x - v;

export function match(c, q, base) {
  const fail = [], note = [], delta = {};
  if (c.gclass == null) fail.push('gravity_not_reported');
  else if (c.gclass !== q.gclass) fail.push(q.gclass === 'partial' && base.partial_rows === 0 ? 'gravity_never_tested' : 'gravity_differs');
  if (!isMeasure(c.o2) || !Number.isFinite(q.o2)) fail.push('o2_not_reported');
  else { const d = gap(c.o2, q.o2); delta.o2 = r1(d); if (Math.abs(d) > TOL.o2 + EPS) fail.push('o2_outside'); }
  const p = c.p ?? c.p_inferred ?? null;
  if (!isMeasure(p) || !Number.isFinite(q.p)) fail.push('pressure_not_reported');
  else { const d = gap(p, q.p); delta.p = r1(d); if (Math.abs(d) > TOL.p + EPS) fail.push('pressure_outside');
         if (c.p == null) note.push('pressure_inferred'); }
  return { fail, note, delta };
}
