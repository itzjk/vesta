// Extinction by ambient oxygen in the FLEX droplet table: every expectation is recounted
// from web/data/tests.json here, independently of the module under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OXYGEN_LIMIT, bandOf, diluentOf, wilson, limitRows, describe, fitLogistic, evaluate, modelLine, cellText, oxygenLimit } from '../../web/js/core/oxygen-limit.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tests = JSON.parse(read('../../web/data/tests.json')).tests;
const flex = tests.filter(row => row.psi_id === 'PSI-69' && row.outcomes?.test_end?.value != null);
const out = row => row.outcomes.test_end.value === 'extinction' ? 1 : 0;
const sum = (items, fn) => items.reduce((total, item) => total + fn(item), 0);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const isoDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const table = describe(tests), report = evaluate(tests), view = oxygenLimit(tests);
const BANNED = /\b(safe|safety|proven|proves|validated|certified|certif\w*|guarantee\w*|outperform\w*|superior)\b/i;

test('bands are fixed constants that partition every oxygen value exactly once', () => {
  assert.deepEqual(OXYGEN_LIMIT.bands.map(band => [band.min, band.max]), [[-Infinity, 18], [18, 22], [22, 30], [30, Infinity]]);
  assert.ok(Object.isFrozen(OXYGEN_LIMIT.bands) && OXYGEN_LIMIT.bands.every(Object.isFrozen));
  for (let o2 = 0; o2 <= 100; o2 += 0.25) assert.equal(OXYGEN_LIMIT.bands.filter(band => o2 > band.min && o2 <= band.max).length, 1);
  assert.deepEqual([18, 18.01, 22, 22.01, 30, 30.01].map(bandOf), ['le18', '18to22', '18to22', '22to30', '22to30', 'gt30']);
  assert.equal(bandOf(NaN), null); assert.equal(bandOf(undefined), null);
});

test('every labelled FLEX row is counted once, and every cell equals an independent recount', () => {
  const before = JSON.stringify(tests); describe(tests); evaluate(tests); assert.equal(JSON.stringify(tests), before, 'source rows are not mutated');
  const selected = limitRows(tests);
  assert.equal(selected.total, flex.length); assert.equal(table.rows_in_table, flex.length);
  assert.equal(selected.rows.length + selected.excluded, flex.length);
  assert.equal(Object.values(selected.exclusions).reduce((a, b) => a + b, 0), selected.excluded);
  assert.ok(selected.rows.length > 100 && selected.rows.every(row => row.n.gclass === 'micro' && row.fuel_form === 'droplet'));
  const edges = { le18: o => o <= 18, '18to22': o => o > 18 && o <= 22, '22to30': o => o > 22 && o <= 30, gt30: o => o > 30 };
  const group = { all: () => true, n2: r => r.composition.co2 === 0 && r.composition.he === 0, co2: r => r.composition.co2 > 0 && r.composition.he === 0,
    he: r => r.composition.he > 0 && r.composition.co2 === 0, co2_he: r => r.composition.co2 > 0 && r.composition.he > 0 };
  assert.ok(table.lines.length >= 6);
  for (const line of table.lines) {
    const own = selected.rows.filter(row => group[line.diluent](row) && (line.fuel === 'All fuels' || row.fuel === line.fuel));
    assert.equal(line.tests, own.length, `${line.diluent}/${line.fuel}`); assert.equal(line.extinction, sum(own, out));
    assert.deepEqual(line.cells.map(cell => cell.band), Object.keys(edges));
    for (const cell of line.cells) {
      const inBand = own.filter(row => edges[cell.band](row.n.o2));
      assert.equal(cell.tests, inBand.length); assert.equal(cell.extinction, sum(inBand, out));
      if (inBand.length) near(cell.share, sum(inBand, out) / inBand.length); else assert.equal(cell.share, null);
    }
    assert.equal(sum(line.cells, cell => cell.tests), line.tests); assert.equal(sum(line.cells, cell => cell.extinction), line.extinction);
  }
});

