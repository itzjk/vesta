import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildIndex,presetPoint} from '../../web/js/core/index.js';
import {createInventoryReviewSession} from '../../web/js/core/inventory-review.js';
import {requestedReviewSelection,chooseReviewFocus} from '../../web/js/world/review-selection.js';

const raw=Object.fromEntries(['meta','tests','findings','investigations','presets'].map(name=>[name,JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`,import.meta.url)))]));
const db=buildIndex(raw),query=presetPoint(db,'station','prevention','pmma');
const run=materials=>createInventoryReviewSession({db,query,materials,yieldTurn:()=>Promise.resolve()}).run();

test('explicit Station PMMA prevention survives the actual default Kapton-priority queue',async()=>{
  const report=await run(['pmma','kapton','silicone']),before=JSON.stringify(report);
  assert.equal(report.priority[0].question_id,'kapton/prevention');
  assert.deepEqual(chooseReviewFocus(report,{material:'pmma',concern:'prevention'},true),{material:'pmma',concern:'prevention',explicit:true});
  const question=report.questions.find(q=>q.id==='pmma/prevention');
  assert.equal(question.status,'PROVEN');assert.equal(question.cell.hit_ids.length,16);
  assert.match(question.label,/pressure inferred/);assert.equal(JSON.stringify(report),before);
});

test('PMMA-only review preserves prevention instead of silently selecting detection',async()=>{
  const report=await run(['pmma']);assert.equal(report.priority[0].question_id,'pmma/detection');
  assert.equal(chooseReviewFocus(report,{material:'pmma',concern:'prevention'},true).concern,'prevention');
  assert.deepEqual(chooseReviewFocus(report,{material:'pmma',concern:'prevention'},false),{material:'pmma',concern:'detection',explicit:false});
});

test('generic and removed-question fallbacks do not pretend to be explicit selections',async()=>{
  const report=await run(['kapton']);
  assert.deepEqual(chooseReviewFocus(report,{material:'pmma',concern:'prevention'},true),{material:'kapton',concern:'prevention',explicit:false});
  assert.equal(chooseReviewFocus({questions:[],priority:[]},null,false),null);
});

test('no-source questions remain selectable without manufacturing evidence',async()=>{
  const report=await run(['kapton']),question=report.questions.find(q=>q.id==='kapton/prevention');
  assert.equal(question.status,'NEVER_TESTED');assert.equal(question.sources.rows.length,0);
  assert.deepEqual(chooseReviewFocus(report,{material:'kapton',concern:'prevention'},true),{material:'kapton',concern:'prevention',explicit:true});
  assert.equal(question.status,'NEVER_TESTED');assert.equal(question.sources.rows.length,0);
});

test('any indexed material can be requested, independently of the three scene props',async()=>{
  const original=['pmma'];const request={material:'nomex',concern:'prevention'};
  const selection=requestedReviewSelection(request,db.materials,original);
  assert.deepEqual(selection,{focus:request,materials:['pmma','nomex'],inventoryChanged:true});
  assert.deepEqual(original,['pmma']);
  const report=await run(selection.materials);assert.deepEqual(chooseReviewFocus(report,selection.focus,true),{...request,explicit:true});
  assert.equal(report.questions.find(q=>q.id==='nomex/prevention').cell.hit_ids.length,2);
});

test('invalid requests are ignored and already selected material does not alter inventory',()=>{
  for(const request of [null,{material:'unknown-id',concern:'prevention'},{material:'pmma',concern:'flight-safety'},{material:'__proto__',concern:'prevention'}])assert.equal(requestedReviewSelection(request,db.materials,['pmma']),null);
  const selected=['pmma','kapton'];const result=requestedReviewSelection({material:'pmma',concern:'suppression'},db.materials,selected);
  assert.equal(result.inventoryChanged,false);assert.deepEqual(result.materials,selected);assert.notEqual(result.materials,selected);
});
