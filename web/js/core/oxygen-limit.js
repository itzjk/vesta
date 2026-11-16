// Extinction versus ambient oxygen in the FLEX droplet table (PSI-69).
// Part 1 is a count, not a model: the share of recorded tests that ended in
// "extinction", by oxygen band, fuel and diluent, with Wilson intervals.
// Part 2 is one small logistic regression, checked on held-out test days against
// the majority baseline. The claim is shipped only if it wins that check.
// Liquid fuel droplets in microgravity: not cabin materials, not a cabin prediction.
export const OXYGEN_LIMIT = Object.freeze({
  id: 'flex-extinction-by-oxygen/1', investigation: 'PSI-69', outcome: 'test_end', event: 'extinction',
  // Bands were fixed before any outcome was tabulated. Upper edges are inclusive.
  bands: Object.freeze([
    Object.freeze({ id: 'le18', label: '18% or less', min: -Infinity, max: 18 }),
    Object.freeze({ id: '18to22', label: 'Over 18% to 22%', min: 18, max: 22 }),
    Object.freeze({ id: '22to30', label: 'Over 22% to 30%', min: 22, max: 30 }),
    Object.freeze({ id: 'gt30', label: 'Over 30%', min: 30, max: Infinity })
  ]),
  diluents: Object.freeze([
    Object.freeze({ id: 'n2', label: 'Nitrogen only' }),
    Object.freeze({ id: 'co2', label: 'With carbon dioxide' }),
    Object.freeze({ id: 'he', label: 'With helium' }),
    Object.freeze({ id: 'co2_he', label: 'With carbon dioxide and helium' })
  ]),
  fuels: Object.freeze(['Heptane', 'Methanol']),
  // The primary model was named before it was evaluated; the other is a sensitivity check.
  primary: 'oxygen_fuel',
  specs: Object.freeze({ oxygen_fuel: 'oxygen percent and recorded fuel', oxygen: 'oxygen percent only' }),
  ridge: 1e-6, z: 1.959963984540054,
  // Fixed before the intervals were read, so the page and the tests always draw the same resamples.
  bootstrap: Object.freeze({ seed: 20261115, resamples: 4000 }),
  scope: 'Liquid fuel droplets in microgravity (FLEX, one NASA table). Not cabin materials and not a cabin prediction.'
});

