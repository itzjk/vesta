// One screen, plain words, for one material-and-concern question: what was found, how close,
// what it rests on, what is not compared, and what a person should do next. It restates the
// existing coverage cell and pressure audit; it computes no new status.
import { pressureDependence } from './assumption-audit.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const REASON = {
  gravity_never_tested: 'this collection has no row at this gravity class', gravity_differs: 'the gravity class differs',
  gravity_not_reported: 'the row does not state gravity', o2_outside: 'oxygen is more than 1 percentage point away',
  o2_not_reported: 'oxygen is not reported', pressure_outside: 'pressure is more than 5 kPa away',
  pressure_not_reported: 'pressure is not reported', finding_without_rows: 'a finding names this material but no table row does'
};
const NOT_COMPARED = 'Airflow, geometry, thickness, ignition and suppressant are not compared.';

export function questionSummary(cell, db, { material = cell.material, concern = cell.concern, cabin = 'this cabin' } = {}) {
  const title = `${material} · ${concern}`, findings = cell.finding_ids?.length ?? 0;
  if (cell.status === 'NEVER_TESTED') return Object.freeze({ title, status: cell.status,
    answer: 'No source in this collection.',
    lines: Object.freeze([`VESTA holds no table row and no finding for this question.`,
      'This is about VESTA\'s collection. It does not mean NASA never studied the material.']),
    next: 'Ask for an attributable source before drawing any conclusion.' });
  if (cell.status === 'PROVEN') {
    const d = pressureDependence(cell, db);
    const basis = d.state === 'all_inferred' ? `In all of them the pressure is assumed from the facility, not reported in the row.`
      : d.state === 'all_reported' ? 'All of them report pressure in the row.'
      : `${d.reported} report pressure in the row; ${d.inferred} rely on an assumed facility pressure.`;
    return Object.freeze({ title, status: cell.status, answer: `Nearby evidence for ${cabin}.`,
      lines: Object.freeze([`${plural(d.nearby, 'source-table row')} match gravity class, oxygen and pressure together. Rows are not independent experiments.`,
        basis, NOT_COMPARED]),
      next: d.inferred ? 'Check whether the assumed pressure applies, then review the variables that are not compared.'
        : 'Review the variables that are not compared before using this evidence.' });
  }
  const reasons = (cell.reasons ?? []).map(key => REASON[key] ?? key.replaceAll('_', ' '));
  const hasRows = cell.rows > 0;
  return Object.freeze({ title, status: cell.status, answer: `No nearby source row for ${cabin}.`,
    lines: Object.freeze([`${plural(cell.rows, 'source-table row')} and ${plural(findings, 'finding')} name this question.`,
      !hasRows ? 'Findings exist, but no source-table row is available to compare.'
        : reasons.length ? `Nearest row: ${reasons.join('; ')}.` : 'The source conditions are incomplete or outside the matching rules.', NOT_COMPARED]),
    next: 'A specialist must judge whether this evidence transfers to the cabin.' });
}