test('diluent conditions are separate rows that add up to the pooled row, per fuel and overall', () => {
  assert.ok(limitRows(tests).rows.every(row => ['n2', 'co2', 'he', 'co2_he'].includes(diluentOf(row))));
  assert.equal(diluentOf({ composition: { co2: null, he: 0 } }), null); assert.equal(diluentOf({}), null);
  const separate = table.lines.filter(line => line.diluent !== 'all');
  assert.ok(new Set(separate.map(line => line.diluent)).size >= 2, 'more than one diluent condition is reported');
  for (const fuel of ['All fuels', ...OXYGEN_LIMIT.fuels]) {
    const pooled = table.lines.find(line => line.diluent === 'all' && line.fuel === fuel), parts = separate.filter(line => line.fuel === fuel);
    assert.equal(sum(parts, line => line.tests), pooled.tests); assert.equal(sum(parts, line => line.extinction), pooled.extinction);
    pooled.cells.forEach((cell, i) => assert.equal(sum(parts, line => line.cells[i].tests), cell.tests));
  }
  for (const diluent of new Set(table.lines.map(line => line.diluent))) {
    const all = table.lines.find(line => line.diluent === diluent && line.fuel === 'All fuels'), fuels = table.lines.filter(line => line.diluent === diluent && line.fuel !== 'All fuels');
    assert.equal(sum(fuels, line => line.tests), all.tests); assert.match(all.diluent_label, diluent === 'all' ? /pooled/i : /Nitrogen only|With /);
  }
});

test('Wilson intervals match the textbook formula, contain the share and refuse impossible counts', () => {
  const z = 1.959963984540054;
  for (const line of table.lines) for (const cell of line.cells.filter(item => item.tests)) {
    const n = cell.tests, p = cell.extinction / n, centre = (p + z * z / (2 * n)) / (1 + z * z / n);
    const half = z / (1 + z * z / n) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    near(cell.low, Math.max(0, centre - half)); near(cell.high, Math.min(1, centre + half));
    assert.ok(cell.low <= cell.share + 1e-12 && cell.share <= cell.high + 1e-12 && cell.low >= 0 && cell.high <= 1);
    if (cell.extinction === 0) near(cell.low, 0); if (cell.extinction === n) near(cell.high, 1);
    assert.ok(cell.high - cell.low > 0, 'no interval collapses to a point, even at 0/n or n/n');
  }
  assert.ok(wilson(5, 10).high - wilson(5, 10).low > wilson(50, 100).high - wilson(50, 100).low);
  for (const [k, n] of [[0, 0], [3, 2], [-1, 5], [1.5, 4], [1, NaN]]) assert.deepEqual(wilson(k, n), { share: null, low: null, high: null });
  assert.equal(cellText({ tests: 0, extinction: 0 }), 'no tests'); assert.match(cellText(table.lines[0].cells[0]), /^\d+\/\d+ · \d+% \(\d+%–\d+%\)$/);
});

test('the Newton fit is deterministic, reaches a stationary point and stays finite under perfect separation', () => {
  const rows = limitRows(tests).rows, mean = sum(rows, r => r.n.o2) / rows.length, X = rows.map(r => [1, r.n.o2 - mean, r.fuel === 'Heptane' ? 1 : 0]), y = rows.map(out);
  const a = fitLogistic(X, y), b = fitLogistic(X, y);
  assert.deepEqual(a, b); assert.ok(a.converged && a.steps < 30);
  const p = X.map(x => 1 / (1 + Math.exp(-x.reduce((s, v, j) => s + v * a.beta[j], 0))));
  for (let j = 0; j < 3; j++) near(sum(X.map((x, i) => (y[i] - p[i]) * x[j]), v => v) - (j ? OXYGEN_LIMIT.ridge * a.beta[j] : 0), 0, 1e-6);
  near(sum(p, v => v), sum(y, v => v), 1e-6); // an intercept fit reproduces the observed total
  // Exact recovery on a constructed case: two groups with shares 1/4 and 3/4 give a log-odds gap of 2·ln 3.
  const X2 = [], y2 = []; for (let i = 0; i < 400; i++) { const g = i % 2; X2.push([1, g]); y2.push((i >> 1) % 4 < (g ? 3 : 1) ? 1 : 0); }
  const two = fitLogistic(X2, y2, { ridge: 0 }); near(two.beta[0], Math.log(1 / 3), 1e-7); near(two.beta[1], 2 * Math.log(3), 1e-7);
  const sep = fitLogistic([[1, -2], [1, -1], [1, 1], [1, 2]], [0, 0, 1, 1]);
  assert.ok(sep.beta.every(Number.isFinite) && sep.beta[1] > 0);
  assert.deepEqual(fitLogistic([], []).beta, []);
});

