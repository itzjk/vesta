import { presetPoint } from '../core/index.js';
import { cells, tally, nearestRow } from '../core/status.js';
import { matchPanel } from '../core/matchpanel.js';

export function buildQuestionModel(db) {
  const before = presetPoint(db, 'station', 'prevention', 'pmma');
  if (!Number.isFinite(before.o2) || !Number.isFinite(before.p) || !db.materials.pmma) {
    throw new Error('This walkthrough needs the station atmosphere and PMMA evidence.');
  }
  const after = { ...before, preset: 'custom', g: 'moon', gclass: 'partial', g_label: '1/6 g' };
  const first = cells(before, db), second = cells(after, db);
  const earlier = new Map(first.map(cell => [`${cell.material}:${cell.concern}`, cell]));
  const changed = second.filter(cell => earlier.get(`${cell.material}:${cell.concern}`)?.status !== cell.status)
    .map(cell => ({ key: `${cell.material}:${cell.concern}`, material: cell.material, concern: cell.concern,
      label: db.materials[cell.material]?.label || cell.material,
      before: earlier.get(`${cell.material}:${cell.concern}`).status, after: cell.status }))
    .sort((a, b) => Number(b.material === 'pmma') - Number(a.material === 'pmma') || a.key.localeCompare(b.key));
  const nearest = nearestRow('pmma', 'prevention', after, db)?.row ?? null;
  const comparison = matchPanel(nearest, after, db);
  return { before, after, cells: { before: first, after: second }, counts: { before: tally(first), after: tally(second) },
    selected: { before: first.find(cell => cell.material === 'pmma' && cell.concern === 'prevention'), after: second.find(cell => cell.material === 'pmma' && cell.concern === 'prevention') },
    nearbyRowIds: { before: [...new Set(first.flatMap(cell => cell.hit_ids || []))].sort(), after: [...new Set(second.flatMap(cell => cell.hit_ids || []))].sort() },
    total: first.length, changed, nearestId: nearest?.id ?? null, comparison,
    notCompared: comparison.notCompared,
    partialRows: db.tests.filter(row => row.n.gclass === 'partial').length };
}
