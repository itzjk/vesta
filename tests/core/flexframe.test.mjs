import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate } from '../../web/js/core/outcome-model.js';
import { FRAME_LABEL, frameSummary, fuelBreakdown } from '../../web/js/core/outcome-summary.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tests = JSON.parse(read('../../web/data/tests.json')).tests;
const report = validate(tests), p = report.predictions;
const answered = p.filter(item => item.predicted !== null);
const right = (items, field) => items.filter(item => item[field] === item.actual).length;

test('the lead sentence carries every framing figure, each recomputed from the held-out predictions', () => {
  const before = JSON.stringify(report), { label, sentence, figures } = frameSummary(report);
  assert.equal(JSON.stringify(report), before, 'summary must not mutate the validation object');
  const completion = p.filter(item => item.actual === 'completion');
  const expected = { rows: p.length, answered: answered.length, abstained: p.length - answered.length,
    correct: right(answered, 'predicted'), baseline_correct: right(p, 'majority_prediction'),
    answered_baseline_correct: right(answered, 'majority_prediction'),
    completion_correct: right(completion, 'predicted'), completion_total: completion.length };
  assert.deepEqual(figures, expected);
  assert.ok(expected.rows > expected.answered && expected.abstained > 0 && expected.completion_total > 0);
  for (const part of [`${expected.correct}/${expected.answered} right on the rows it answered`,
    `vs ${expected.answered_baseline_correct}/${expected.answered} for the majority baseline`,
    `(${expected.abstained} abstentions)`, `${expected.correct}/${expected.rows} vs ${expected.baseline_correct}/${expected.rows} over all rows`,
    `completion endings found: ${expected.completion_correct}/${expected.completion_total}`]) assert.ok(sentence.includes(part), `${part} missing from: ${sentence}`);
  assert.ok(!sentence.includes('\n') && sentence.length < 260 && sentence.trim().endsWith('.'), 'one short line');
  assert.equal((sentence.match(/\. /g) || []).length, 0, 'a single sentence');
  // The fixed label is only allowed while the all-row result does not beat the baseline.
  assert.equal(report.beats_baseline, false); assert.equal(label, FRAME_LABEL);
  assert.match(FRAME_LABEL, /^Exploratory pattern in one NASA table; no predictive advantage shown$/);
});

test('the label drops the no-advantage wording if a table ever beat the baseline, and never claims a win', () => {
  const better = { ...report, correct: report.baseline_correct + 1 }, s = frameSummary(better);
  assert.notEqual(s.label, FRAME_LABEL); assert.match(s.label, /^Exploratory pattern in one NASA table/);
  for (const text of [s.label, s.sentence, frameSummary(report).label, frameSummary(report).sentence])
    assert.doesNotMatch(text, /\b(safe|proven|validated|certified|outperform|accura|superior|predicts)\b/i);
});

test('per-fuel breakdown is recomputed from predictions, matches the validation object and adds up', () => {
  const before = JSON.stringify(report), { fuels, total } = fuelBreakdown(report);
  assert.equal(JSON.stringify(report), before);
  assert.deepEqual(fuels.map(item => item.fuel), [...new Set(p.map(item => item.fuel))].sort());
  assert.deepEqual(fuels.map(item => item.fuel), ['Heptane', 'Methanol']);
  for (const item of fuels) {
    const own = p.filter(row => row.fuel === item.fuel), ownAnswered = own.filter(row => row.predicted !== null), m = report.per_fuel[item.fuel];
    assert.deepEqual(item, { fuel: item.fuel, rows: own.length, answered: ownAnswered.length, abstained: own.length - ownAnswered.length,
      correct: right(ownAnswered, 'predicted'), baseline_correct: right(own, 'majority_prediction'), answered_baseline_correct: right(ownAnswered, 'majority_prediction') });
    assert.deepEqual([item.rows, item.answered, item.abstained, item.correct, item.baseline_correct, item.answered_baseline_correct],
      [m.rows, m.answered, m.abstained, m.correct, m.baseline_correct, m.accepted_baseline_correct]);
  }
  for (const key of ['rows', 'answered', 'abstained', 'correct', 'baseline_correct', 'answered_baseline_correct'])
    assert.equal(fuels.reduce((sum, item) => sum + item[key], 0), total[key], key);
  const f = frameSummary(report).figures;
  assert.deepEqual([total.rows, total.answered, total.abstained, total.correct, total.baseline_correct, total.answered_baseline_correct],
    [f.rows, f.answered, f.abstained, f.correct, f.baseline_correct, f.answered_baseline_correct]);
});

test('empty, missing or single-day validation yields no figures rather than invented ones', () => {
  for (const value of [undefined, null, {}, validate([])]) {
    const s = frameSummary(value); assert.equal(s.sentence, null); assert.equal(s.figures, null); assert.notEqual(s.label, FRAME_LABEL);
    assert.deepEqual(fuelBreakdown(value).fuels, []); assert.equal(fuelBreakdown(value).total.rows, 0);
  }
  const day = p[0].held_out_day, oneDay = validate(tests.filter(row => row.date === day)), s = frameSummary(oneDay);
  assert.equal(oneDay.answered, 0); assert.equal(s.figures.answered, 0);
  assert.ok(s.sentence.includes(`${oneDay.correct}/${oneDay.rows} vs ${oneDay.baseline_correct}/${oneDay.rows}`));
});

test('the panel and worker render the summary without typed-in results', () => {
  const panel = read('../../web/js/world/outcome-panel.js'), worker = read('../../web/js/world/outcome-worker.js'), summary = read('../../web/js/core/outcome-summary.js');
  assert.match(panel, /frameSummary\(value\)/); assert.match(panel, /fuelBreakdown\(value\)/);
  assert.ok(panel.indexOf('element.append(title, frame, fuelTable,') > 0, 'the framing leads the panel');
  assert.match(worker, /query == null/);
  const f = frameSummary(report).figures;
  for (const source of [panel, summary]) for (const n of new Set([f.rows, f.answered, f.correct, f.baseline_correct, f.answered_baseline_correct]))
    assert.ok(!new RegExp(`(?<![\\d.])${n}(?![\\d.])`).test(source), `result ${n} is typed into a source file`);
  // Panel and worker must load the same copy of the model module.
  const token = file => [...file.matchAll(/outcome-(?:model|summary|worker)\.js\?v=([\w-]+)/g)].map(match => match[1]);
  assert.equal(new Set([...token(panel), ...token(worker)]).size, 1);
});
