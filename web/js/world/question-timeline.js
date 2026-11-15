export const QUESTION_SECONDS = 28;
export const QUESTION_STEPS = Object.freeze([
  { id: 'question', at: 0, label: 'One material question' },
  { id: 'cabin', at: 3.5, label: 'Choose the Moon' },
  { id: 'rack', at: 7, label: 'What NASA tested' },
  { id: 'comparison', at: 9.5, label: 'Different conditions' },
  { id: 'source', at: 15, label: 'Check the source' },
  { id: 'gap', at: 20, label: 'No source here' },
  { id: 'repeat', at: 24, label: 'Repeat the result' }
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
