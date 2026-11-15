import { isMeasure } from './match.js';
import { matchPanel } from './matchpanel.js';

export const ROW_COMPARISON_LIMIT = 3;
const copy = value => JSON.parse(JSON.stringify(value));
const present = value => value != null && value !== '';
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const gravity = { micro: 'Microgravity', partial: 'Partial gravity', normal: 'Normal gravity' };
const valueText = value => Array.isArray(value) ? value.map(String).join('–') : String(value);
const empty = (note = 'Not available as a comparable field in this record.') =>
  ({ value: null, unit: null, text: 'Not reported', basis: 'unknown', raw: null, note });
const field = (value, unit, basis, raw = null, note = '') => ({ value: copy(value), unit,
  text: `${valueText(value)}${unit ? ` ${unit}` : ''}`, basis, raw: present(raw) ? String(raw) : null, note });
const measure = (value, unit, basis = 'reported', raw = null, note = '') =>
  isMeasure(value) ? field(value, unit, basis, raw, note) : empty(note || undefined);
const descriptor = (value, basis = 'source description', note = '') =>
  present(value) ? field(String(value), null, basis, value, note) : empty();
const sourceValue = entry => {
  if (!entry) return empty();
  if (isMeasure(entry.value)) return field(entry.value, entry.unit || null, 'reported', entry.raw,
    entry.unit ? '' : 'Unit not stated in this field.');
  if (typeof entry.value === 'number' && !Number.isFinite(entry.value) && !present(entry.raw)) return empty();
  const value = present(entry.raw) ? entry.raw : entry.value;
  return present(value) ? field(String(value), entry.unit || null, 'source description', entry.raw) : empty();
};
const safeUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};

/** Equality of recorded values is not proof of a controlled experimental factor. */
export function compareRecordedValues(values) {
  const available = values.filter(v => v.basis !== 'unknown');
  if (!available.length) return { state: 'unknown', label: 'Unreported in all selected rows' };
  if (available.length !== values.length) return { state: 'incomplete', label: 'Unreported in some selected rows' };
  const keys = values.map(v => JSON.stringify([typeof v.value === 'string' ? clean(v.value) : v.value, v.unit]));
  if (new Set(keys).size > 1) return { state: 'different', label: 'Different recorded values' };
  if (new Set(values.map(v => v.basis)).size > 1) return { state: 'different_basis', label: 'Same value · different basis' };
  return { state: 'same', label: values.some(v => v.basis === 'facility-inferred')
    ? 'Same inferred value' : 'Same recorded value' };
}

function pressure(row) {
  const n = row.n;
  if (isMeasure(n.p)) return measure(n.p, 'kPa', 'reported', row.pressure_raw);
  if (isMeasure(n.p_inferred)) return measure(n.p_inferred, 'kPa', 'facility-inferred', null,
    n.p_inferred_source?.assumption || 'Pressure is not reported in this row; a nominal facility value is assumed.');
  return empty('No reported or facility-inferred pressure is available.');
}
function oxygen(row) {
  if (!isMeasure(row.n.o2)) return empty(row.o2_basis === 'burner_stream'
    ? 'Burner-stream oxygen is not an ambient-oxygen measurement.' : undefined);
  return measure(row.n.o2, '%', 'reported ambient value', row.o2_raw);
}
function specimen(row) {
  return descriptor(row.fuel_raw || row.fuel,
    'source description', row.fuel_from_row_above ? 'Material inherited from the preceding source row.' :
      'Source wording; no dimensional equivalence or thickness conversion is inferred.');
}
function sourceRecord(row, db, query) {
  const investigation = db.invById?.[row.psi_id];
  return { id: row.id, investigation_id: row.psi_id, investigation: row.investigation || investigation?.name || row.psi_id,
    table: row.table_file ?? null, row: row.row ?? null, label: row.test_label ?? null, date: row.date ?? null,
    row_kind: row.row_kind ?? null, source_url: safeUrl(row.psi_url || investigation?.psi_url),
    pressure_inference_url: safeUrl(row.n.p_inferred_source?.url),
    comparison: matchPanel(row, query, db) };
}