test('the held-out check uses only dated rows, whole days, and counts recomputed from its own predictions', () => {
  const dated = limitRows(tests).rows.filter(row => isoDay(row.date)), p = report.predictions, byId = new Map(dated.map(row => [row.id, row]));
  assert.equal(report.rows, dated.length); assert.equal(p.length, dated.length); assert.equal(new Set(p.map(item => item.row_id)).size, p.length);
  assert.equal(report.test_days, new Set(dated.map(row => row.date)).size); assert.equal(report.rows_excluded_unavailable_date, flex.length - dated.length - report.rows_excluded_other);
  assert.ok(report.rows_excluded_unavailable_date > 0 && report.test_days > 10);
  for (const item of p) {
    const row = byId.get(item.row_id), training = dated.filter(other => other.date !== row.date), rate = sum(training, out) / training.length;
    assert.equal(item.held_out_day, row.date); assert.equal(item.actual, out(row)); near(item.baseline_rate, rate); assert.equal(item.baseline_majority, rate >= .5 ? 1 : 0);
    const same = training.filter(other => other.fuel === row.fuel); near(item.fuel_baseline_rate, sum(same, out) / same.length);
    for (const spec of Object.keys(OXYGEN_LIMIT.specs)) assert.ok(item[spec] > 0 && item[spec] < 1);
  }
  const right = field => p.filter(item => (item[field] >= .5 ? 1 : 0) === item.actual).length, brier = field => sum(p, item => (item[field] - item.actual) ** 2) / p.length;
  assert.equal(report.baseline.correct, p.filter(item => item.baseline_majority === item.actual).length); near(report.baseline.brier, brier('baseline_rate'));
  assert.equal(report.fuel_baseline.correct, right('fuel_baseline_rate')); near(report.fuel_baseline.brier, brier('fuel_baseline_rate'));
  for (const [spec, m] of Object.entries(report.sensitivity)) {
    assert.equal(m.correct, right(spec)); near(m.brier, brier(spec)); near(m.accuracy, m.correct / p.length);
    assert.equal(m.beats_baseline, m.correct > Math.max(report.baseline.correct, report.fuel_baseline.correct));
    assert.equal(m.brier_below_baseline, m.brier < Math.min(report.baseline.brier, report.fuel_baseline.brier));
  }
  assert.equal(report.model, report.sensitivity[OXYGEN_LIMIT.primary]); assert.equal(report.ships, report.model.beats_baseline && report.model.brier_below_baseline);
  // One fold refitted by hand with fitLogistic gives the module's probabilities.
  const day = p[0].held_out_day, training = dated.filter(row => row.date !== day), mean = sum(training, r => r.n.o2) / training.length;
  const sd = Math.sqrt(sum(training, r => (r.n.o2 - mean) ** 2) / training.length), fitted = fitLogistic(training.map(r => [1, (r.n.o2 - mean) / sd]), training.map(out));
  for (const item of p.filter(q => q.held_out_day === day)) near(item.oxygen, 1 / (1 + Math.exp(-(fitted.beta[0] + fitted.beta[1] * (item.oxygen_percent - mean) / sd))), 1e-9);
});

