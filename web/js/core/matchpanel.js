import { match, TOL, isMeasure } from './match.js';

const gravity = { micro: 'Microgravity', partial: 'Partial gravity', normal: 'Normal gravity' };
const number = value => String(Math.round(value * 10) / 10);
const measure = (value, unit) => !isMeasure(value) ? 'not reported' : Array.isArray(value) ? `${value.map(number).join(' to ')} ${unit}` : `${number(value)} ${unit}`;
const signed = value => `${value > 0 ? '+' : ''}${number(value)}`;
const exclusions = [['airflow', 'Airflow'], ['geometry', 'Sample geometry'], ['thickness', 'Thickness'], ['ignition', 'Ignition'], ['suppressant', 'Suppressant configuration']];

export function matchPanel(row, cabin, db) {
  const warning = 'A match does not establish safety.';
  if (!row) return { rowId: null, compared: [], notCompared: [], empty: 'No source row to compare with your cabin.', warning };
  const comparison = match(row.n, cabin, db.base), { fail, note, delta } = comparison;
  const state = codes => codes.some(code => fail.includes(code)) ? 'different' : 'matched';
  const gravityDetail = [`Row: ${gravity[row.n.gclass] || 'not reported'}`, `Cabin: ${gravity[cabin.gclass] || 'not reported'}`];
  const gravityRows = db.tests.filter(candidate => candidate.n.gclass === cabin.gclass).length;
  if (gravityRows === 0) gravityDetail.push('No rows at this gravity class in this collection');
  if (fail.includes('gravity_not_reported')) gravityDetail.push('comparison unavailable');
  const atmosphere = (key, label, value, cabinValue, unit, deltaKey, tolerance, codes) => {
    const difference = delta[deltaKey] ?? null;
    const inferred = key === 'pressure' && note.includes('pressure_inferred');
    const parts = [`Row: ${measure(value, unit)}${inferred ? ' (facility-inferred)' : ''}`, `Cabin: ${measure(cabinValue, unit)}`];
    parts.push(difference == null ? 'comparison unavailable' : `Δ ${signed(difference)} ${deltaKey === 'o2' ? 'pp' : 'kPa'}`);
    parts.push(`tolerance ±${tolerance} ${deltaKey === 'o2' ? 'pp' : 'kPa'}`);
    return { key, label, state: state(codes), detail: parts.join(' · '), delta: difference, inferred };
  };
  return { rowId: row.id, comparison, warning, empty: null,
    deltaLegend: 'Δ = cabin minus row, rounded to 0.1; pp = percentage points.' + ([row.n.o2, row.n.p ?? row.n.p_inferred].some(Array.isArray) ? ' For a reported range, Δ is the distance to its nearest edge, or 0 inside.' : ''),
    compared: [
      { key: 'gravity', label: 'Gravity class', state: state(['gravity_not_reported', 'gravity_differs', 'gravity_never_tested']), detail: gravityDetail.join(' · ') },
      atmosphere('oxygen', 'Oxygen', row.n.o2, cabin.o2, '%', 'o2', TOL.o2, ['o2_not_reported', 'o2_outside']),
      atmosphere('pressure', 'Pressure', row.n.p ?? row.n.p_inferred, cabin.p, 'kPa', 'p', TOL.p, ['pressure_not_reported', 'pressure_outside'])
    ],
    notCompared: exclusions.map(([key, label]) => ({ key, label, state: 'not-compared' })) };
}
