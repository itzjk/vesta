export const QUESTION_SECONDS = 26.5;
export const QUESTION_STEPS = Object.freeze([
  { id: 'question', at: 0, label: 'One question' },
  { id: 'cabin', at: 9, label: 'Change one condition' },
  { id: 'comparison', at: 12, label: 'No longer matching' },
  { id: 'gap', at: 15.5, label: 'Not tested yet' },
  { id: 'close', at: 20, label: 'Evidence, not a verdict' }
]);
export function questionStep(seconds) {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return QUESTION_STEPS.findLastIndex(step => t >= step.at);
}
export function questionTime(offset, epoch, now, paused = false) {
  return Math.min(QUESTION_SECONDS, Math.max(0, offset + (paused ? 0 : (now - epoch) / 1000)));
}
export function questionMotion(seconds, reduced = false) {
  const x = reduced ? 1 : Math.min(1, Math.max(0, seconds / .85));
  return x * x * (3 - 2 * x);
}
