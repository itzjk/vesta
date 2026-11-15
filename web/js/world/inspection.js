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
  const keys = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];
  const numeric = counts && !Array.isArray(counts) && keys.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0);
  const total = numeric ? keys.reduce((sum, key) => sum + counts[key], 0) : null;
  const valid = numeric && Number.isSafeInteger(total);
  const currentPhase = INSPECTION_STEPS.includes(phase) ? phase : 'ready';
  return {
    type: 'vesta-digital-inspection', version: 1, mode: 'software-concept',
    signal: { origin: 'scripted-demo', observation: 'Visual cue at an equipment bay; cause unknown.' },
    cabin: { preset: q?.preset ?? null, oxygen_percent: q?.o2 ?? null, pressure_kpa: q?.p ?? null, gravity: q?.g ?? null },
    evidence: valid ? Object.fromEntries(keys.map(key => [key, counts[key]])) : null,
    evidence_scope: { unit: 'material-concern questions', total: valid ? total : null,
      meaning: 'Coverage in the loaded VESTA collection, not fire probability or cabin safety.' },
    visualization: { motion: 'scripted-choreography', scan: 'illustrative-no-sensor-data', target: 'equipment-bay',
      physics_model: false, freefall_anchoring: false },
    phase: currentPhase, human_approved: ['inspect', 'return', 'complete'].includes(currentPhase),
    proposed_action: 'Visual inspection only',
    result: currentPhase === 'complete' ? 'Demonstration completed; no hardware action or safety conclusion.' : 'Demonstration in progress.',
    hardware_connected: false
  };
}
