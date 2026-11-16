// A bounded, deterministic neighbour vote over recorded FLEX droplet test endings.
// No burn-time or other post-test measurement is an input. This is neither a
// combustion simulation nor a prediction for cabin materials or spacecraft.
export const MODEL = Object.freeze({
  id: 'flex-droplet-test-end/2', investigation: 'PSI-69', outcome: 'test_end',
  features: Object.freeze(['oxygen_percent', 'pressure_kpa', 'co2_fraction', 'helium_fraction', 'droplet_diameter_mm']),
  k_candidates: Object.freeze([3, 5, 7, 9, 11]),
  support_quantile: .95,
  scope: 'Pattern in the FLEX droplet table (methanol and heptane droplets in microgravity). Not a prediction for cabin materials, other fuels, other gravity or any spacecraft.'
});
const finite = Number.isFinite;
const labels = ['completion', 'disruption', 'extinction'];
const label = row => row.outcomes?.test_end?.value ?? null;
const inputs = row => [row.n?.o2, row.n?.p, row.composition?.co2, row.composition?.he, row.conditions?.droplet_diameter_mm?.value];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const compositionValid = x => x[0] >= 0 && x[0] <= 100 && x[2] >= 0 && x[3] >= 0 && x[0] / 100 + x[2] + x[3] <= 1 + 1e-9;
const positiveDimensions = x => x[1] > 0 && x[4] > 0;
const tally = values => values.reduce((out, key) => { out[key] = (out[key] || 0) + 1; return out; }, {});
const ratio = (a, b) => b ? a / b : null;

