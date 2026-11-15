export function plottedSummary(db, rows) {
  const summary = { loaded: db.tests.length, plotted: rows.length, excluded: db.tests.length - rows.length, reported: 0, inferred: 0, missing: 0, gravity: {} };
  for (const p of rows) {
    const n = p.row.n;
    summary[Number.isFinite(n.p) ? 'reported' : Number.isFinite(n.p_inferred) ? 'inferred' : 'missing']++;
    summary.gravity[p.plane] = (summary.gravity[p.plane] || 0) + 1;
  }
  return summary;
}

export function markGroups(rows) {
  const groups = new Map();
  for (const p of rows) {
    const key = JSON.stringify([p.plane, Number.isFinite(p.p) && p.p > 0 ? p.p : null, p.o2]);
    if (!groups.has(key)) groups.set(key, { key, rows: [] });
    groups.get(key).rows.push(p);
  }
  return [...groups.values()];
}
