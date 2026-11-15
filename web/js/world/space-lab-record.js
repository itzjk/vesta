// A presentation snapshot of an existing source row. No interpolation, sensor
// reading, prediction, matching calculation or new experimental result occurs.
export function spaceLabRecord(db,question,query){
  if(!question||!query)return null;
  const id=question.sources?.rows?.[0]?.id||null,row=id?db.testById?.[id]:null;
  const model={questionId:question.id||`${question.material_id}/${question.concern}`,material:question.material||db.materials?.[question.material_id]?.label||question.material_id,
    materialId:question.material_id,concern:question.concern,applicability:question.label||question.status,
    cabin:{oxygen:query.o2??null,pressure:query.p??null,gravity:query.g??null},
    rowCount:question.cell?.rows??null,nearbyCount:Array.isArray(question.cell?.hit_ids)?question.cell.hit_ids.length:0,
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
