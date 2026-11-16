// Pure framing helpers for the FLEX droplet table explorer. Every figure is read
// from the object returned by validate() in outcome-model.js; nothing is typed in.
const count = Number.isInteger;
const hit = (items, field) => items.filter(item => item[field] !== null && item[field] === item.actual).length;

export const FRAME_LABEL = 'Exploratory pattern in one NASA table; no predictive advantage shown';
const FRAME_LABEL_NEUTRAL = 'Exploratory pattern in one NASA table; internal check only';

/** One-line framing of the held-out evaluation. Returns null figures when nothing was evaluated. */
export function frameSummary(validation) {
  const v = validation || {}, completion = v.class_recall?.completion ?? null;
  const usable = count(v.rows) && v.rows > 0 && [v.answered, v.abstained, v.correct, v.baseline_correct, v.accepted_baseline_correct].every(count);
  if (!usable) return { label: FRAME_LABEL_NEUTRAL, sentence: null, figures: null };
  const figures = { rows: v.rows, answered: v.answered, abstained: v.abstained, correct: v.correct,
    baseline_correct: v.baseline_correct, answered_baseline_correct: v.accepted_baseline_correct,
    completion_correct: completion?.correct ?? null, completion_total: completion?.total ?? null };
  // The "no advantage" wording is shown only while the all-row result does not beat the baseline.
  const label = v.correct > v.baseline_correct ? FRAME_LABEL_NEUTRAL : FRAME_LABEL;
  const plural = v.abstained === 1 ? 'abstention' : 'abstentions';
  const weak = count(figures.completion_total) && figures.completion_total > 0
    ? `; completion endings found: ${figures.completion_correct}/${figures.completion_total}` : '';
  const sentence = `Held-out test days: ${v.correct}/${v.answered} right on the rows it answered vs ${v.accepted_baseline_correct}/${v.answered} for the majority baseline (${v.abstained} ${plural}); `
    + `${v.correct}/${v.rows} vs ${v.baseline_correct}/${v.rows} over all rows${weak}.`;
  return { label, sentence, figures };
}

/** Per-fuel counts recomputed from the held-out predictions, with a total row. Baseline = overall training-day majority. */
export function fuelBreakdown(validation) {
  const predictions = Array.isArray(validation?.predictions) ? validation.predictions : [];
  const measure = (fuel, items) => {
    const answered = items.filter(item => item.predicted !== null);
    return { fuel, rows: items.length, answered: answered.length, abstained: items.length - answered.length,
      correct: hit(answered, 'predicted'), baseline_correct: hit(items, 'majority_prediction'),
      answered_baseline_correct: hit(answered, 'majority_prediction') };
  };
  const fuels = [...new Set(predictions.map(item => item.fuel))].sort((a, b) => String(a).localeCompare(String(b)));
  return { fuels: fuels.map(fuel => measure(fuel, predictions.filter(item => item.fuel === fuel))), total: measure('All fuels', predictions) };
}
