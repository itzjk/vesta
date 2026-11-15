import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildIndex,presetPoint} from '../../web/js/core/index.js';
import {createInventoryReviewSession} from '../../web/js/core/inventory-review.js';
import {spaceLabRecord,recordedFieldText} from '../../web/js/world/space-lab-record.js';

const raw=Object.fromEntries(['meta','tests','findings','investigations','presets'].map(name=>[name,JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`,import.meta.url)))]));
const db=buildIndex(raw);
const run=async(preset,material='pmma')=>{
  const query=presetPoint(db,preset,'prevention',material);
  const report=await createInventoryReviewSession({db,query,materials:[material],yieldTurn:()=>Promise.resolve()}).run();
  return {query,question:report.questions.find(q=>q.id===`${material}/prevention`)};
};

test('Station PMMA bench shows the selected archive row and exact source outcomes, retaining the inference qualifier',async()=>{
  const {query,question}=await run('station');const before=JSON.stringify({query,question,row:db.testById[question.sources.rows[0].id]});
  const model=spaceLabRecord(db,question,query);
  assert.equal(model.record.id,question.sources.rows[0].id);assert.equal(model.record.id,'PSI-25:10');
  assert.deepEqual(model.record.fields.map(f=>[f.name,f.raw,f.unit]),[
    ['o2_final_percent','20.8','%'],['co2_final_percent','0.44','%'],['co_final_ppm','23','ppm']]);
  assert.match(model.applicability,/pressure inferred/);assert.equal(model.cabin.oxygen,query.o2);
  assert.equal(model.conditionDifference.recordId,model.record.id);
  assert.equal(model.conditionDifference.key,'pressure');assert.equal(model.conditionDifference.state,'matched');
  assert.equal(model.conditionDifference.inferred,true);assert.match(model.conditionDifference.detail,/facility-inferred/);
  assert.deepEqual(model.pressure,{nearby:16,reported:0,inferred:16,unknown:0});
  assert.equal(model.nearbyCount,16);assert.equal(model.rowCount,question.cell.rows);
  assert.equal(JSON.stringify({query,question,row:db.testById[question.sources.rows[0].id]}),before);
});

test('Lunar review chooses its actual nearest row, not a hard-coded Station row or predicted outcome',async()=>{
  const {query,question}=await run('lunar-base');const model=spaceLabRecord(db,question,query);
  assert.equal(model.record.id,question.sources.rows[0].id);assert.equal(model.record.id,'PSI-25:1');
  assert.deepEqual(model.record.fields.map(recordedFieldText),['22.2 %','0.44 %','6 ppm']);
  assert.equal(model.applicability,question.label);assert.equal(model.cabin.gravity,query.g);
  assert.ok(model.record.difference);assert.match(model.limitation,/not new measurements or predicted results/);
  assert.equal(model.conditionDifference.recordId,model.record.id);assert.equal(model.conditionDifference.key,'gravity');
  assert.equal(model.conditionDifference.state,'different');assert.equal(model.nearbyCount,0);
  const sameArchive=spaceLabRecord(db,question,{...query,o2:30});
  assert.deepEqual(sameArchive.record.fields,model.record.fields);assert.equal(sameArchive.cabin.oxygen,30);
});

test('a changed first source selection changes the bench record without replacing its raw values',async()=>{
  const {query,question}=await run('station');
  const selected={...question,sources:{...question.sources,rows:[{id:'PSI-25:11'}]}};
  const model=spaceLabRecord(db,selected,query);
  assert.equal(model.record.label,'B11');assert.equal(recordedFieldText(model.record.fields[2]),'46 ppm');
});

test('a no-source question remains a gap; missing records and missing outcomes remain distinct',async()=>{
  const {query,question}=await run('station','kapton');
  const gap=spaceLabRecord(db,question,query);assert.equal(gap.state,'no-row');assert.equal(gap.record,null);
  assert.equal(gap.nearbyCount,0);assert.equal(gap.findingCount,0);assert.equal(gap.conditionDifference,null);
  assert.match(gap.requestReason,/No row or finding/);
  const missing={...question,sources:{rows:[{id:'absent'}]}};
  assert.equal(spaceLabRecord(db,missing,query).state,'record-unavailable');
  const emptyDb={...db,testById:{example:{id:'example',outcomes:{}}}};
  const empty=spaceLabRecord(emptyDb,{...question,sources:{rows:[{id:'example'}]}},query);
  assert.equal(empty.state,'recorded');assert.deepEqual(empty.record.fields,[]);
  assert.equal(spaceLabRecord(db,null,query),null);
});

test('row source and visible condition stay associated despite unrelated incomplete findings',async()=>{
  const {query,question}=await run('station');
  const copy=structuredClone(question);
  copy.comparisons.unshift({kind:'finding',id:'unrelated',panel:{compared:[{key:'oxygen',state:'unavailable',detail:'Not reported in an unrelated finding'}]}});
  const model=spaceLabRecord(db,copy,query);
  assert.equal(model.conditionDifference.recordId,model.record.id);assert.equal(model.conditionDifference.kind,'row');
  assert.doesNotMatch(model.conditionDifference.detail,/unrelated/);
  copy.sources.rows=[];copy.comparisons=copy.comparisons.filter(c=>c.kind==='finding');
  const findingOnly=spaceLabRecord(db,copy,query);
  assert.equal(findingOnly.record,null);assert.equal(findingOnly.conditionDifference.kind,'finding');
  assert.equal(findingOnly.conditionDifference.recordId,'unrelated');
});

test('zero, qualifiers, ranges and absent values are not interpolated or aliased into the collection',()=>{
  const row={id:'example',outcomes:{zero:{raw:'0',value:0,unit:'ppm'},bound:{raw:'< 1',value:null,unit:'mm'},range:{raw:null,value:[2,4],unit:'s'},more:{raw:'not reported',value:null,unit:null}}};
  const model=spaceLabRecord({testById:{example:row}},{id:'pmma/prevention',material_id:'pmma',concern:'prevention',sources:{rows:[{id:'example'}]}},{o2:null,p:null,g:null});
  assert.equal(model.record.outcomeFieldCount,4);assert.equal(model.record.fields.length,3);
  assert.deepEqual(model.record.fields.map(recordedFieldText),['0 ppm','< 1 mm','2–4 s']);
  model.record.fields[2].value[0]=999;assert.deepEqual(row.outcomes.range.value,[2,4]);
  assert.equal(recordedFieldText({raw:null,value:null,unit:'kPa'}),'Not reported');
  assert.deepEqual(model.cabin,{oxygen:null,pressure:null,gravity:null});
});
