const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, amount) => a + (b - a) * amount;

// One short explanation, then a clear view of the evidence again.
// Reduced motion keeps the pointing pose at the dock; it never flies across the chart.
export function evidenceGuidePose({ elapsed = 5, target, compact = false, lower = false, still = false }) {
  const dock = { x: compact ? lower ? 5.6 : 4.1 : 7.4, y: compact ? lower ? -2.8 : -.9 : -.65, z: 6.7 };
  const focus = target && [target.x, target.y, target.z].every(Number.isFinite) ? target : { x: 0, y: .5, z: 4.5 };
  const visit = {
    x: clamp(focus.x + (compact ? 2.1 : 3), compact ? -2.5 : -4, compact ? 3.8 : 6.3),
    y: clamp(focus.y - 1.3, lower ? -4.5 : -1.5, 1.8),
    z: Math.max(6.7, focus.z + 1.5)
  };
  const attention = elapsed >= 0 && elapsed < 4.6 ? 1 : 0;
  const flight = still || !attention ? 0 : ease(elapsed / 1.15) * (1 - ease((elapsed - 2.9) / 1.7));
  const x = mix(dock.x, visit.x, flight), y = mix(dock.y, visit.y, flight) + Math.sin(flight * Math.PI) * .28;
  const lookX = clamp((focus.x - x) / 3, -1, 1), lookY = clamp((focus.y - y) / 3, -.6, .6);
  return {
    x, y, z: mix(dock.z, visit.z, flight), scale: compact ? lower ? 1.4 : 1.15 : 1.65,
    yaw: -.2 + lookX * .2, pitch: lookY * -.05, roll: still ? 0 : Math.sin(flight * Math.PI) * .09,
    lookX, lookY, armL: .18 + attention * .5, armR: .12, armFwdL: attention * .42,
    browY: attention * .2, eyeWide: attention * .12, thrust: .38 + flight * .22,
    idle: still ? 0 : .35, beacon: attention ? .5 : .18, beaconWarm: 1
  };
}
