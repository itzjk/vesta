export const QUESTION_SECONDS = 26.5;
export const QUESTION_STEPS = Object.freeze([
  { id: 'question', at: 0, label: 'One question' },
  { id: 'cabin', at: 6, label: 'Change gravity only' },
  { id: 'comparison', at: 10, label: 'Watch evidence change' },
  { id: 'gap', at: 15.5, label: 'Still not compared' },
  { id: 'close', at: 21.5, label: 'Evidence is not safety' }
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

export function questionReveal(seconds, count, reduced = false) {
  const start = QUESTION_STEPS.find(step => step.id === 'gap').at;
  if (seconds < start) return 0;
  return reduced ? count : Math.min(count, Math.max(0, 1 + Math.floor((seconds - start) / .8)));
}
