import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODEL, modelRows, validate, predict } from '../../web/js/core/outcome-model.js';

const tests = JSON.parse(fs.readFileSync(new URL('../../web/data/tests.json', import.meta.url), 'utf8')).tests;
const selected = modelRows(tests), rows = selected.rows, byId = new Map(rows.map(row => [row.id, row]));
const x = row => [row.n.o2, row.n.p, row.composition.co2, row.composition.he, row.conditions.droplet_diameter_mm.value];
const query = row => ({ fuel: row.fuel, ...Object.fromEntries(MODEL.features.map((name, i) => [name, x(row)[i]])) });
const report = validate(tests);
const countCorrect = (items, field) => items.filter(item => item[field] === item.actual).length;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('eligibility preserves source data and excludes unavailable dates separately from missing measurements', () => {
  const before = JSON.stringify(tests); modelRows(tests); validate(tests); assert.equal(JSON.stringify(tests), before);
  assert.equal(selected.total, 274); assert.equal(rows.length, 212); assert.equal(selected.excluded, 62);
  assert.deepEqual(selected.exclusions, { missing_input: 13, unavailable_test_date: 49, unsupported_record: 0 });
  assert.equal(selected.missing_inputs.droplet_diameter_mm, 12); assert.equal(selected.missing_inputs.pressure_kpa, 1);
  assert.equal(new Set(rows.map(row => row.date)).size, 66); assert.ok(rows.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date)));
  assert.ok(!byId.has('PSI-69:20'), 'A raw date is not silently converted into a grouping date');
  assert.equal(tests.find(row => row.id === 'PSI-69:20').date_raw, '10/24/09');
  assert.ok(selected.excluded_rows.some(item => item.id === 'PSI-69:114' && item.missing.includes('pressure_kpa')));
  assert.ok(rows.every(row => row.psi_id === 'PSI-69' && row.n.gclass === 'micro'));
});

test('each outer prediction excludes its entire day and its scale uses only training records', () => {
  assert.equal(report.predictions.length, rows.length);
  for (const fold of report.folds) {
    const train = rows.filter(row => row.date !== fold.held_out_day);
    assert.equal(fold.training_rows, train.length);
    for (let i = 0; i < MODEL.features.length; i++) {
      const mean = train.reduce((sum, row) => sum + x(row)[i], 0) / train.length;
      near(fold.scale.mean[i], mean);
      near(fold.scale.sd[i], Math.sqrt(train.reduce((sum, row) => sum + (x(row)[i] - mean) ** 2, 0) / train.length) || 1);
    }
  }
  for (const result of report.predictions) for (const id of result.neighbour_row_ids) {
    const source = byId.get(id); assert.ok(source); assert.notEqual(source.date, result.held_out_day); assert.equal(source.fuel, result.fuel);
  }
});

test('held-out labels and post-test fields cannot change their own predictions, selected k or scaling', () => {
  const day = rows[0].date, nextLabel = { extinction: 'completion', completion: 'disruption', disruption: 'extinction' };
  const changed = tests.map(row => row.date === day ? { ...row, outcomes: { ...row.outcomes,
    test_end: { value: nextLabel[row.outcomes.test_end.value] }, burn_time_s: { value: 9e9 }, burning_rate: { value: -99 } } } : row);
  const other = validate(changed), own = r => r.predictions.filter(item => item.held_out_day === day).map(({ row_id, predicted, neighbour_row_ids, reason }) => ({ row_id, predicted, neighbour_row_ids, reason }));
  assert.deepEqual(own(other), own(report));
  assert.deepEqual(other.folds.find(fold => fold.held_out_day === day), report.folds.find(fold => fold.held_out_day === day));
  const original = rows[0], onlyPost = tests.map(row => ({ ...row, outcomes: { ...row.outcomes, burn_time_s: { value: 1e12 }, flame_extinction_diameter_mm: { value: 1e12 } } }));
  assert.deepEqual(predict(onlyPost, query(original)), predict(tests, query(original)));
});

