import { gap, match, isMeasure } from './match.js';

export const W     = { pillar: 30, atmosphere: 25, gravity: 15, level: 15, material: 10, habitat: 5 };
export const LEVEL = { flight: 1, ground_lowg: 0.8, normal_g: 0.6, summary: 0.5, operations: 0.5, model: 0.4 };
export const SPAN  = { o2: 15, p: 50 };
export const PARTIAL_SUPPORT = 0.85;
const near = (v, x, span) => !isMeasure(v) || !Number.isFinite(x) ? 0.3 : Math.max(0, 1 - Math.abs(gap(v, x)) / span);

export function score(f, q, db) {
  const n = f.n, ids = n.material_ids ?? [], habitats = n.habitats ?? [], t = {
    pillar:     f.pillar === q.concern ? 1 : (f.pillar === 'design' || f.pillar === 'response') ? 0.5 : 0.2,
    atmosphere: 0.7 * near(n.o2, q.o2, SPAN.o2) + 0.3 * near(n.p, q.p, SPAN.p),
    gravity:    n.gclass == null ? 0.3 : n.gclass === q.gclass ? 1 : 0.4,
    level:      LEVEL[n.work],
    material:   !q.material ? 0.5 : ids.includes(q.material) ? 1
              : (!ids.length && !n.fuel_class) ? 0.3
              : n.fuel_class === db.materials[q.material]?.fuel_class ? 0.5 : 0,
    habitat:    habitats.includes(q.habitat) ? 1 : 0 };
  const parts = {}; let sum = 0;
  for (const k in W) { parts[k] = W[k] * t[k]; sum += parts[k]; }
  return { total: Math.round(sum * (n.support === 'direct' ? 1 : PARTIAL_SUPPORT)), parts, terms: t };
}

export const rank = (findings, q, db) => findings.map(f => ({ f, ...score(f, q, db) }))
  .sort((a, b) => b.total - a.total || LEVEL[b.f.n.work] - LEVEL[a.f.n.work] || (b.f.source.year || 0) - (a.f.source.year || 0) || a.f.id.localeCompare(b.f.id));

export function rankInvestigations(db, q) {
  const by = {}; for (const r of rank(db.findings, q, db)) if (r.f.n.psi_id) (by[r.f.n.psi_id] ||= []).push(r.total);
  return db.investigations.map(i => { const s = (by[i.psi_id] || []).slice(0, 3), rows = db.rowsByPsi[i.psi_id] || [];
    return { psi_id: i.psi_id, score: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null, findings: (by[i.psi_id] || []).length,
             rows: rows.length, rows_at_cabin: rows.filter(r => match(r.n, q, db.base).fail.length === 0).length }; })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.rows_at_cabin - a.rows_at_cabin || b.rows - a.rows || a.psi_id.localeCompare(b.psi_id, 'en', { numeric: true }));
}