test('a held-out day cannot influence its own predictions or baseline', () => {
  const day = report.predictions[0].held_out_day;
  const flipped = tests.map(row => row.psi_id === 'PSI-69' && row.date === day ? { ...row, outcomes: { ...row.outcomes, test_end: { value: out(row) ? 'completion' : 'extinction' } } } : row);
  const own = r => r.predictions.filter(item => item.held_out_day === day).map(({ actual, ...rest }) => rest);
  assert.deepEqual(own(evaluate(flipped)), own(report));
  assert.notDeepEqual(evaluate(flipped).predictions.filter(item => item.held_out_day === day).map(item => item.actual), report.predictions.filter(item => item.held_out_day === day).map(item => item.actual));
});

test('the model claim follows the held-out counts in both directions and is withheld when the baseline is not beaten', () => {
  const line = modelLine(report), m = report.model;
  for (const part of [`${m.correct}/${report.rows} held-out tests right`, `${report.baseline.correct}/${report.rows} for the majority baseline`,
    `Brier score ${m.brier.toFixed(3)} vs ${report.baseline.brier.toFixed(3)}`, `${report.test_days} test days`]) assert.ok(line.text.includes(part), `${part} missing from: ${line.text}`);
  assert.equal(line.ships, report.ships); assert.equal(view.model_ships, report.ships); assert.equal(view.model_line, line.text);
  assert.equal(/^No model is offered/.test(line.text), !report.ships);
  assert.ok(line.detail.includes(`${report.fuel_baseline.correct}/${report.rows}`) && line.detail.includes(`${report.sensitivity.oxygen.correct}/${report.rows}`));
  // Outcomes reassigned in a fixed pattern unrelated to oxygen: no signal, so no claim.
  let i = 0; const noise = tests.map(row => row.psi_id === 'PSI-69' && row.outcomes?.test_end ? { ...row, outcomes: { ...row.outcomes, test_end: { value: (i++ * 7) % 10 < 7 ? 'extinction' : 'disruption' } } } : row);
  const none = evaluate(noise), said = modelLine(none);
  assert.equal(none.ships, false); assert.equal(said.ships, false); assert.match(said.text, /^No model is offered: .*does not get more held-out tests right/);
  assert.ok(said.text.includes(`${none.model.correct}/${none.rows}`) && said.text.includes(`${none.baseline.correct}/${none.rows}`));
  assert.equal(oxygenLimit(noise).model_ships, false);
  // More right but a worse Brier score also withholds the claim.
  const mixed = modelLine({ ...report, ships: false, model: { ...m, beats_baseline: true, brier_below_baseline: false } });
  assert.equal(mixed.ships, false); assert.match(mixed.text, /Brier score is not lower/);
  for (const empty of [[], undefined, tests.filter(row => row.psi_id !== 'PSI-69'), flex.filter(row => row.date === day0())]) {
    const e = evaluate(empty); assert.equal(e.ships, false); assert.equal(modelLine(e).ships, false); assert.match(modelLine(e).text, /^No model result/);
  }
  assert.equal(describe([]).rows, 0); assert.match(oxygenLimit([]).lead, /^No FLEX droplet tests/);
});
function day0() { return report.predictions[0].held_out_day; }

test('headline text carries the recounted figures, states the scope in one line and makes no forbidden claim', () => {
  const pooled = flex, bands = [o => o <= 18, o => o > 18 && o <= 22, o => o > 22 && o <= 30, o => o > 30];
  for (const inBand of bands) { const rows = pooled.filter(row => inBand(row.n.o2)); if (rows.length) assert.ok(view.lead.includes(` ${sum(rows, out)}/${rows.length}`), view.lead); }
  assert.ok(view.lead.includes(`all ${flex.length} counted tests`));
  assert.match(OXYGEN_LIMIT.scope, /droplets in microgravity/); assert.match(OXYGEN_LIMIT.scope, /Not cabin materials and not a cabin prediction/);
  for (const text of [view.scope, view.limits, view.definition]) assert.ok(!text.includes('\n') && text.length < 200, text);
  const said = [view.lead, view.model_line, view.model_detail, view.scope, view.limits, view.definition, table.interval, report.method, report.baseline.rule, report.fuel_baseline.rule,
    ...table.lines.map(line => line.diluent_label), ...table.bands.map(band => band.label), modelLine(evaluate([])).text];
  for (const text of said) { assert.doesNotMatch(text, BANNED, text); assert.doesNotMatch(text, /undefined|NaN|null/); }
  assert.match(view.limits, /not independent/);
});

