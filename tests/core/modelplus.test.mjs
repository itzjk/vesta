// Extra checks on the FLEX extinction model: oxygen-threshold baseline, paired day bootstrap,
// disagreement counts, the undated-test sensitivity and the band chart geometry.
// Every expectation is recomputed here from web/data/tests.json, independently of the module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OXYGEN_LIMIT, limitRows, describe, evaluate, fitLogistic, bestCut, lcg, bootstrapDays, disagreements, checkLines, bandChart, oxygenLimit } from '../../web/js/core/oxygen-limit.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tests = JSON.parse(read('../../web/data/tests.json')).tests;
const out = row => row.outcomes.test_end.value === 'extinction' ? 1 : 0;
const sum = (items, fn) => items.reduce((total, item) => total + fn(item), 0);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const isoDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const counted = limitRows(tests).rows, dated = counted.filter(row => isoDay(row.date)), undated = counted.filter(row => !isoDay(row.date));
const report = evaluate(tests), view = oxygenLimit(tests), p = report.predictions;
const BANNED = /\b(safe|safety|proven|proves|validated|certified|certif\w*|guarantee\w*|outperform\w*|superior)\b/i;

// Independent brute force: every midpoint cut, both sides, first best in ascending order.
function bruteCut(rows) {
  const values = [...new Set(rows.map(row => row.n.o2))].sort((a, b) => a - b); let best = null;
  for (let i = 1; i < values.length; i++) for (const side of ['below', 'above']) {
    const cut = (values[i - 1] + values[i]) / 2, correct = rows.filter(row => ((row.n.o2 <= cut) === (side === 'below') ? 1 : 0) === out(row)).length;
    if (!best || correct > best.correct) best = { cut, side, correct };
  }
  return best;
}
const modelRight = item => ((item[OXYGEN_LIMIT.primary] >= .5 ? 1 : 0) === item.actual ? 1 : 0);
const majorityRight = item => (item.baseline_majority === item.actual ? 1 : 0), thresholdRight = item => (item.threshold === item.actual ? 1 : 0);

test('the oxygen-threshold baseline is the best single cut of the training days only, in every fold', () => {
  const byId = new Map(dated.map(row => [row.id, row]));
  for (const day of new Set(dated.map(row => row.date))) {
    const training = dated.filter(row => row.date !== day), expected = bruteCut(training), got = bestCut(training);
    assert.equal(got.cut, expected.cut); assert.equal(got.extinction_side, expected.side); assert.equal(got.correct, expected.correct);
    // No other cut on the training days does better, and the trivial "always one answer" rule does not either.
    assert.ok(got.correct >= Math.max(sum(training, out), training.length - sum(training, out)));
    for (const item of p.filter(q => q.held_out_day === day)) {
      const row = byId.get(item.row_id);
      assert.equal(item.threshold_cut, expected.cut);
      assert.equal(item.threshold, (row.n.o2 <= expected.cut) === (expected.side === 'below') ? 1 : 0);
    }
  }
  const t = report.threshold_baseline;
  assert.equal(t.correct, sum(p, thresholdRight)); near(t.accuracy, t.correct / p.length);
  assert.equal(t.cut_min, Math.min(...p.map(item => item.threshold_cut))); assert.equal(t.cut_max, Math.max(...p.map(item => item.threshold_cut)));
  const whole = bruteCut(dated); assert.deepEqual(t.all_dated_rows_cut, { cut: whole.cut, extinction_side: whole.side });
  assert.match(t.rule, /training days of each fold/);
  assert.equal(bestCut(dated.filter(row => row.n.o2 === dated[0].n.o2)), null, 'one oxygen value offers no cut');
});

test('the generator is a fixed 32-bit linear congruential sequence', () => {
  let state = BigInt(OXYGEN_LIMIT.bootstrap.seed) % (1n << 32n); const next = lcg(OXYGEN_LIMIT.bootstrap.seed);
  for (let i = 0; i < 500; i++) { state = (state * 1664525n + 1013904223n) % (1n << 32n); const value = next(); assert.equal(value, Number(state) / 2 ** 32); assert.ok(value >= 0 && value < 1); }
  const a = lcg(7), b = lcg(7), c = lcg(8); const first = [a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b()]); assert.notDeepEqual(first, [c(), c(), c()]);
});

