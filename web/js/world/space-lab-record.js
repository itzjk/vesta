import {pressureDependence} from '../core/assumption-audit.js';

// A presentation snapshot of an existing source row. No interpolation, sensor
// reading, prediction, matching calculation or new experimental result occurs.
export function spaceLabRecord(db,question,query){
  if(!question||!query)return null;
  const id=question.sources?.rows?.[0]?.id||null,row=id?db.testById?.[id]:null;
  // Keep the answer and its source button associated with the same record. An
  // unrelated finding's missing field must not look like this row failed a test.
  const representative=id?question.comparisons?.find(entry=>entry.kind==='row'&&entry.id===id)
    :question.comparisons?.find(entry=>entry.kind==='finding');
  const compared=representative?.panel?.compared||[];
  const field=compared.find(field=>field.state!=='matched'&&field.detail)
    ||compared.find(field=>field.inferred&&field.detail)||compared.find(field=>field.detail);
  const condition=field?{recordId:representative.id,kind:representative.kind,key:field.key,state:field.state,inferred:Boolean(field.inferred),detail:field.detail}:null;
  const pressure=question.cell&&db.testById?pressureDependence(question.cell,db):null;
  const model={questionId:question.id||`${question.material_id}/${question.concern}`,material:question.material||db.materials?.[question.material_id]?.label||question.material_id,
    materialId:question.material_id,concern:question.concern,applicability:question.label||question.status,
    status:question.status,conditionDifference:condition,requestReason:question.request?.reason||null,
    pressure:pressure?{nearby:pressure.nearby,reported:pressure.reported,inferred:pressure.inferred,unknown:pressure.unknown}:null,
    cabin:{oxygen:query.o2??null,pressure:query.p??null,gravity:query.g??null},
    rowCount:question.cell?.rows??null,nearbyCount:Array.isArray(question.cell?.hit_ids)?question.cell.hit_ids.length:0,
    findingCount:Array.isArray(question.cell?.finding_ids)?question.cell.finding_ids.length:0,
    state:!id?'no-row':!row?'record-unavailable':'recorded',record:null,
    limitation:'Archived source values, not new measurements or predicted results for this cabin.'};
  if(!row)return model;
  const entries=Object.entries(row.outcomes||{});
  const fields=entries.slice(0,3).map(([name,value])=>({name,raw:value?.raw==null?null:structuredClone(value.raw),value:value?.value==null?null:structuredClone(value.value),unit:value?.unit??null}));
  const panel=question.comparisons?.find(entry=>entry.id===id)?.panel;
  const difference=panel?.compared?.find(field=>field.state!=='matched'&&field.detail)?.detail||null;
  model.record={id:row.id,label:row.test_label??null,table:row.table_file??null,row:row.row??null,
    specimen:row.fuel_raw||row.fuel||null,fields,outcomeFieldCount:entries.length,difference};
  return model;
}

export function recordedFieldText(field){
  const value=field.raw!=null&&field.raw!==''?String(field.raw):field.value;
  if(value==null||value==='')return 'Not reported';
  const text=Array.isArray(value)?value.join('–'):String(value);
  return `${text}${field.unit?` ${field.unit}`:''}`;
}