test('README states the same figures as a fresh calculation', () => {
  const readme = read('../../README.md'), cells = table.lines.find(line => line.diluent === 'all' && line.fuel === 'All fuels').cells, c = cells.map(cell => `${cell.extinction}/${cell.tests}`);
  const m = report.model, f3 = v => v.toFixed(3);
  for (const sentence of [
    `Of ${flex.length} FLEX droplet tests (PSI-69) with a recorded end state, the flame went out before the fuel was consumed in ${c[0]} at 18% oxygen or less, ${c[1]} over 18% to 22%, ${c[2]} over 22% to 30% and ${c[3]} over 30%.`,
    `holding out each of ${report.test_days} known test days in turn, gets ${m.correct}/${report.rows} held-out tests right versus ${report.baseline.correct}/${report.rows} for the majority baseline and ${report.fuel_baseline.correct}/${report.rows} for the same-fuel majority (Brier score ${f3(m.brier)} versus ${f3(report.baseline.brier)} and ${f3(report.fuel_baseline.brier)}; lower is better).`,
    `Oxygen percent alone gets ${report.sensitivity.oxygen.correct}/${report.rows}.`,
    `The ${report.rows_excluded_unavailable_date} tests without a usable date are left out of that check.`,
    'liquid fuel droplets in microgravity', 'not cabin materials, not a cabin prediction'
  ]) assert.ok(readme.includes(sentence), sentence);
  assert.equal(readme.includes('a logistic regression on oxygen percent and recorded fuel'), report.ships && OXYGEN_LIMIT.primary === 'oxygen_fuel');
});

test('the panel shows the table first, then the model line, then the demoted lookup, with no typed-in results', () => {
  const panel = read('../../web/js/world/outcome-panel.js'), css = read('../../web/css/outcome-panel.css');
  assert.match(panel, /element\.append\(title, scope, oxygen, lookupTitle, frame, fuelTable,/);
  assert.match(panel, /Nearest recorded tests \(secondary lookup\)/); assert.match(panel, /oxygenLimit\(db\.tests\)/);
  assert.match(panel, /Does NOT beat the overall baseline|does NOT beat the overall majority baseline/, 'the neighbour vote keeps its negative result');
  const order = ['oxygen.append(wrap,', 'view.model_line', 'view.limits'].map(text => panel.indexOf(text));
  assert.ok(order.every(i => i > 0)); assert.ok(panel.indexOf('wrap.append(table)') < panel.indexOf('oxygen.append(wrap,'));
  assert.match(panel, /oxygen\.append\(wrap, make\('p', [^)]*\), model\)/, 'table, note, then the model line');
  const figures = new Set([report.rows, report.model.correct, report.baseline.correct, report.fuel_baseline.correct, flex.length, ...table.lines[0].cells.flatMap(cell => [cell.extinction, cell.tests])].filter(n => n > 30));
  for (const n of figures) for (const [name, source] of [['panel', panel], ['module', read('../../web/js/core/oxygen-limit.js')]])
    assert.ok(!new RegExp(`(?<![\\d.#])${n}(?![\\d.])`).test(source), `result ${n} is typed into the ${name}`);
  for (const cls of ['op-oxygen', 'op-oxygen-table', 'op-model', 'op-note', 'op-lookup-title']) assert.ok(css.includes(`.${cls}`), cls);
  assert.doesNotMatch(css, /url\(|@import/); assert.doesNotMatch(panel, /https?:\/\//);
});