/** A descriptive worksheet over exact IDs. Does not alter matching, ranking or data. */
export function buildRowComparison(db, rowIds, query) {
  if (!db?.testById || !Array.isArray(rowIds) || rowIds.length < 2 || rowIds.length > ROW_COMPARISON_LIMIT)
    throw new Error('Choose two or three source rows to compare.');
  if (rowIds.some(id => typeof id !== 'string' || !Object.hasOwn(db.testById, id)))
    throw new Error('Every selected row must exist in the loaded collection.');
  if (new Set(rowIds).size !== rowIds.length) throw new Error('Choose different source rows.');
  if (!query || typeof query !== 'object') throw new Error('The saved cabin query is required.');
  const rows = rowIds.map(id => db.testById[id]);
  const dimension = (key, label, used, read) => {
    const values = rows.map(row => ({ row_id: row.id, ...read(row) }));
    const comparison = compareRecordedValues(values);
    return { key, label, used_by_cabin_match: used, state: comparison.state, comparison_label: comparison.label, values };
  };
  const dimensions = [
    dimension('gravity', 'Gravity class', true, row => row.n.gclass ?
      descriptor(gravity[row.n.gclass] || row.n.gclass, 'source context',
        'Normalized investigation or row context, not a per-row gravity measurement.') : empty()),
    dimension('oxygen', 'Ambient oxygen', true, oxygen),
    dimension('pressure', 'Pressure', true, pressure),
    dimension('specimen', 'Material / source wording', false, specimen),
    dimension('form', 'Recorded form', false, row => descriptor(row.fuel_form)),
    dimension('size', 'Recorded size / thickness', false, row => descriptor(row.fuel_size,
      'source description', 'Source descriptor, not a dimensional conversion or a claim of equivalent specimens.')),
    dimension('airflow', 'Physical airflow', false, row => measure(row.flow_cm_s, 'cm/s', 'reported', row.flow_raw,
      'Fan and air display settings are not converted into physical velocity.')),
    dimension('ignition_power', 'Ignition power', false, row => sourceValue(row.conditions?.ignition_power_w)),
    dimension('ignition_time', 'Ignition duration', false, row => sourceValue(row.conditions?.ignition_time_s)),
    dimension('suppressant', 'Suppressant configuration', false, () => empty('No explicit comparable suppressant-configuration field is available; inspect the source for context.'))
  ];
  const settings = ['fan_display', 'air_display', 'flow_restrictor'].filter(key => rows.some(row => present(row.conditions?.[key]?.raw)))
    .map(key => dimension(key, key.replaceAll('_', ' '), false, row => sourceValue(row.conditions?.[key])));
  const outcomeKeys = [...new Set(rows.flatMap(row => Object.keys(row.outcomes || {})))].sort();
  const outcomes = outcomeKeys.map(key => dimension(key, key.replaceAll('_', ' '), false, row => sourceValue(row.outcomes?.[key])));
  return { schema: 'vesta.row-comparison/1', query: copy(query), row_ids: [...rowIds],
    records: rows.map(row => sourceRecord(row, db, query)), dimensions, settings, outcomes,
    cross_investigation: new Set(rows.map(row => row.psi_id)).size > 1,
    scope: 'Descriptive comparison of source records, not a controlled experiment or a causal result. Row counts do not establish independent sample size.',
    matching_limit: 'Only gravity class, ambient oxygen and pressure enter cabin matching. Geometry, thickness, airflow, ignition and suppressant configuration remain outside it.',
    outcome_limit: 'Recorded outcomes are shown without pooling, fitting or predicting them. Different specimens, apparatus and unreported conditions can affect comparability.',
    unknown_limit: 'Unreported means unavailable as a comparable field here, not proof that the original investigation never documented it.' };
}
