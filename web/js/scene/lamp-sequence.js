// A presentation transition between two already-computed coverage states.
// This interpolates only lamp colour; it never computes or changes evidence.
export const LAMP_STAGGER = .65;
export function lampProgress(seconds, index = 0, snap = false) {
  if (snap) return 1;
  const x = Math.max(0, Math.min(1, (seconds - Math.max(0, index) * LAMP_STAGGER) / .55));
  return x * x * (3 - 2 * x);
}