const finite = Number.isFinite;
const label = row => row.outcomes?.test_end?.value ?? null;
const ended = row => label(row) === OXYGEN_LIMIT.event ? 1 : 0;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && finite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function bandOf(oxygen) {
  if (!finite(oxygen)) return null;
  return OXYGEN_LIMIT.bands.find(band => oxygen > band.min && oxygen <= band.max)?.id ?? null;
}
/** Diluent group read from the recorded gas fractions; null when either fraction is not recorded. */
export function diluentOf(row) {
  const co2 = row.composition?.co2, he = row.composition?.he;
  if (!finite(co2) || !finite(he) || co2 < 0 || he < 0) return null;
  return co2 > 0 ? (he > 0 ? 'co2_he' : 'co2') : (he > 0 ? 'he' : 'n2');
}
/** 95% Wilson score interval for a share. It treats every counted row as one independent trial. */
export function wilson(events, total, z = OXYGEN_LIMIT.z) {
  if (!Number.isInteger(events) || !Number.isInteger(total) || total <= 0 || events < 0 || events > total) return { share: null, low: null, high: null };
  const p = events / total, z2 = z * z, denom = 1 + z2 / total, centre = (p + z2 / (2 * total)) / denom;
  const half = z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total)) / denom;
  return { share: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Rows that can be counted: a recorded end state, a usable oxygen value, a known fuel and diluent, microgravity. */
export function limitRows(tests) {
  const all = (Array.isArray(tests) ? tests : []).filter(row => row?.psi_id === OXYGEN_LIMIT.investigation && label(row) !== null);
  const exclusions = { missing_oxygen: 0, unknown_diluent: 0, unsupported_record: 0 }, rows = [];
  for (const row of all) {
    const oxygen = row.n?.o2;
    let reason = null;
    if (!finite(oxygen) || oxygen < 0 || oxygen > 100) reason = 'missing_oxygen';
    else if (diluentOf(row) === null) reason = 'unknown_diluent';
    else if (!OXYGEN_LIMIT.fuels.includes(row.fuel) || row.n?.gclass !== 'micro') reason = 'unsupported_record';
    if (reason) exclusions[reason]++; else rows.push(row);
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { rows, total: all.length, excluded: all.length - rows.length, exclusions };
}

function cellsOf(rows) {
  return OXYGEN_LIMIT.bands.map(band => {
    const inBand = rows.filter(row => bandOf(row.n.o2) === band.id), events = inBand.reduce((sum, row) => sum + ended(row), 0);
    return { band: band.id, tests: inBand.length, extinction: events, ...wilson(events, inBand.length) };
  });
}
function line(diluent, diluentLabel, fuel, rows) {
  const events = rows.reduce((sum, row) => sum + ended(row), 0);
  return { diluent, diluent_label: diluentLabel, fuel, tests: rows.length, extinction: events, ...wilson(events, rows.length), cells: cellsOf(rows) };
}
/** Descriptive table. Diluent groups stay separate rows; the pooled row is labelled as pooled. */
export function describe(tests) {
  const selected = limitRows(tests), { rows } = selected, lines = [];
  const groups = [{ id: 'all', label: 'All diluents pooled' }, ...OXYGEN_LIMIT.diluents];
  for (const group of groups) {
    const own = group.id === 'all' ? rows : rows.filter(row => diluentOf(row) === group.id);
    if (!own.length) continue;
    lines.push(line(group.id, group.label, 'All fuels', own));
    for (const fuel of OXYGEN_LIMIT.fuels) { const same = own.filter(row => row.fuel === fuel); if (same.length) lines.push(line(group.id, group.label, fuel, same)); }
  }
  return { id: OXYGEN_LIMIT.id, event: OXYGEN_LIMIT.event, bands: OXYGEN_LIMIT.bands.map(({ id, label: text }) => ({ id, label: text })),
    rows: rows.length, rows_in_table: selected.total, rows_excluded: selected.excluded, exclusions: selected.exclusions, lines,
    interval: '95% Wilson score interval, each table row counted as one test.' };
}

// ---- one small logistic regression, fitted by Newton's method (IRLS) ----
const sigmoid = t => t >= 0 ? 1 / (1 + Math.exp(-t)) : Math.exp(t) / (1 + Math.exp(t));
function solve(a, b) {
  const n = b.length, m = a.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    if (Math.abs(m[pivot][c]) < 1e-12) return null;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map((r, i) => r[n] / m[i][i]);
}
/** Deterministic logistic fit. X rows start with 1 (intercept); a tiny ridge on the other terms keeps it finite. */
export function fitLogistic(X, y, { ridge = OXYGEN_LIMIT.ridge, iterations = 60, tolerance = 1e-10 } = {}) {
  const d = X[0]?.length ?? 0; let beta = Array(d).fill(0), converged = false, steps = 0;
  const penalty = b => b.reduce((sum, v, j) => sum + (j ? ridge * v * v / 2 : 0), 0);
  const loss = b => X.reduce((sum, x, i) => { const t = x.reduce((s, v, j) => s + v * b[j], 0); return sum + Math.log1p(Math.exp(-Math.abs(t))) + Math.max(t, 0) - y[i] * t; }, 0) + penalty(b);
  if (!d || !X.length) return { beta, converged: false, steps };
  let current = loss(beta);
  for (; steps < iterations; steps++) {
    const gradient = Array(d).fill(0), hessian = Array.from({ length: d }, () => Array(d).fill(0));
    X.forEach((x, i) => {
      const p = sigmoid(x.reduce((s, v, j) => s + v * beta[j], 0)), w = Math.max(p * (1 - p), 1e-12);
      for (let j = 0; j < d; j++) { gradient[j] += (y[i] - p) * x[j]; for (let k = 0; k < d; k++) hessian[j][k] += w * x[j] * x[k]; }
    });
    for (let j = 1; j < d; j++) { gradient[j] -= ridge * beta[j]; hessian[j][j] += ridge; }
    const delta = solve(hessian, gradient); if (!delta) break;
    let scale = 1, next = beta, value = current;
    for (let half = 0; half < 30; half++, scale /= 2) { next = beta.map((v, j) => v + scale * delta[j]); value = loss(next); if (value <= current + 1e-12) break; }
    const moved = Math.max(...next.map((v, j) => Math.abs(v - beta[j])));
    beta = next; current = value;
    if (moved < tolerance) { converged = true; steps++; break; }
  }
  return { beta, converged, steps };
}

const design = { oxygen: (row, s) => [1, (row.n.o2 - s.mean) / s.sd], oxygen_fuel: (row, s) => [1, (row.n.o2 - s.mean) / s.sd, row.fuel === s.fuel ? 1 : 0] };
function train(rows, spec) {
  const mean = rows.reduce((sum, row) => sum + row.n.o2, 0) / rows.length;
  const sd = Math.sqrt(rows.reduce((sum, row) => sum + (row.n.o2 - mean) ** 2, 0) / rows.length) || 1;
  const s = { mean, sd, fuel: OXYGEN_LIMIT.fuels[0] }, fitted = fitLogistic(rows.map(row => design[spec](row, s)), rows.map(ended));
  return { spec, s, ...fitted, probability: row => sigmoid(design[spec](row, s).reduce((sum, v, j) => sum + v * fitted.beta[j], 0)) };
}
const ratio = (a, b) => b ? a / b : null;
function score(items, field) {
  const correct = items.filter(item => (item[field] >= .5 ? 1 : 0) === item.actual).length;
  return { correct, accuracy: ratio(correct, items.length), brier: items.length ? items.reduce((sum, item) => sum + (item[field] - item.actual) ** 2, 0) / items.length : null };
}

// ---- one-variable baseline: the best single oxygen cut, chosen on the training rows only ----
/** Best single cut on oxygen percent. Cuts are midpoints between neighbouring recorded values; the side that predicts extinction is chosen too. */
export function bestCut(rows) {
  const values = [...new Set(rows.map(row => row.n.o2))].sort((x, y) => x - y);
  let best = null;
  for (let i = 0; i + 1 < values.length; i++) {
    const cut = (values[i] + values[i + 1]) / 2, low = rows.filter(row => row.n.o2 <= cut), high = rows.length - low.length;
    const lowEvents = low.reduce((sum, row) => sum + ended(row), 0), highEvents = rows.reduce((sum, row) => sum + ended(row), 0) - lowEvents;
    // "below": extinction is predicted at or under the cut. "above": extinction is predicted over the cut.
    for (const [side, correct] of [['below', lowEvents + high - highEvents], ['above', low.length - lowEvents + highEvents]])
      if (!best || correct > best.correct) best = { cut, extinction_side: side, correct, rows: rows.length };
  }
  return best;
}
const cutPredicts = (rule, oxygen) => (rule.extinction_side === 'below') === (oxygen <= rule.cut) ? 1 : 0;

/** Small deterministic generator (32-bit linear congruential); the same seed always gives the same resamples. */
export function lcg(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const quantile = (sorted, q) => { const at = q * (sorted.length - 1), i = Math.floor(at), next = Math.min(i + 1, sorted.length - 1); return sorted[i] + (sorted[next] - sorted[i]) * (at - i); };
const RULES = Object.freeze({ model: item => (item[OXYGEN_LIMIT.primary] >= .5 ? 1 : 0), majority: item => item.baseline_majority, threshold: item => item.threshold });
const right = (item, rule) => RULES[rule](item) === item.actual ? 1 : 0;

/** Paired bootstrap over whole test days: each resample draws days with replacement and scores every rule on the same draw. */
export function bootstrapDays(predictions, { seed = OXYGEN_LIMIT.bootstrap.seed, resamples = OXYGEN_LIMIT.bootstrap.resamples } = {}) {
  const byDay = new Map();
  for (const item of predictions) {
    const day = byDay.get(item.held_out_day) || { rows: 0, model: 0, majority: 0, threshold: 0 };
    day.rows++; for (const rule of Object.keys(RULES)) day[rule] += right(item, rule);
    byDay.set(item.held_out_day, day);
  }
  const days = [...byDay.keys()].sort().map(day => byDay.get(day));
  if (days.length < 2) return null;
  const random = lcg(seed), draws = { model: [], majority: [], threshold: [], model_minus_majority: [], model_minus_threshold: [] };
  for (let r = 0; r < resamples; r++) {
    const total = { rows: 0, model: 0, majority: 0, threshold: 0 };
    for (let k = 0; k < days.length; k++) { const day = days[Math.floor(random() * days.length)]; for (const key of Object.keys(total)) total[key] += day[key]; }
    for (const rule of Object.keys(RULES)) draws[rule].push(total[rule] / total.rows);
    draws.model_minus_majority.push((total.model - total.majority) / total.rows); draws.model_minus_threshold.push((total.model - total.threshold) / total.rows);
  }
  const all = { rows: predictions.length, model: 0, majority: 0, threshold: 0 };
  for (const day of days) for (const rule of Object.keys(RULES)) all[rule] += day[rule];
  const estimate = { model: all.model / all.rows, majority: all.majority / all.rows, threshold: all.threshold / all.rows,
    model_minus_majority: (all.model - all.majority) / all.rows, model_minus_threshold: (all.model - all.threshold) / all.rows };
  const out = { method: 'Paired percentile bootstrap: test days are drawn with replacement and every rule is scored on the same draw.', seed, resamples, test_days: days.length, level: 0.95 };
  for (const [key, values] of Object.entries(draws)) {
    const sorted = values.slice().sort((x, y) => x - y), low = quantile(sorted, .025), high = quantile(sorted, .975);
    out[key] = { estimate: estimate[key], low, high, ...(key.startsWith('model_minus') ? { includes_zero: low <= 0 && high >= 0 } : {}) };
  }
  return out;
}
/** Paired disagreement counts between the model and one baseline rule on the same held-out tests. */
export function disagreements(predictions, rule) {
  const counts = { both_right: 0, model_only: 0, baseline_only: 0, both_wrong: 0 };
  for (const item of predictions) { const m = right(item, 'model'), o = right(item, rule); counts[m ? (o ? 'both_right' : 'model_only') : (o ? 'baseline_only' : 'both_wrong')]++; }
  return counts;
}

const UNDATED = 'no-normalized-date';
/** Hold out one group at a time; everything a prediction uses is fitted on the other groups. */
function heldOut(rows, groupOf) {
  const groups = [...new Set(rows.map(groupOf))].sort(), predictions = [];
  for (const group of groups) {
    const training = rows.filter(row => groupOf(row) !== group); if (!training.length) continue;
    const rate = training.reduce((sum, row) => sum + ended(row), 0) / training.length;
    const fuelRate = Object.fromEntries(OXYGEN_LIMIT.fuels.map(fuel => { const same = training.filter(row => row.fuel === fuel); return [fuel, same.length ? same.reduce((sum, row) => sum + ended(row), 0) / same.length : rate]; }));
    const models = Object.fromEntries(Object.keys(OXYGEN_LIMIT.specs).map(spec => [spec, train(training, spec)]));
    const rule = bestCut(training);
    for (const row of rows.filter(item => groupOf(item) === group)) predictions.push({ row_id: row.id, held_out_day: group, fuel: row.fuel, oxygen_percent: row.n.o2,
      actual: ended(row), baseline_majority: rate >= .5 ? 1 : 0, baseline_rate: rate, fuel_baseline_rate: fuelRate[row.fuel],
      threshold: rule ? cutPredicts(rule, row.n.o2) : (rate >= .5 ? 1 : 0), threshold_cut: rule ? rule.cut : null,
      ...Object.fromEntries(Object.entries(models).map(([spec, model]) => [spec, model.probability(row)])) });
  }
  return { groups, predictions };
}
const tally = (predictions, rule) => predictions.reduce((sum, item) => sum + right(item, rule), 0);

/** Leave-one-known-test-day-out check of the logistic model against the majority baseline. */
export function evaluate(tests) {
  const selected = limitRows(tests), rows = selected.rows.filter(row => validDate(row.date));
  const { groups: days, predictions } = heldOut(rows, row => row.date);
  const majority = predictions.map(item => ({ actual: item.actual, value: item.baseline_majority }));
  const baseline = { correct: score(majority, 'value').correct, accuracy: score(majority, 'value').accuracy, brier: score(predictions, 'baseline_rate').brier };
  // Same-fuel majority: the fairer comparison for a model that is told the fuel.
  const fuel_baseline = { rule: 'The more common ending of the same recorded fuel in the training days; its Brier score uses that fuel\'s training-day extinction share.', ...score(predictions, 'fuel_baseline_rate') };
  const hardest = Math.max(baseline.correct, fuel_baseline.correct), lowest = Math.min(baseline.brier ?? Infinity, fuel_baseline.brier ?? Infinity);
  const measured = Object.fromEntries(Object.keys(OXYGEN_LIMIT.specs).map(spec => {
    const s = score(predictions, spec);
    return [spec, { inputs: OXYGEN_LIMIT.specs[spec], ...s, beats_baseline: predictions.length > 0 && s.correct > hardest, brier_below_baseline: predictions.length > 0 && s.brier < lowest }];
  }));
  const primary = measured[OXYGEN_LIMIT.primary];
  const full = rows.length && days.length > 1 ? train(rows, OXYGEN_LIMIT.primary) : null;
  const usable = predictions.length > 0 && days.length > 1;
  // One-variable baseline: a single oxygen cut, re-chosen on the training days of every fold.
  const cuts = predictions.map(item => item.threshold_cut).filter(finite), wholeCut = usable ? bestCut(rows) : null;
  const threshold_baseline = usable ? { rule: 'One cut on oxygen percent, chosen on the training days of each fold as the cut that gets most training tests right; extinction is predicted on one side of it.',
    correct: tally(predictions, 'threshold'), accuracy: ratio(tally(predictions, 'threshold'), predictions.length),
    cut_min: cuts.length ? Math.min(...cuts) : null, cut_max: cuts.length ? Math.max(...cuts) : null,
    all_dated_rows_cut: wholeCut ? { cut: wholeCut.cut, extinction_side: wholeCut.extinction_side } : null } : null;
  const uncertainty = usable ? bootstrapDays(predictions) : null;
  const paired = usable ? { vs_majority: disagreements(predictions, 'majority'), vs_threshold: disagreements(predictions, 'threshold') } : null;
  // Sensitivity: the tests with no normalized date join as ONE extra held-out group. It is not the headline check.
  const undatedRows = selected.rows.filter(row => !validDate(row.date));
  let undated = null;
  if (usable && undatedRows.length) {
    const wide = heldOut(selected.rows, row => validDate(row.date) ? row.date : UNDATED).predictions, extra = wide.filter(item => item.held_out_day === UNDATED);
    const fuelRight = items => score(items, 'fuel_baseline_rate').correct, counts = items => ({ rows: items.length, model: tally(items, 'model'), majority: tally(items, 'majority'), same_fuel_majority: fuelRight(items), threshold: tally(items, 'threshold') });
    undated = { reason: 'These rows have no normalized test date in this collection. The raw date text is kept in the source row but is not reinterpreted, so the rows cannot be assigned to a test day.',
      method: 'Sensitivity only: the undated tests are added as one extra held-out group, and they also join the training rows of every dated fold.',
      groups: days.length + 1, all: counts(wide), extra_group: counts(extra) };
  }
  return { id: OXYGEN_LIMIT.id, method: 'Leave one known test day out. Oxygen centring, scaling and all coefficients are fitted on the training days only. Threshold 0.5.',
    rows: predictions.length, test_days: days.length, rows_in_table: selected.total, rows_excluded_unavailable_date: selected.rows.length - rows.length,
    rows_excluded_other: selected.excluded, primary: OXYGEN_LIMIT.primary, model: primary, sensitivity: measured, baseline: { rule: 'Always the more common ending (extinction or not) of the training days; its Brier score uses the training-day extinction share.', ...baseline }, fuel_baseline,
    threshold_baseline, uncertainty, paired, undated,
    // The claim needs strictly more held-out rows right than BOTH baselines AND a lower Brier score than both.
    ships: Boolean(primary.beats_baseline && primary.brier_below_baseline),
    full_table_fit: full ? { inputs: OXYGEN_LIMIT.specs[OXYGEN_LIMIT.primary], oxygen_mean: full.s.mean, oxygen_sd: full.s.sd, reference_fuel: full.s.fuel, coefficients: full.beta, converged: full.converged,
      log_odds_per_oxygen_point: full.beta[1] / full.s.sd } : null,
    predictions };
}

const pct = value => finite(value) ? `${Math.round(value * 100)}%` : 'n/a';
const fixed = value => finite(value) ? value.toFixed(3) : 'n/a';
/** Short cell text: count, share and interval. An empty band says so instead of showing a share. */
export function cellText(cell) { return cell?.tests ? `${cell.extinction}/${cell.tests} · ${pct(cell.share)} (${pct(cell.low)}–${pct(cell.high)})` : 'no tests'; }

/** The single model-versus-baseline sentence, plus one line of detail. It never claims more than the held-out counts show. */
export function modelLine(evaluation) {
  const e = evaluation, m = e?.model, b = e?.baseline, f = e?.fuel_baseline;
  if (!e || !Number.isInteger(e.rows) || e.rows <= 0 || e.test_days < 2 || !m || !b || !f) return { ships: false, text: 'No model result: too few dated tests to hold a day out.', detail: null };
  const counts = `${m.correct}/${e.rows} held-out tests right vs ${b.correct}/${e.rows} for the majority baseline (Brier score ${fixed(m.brier)} vs ${fixed(b.brier)}, lower is better; ${e.test_days} test days, each held out in turn)`;
  const other = e.sensitivity?.oxygen;
  const detail = `Same-fuel majority baseline: ${f.correct}/${e.rows}, Brier ${fixed(f.brier)}.` + (other ? ` Oxygen percent alone: ${other.correct}/${e.rows}, Brier ${fixed(other.brier)}.` : '')
    + ` ${e.rows_excluded_unavailable_date} of ${e.rows_in_table} tests have no usable date and are left out of this check.`;
  if (e.ships) return { ships: true, text: `One small model, checked on held-out days: logistic regression on ${m.inputs} gets ${counts}.`, detail };
  const why = m.beats_baseline ? 'its Brier score is not lower than both baselines' : 'it does not get more held-out tests right than both baselines';
  return { ships: false, text: `No model is offered: logistic regression on ${m.inputs} was tried and ${why}: ${counts}.`, detail };
}

const pct1 = value => `${(value * 100).toFixed(1)}%`;
const points = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(1)}`;
const span = item => `${pct1(item.estimate)} (${pct1(item.low)} to ${pct1(item.high)})`;
function gap(item, name) {
  const verdict = item.includes_zero
    ? `That interval includes zero, so this check does not show the model is more accurate than the ${name}.`
    : 'That interval excludes zero. It is still an internal check on one table, not an independent experiment.';
  return `Model minus ${name}: ${points(item.estimate)} points (${points(item.low)} to ${points(item.high)}). ${verdict}`;
}
/** Short, computed sentences for the extra checks: threshold baseline, intervals, disagreements, undated tests. */
export function checkLines(evaluation) {
  const e = evaluation, u = e?.uncertainty, t = e?.threshold_baseline, d = e?.paired, lines = [];
  if (!e || !u || !t || !d) return lines;
  const all = e.threshold_baseline.all_dated_rows_cut, lead = e.model.correct - t.correct;
  const versus = lead > 0 ? `${lead} fewer than the model` : lead < 0 ? `${-lead} more than the model` : 'the same as the model';
  lines.push({ id: 'threshold', text: `Oxygen-threshold baseline (one cut on oxygen, chosen on training days only): ${t.correct}/${e.rows} held-out tests right, ${versus}.`
    + (all ? ` On all dated tests the cut is ${all.cut}% oxygen, with extinction predicted ${all.extinction_side === 'below' ? 'at or below' : 'above'} it.` : '') });
  lines.push({ id: 'interval', text: `95% intervals from ${u.resamples.toLocaleString('en-US')} resamples of the ${u.test_days} test days (fixed seed): model ${span(u.model)}, majority baseline ${span(u.majority)}, oxygen threshold ${span(u.threshold)}.` });
  lines.push({ id: 'gap-majority', text: gap(u.model_minus_majority, 'majority baseline') });
  lines.push({ id: 'gap-threshold', plain: u.model_minus_threshold.includes_zero, text: gap(u.model_minus_threshold, 'oxygen threshold') });
  lines.push({ id: 'paired', text: `Where they disagree: the model is right and the majority baseline wrong on ${d.vs_majority.model_only} tests, the reverse on ${d.vs_majority.baseline_only}; against the oxygen threshold, ${d.vs_threshold.model_only} and ${d.vs_threshold.baseline_only}.` });
  const x = e.undated;
  if (x) lines.push({ id: 'undated', text: `${x.extra_group.rows} tests have no normalized date in this collection (the raw date text is kept, not reinterpreted), so they cannot be held out by day. `
    + `Sensitivity, adding them as one extra held-out group: model ${x.all.model}/${x.all.rows}, majority ${x.all.majority}/${x.all.rows}, oxygen threshold ${x.all.threshold}/${x.all.rows}. `
    + `On those ${x.extra_group.rows} alone: model ${x.extra_group.model}, majority ${x.extra_group.majority}, oxygen threshold ${x.extra_group.threshold}.` });
  return lines;
}

/** Geometry for the four-bar chart of the pooled row: bar, Wilson whisker and printed count per band. Pure numbers, no DOM. */
export function bandChart(table, { width = 560, height = 240 } = {}) {
  const pooled = table?.lines?.find(item => item.diluent === 'all' && item.fuel === 'All fuels');
  if (!pooled) return null;
  const left = 46, right = 10, top = 26, bottom = 48, plotW = width - left - right, plotH = height - top - bottom, slot = plotW / pooled.cells.length, barW = slot * .56;
  const y = share => top + plotH * (1 - share), labelOf = id => table.bands.find(band => band.id === id)?.label ?? id;
  const bars = pooled.cells.map((cell, i) => {
    const centre = left + slot * (i + .5), has = cell.tests > 0;
    return { band: cell.band, label: labelOf(cell.band), tests: cell.tests, extinction: cell.extinction, share: cell.share, low: cell.low, high: cell.high,
      centre, x: centre - barW / 2, width: barW, y: has ? y(cell.share) : y(0), height: has ? plotH * cell.share : 0,
      whisker: has ? { x: centre, y_low: y(cell.low), y_high: y(cell.high), cap: barW * .2 } : null,
      count_text: has ? `${cell.extinction}/${cell.tests}` : 'no tests', share_text: has ? pct(cell.share) : '', text_y: (has ? y(cell.high) : y(0)) - 7 };
  });
  const ticks = [0, .25, .5, .75, 1].map(value => ({ value, y: y(value), text: pct(value) }));
  return { width, height, plot: { left, right: width - right, top, bottom: top + plotH }, bars, ticks, label_y: top + plotH + 18, axis_title: 'Tests ending in extinction',
    title: `Extinction share by ambient oxygen band, all ${pooled.tests} counted tests`,
    description: bars.map(bar => bar.tests ? `${bar.label}: ${bar.count_text}, ${bar.share_text}, 95% interval ${pct(bar.low)} to ${pct(bar.high)}` : `${bar.label}: no tests`).join('. ') + '.' };
}

/** Everything the panel shows: the table first, then the model line. */
export function oxygenLimit(tests) {
  const table = describe(tests), evaluation = evaluate(tests), verdict = modelLine(evaluation);
  const pooled = table.lines.find(item => item.diluent === 'all' && item.fuel === 'All fuels') || null;
  const lead = pooled ? `Extinction share by ambient oxygen, all ${table.rows} counted tests: ` + pooled.cells.filter(cell => cell.tests).map(cell =>
    `${table.bands.find(band => band.id === cell.band).label.toLowerCase()} ${cell.extinction}/${cell.tests}`).join(', ') + '.' : 'No FLEX droplet tests with a recorded end state are loaded.';
  return { id: OXYGEN_LIMIT.id, scope: OXYGEN_LIMIT.scope, table, evaluation, lead, model_line: verdict.text, model_detail: verdict.detail, model_ships: verdict.ships,
    checks: checkLines(evaluation), chart: bandChart(table),
    definition: 'Extinction: the flame went out before the fuel was consumed. Other recorded endings are disruption and completion.',
    limits: 'One table, counted as recorded: rows sharing a test day are not independent, so the intervals are likely too narrow; diluent, pressure and droplet size also vary.' };
}
