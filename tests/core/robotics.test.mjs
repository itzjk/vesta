import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceInspection, inspectionReport } from '../../web/js/world/inspection.js';
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