test('the paired day bootstrap matches an independent re-implementation and is reproducible', () => {
  const u = report.uncertainty, { seed, resamples } = OXYGEN_LIMIT.bootstrap;
  assert.ok(Number.isInteger(resamples) && resamples >= 2000); assert.equal(u.resamples, resamples); assert.equal(u.seed, seed); assert.equal(u.level, 0.95);
  const dayNames = [...new Set(p.map(item => item.held_out_day))].sort(); assert.equal(u.test_days, dayNames.length); assert.equal(u.test_days, new Set(dated.map(row => row.date)).size);
  const days = dayNames.map(day => { const own = p.filter(item => item.held_out_day === day); return [own.length, sum(own, modelRight), sum(own, majorityRight), sum(own, thresholdRight)]; });
  let state = BigInt(seed); const draw = () => { state = (state * 1664525n + 1013904223n) % 4294967296n; return Math.floor(Number(state) / 4294967296 * days.length); };
  const series = { model: [], majority: [], threshold: [], model_minus_majority: [], model_minus_threshold: [] };
  for (let r = 0; r < resamples; r++) {
    let n = 0, m = 0, b = 0, t = 0; for (let k = 0; k < days.length; k++) { const d = days[draw()]; n += d[0]; m += d[1]; b += d[2]; t += d[3]; }
    series.model.push(m / n); series.majority.push(b / n); series.threshold.push(t / n); series.model_minus_majority.push((m - b) / n); series.model_minus_threshold.push((m - t) / n);
  }
  const q = (values, prob) => { const s = [...values].sort((x, y) => x - y), at = prob * (s.length - 1), lo = Math.floor(at), hi = Math.min(lo + 1, s.length - 1); return s[lo] + (s[hi] - s[lo]) * (at - lo); };
  const estimate = { model: sum(p, modelRight) / p.length, majority: sum(p, majorityRight) / p.length, threshold: sum(p, thresholdRight) / p.length };
  estimate.model_minus_majority = estimate.model - estimate.majority; estimate.model_minus_threshold = estimate.model - estimate.threshold;
  for (const [key, values] of Object.entries(series)) {
    near(u[key].low, q(values, .025)); near(u[key].high, q(values, .975)); near(u[key].estimate, estimate[key]);
    assert.ok(u[key].low < u[key].estimate && u[key].estimate < u[key].high, `${key} interval contains its estimate`);
  }
  for (const key of ['model_minus_majority', 'model_minus_threshold']) assert.equal(u[key].includes_zero, u[key].low <= 0 && u[key].high >= 0);
  near(u.model.estimate, report.model.accuracy); near(u.majority.estimate, report.baseline.accuracy); near(u.threshold.estimate, report.threshold_baseline.accuracy);
  assert.deepEqual(bootstrapDays(p), u); assert.deepEqual(evaluate(tests).uncertainty, u);
  // Another seed moves the ends a little, never the conclusion drawn from the point estimates.
  const other = bootstrapDays(p, { seed: 12345 }); assert.notDeepEqual(other.model, u.model); assert.ok(Math.abs(other.model.low - u.model.low) < 0.03 && Math.abs(other.model.high - u.model.high) < 0.03);
  assert.equal(bootstrapDays(p.filter(item => item.held_out_day === dayNames[0])), null, 'one day cannot be resampled');
});

test('disagreement counts are exact and reconcile with the held-out totals', () => {
  for (const [key, rule, baselineRight, baselineCorrect] of [['vs_majority', 'majority', majorityRight, report.baseline.correct], ['vs_threshold', 'threshold', thresholdRight, report.threshold_baseline.correct]]) {
    const d = report.paired[key];
    assert.deepEqual(d, { both_right: p.filter(i => modelRight(i) && baselineRight(i)).length, model_only: p.filter(i => modelRight(i) && !baselineRight(i)).length,
      baseline_only: p.filter(i => !modelRight(i) && baselineRight(i)).length, both_wrong: p.filter(i => !modelRight(i) && !baselineRight(i)).length });
    assert.deepEqual(disagreements(p, rule), d);
    assert.equal(d.both_right + d.model_only + d.baseline_only + d.both_wrong, report.rows);
    assert.equal(d.both_right + d.model_only, report.model.correct); assert.equal(d.both_right + d.baseline_only, baselineCorrect);
    assert.equal(d.model_only - d.baseline_only, report.model.correct - baselineCorrect);
  }
});

