import { cells, tally, nearestRow } from '../core/status.js';

export const INSPECTION_STEPS = ['ready', 'observe', 'evidence', 'review', 'inspect', 'return', 'complete'];
export const INSPECTION_DWELL = Object.freeze({ observe: 1.8, evidence: 2.4, inspect: 8, return: 4.05 });

// Only bounded demonstration stages advance with time. Approval is never a clock event.
export function advanceInspectionClock(phase, elapsed) {
  if (!INSPECTION_STEPS.includes(phase)) return 'ready';
  if (!Number.isFinite(elapsed) || elapsed < 0 || !(phase in INSPECTION_DWELL)) return phase;
  return elapsed >= INSPECTION_DWELL[phase] ? advanceInspection(phase) : phase;
}

// Capture/reduced-motion may have no continuing RAF. Automatic stages settle,
// but human review remains a boundary even when the animation is skipped.
export function settleInspectionPose(phase) {
  let current=INSPECTION_STEPS.includes(phase)?phase:'ready';
  for(let i=0;i<INSPECTION_STEPS.length;i++){
    const next=advanceInspectionClock(current,INSPECTION_DWELL[current]??0);
    if(next===current)return current;
    current=next;
  }
  return current;
}

export function buildInspectionMission(q, db) {
  const query = { ...q, material: 'pmma', concern: 'prevention' };
  const all = cells(query, db), selected = all.find(cell => cell.material === 'pmma' && cell.concern === 'prevention');
  const row = nearestRow('pmma', 'prevention', query, db)?.row ?? null;
  const investigation = row ? db.invById[row.psi_id] : null;
  return {
    id: 'lunar-work-zone-traceability', asset_id: 'HAB-PMMA-01',
    title: 'Trace a PMMA work-zone panel before crew review',
    setting: 'lunar-habitat-concept', asset_kind: 'illustrative-panel',
    query, counts: tally(all),
    question: { material: 'pmma', concern: 'prevention', status: selected?.status ?? null,
      nearby_row_ids: [...(selected?.hit_ids || [])] },
    nearest_source: row ? { id: row.id, investigation: row.psi_id,
      title: investigation?.name || row.investigation || row.psi_id,
      url: row.psi_url || investigation?.psi_url || null } : null,
    disposition: selected?.status === 'PROVEN' ? 'CREW_REVIEW_REQUIRED' : 'EVIDENCE_GAP_REVIEW_REQUIRED',
    crew_work_authorized: false,
    limit: 'Source coverage does not validate the robot, diagnose the panel or authorize crew work.'
  };
}

// A software demonstration: no telemetry, actuator or autonomous flight connection.
export function advanceInspection(phase, event = 'next') {
  if (event === 'reset') return 'ready';
  if (!INSPECTION_STEPS.includes(phase)) return 'ready';
  if (phase === 'review') return event === 'approve' ? 'inspect' : phase;
  if (event !== 'next') return phase;
  return INSPECTION_STEPS[Math.min(INSPECTION_STEPS.indexOf(phase) + 1, INSPECTION_STEPS.length - 1)];
}

export function inspectionReport(q, counts, phase, mission = null, { reducedMotion = false } = {}) {
  const keys = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];
  const numeric = counts && !Array.isArray(counts) && keys.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0);
  const total = numeric ? keys.reduce((sum, key) => sum + counts[key], 0) : null;
  const valid = numeric && Number.isSafeInteger(total);
  const currentPhase = INSPECTION_STEPS.includes(phase) ? phase : 'ready';
  return {
    type: 'vesta-digital-inspection', version: 1, mode: 'software-concept',
    signal: { origin: 'scripted-demo', observation: 'PMMA panel traceability target in a work zone; physical condition and cause unknown.' },
    cabin: { preset: q?.preset ?? null, oxygen_percent: q?.o2 ?? null, pressure_kpa: q?.p ?? null, gravity: q?.g ?? null },
    evidence: valid ? Object.fromEntries(keys.map(key => [key, counts[key]])) : null,
    evidence_scope: { unit: 'material-concern questions', total: valid ? total : null,
      meaning: 'Coverage in the loaded VESTA collection, not fire probability or cabin safety.' },
    visualization: { motion: 'scripted-choreography', scan: 'illustrative-no-sensor-data', target: 'equipment-bay',
      physics_model: false, freefall_anchoring: false },
    mission: mission ? {
      id: 'lunar-work-zone-traceability', asset_id: 'HAB-PMMA-01', asset_kind: 'illustrative-panel',
      setting: 'lunar-habitat-concept', material: 'pmma', concern: 'prevention',
      source_status: ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'].includes(mission.question?.status) ? mission.question.status : null,
      nearby_row_ids: Array.isArray(mission.question?.nearby_row_ids) ? mission.question.nearby_row_ids.filter(id => typeof id === 'string') : [],
      nearest_source: mission.nearest_source ? Object.fromEntries(['id','investigation','title','url'].map(key => [key,typeof mission.nearest_source[key] === 'string' ? mission.nearest_source[key] : null])) : null,
      disposition: mission.question?.status === 'PROVEN' ? 'CREW_REVIEW_REQUIRED' : 'EVIDENCE_GAP_REVIEW_REQUIRED',
      crew_work_authorized: false, sensor_measurements: null,
      visual_pass_recorded: currentPhase === 'complete', motion_mode: reducedMotion ? 'reduced-motion-poses' : 'scripted-animation',
      tasks: ['Consult selected cabin evidence', 'Human approval', 'Visual panel pass', 'Return to dock', 'Crew review handoff']
    } : null,
    phase: currentPhase, human_approved: ['inspect', 'return', 'complete'].includes(currentPhase),
    proposed_action: 'Visual inspection only',
    result: currentPhase === 'complete' ? 'Illustrative inspection logged; crew review still required. No measured condition or safety conclusion.' : 'Demonstration in progress; crew work is not authorized.',
    hardware_connected: false
  };
}