// Dates are NOT recovered or invented. A raw date can exist while the normalized
// date is unavailable; such rows are explicitly excluded from both fit and CV.
export function modelRows(tests) {
  const all = tests.filter(row => row.psi_id === MODEL.investigation && label(row) !== null);
  const exclusions = { missing_input: 0, unavailable_test_date: 0, unsupported_record: 0 };
  const missing_inputs = Object.fromEntries(MODEL.features.map(name => [name, 0]));
  const excluded_rows = [], rows = [];
  for (const row of all) {
    const x = inputs(row), missing = MODEL.features.filter((name, i) => !finite(x[i]));
    let reason = null;
    if (missing.length) { reason = 'missing_input'; missing.forEach(name => missing_inputs[name]++); }
    else if (!validDate(row.date)) reason = 'unavailable_test_date';
    else if (!labels.includes(label(row)) || !['Methanol', 'Heptane'].includes(row.fuel) || row.n?.gclass !== 'micro'
      || !compositionValid(x) || !positiveDimensions(x)) reason = 'unsupported_record';
    if (reason) { exclusions[reason]++; excluded_rows.push({ id: row.id, reason, missing }); }
    else rows.push(row);
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { rows, excluded: all.length - rows.length, total: all.length, exclusions, missing_inputs, excluded_rows };
}
function scale(train) {
  const n = MODEL.features.length, mean = Array(n).fill(0), sd = Array(n).fill(0);
  for (const row of train) inputs(row).forEach((v, i) => { mean[i] += v / train.length; });
  for (const row of train) inputs(row).forEach((v, i) => { sd[i] += (v - mean[i]) ** 2 / train.length; });
  return { mean, sd: sd.map(v => Math.sqrt(v) || 1) };
}
function distance(a, b, s) { let d = 0; for (let i = 0; i < a.length; i++) d += ((a[i] - b[i]) / s.sd[i]) ** 2; return Math.sqrt(d); }
function neighbours(train, fuel, x, s) {
  return train.filter(row => row.fuel === fuel).map(row => ({ row, d: distance(inputs(row), x, s) }))
    .sort((a, b) => a.d - b.d || a.row.id.localeCompare(b.row.id));
}
function vote(list, k) {
  const counts = tally(list.slice(0, k).map(item => label(item.row)));
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { outcome: ranked[0]?.[0] ?? null, counts };
}
const majority = rows => vote(rows.map(row => ({ row })), rows.length).outcome;
const daysOf = rows => [...new Set(rows.map(row => row.date))].sort();
function chooseK(train) {
  const hits = Object.fromEntries(MODEL.k_candidates.map(k => [k, 0]));
  // Inner folds refit scaling as well as exclude the entire inner test day.
  for (const day of daysOf(train)) {
    const inner = train.filter(row => row.date !== day), s = scale(inner);
    for (const row of train.filter(row => row.date === day)) {
      const list = neighbours(inner, row.fuel, inputs(row), s);
      for (const k of MODEL.k_candidates) if (vote(list, k).outcome === label(row)) hits[k]++;
    }
  }
  return MODEL.k_candidates.reduce((best, k) => hits[k] > hits[best] ? k : best, MODEL.k_candidates[0]);
}
function fit(rows) {
  const s = scale(rows), k = chooseK(rows), support = {};
  for (const fuel of [...new Set(rows.map(row => row.fuel))]) {
    const same = rows.filter(row => row.fuel === fuel);
    const distances = same.map(row => neighbours(same.filter(other => other.date !== row.date), fuel, inputs(row), s)[0]?.d).filter(finite).sort((a, b) => a - b);
    support[fuel] = distances.length ? distances[Math.ceil(MODEL.support_quantile * distances.length) - 1] : null;
  }
  return { rows, s, k, support };
}
function infer(model, fuel, x) {
  const same = model.rows.filter(row => row.fuel === fuel);
  if (!same.length) return { outcome: null, reason: 'fuel_not_in_table', fuels: [...new Set(model.rows.map(row => row.fuel))].sort() };
  if (!x.every(finite)) return { outcome: null, reason: 'missing_input', missing: MODEL.features.filter((name, i) => !finite(x[i])) };
  if (!compositionValid(x) || !positiveDimensions(x)) return { outcome: null, reason: 'invalid_input' };
  const outside = MODEL.features.filter((name, i) => { const v = same.map(row => inputs(row)[i]); return x[i] < Math.min(...v) || x[i] > Math.max(...v); });
  if (outside.length) return { outcome: null, reason: 'outside_table_range', outside };
  const list = neighbours(model.rows, fuel, x, model.s), nearest_distance = list[0]?.d, support_threshold = model.support[fuel];
  if (!finite(support_threshold) || !finite(nearest_distance) || nearest_distance > support_threshold + 1e-12)
    return { outcome: null, reason: 'outside_joint_support', nearest_distance, support_threshold };
  const k = Math.min(model.k, list.length), result = vote(list, k);
  return { outcome: result.outcome, votes: result.counts, k, selected_k: model.k,
    neighbour_row_ids: list.slice(0, k).map(item => item.row.id), nearest_distance, support_threshold,
    support_rule: 'Within each same-fuel input range and the training-only 95th percentile of nearest cross-day distances. This is a support heuristic, not a calibrated probability.', scope: MODEL.scope };
}
function metrics(items) {
  const accepted = items.filter(item => item.predicted !== null), correct = accepted.filter(item => item.predicted === item.actual).length;
  const baseline_correct = items.filter(item => item.majority_prediction === item.actual).length;
  const fuel_baseline_correct = items.filter(item => item.fuel_majority_prediction === item.actual).length;
  const accepted_baseline_correct = accepted.filter(item => item.majority_prediction === item.actual).length;
  const accepted_fuel_baseline_correct = accepted.filter(item => item.fuel_majority_prediction === item.actual).length;
  return { rows: items.length, answered: accepted.length, abstained: items.length - accepted.length, coverage: ratio(accepted.length, items.length), correct,
    accuracy: ratio(correct, items.length), accepted_accuracy: ratio(correct, accepted.length),
    baseline_correct, baseline_accuracy: ratio(baseline_correct, items.length), fuel_baseline_correct, fuel_baseline_accuracy: ratio(fuel_baseline_correct, items.length),
    accepted_baseline_correct, accepted_baseline_accuracy: ratio(accepted_baseline_correct, accepted.length),
    accepted_fuel_baseline_correct, accepted_fuel_baseline_accuracy: ratio(accepted_fuel_baseline_correct, accepted.length),
    beats_baseline: correct > baseline_correct, beats_fuel_baseline: correct > fuel_baseline_correct };
}
export function validate(tests) {
  const selected = modelRows(tests), { rows } = selected, days = daysOf(rows), predictions = [], folds = [], chosen = {};
  for (const day of days) {
    const train = rows.filter(row => row.date !== day), test = rows.filter(row => row.date === day), model = fit(train);
    const common = majority(train); chosen[model.k] = (chosen[model.k] || 0) + 1;
    folds.push({ held_out_day: day, training_rows: train.length, k: model.k, scale: model.s, support_thresholds: model.support });
    for (const row of test) {
      const answer = infer(model, row.fuel, inputs(row)), ungated = vote(neighbours(train, row.fuel, inputs(row), model.s), model.k).outcome;
      predictions.push({ row_id: row.id, held_out_day: day, fuel: row.fuel, actual: label(row), predicted: answer.outcome,
        reason: answer.reason ?? null, neighbour_row_ids: answer.neighbour_row_ids ?? [], ungated_prediction: ungated,
        majority_prediction: common, fuel_majority_prediction: majority(train.filter(other => other.fuel === row.fuel)) });
    }
  }
  const counts = metrics(predictions), confusion = tally(predictions.map(item => `${item.actual}>${item.predicted ?? 'ABSTAIN'}`));
  const per_class = Object.fromEntries(labels.map(name => {
    const items = predictions.filter(item => item.actual === name), measured = metrics(items);
    return [name, { total: items.length, answered: measured.answered, correct: measured.correct, recall: measured.accuracy, accepted_recall: measured.accepted_accuracy }];
  }));
  return { model: MODEL.id, method: 'Outer leave-one-known-test-day-out. Inner leave-one-day-out selects k with scaling refit per inner fold. Range and joint-support thresholds use only outer training rows.',
    ...counts, rows_in_table: selected.total, rows_excluded: selected.excluded,
    rows_excluded_missing_input: selected.exclusions.missing_input, rows_excluded_unavailable_date: selected.exclusions.unavailable_test_date,
    exclusions: selected.exclusions, missing_inputs: selected.missing_inputs, excluded_rows: selected.excluded_rows,
    date_policy: 'Only valid ISO-normalized dates are used. Raw date strings are retained in the source but are not reinterpreted or assigned to an invented day.',
    test_days: days.length, baseline: 'Always the most common end state of the training days; same-fuel majority also reported.',
    accuracy_scope: 'All eligible held-out rows; abstentions count as unanswered, not correct. Accepted-case accuracy and both baselines use the same accepted subset.',
    class_recall: per_class, per_fuel: Object.fromEntries([...new Set(rows.map(row => row.fuel))].map(fuel => [fuel, metrics(predictions.filter(item => item.fuel === fuel))])),
    balanced_accuracy: predictions.length ? labels.reduce((sum, name) => sum + (per_class[name].recall ?? 0), 0) / labels.length : null,
    ungated_correct: predictions.filter(item => item.ungated_prediction === item.actual).length,
    ungated_accuracy: ratio(predictions.filter(item => item.ungated_prediction === item.actual).length, predictions.length),
    k_chosen: chosen, confusion, classes: labels.slice(), abstention_reasons: tally(predictions.filter(item => item.reason).map(item => item.reason)),
    predictions, folds, limits: 'One investigation, no independent external study or uncertainty interval. Test-day grouping does not establish independence across campaigns. Vote shares are not calibrated probabilities. Completion is a recorded test ending, not material safety.' };
}
export function predict(tests, query) {
  const { rows } = modelRows(tests);
  // All five inputs must be explicit, including zero diluent fractions.
  const x = [query?.oxygen_percent, query?.pressure_kpa, query?.co2_fraction, query?.helium_fraction, query?.droplet_diameter_mm];
  return infer(fit(rows), query?.fuel, x);
}