test('the undated tests are explained and reported as one extra held-out group, recounted by hand', () => {
  const x = report.undated;
  assert.equal(undated.length, report.rows_excluded_unavailable_date); assert.ok(undated.length > 0 && undated.every(row => row.date === null));
  assert.ok(undated.some(row => typeof row.date_raw === 'string' && row.date_raw.length > 0), 'a raw date text exists, which the explanation says is kept');
  assert.equal(x.extra_group.rows, undated.length); assert.equal(x.all.rows, counted.length); assert.equal(x.groups, report.test_days + 1);
  assert.match(x.reason, /no normalized test date in this collection/); assert.match(x.reason, /not reinterpreted/); assert.match(x.method, /Sensitivity only/);
  // Extra group: everything is fitted on the dated rows only.
  const mean = sum(dated, r => r.n.o2) / dated.length, sd = Math.sqrt(sum(dated, r => (r.n.o2 - mean) ** 2) / dated.length);
  const fitted = fitLogistic(dated.map(r => [1, (r.n.o2 - mean) / sd, r.fuel === 'Heptane' ? 1 : 0]), dated.map(out));
  const prob = r => 1 / (1 + Math.exp(-(fitted.beta[0] + fitted.beta[1] * (r.n.o2 - mean) / sd + fitted.beta[2] * (r.fuel === 'Heptane' ? 1 : 0))));
  const rate = sum(dated, out) / dated.length, cut = bruteCut(dated);
  assert.equal(x.extra_group.model, undated.filter(r => (prob(r) >= .5 ? 1 : 0) === out(r)).length);
  assert.equal(x.extra_group.majority, undated.filter(r => (rate >= .5 ? 1 : 0) === out(r)).length);
  assert.equal(x.extra_group.threshold, undated.filter(r => ((r.n.o2 <= cut.cut) === (cut.side === 'below') ? 1 : 0) === out(r)).length);
  const fuelRate = fuel => { const same = dated.filter(r => r.fuel === fuel); return sum(same, out) / same.length; };
  assert.equal(x.extra_group.same_fuel_majority, undated.filter(r => (fuelRate(r.fuel) >= .5 ? 1 : 0) === out(r)).length);
  // The wider check recounted over all groups for the two rules that need no fit: undated tests join every dated fold's training rows.
  const groupOf = r => isoDay(r.date) ? r.date : 'undated'; let majority = 0, threshold = 0;
  for (const group of new Set(counted.map(groupOf))) {
    const training = counted.filter(r => groupOf(r) !== group), held = counted.filter(r => groupOf(r) === group), share = sum(training, out) / training.length, rule = bruteCut(training);
    majority += held.filter(r => (share >= .5 ? 1 : 0) === out(r)).length; threshold += held.filter(r => ((r.n.o2 <= rule.cut) === (rule.side === 'below') ? 1 : 0) === out(r)).length;
  }
  assert.equal(x.all.majority, majority); assert.equal(x.all.threshold, threshold);
  for (const key of ['model', 'majority', 'same_fuel_majority', 'threshold']) assert.ok(x.all[key] >= x.extra_group[key] && x.all[key] <= x.all.rows - (x.extra_group.rows - x.extra_group[key]));
  // The headline check is untouched by the sensitivity run.
  assert.equal(report.rows, dated.length); assert.equal(report.rows + x.extra_group.rows, x.all.rows);
});

