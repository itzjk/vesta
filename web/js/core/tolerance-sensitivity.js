// Tolerance sensitivity: recount "nearby evidence" under other oxygen and pressure limits.
// Read-only. It never changes TOL, a coverage label, a receipt or an export; the shipped column must equal status.cell().
import { match, gap, TOL } from './match.js';
import { CONCERNS } from './index.js';

export const SCALES = [0.5, 1, 2, 4];
const EPS = 1e-9;                                   // the same edge allowance as core/match.js
const ATMOSPHERE = new Set(['o2_outside', 'pressure_outside']);
const trim = x => String(Math.round(x * 100) / 100);

export const tolerancesAt = scale => ({ scale, o2: TOL.o2 * scale, p: TOL.p * scale, shipped: scale === 1 });

// The existing matcher decides gravity and unreported conditions; only the two distance limits are re-read here.
// Returns null when the row cannot match at any tolerance, otherwise its distances from the cabin.
export function distance(c, q, base) {
  if (match(c, q, base).fail.some(code => !ATMOSPHERE.has(code))) return null;
  return { o2: Math.abs(gap(c.o2, q.o2)), p: Math.abs(gap(c.p ?? c.p_inferred, q.p)) };
}

export const within = (d, tol) => d != null && d.o2 <= tol.o2 + EPS && d.p <= tol.p + EPS;

const point = preset => ({ o2: preset.o2, p: preset.p_kpa, gclass: preset.gclass });

export function sensitivity(db, scales = SCALES) {
  const tolerances = scales.map(tolerancesAt);
  const questions = [];
  for (const material of Object.keys(db.materials)) for (const concern of CONCERNS)
    questions.push((db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(concern)));
  const presets = db.presets.map(preset => {
    const q = point(preset), counts = tolerances.map(() => 0);
    let reachable = 0;                              // questions with a same-gravity row that reports oxygen and pressure
    for (const rows of questions) {
      const ds = rows.map(r => distance(r.n, q, db.base)).filter(Boolean);
      if (ds.length) reachable++;
      tolerances.forEach((tol, i) => { if (ds.some(d => within(d, tol))) counts[i]++; });
    }
    return { id: preset.id, label: preset.label, o2: q.o2, p: q.p, gclass: q.gclass, g_display: preset.g_display ?? null,
             counts, reachable, fixed: counts.every(n => n === counts[0]) };
  });
  return { questions: questions.length, without_rows: questions.filter(rows => !rows.length).length,
           partial_rows: db.base.partial_rows, tolerances, presets };
}

const list = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// Display model for the Method & limits topic: plain strings only, so it is testable without a DOM.
export function sensitivityView(db, scales = SCALES) {
  const s = sensitivity(db, scales), shipped = s.tolerances.find(t => t.shipped);
  const columns = ['Cabin', ...s.tolerances.map(t => `±${trim(t.o2)} pt, ±${trim(t.p)} kPa${t.shipped ? ' (shipped)' : ''}`), 'Any oxygen and pressure'];
  const rows = s.presets.map(p => ({ id: p.id, label: `${p.label} (${trim(p.o2)}% O₂, ${trim(p.p)} kPa, ${p.g_display ?? p.gclass})`,
                                     cells: [...p.counts, p.reachable].map(String) }));
  const partial = s.presets.filter(p => p.gclass === 'partial'), zeroPartial = partial.length > 0 && s.partial_rows === 0 && partial.every(p => p.reachable === 0);
  const notes = [
    `The shipped limits (oxygen ±${trim(shipped?.o2 ?? TOL.o2)} percentage point, pressure ±${trim(shipped?.p ?? TOL.p)} kPa) are the VESTA team's choice. They are not a NASA criterion and are not derived from combustion physics. This table recounts coverage under other limits; it changes no label, receipt or export.`,
  ];
  if (zeroPartial) notes.push(`Does not change with tolerance: ${list(partial.map(p => p.label))} stay at 0 because this collection has no partial-gravity source-table rows. Gravity class is never relaxed.`);
  notes.push(`${s.without_rows} of ${s.questions} questions have no counting source-table row for that material and concern in this collection, so no tolerance reaches them. The last column is the ceiling: questions with a same-gravity row that reports oxygen and pressure.`);
  notes.push('A wider limit admits rows further from the cabin. It does not make them equivalent tests, and counts are questions, not independent experiments.');
  return { summary: 'Tolerance sensitivity', caption: `Questions with nearby evidence, of ${s.questions}, when both limits scale together`, columns, rows, notes, data: s };
}
