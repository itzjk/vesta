// Adversarial tests for the FLEX droplet table vote (web/js/core/outcome-model.js).
// Tests marked { todo: ... } FAIL TODAY on a confirmed defect; node:test reports them without failing the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODEL, modelRows, validate, predict } from '../../web/js/core/outcome-model.js';

const tests = JSON.parse(fs.readFileSync(new URL('../../web/data/tests.json', import.meta.url), 'utf8')).tests;
const { rows } = modelRows(tests);
const x = row => [row.n.o2, row.n.p, row.composition.co2, row.composition.he, row.conditions.droplet_diameter_mm.value];
const query = row => ({ fuel: row.fuel, ...Object.fromEntries(MODEL.features.map((name, i) => [name, x(row)[i]])) });
const base = query(rows[0]);
const topTwo = votes => Object.values(votes).sort((a, b) => b - a);

test('no query shape makes predict throw; every refusal carries a reason and no outcome', () => {
  const junk = [null, undefined, {}, [], 'Methanol', 5, true, { fuel: 'Methanol' }, { fuel: {} }, { fuel: '__proto__' }, { fuel: 'constructor' },
    { ...base, fuel: base.fuel.toLowerCase() }, { ...base, fuel: 'PMMA' },
    ...MODEL.features.flatMap(name => [null, undefined, '', '21', NaN, Infinity, -Infinity, [1, 2], {}, true, 21n].map(value => ({ ...base, [name]: value }))),
    { ...base, oxygen_percent: -1 }, { ...base, oxygen_percent: 101 }, { ...base, pressure_kpa: 0 }, { ...base, pressure_kpa: -5 },
    { ...base, droplet_diameter_mm: 0 }, { ...base, co2_fraction: -0.1 }, { ...base, helium_fraction: -0.1 },
    { ...base, co2_fraction: 0.9, helium_fraction: 0.9 }, { ...base, oxygen_percent: 1e9 }, { ...base, pressure_kpa: 1e308 }];
  const before = JSON.stringify(tests[0]);
  for (const q of junk) {
    let answer;
    assert.doesNotThrow(() => { answer = predict(tests, q); }, undefined, String(JSON.stringify(q, (k, v) => typeof v === 'bigint' ? `${v}n` : v)));
    assert.equal(answer.outcome, null);
    assert.ok(['fuel_not_in_table', 'missing_input', 'invalid_input', 'outside_table_range', 'outside_joint_support'].includes(answer.reason), answer.reason);
    assert.equal(answer.votes, undefined);
  }
  assert.equal(JSON.stringify(tests[0]), before);
});

test('an empty or one-row table abstains instead of answering or throwing', () => {
  assert.deepEqual(predict([], base), { outcome: null, reason: 'fuel_not_in_table', fuels: [] });
  assert.equal(predict([rows[0]], base).outcome, null);
  const empty = validate([]);
  assert.deepEqual([empty.rows, empty.answered, empty.accuracy, empty.balanced_accuracy, empty.beats_baseline], [0, 0, null, null, false]);
  const one = validate([rows[0]]);
  assert.deepEqual([one.rows, one.answered, one.correct], [1, 0, 0]);
});

test('each feature just outside its recorded same-fuel range is refused by name', () => {
  for (const fuel of [...new Set(rows.map(r => r.fuel))]) {
    const same = rows.filter(r => r.fuel === fuel), start = query(same[0]);
    MODEL.features.forEach((name, i) => {
      const values = same.map(r => x(r)[i]), lo = Math.min(...values), hi = Math.max(...values);
      for (const value of [hi + Math.max(1e-6, Math.abs(hi) * 1e-6), lo - Math.max(1e-6, Math.abs(lo) * 1e-6)]) {
        const answer = predict(tests, { ...start, [name]: value });
        assert.equal(answer.outcome, null, `${fuel} ${name} ${value}`);
        assert.ok(['outside_table_range', 'invalid_input'].includes(answer.reason), `${fuel} ${name} ${value}: ${answer.reason}`);
        if (answer.reason === 'outside_table_range') assert.ok(answer.outside.includes(name));
      }
    });
  }
});

test('answers only ever cite same-fuel rows of the eligible table and never claim more votes than neighbours', () => {
  const eligible = new Map(rows.map(r => [r.id, r]));
  for (const row of rows.filter((_, i) => i % 7 === 0)) {
    const answer = predict(tests, query(row));
    if (!answer.outcome) continue;
    assert.equal(Object.values(answer.votes).reduce((a, b) => a + b, 0), answer.neighbour_row_ids.length);
    assert.ok(answer.k <= answer.selected_k && MODEL.k_candidates.includes(answer.selected_k));
    for (const id of answer.neighbour_row_ids) assert.equal(eligible.get(id)?.fuel, row.fuel, id);
    assert.match(answer.scope, /Not a prediction for cabin materials/);
    assert.match(answer.support_rule, /not a calibrated probability/);
    assert.doesNotMatch(JSON.stringify(answer), /\bsafe\b|validated|certif|probability of/i);
  }
});

test('the evaluation never credits itself: abstentions count against it and the baseline flags follow the counts', () => {
  const v = validate(tests);
  assert.equal(v.answered + v.abstained, v.rows);
  assert.equal(v.correct, v.predictions.filter(p => p.predicted !== null && p.predicted === p.actual).length);
  assert.equal(v.beats_baseline, v.correct > v.baseline_correct);
  assert.equal(v.beats_fuel_baseline, v.correct > v.fuel_baseline_correct);
  assert.equal(Object.values(v.abstention_reasons).reduce((a, b) => a + b, 0), v.abstained);
  assert.equal(Object.values(v.class_recall).reduce((a, c) => a + c.total, 0), v.rows);
  assert.match(v.limits, /not material safety/);
  assert.doesNotMatch(v.method + v.limits + v.accuracy_scope + MODEL.scope, /validated|proven|certif/i);
});

// ---------------------------------------------------------------- confirmed defect

test('DEFECT outcome: a tied vote is not reported as an outcome (minimal two-row table)', { todo: 'outcome-model.js:55 breaks ties alphabetically, so "completion" wins every tie it is part of' }, () => {
  const make = (id, date, end) => ({ ...structuredClone(rows[0]), id, date, outcomes: { test_end: { value: end } } });
  const table = [make('PSI-69:a', '2020-01-01', 'extinction'), make('PSI-69:b', '2020-01-02', 'completion')];
  const answer = predict(table, base);
  assert.deepEqual(answer.votes, { extinction: 1, completion: 1 });
  assert.ok(answer.outcome === null || answer.tie === true, `1 vs 1 was reported as "${answer.outcome}"`);
});

test('DEFECT outcome: on the real table no answer names an outcome that merely tied for first place', { todo: 'outcome-model.js:55–56 and :91–94 — vote() returns a winner with no tie flag and infer() passes it on' }, () => {
  const tied = [];
  for (const row of rows) {
    const answer = predict(tests, query(row));
    if (!answer.outcome || answer.tie === true) continue;
    const [first, second = 0] = topTwo(answer.votes);
    if (first === second) tied.push(`${row.id} ${JSON.stringify(answer.votes)} -> ${answer.outcome}`);
  }
  assert.equal(tied.length, 0, `${tied.length} of ${rows.length} same-table queries: ${tied.slice(0, 4).join('; ')}`);
});