test('reported accuracy, abstention coverage and both baselines use their explicitly stated denominators', () => {
  const p = report.predictions, accepted = p.filter(item => item.predicted !== null);
  assert.equal(report.rows, p.length); assert.equal(report.answered, accepted.length); assert.equal(report.abstained, p.length - accepted.length);
  assert.equal(report.correct, countCorrect(p, 'predicted')); near(report.accuracy, report.correct / p.length);
  near(report.accepted_accuracy, report.correct / accepted.length); near(report.coverage, accepted.length / p.length);
  for (const [key, field] of [['baseline', 'majority_prediction'], ['fuel_baseline', 'fuel_majority_prediction']]) {
    assert.equal(report[`${key}_correct`], countCorrect(p, field));
    assert.equal(report[`accepted_${key}_correct`], countCorrect(accepted, field));
    near(report[`${key}_accuracy`], countCorrect(p, field) / p.length);
    near(report[`accepted_${key}_accuracy`], countCorrect(accepted, field) / accepted.length);
  }
  assert.equal(Object.values(report.confusion).reduce((a, b) => a + b, 0), p.length);
  for (const name of report.classes) {
    const group = p.filter(item => item.actual === name), c = report.class_recall[name];
    assert.equal(c.total, group.length); assert.equal(c.correct, countCorrect(group, 'predicted')); near(c.recall, c.correct / group.length);
  }
  assert.equal(report.beats_baseline, report.correct > report.baseline_correct);
  // Freeze the honest negative result for this source snapshot; no test demands a win.
  assert.deepEqual([report.correct, report.rows, report.baseline_correct, report.answered], [134, 212, 143, 187]);
  assert.equal(report.beats_baseline, false); assert.equal(report.class_recall.completion.correct, 1); assert.equal(report.class_recall.completion.total, 22);
});

test('an explicit same-table example returns traceable votes, not held-out performance or probabilities', () => {
  const row = rows[0], answer = predict(tests, query(row));
  assert.ok(report.classes.includes(answer.outcome)); assert.equal(answer.neighbour_row_ids.length, answer.k);
  assert.ok(answer.neighbour_row_ids.includes(row.id), 'A training example may retrieve itself; the UI must label this');
  assert.ok(answer.neighbour_row_ids.every(id => byId.get(id)?.fuel === row.fuel));
  assert.equal(Object.values(answer.votes).reduce((a, b) => a + b, 0), answer.k);
  assert.match(answer.scope, /Not a prediction for cabin materials/); assert.match(answer.support_rule, /not a calibrated probability/);
});

test('missing inputs, impossible mixtures and values beyond the marginal range refuse to vote', () => {
  const q = query(rows[0]);
  for (const key of MODEL.features) assert.equal(predict(tests, { ...q, [key]: undefined }).reason, 'missing_input', key);
  assert.equal(predict(tests, { ...q, fuel: 'PMMA' }).reason, 'fuel_not_in_table');
  assert.equal(predict(tests, { ...q, co2_fraction: .7, helium_fraction: .45 }).reason, 'invalid_input');
  assert.equal(predict(tests, { ...q, droplet_diameter_mm: -1 }).reason, 'invalid_input');
  assert.equal(predict(tests, { ...q, oxygen_percent: 95 }).reason, 'outside_table_range');
});

test('an unsupported combination refuses even when each of its five inputs is individually inside range', () => {
  const q = { fuel: 'Methanol', oxygen_percent: 34, pressure_kpa: 70.167369, co2_fraction: 0, helium_fraction: 0, droplet_diameter_mm: 1.61 };
  const same = rows.filter(row => row.fuel === q.fuel);
  for (let i = 0; i < MODEL.features.length; i++) assert.ok(q[MODEL.features[i]] >= Math.min(...same.map(row => x(row)[i])) && q[MODEL.features[i]] <= Math.max(...same.map(row => x(row)[i])));
  const result = predict(tests, q); assert.equal(result.outcome, null); assert.equal(result.reason, 'outside_joint_support');
  assert.ok(result.nearest_distance > result.support_threshold);
});

test('empty or single-day data cannot claim usable cross-day support or a validated baseline advantage', () => {
  const empty = validate([]); assert.equal(empty.rows, 0); assert.equal(empty.accuracy, null); assert.equal(empty.beats_baseline, false);
  const oneDay = rows.filter(row => row.date === rows[0].date);
  assert.equal(predict(oneDay, query(oneDay[0])).reason, 'outside_joint_support');
  const r = validate(oneDay); assert.equal(r.answered, 0); assert.equal(r.correct, 0); assert.equal(r.beats_baseline, false);
});
