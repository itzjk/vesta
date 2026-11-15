export const INSPECTION_STEPS = ['ready', 'observe', 'evidence', 'review', 'inspect', 'return', 'complete'];

// A software demonstration: no telemetry, actuator or autonomous flight connection.
export function advanceInspection(phase, event = 'next') {
  if (event === 'reset') return 'ready';
  if (!INSPECTION_STEPS.includes(phase)) return 'ready';
  if (phase === 'review') return event === 'approve' ? 'inspect' : phase;
  if (event !== 'next') return phase;
  return INSPECTION_STEPS[Math.min(INSPECTION_STEPS.indexOf(phase) + 1, INSPECTION_STEPS.length - 1)];
}

export function inspectionReport(q, counts, phase) {
  const valid = counts && ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'].every(key => Number.isInteger(counts[key]) && counts[key] >= 0);
  return {
    type: 'vesta-digital-inspection', version: 1, mode: 'software-concept',
    signal: { origin: 'scripted-demo', observation: 'Visual cue at an equipment bay; cause unknown.' },
    cabin: { preset: q.preset, oxygen_percent: q.o2, pressure_kpa: q.p, gravity: q.g },
    evidence: valid ? { ...counts } : null,
    phase, human_approved: ['inspect', 'return', 'complete'].includes(phase),
    proposed_action: 'Visual inspection only',
    result: phase === 'complete' ? 'Demonstration completed; no hardware action or safety conclusion.' : 'Demonstration in progress.',
    hardware_connected: false
  };
}