test('the check sentences carry the computed numbers and say plainly when an interval includes zero', () => {
  const u = report.uncertainty, t = report.threshold_baseline, d = report.paired, x = report.undated, lines = Object.fromEntries(view.checks.map(item => [item.id, item]));
  const pc = v => `${(v * 100).toFixed(1)}%`, pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}`;
  assert.deepEqual(view.checks.map(item => item.id), ['threshold', 'interval', 'gap-majority', 'gap-threshold', 'paired', 'undated']);
  assert.deepEqual(checkLines(report), view.checks);
  assert.ok(lines.threshold.text.includes(`${t.correct}/${report.rows} held-out tests right`)); assert.match(lines.threshold.text, /chosen on training days only/);
  const lead = report.model.correct - t.correct;
  assert.ok(lines.threshold.text.includes(lead > 0 ? `${lead} fewer than the model` : lead < 0 ? `${-lead} more than the model` : 'the same as the model'));
  for (const key of ['model', 'majority', 'threshold']) assert.ok(lines.interval.text.includes(`${pc(u[key].estimate)} (${pc(u[key].low)} to ${pc(u[key].high)})`), key);
  assert.ok(lines.interval.text.includes(`${u.resamples.toLocaleString('en-US')} resamples of the ${u.test_days} test days`));
  for (const [id, key] of [['gap-majority', 'model_minus_majority'], ['gap-threshold', 'model_minus_threshold']]) {
    const g = u[key], text = lines[id].text;
    assert.ok(text.includes(`${pts(g.estimate)} points (${pts(g.low)} to ${pts(g.high)})`), text);
    assert.equal(/That interval includes zero, so this check does not show the model is more accurate/.test(text), g.includes_zero, text);
    assert.equal(/That interval excludes zero/.test(text), !g.includes_zero, text);
  }
  assert.equal(Boolean(lines['gap-threshold'].plain), u.model_minus_threshold.includes_zero);
  assert.ok(lines.paired.text.includes(`wrong on ${d.vs_majority.model_only} tests, the reverse on ${d.vs_majority.baseline_only}`) && lines.paired.text.includes(`${d.vs_threshold.model_only} and ${d.vs_threshold.baseline_only}`));
  assert.ok(lines.undated.text.includes(`model ${x.all.model}/${x.all.rows}, majority ${x.all.majority}/${x.all.rows}, oxygen threshold ${x.all.threshold}/${x.all.rows}`));
  assert.ok(lines.undated.text.includes(`On those ${x.extra_group.rows} alone: model ${x.extra_group.model}, majority ${x.extra_group.majority}, oxygen threshold ${x.extra_group.threshold}.`));
  assert.match(lines.undated.text, /no normalized date in this collection/);
  // A forced sign flip changes the sentence, so the wording follows the interval and is not fixed text.
  const flipped = checkLines({ ...report, uncertainty: { ...u, model_minus_majority: { ...u.model_minus_majority, low: -0.01, includes_zero: true }, model_minus_threshold: { ...u.model_minus_threshold, low: 0.01, includes_zero: false } } });
  assert.match(flipped.find(item => item.id === 'gap-majority').text, /includes zero/); assert.match(flipped.find(item => item.id === 'gap-threshold').text, /excludes zero/);
  for (const item of view.checks) { assert.doesNotMatch(item.text, BANNED, item.text); assert.doesNotMatch(item.text, /undefined|NaN|null|Infinity/); assert.ok(item.text.length < 420, item.text); }
  for (const text of [report.threshold_baseline.rule, u.method, x.reason, x.method]) assert.doesNotMatch(text, BANNED);
  for (const empty of [[], tests.filter(row => row.psi_id !== 'PSI-69')]) {
    const e = evaluate(empty); assert.equal(e.threshold_baseline, null); assert.equal(e.uncertainty, null); assert.equal(e.undated, null); assert.deepEqual(checkLines(e), []);
    assert.deepEqual(oxygenLimit(empty).checks, []); assert.equal(oxygenLimit(empty).chart, null);
  }
});

test('the chart geometry is drawn from the pooled counts: bar heights, Wilson whiskers and printed counts', () => {
  const chart = view.chart, pooled = describe(tests).lines.find(line => line.diluent === 'all' && line.fuel === 'All fuels');
  const edges = [o => o <= 18, o => o > 18 && o <= 22, o => o > 22 && o <= 30, o => o > 30];
  assert.equal(chart.bars.length, 4); assert.deepEqual(chart.bars.map(bar => bar.band), OXYGEN_LIMIT.bands.map(band => band.id));
  const span = chart.plot.bottom - chart.plot.top; assert.ok(span > 100);
  chart.bars.forEach((bar, i) => {
    const rows = counted.filter(row => edges[i](row.n.o2)), events = sum(rows, out), cell = pooled.cells[i];
    assert.equal(bar.count_text, `${events}/${rows.length}`); assert.equal(bar.tests, rows.length); assert.equal(bar.extinction, events);
    assert.equal(bar.share_text, `${Math.round(events / rows.length * 100)}%`); assert.equal(bar.label, OXYGEN_LIMIT.bands[i].label);
    near(bar.height, span * events / rows.length); near(bar.y + bar.height, chart.plot.bottom);
    near(bar.whisker.y_low, chart.plot.bottom - span * cell.low); near(bar.whisker.y_high, chart.plot.bottom - span * cell.high);
    assert.ok(bar.whisker.y_high <= bar.y + 1e-9 && bar.y <= bar.whisker.y_low + 1e-9, 'the whisker spans the bar top');
    assert.ok(bar.whisker.y_high >= chart.plot.top - 1e-9 && bar.whisker.y_low <= chart.plot.bottom + 1e-9);
    assert.ok(bar.text_y < bar.whisker.y_high && bar.text_y > 10, 'the count is printed above the whisker, inside the drawing');
    assert.ok(bar.x >= chart.plot.left && bar.x + bar.width <= chart.plot.right); near(bar.whisker.x, bar.centre); near(bar.x + bar.width / 2, bar.centre);
    if (i) assert.ok(bar.x > chart.bars[i - 1].x + chart.bars[i - 1].width + 20, 'bars do not touch');
    assert.ok(chart.description.includes(`${bar.label}: ${events}/${rows.length}`));
  });
  assert.deepEqual(chart.ticks.map(tick => tick.text), ['0%', '25%', '50%', '75%', '100%']); near(chart.ticks[0].y, chart.plot.bottom); near(chart.ticks[4].y, chart.plot.top);
  assert.ok(chart.label_y > chart.plot.bottom && chart.label_y + 20 < chart.height); assert.ok(chart.title.includes(`all ${counted.length} counted tests`));
  assert.doesNotMatch(chart.title + chart.description + chart.axis_title, BANNED);
  // An empty band draws no bar and says so; nothing is invented for it.
  const none = bandChart({ bands: describe(tests).bands, lines: [{ diluent: 'all', fuel: 'All fuels', tests: 0, cells: OXYGEN_LIMIT.bands.map(band => ({ band: band.id, tests: 0, extinction: 0, share: null, low: null, high: null })) }] });
  assert.ok(none.bars.every(bar => bar.whisker === null && bar.height === 0 && bar.count_text === 'no tests' && bar.share_text === ''));
  assert.equal(bandChart(null), null); assert.equal(bandChart({ lines: [] }), null);
});

test('the panel draws the chart and the checks from the module output, with no typed-in results or outside requests', () => {
  const panel = read('../../web/js/world/outcome-panel.js'), css = read('../../web/css/outcome-panel.css'), module = read('../../web/js/core/oxygen-limit.js'), host = read('../../web/js/world/act-evidence.js');
  assert.match(panel, /createElementNS\(svgNamespace\(\), tag\)/); assert.match(panel, /if \(view\.chart\) oxygen\.append\(drawBands\(view\.chart\)\)/); assert.match(panel, /for \(const item of view\.checks\)/);
  assert.match(panel, /for \(const bar of chart\.bars\)/); assert.match(panel, /Whiskers: 95% Wilson interval/);
  assert.ok(panel.indexOf('drawBands(view.chart)') < panel.indexOf('oxygen.append(wrap,') && panel.indexOf('view.model_line') < panel.indexOf('view.checks'), 'chart, table, model line, then the checks');
  const key = panel.match(/oxygen-limit\.js\?v=([\w-]+)/)[1]; assert.ok(panel.includes(`outcome-panel.css?v=${key}`)); assert.ok(host.includes(`./outcome-panel.js?v=${key}`), 'the host imports the current panel');
  const u = report.uncertainty, x = report.undated, d = report.paired;
  const figures = new Set([report.threshold_baseline.correct, x.all.model, x.all.majority, x.all.threshold, x.all.rows, d.vs_majority.both_right, d.vs_majority.model_only, d.vs_threshold.both_right,
    report.rows, report.model.correct, report.baseline.correct, u.test_days].filter(n => n > 30));
  for (const n of figures) for (const [name, source] of [['panel', panel], ['module', module]]) assert.ok(!new RegExp(`(?<![\\d.#])${n}(?![\\d.])`).test(source), `result ${n} is typed into the ${name}`);
  for (const pattern of [/\d\d\.\d%/, /[+−]\d+\.\d points/]) assert.doesNotMatch(panel + module, pattern, 'no typed-in percentage');
  for (const cls of ['op-chart', 'op-chart-bar', 'op-chart-whisker', 'op-chart-count', 'op-chart-label', 'op-chart-tick', 'op-chart-grid', 'op-chart-axis', 'op-checks', 'op-checks-title']) assert.ok(css.includes(`.${cls}`), cls);
  assert.doesNotMatch(css, /url\(|@import/); assert.doesNotMatch(panel, /https?:\/\//); assert.doesNotMatch(panel + module, /Math\.random|fetch\(|Date\.now/);
});

test('README reports the same checks as a fresh calculation', () => {
  const readme = read('../../README.md'), u = report.uncertainty, t = report.threshold_baseline, d = report.paired, x = report.undated;
  const pc = v => `${(v * 100).toFixed(1)}%`, pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}`, iv = item => `${pc(item.estimate)} (${pc(item.low)} to ${pc(item.high)})`;
  const gap = item => `${pts(item.estimate)} points (${pts(item.low)} to ${pts(item.high)}); that interval ${item.includes_zero ? 'includes zero' : 'excludes zero'}`;
  const ranked = [['the oxygen threshold', x.extra_group.threshold], ['the model', x.extra_group.model], ['the majority baseline', x.extra_group.majority]];
  for (const sentence of [
    `gets ${t.correct}/${report.rows}, ${report.model.correct - t.correct} fewer than the model.`,
    `A paired bootstrap over the ${u.test_days} test days (${u.resamples.toLocaleString('en-US')} resamples, fixed seed, 95% percentile intervals) gives the model ${iv(u.model)}, the majority baseline ${iv(u.majority)} and the oxygen threshold ${iv(u.threshold)}.`,
    `Model minus majority baseline: ${gap(u.model_minus_majority)}.`,
    `Model minus oxygen threshold: ${gap(u.model_minus_threshold)}`,
    `the model is right and the majority baseline wrong on ${d.vs_majority.model_only} tests and the reverse on ${d.vs_majority.baseline_only}; against the oxygen threshold, ${d.vs_threshold.model_only} and ${d.vs_threshold.baseline_only}.`,
    `The ${x.extra_group.rows} tests left out have no normalized test date in this collection`,
    `adding them as one extra held-out group of ${x.extra_group.rows}: model ${x.all.model}/${x.all.rows}, majority baseline ${x.all.majority}/${x.all.rows}, oxygen threshold ${x.all.threshold}/${x.all.rows}`,
    `on those ${x.extra_group.rows} alone ${ranked.map(([name, n], i) => i ? `${name} ${n}` : `${name} gets ${n}`).join(', ').replace(/, ([^,]+)$/, ' and $1')}.`
  ]) assert.ok(readme.includes(sentence), sentence);
  assert.ok(report.model.correct - t.correct > 0 && ranked[0][1] >= ranked[1][1] && ranked[1][1] >= ranked[2][1], 'README wording order still matches the counts');
  assert.equal(readme.includes('so this check does not show the model is more accurate than a single oxygen cut'), u.model_minus_threshold.includes_zero);
});
