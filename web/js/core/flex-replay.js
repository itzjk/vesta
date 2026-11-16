// Replay data for the FLEX oxygen-band table: one record per counted droplet test,
// grouped by the same bands and drawn from the same rows as describe() in oxygen-limit.js.
// Pure: no DOM, no clock. Nothing here is typed in; every count comes from the loaded rows.
// Liquid fuel droplets in microgravity: not cabin materials.
import { OXYGEN_LIMIT, limitRows, bandOf, diluentOf } from './oxygen-limit.js';

export const REPLAY_SCOPE = 'Each mark is one recorded FLEX test (liquid droplets in microgravity). Marks are drawn, not footage. Not cabin materials.';
export const REPLAY_ORDER = 'Within a band, marks settle in order of recorded burn time, shortest first; tests with no recorded burn time settle last. Playback is not real time.';
/** Recorded end states, in legend order. The first one is the event the table counts. */
export const ENDINGS = Object.freeze([
  Object.freeze({ id: 'extinction', label: 'Extinction (went out on its own)', shape: 'disc' }),
  Object.freeze({ id: 'disruption', label: 'Disruption', shape: 'diamond' }),
  Object.freeze({ id: 'completion', label: 'Completion', shape: 'open square' })
]);
const OTHER = Object.freeze({ id: 'other', label: 'Other recorded ending', shape: 'bar' });

const finite = Number.isFinite;
const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });
const diluentLabel = id => OXYGEN_LIMIT.diluents.find(item => item.id === id)?.label ?? id;

/**
 * One record per counted test, grouped by oxygen band.
 * Display order inside a band is the table order (row id). `end_at` is the play time in (0, 1]
 * at which the mark settles: rank by recorded burn time inside the band; no burn time means 1.
 */
export function flexReplay(tests) {
  const { rows } = limitRows(tests);
  const bands = OXYGEN_LIMIT.bands.map(band => {
    const marks = rows.filter(row => bandOf(row.n.o2) === band.id).map(row => {
      const recorded = row.outcomes.test_end.value, burn = row.outcomes?.burn_time_s?.value, diluent = diluentOf(row);
      return { id: row.id, fuel: row.fuel, oxygen: row.n.o2, band: band.id, recorded,
        end: ENDINGS.some(item => item.id === recorded) ? recorded : OTHER.id,
        burn_time_s: finite(burn) && burn >= 0 ? burn : null, diluent, diluent_label: diluentLabel(diluent), end_at: 1 };
    }).sort(byId);
    const timed = marks.filter(mark => mark.burn_time_s !== null).sort((a, b) => a.burn_time_s - b.burn_time_s || byId(a, b));
    timed.forEach((mark, i) => { mark.end_at = (i + 1) / (timed.length + 1); });
    const counts = Object.fromEntries([...ENDINGS, OTHER].map(item => [item.id, marks.filter(mark => mark.end === item.id).length]));
    return { id: band.id, label: band.label, tests: marks.length, extinction: counts[OXYGEN_LIMIT.event], counts, timed: timed.length, marks };
  });
  return { id: 'flex-replay/1', event: OXYGEN_LIMIT.event, rows: rows.length, bands, endings: bands.some(band => band.counts.other) ? [...ENDINGS, OTHER] : [...ENDINGS] };
}

const clamp = t => finite(t) ? Math.min(1, Math.max(0, t)) : 0;
/** True once the mark has settled into its recorded end state at play time t. Nothing has settled at t = 0. */
export const hasEnded = (mark, t) => clamp(t) > 0 && mark.end_at <= clamp(t);
/** Per band at play time t in [0, 1]: which marks have settled, and how many of them ended in extinction. */
export function replayState(replay, t) {
  const at = clamp(t);
  return { t: at, bands: replay.bands.map(band => {
    const done = band.marks.filter(mark => hasEnded(mark, at));
    return { id: band.id, tests: band.tests, ended: done.length, extinction: done.filter(mark => mark.end === replay.event).length, ids: done.map(mark => mark.id) };
  }) };
}

const oxygenText = value => `${Math.round(value * 100) / 100}% oxygen`;
/** One line for a single mark: row id, fuel, oxygen, diluent group, recorded ending, burn time when recorded. */
export function markText(mark) {
  return `${mark.id} · ${mark.fuel} · ${oxygenText(mark.oxygen)} · ${mark.diluent_label.toLowerCase()} · recorded ending: ${mark.recorded}`
    + (mark.burn_time_s === null ? ' · no burn time recorded' : ` · burn time ${mark.burn_time_s} s`);
}
/** Live counter under a band. */
export const counterText = (extinction, tests) => `went out on their own: ${extinction} of ${tests}`;
/** Text equivalent of the finished replay: the same totals as the pooled row of the table. */
export function replaySummary(replay) {
  if (!replay.rows) return 'No FLEX droplet tests with a recorded end state are loaded.';
  const part = band => band.tests ? `${band.label}: ${band.extinction} of ${band.tests} went out on their own`
    + replay.endings.filter(item => item.id !== replay.event && band.counts[item.id]).map(item => `, ${band.counts[item.id]} ${item.id}`).join('') : `${band.label}: no tests`;
  return `Recorded endings of ${replay.rows} FLEX droplet tests by ambient oxygen band. ${replay.bands.map(part).join('. ')}.`;
}
