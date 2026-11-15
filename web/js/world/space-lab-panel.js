import {recordedFieldText} from './space-lab-record.js?v=question-lab-20261115-3';

const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const css=`.space-lab-result{margin-top:14px;padding:12px;background:#10191df2;border-top:1px solid #b49b6b66;color:#eee6d8}.space-lab-result[hidden]{display:none!important}.space-lab-result h3{font:600 18px/1.2 var(--font);margin:0 0 8px}.space-lab-result p{font-size:14px!important;line-height:1.4!important;margin:6px 0!important}.space-lab-result summary{min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer;font:500 14px/1.4 var(--font);color:#eed7b0}.space-lab-result .sl-section{font-size:12px!important;text-transform:uppercase;letter-spacing:.06em;color:#d8ba87}.space-lab-result dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}.space-lab-result dl div{min-width:0}.space-lab-result dt{font:400 12px/1.3 var(--font);overflow-wrap:anywhere;color:#c9c3b8}.space-lab-result dd{font:500 17px/1.3 var(--font);margin:4px 0;overflow-wrap:anywhere;white-space:pre-wrap}.space-lab-result button{min-height:44px;padding:7px 0;background:none;border:0;border-bottom:1px solid #b49b6b;color:#eed7b0;cursor:pointer;font:500 14px/1.3 var(--font)}.space-lab-result button:focus-visible,.space-lab-result summary:focus-visible{outline:2px solid #e4ba78;outline-offset:3px}.robotics-lab-path{font-size:14px!important;margin:10px 0!important;color:#e2c394!important}.robotics-work-caption.has-kit-task>.robotics-lab-path{display:none}`;

export function createSpaceLabPanel({onSource}={}){
  const element=make('section',null,'space-lab-result');element.hidden=true;element.setAttribute('aria-label','Space lab bench result');
  // Unmodelled materials have no kit strip, but their real record still needs a
  // bounded, scrollable result area. Keep the guide and native details reachable.
  const overflow=`.robotics-work-caption.has-lab-result:not(.has-kit-task){max-height:calc(100dvh - 250px);overflow:auto;overscroll-behavior:contain;pointer-events:auto;padding-right:8px}@media(max-width:759px){.robotics-work-caption.has-lab-result:not(.has-kit-task){top:auto!important;bottom:174px;left:14px;width:calc(100% - 28px);max-width:none;max-height:min(190px,34dvh);background:#101b20ed;padding:8px 12px;box-sizing:border-box;scroll-padding:8px}.robotics-work-caption.has-lab-result:not(.has-kit-task)>:is(h1,.robotics-eyebrow,.robotics-lab-path,.robotics-caption-scope){display:none}}`;
  const style=make('style',css+overflow),title=make('h3'),archive=make('p','Archived NASA record','sl-section'),record=make('p'),fields=make('dl'),missing=make('p');
  const details=make('details'),summary=make('summary');
  const current=make('p','Current cabin applicability','sl-section'),applicability=make('p'),limits=make('p'),scope=make('p');
  const source=make('button','Open original source record');source.type='button';let model=null,key='',disposed=false;
  const open=()=>{if(model?.record&&typeof onSource==='function')onSource({material:model.materialId,concern:model.concern,rowId:model.record.id});};
  source.addEventListener('click',open);
  details.append(summary,archive,record,fields,missing,current,applicability,limits,source,scope);
  element.append(style,title,details);
  function update(next){
    if(disposed)return;const nextKey=JSON.stringify(next);if(nextKey===key)return;key=nextKey;model=next;element.hidden=!next;if(!next)return;
    title.textContent=`Bench result · ${next.material} / ${next.concern}`;
    const row=next.record;summary.textContent=row?`${row.id} · ${row.outcomeFieldCount?`${row.outcomeFieldCount} recorded fields`:'original record'} & cabin limits`:'No archived table row · review the gap';
    record.textContent=row?`${row.id}${row.label?` · ${row.label}`:''}${row.specimen?` · ${row.specimen}`:''}`:'No archived source row selected for this question.';
    fields.replaceChildren();for(const field of row?.fields||[]){const group=make('div');group.append(make('dt',field.name.replaceAll('_',' ')),make('dd',recordedFieldText(field)));fields.append(group);}
    fields.hidden=!row?.fields.length;
    missing.hidden=Boolean(row?.fields.length);missing.textContent=next.state==='record-unavailable'?'The selected source row is unavailable in this collection.':row?'No outcome fields are reported in this record. Open the original source for context.':'There is no table result to replay. The evidence review still records the gap and a request for human review.';
    const c=next.cabin;applicability.textContent=`${next.applicability} · ${c.oxygen??'unknown'}% O₂ · ${c.pressure??'unknown'} kPa · ${c.gravity??'unknown'} gravity`;
    limits.textContent=row?.difference||'Coverage compares source conditions; it does not predict a new experiment. Airflow, geometry, thickness, ignition and suppressant are not matched.';
    source.hidden=!row;source.disabled=typeof onSource!=='function';scope.textContent=next.limitation;
  }
  return {element,update,dispose(){if(disposed)return;disposed=true;source.removeEventListener('click',open);model=null;element.remove();}};
}
