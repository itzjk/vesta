import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advanceInspection, inspectionReport, INSPECTION_STEPS } from '../../web/js/world/inspection.js';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cells, tally } from '../../web/js/core/status.js';
import { stationFor } from '../../web/js/world/world.js';
import { stationHash } from '../../web/js/world/welcome.js';
import { parseHash } from '../../web/js/router.js';

test('inspection cannot pass human review through an ordinary advance', () => {
  let phase='ready';
  for(let i=0;i<20;i++) phase=advanceInspection(phase);
  assert.equal(phase,'review');
  assert.equal(advanceInspection(phase,'approve'),'inspect');
  assert.equal(advanceInspection('observe','approve'),'observe');
});

test('the report distinguishes source coverage from simulated observations and revokes approval on reset', () => {
  const q={preset:'lunar-base',o2:34,p:56.5,g:'moon'}, counts={PROVEN:0,EXTRAPOLATED:24,NEVER_TESTED:21};
  const report=inspectionReport(q,counts,'complete');
  assert.deepEqual(report.evidence,counts);
  assert.equal(report.signal.origin,'scripted-demo');
  assert.equal(report.hardware_connected,false);
  assert.equal(report.human_approved,true);
  assert.equal(inspectionReport(q,counts,advanceInspection('complete','reset')).human_approved,false);
  assert.equal(inspectionReport(q,null,'evidence').evidence,null);
});

test('robotics navigation preserves the cabin and leaves the trust route reachable', () => {
  const q={preset:'custom',o2:28,p:68,g:'moon',concern:'detection',material:'pmma',habitat:'lunar'};
  const route=parseHash(stationHash('robotics',q));
  assert.equal(route.known,true);
  assert.equal(stationFor(route.route,route.params),5);
  assert.equal(route.params.o2,'28');
  assert.equal(route.params.mat,'pmma');
  assert.equal(stationFor('engine',{}),4);
  assert.equal(stationFor('design',{station:'robotics'}),2);
});

test('no ordinary or unrecognized event can bypass review; only approval at review starts inspection', () => {
  const beforeApproval = ['ready', 'observe', 'evidence', 'review'];
  for (const start of beforeApproval) {
    let phase = start;
    for (const event of ['inspect', 'approved', 'return', 'complete', 'next', 'next', 'next', 'next']) {
      phase = advanceInspection(phase, event);
      assert.ok(beforeApproval.includes(phase));
      assert.equal(inspectionReport({}, null, phase).human_approved, false);
    }
  }
  for (const phase of beforeApproval.filter(p => p !== 'review')) assert.equal(advanceInspection(phase, 'approve'), phase);
  let phase = advanceInspection('review', 'approve');
  assert.equal(phase, 'inspect');
  phase = advanceInspection(phase); assert.equal(phase, 'return');
  phase = advanceInspection(phase); assert.equal(phase, 'complete');
  assert.equal(advanceInspection(phase), 'complete');
});

test('reset revokes approval at every stage, requires a fresh review, and unknown phases fail closed', () => {
  for (const phase of INSPECTION_STEPS) {
    const reset = advanceInspection(phase, 'reset');
    assert.equal(reset, 'ready');
    assert.equal(inspectionReport({}, null, reset).human_approved, false);
    assert.equal(advanceInspection(reset, 'approve'), 'ready');
  }
  const report = inspectionReport(null, null, 'approved-by-robot');
  assert.equal(report.phase, 'ready'); assert.equal(report.human_approved, false);
  assert.equal(report.cabin.oxygen_percent, null); assert.equal(report.evidence, null);
});

test('real cabin coverage is exported as question counts and never as sensor observations or burn counts', () => {
  const raw = Object.fromEntries(['tests', 'findings', 'investigations', 'presets'].map(name => [name,
    JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
  const db = buildIndex(raw);
  for (const [preset, expected] of [['station', { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21 }], ['lunar-base', { PROVEN: 0, EXTRAPOLATED: 24, NEVER_TESTED: 21 }]]) {
    const q = presetPoint(db, preset, 'prevention', 'pmma'), coverage = tally(cells(q, db));
    const report = inspectionReport(q, coverage, 'evidence');
    assert.deepEqual(report.evidence, expected);
    assert.equal(report.evidence_scope.unit, 'material-concern questions');
    assert.equal(report.evidence_scope.total, cells(q, db).length);
    assert.notEqual(report.evidence_scope.total, db.tests.length);
    assert.equal(report.human_approved, false);
    assert.equal(report.signal.origin, 'scripted-demo'); assert.match(report.signal.observation, /cause unknown/);
    assert.deepEqual(report.visualization, { motion: 'scripted-choreography', scan: 'illustrative-no-sensor-data', target: 'equipment-bay', physics_model: false, freefall_anchoring: false });
    assert.equal(report.hardware_connected, false); assert.equal(report.proposed_action, 'Visual inspection only');
  }
});

test('report snapshots validated counts only; missing or invalid evidence never becomes a zero-coverage result', () => {
  const q = { preset: 'station', o2: 21, p: 101.4, g: '0g' };
  const counts = { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21, safety_certified: true };
  const report = inspectionReport(q, counts, 'complete');
  counts.PROVEN = 99; q.o2 = 90;
  assert.deepEqual(report.evidence, { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21 });
  assert.equal(report.cabin.oxygen_percent, 21);
  for (const invalid of [null, {}, [], { PROVEN: 0, EXTRAPOLATED: 0 },
    { PROVEN: '0', EXTRAPOLATED: 24, NEVER_TESTED: 21 }, { PROVEN: NaN, EXTRAPOLATED: 24, NEVER_TESTED: 21 },
    { PROVEN: -1, EXTRAPOLATED: 24, NEVER_TESTED: 21 }, { PROVEN: .5, EXTRAPOLATED: 24, NEVER_TESTED: 21 },
    { PROVEN: 1n, EXTRAPOLATED: 24, NEVER_TESTED: 21 }, { PROVEN: Number.MAX_SAFE_INTEGER, EXTRAPOLATED: 24, NEVER_TESTED: 21 }]) {
    const empty = inspectionReport(q, invalid, 'evidence');
    assert.equal(empty.evidence, null); assert.equal(empty.evidence_scope.total, null);
  }
  const zero = inspectionReport(q, { PROVEN: 0, EXTRAPOLATED: 0, NEVER_TESTED: 0 }, 'evidence');
  assert.equal(zero.evidence_scope.total, 0);
});
