import {recordedFieldText} from './space-lab-record.js?v=lab-actions-20261115-1';

const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};

/** The selected question's answer stays visible; raw archived values are detail. */
export function createSpaceLabPanel({onSource,onPrepare}={}){
  const element=make('section',null,'space-lab-result');element.hidden=true;element.setAttribute('aria-label','Selected lab question answer');
  const title=make('h3'),verdict=make('p',null,'sl-verdict'),counts=make('p',null,'sl-counts');title.tabIndex=-1;
  const difference=make('p',null,'sl-difference'),scope=make('p','Coverage, not safety. No new physical experiment.','sl-scope');
  const actions=make('div',null,'sl-actions');
  const source=make('button','Open source'),prepare=make('button','Prepare crew handoff');source.type=prepare.type='button';
  source.dataset.labAction='source';prepare.dataset.labAction='prepare';actions.append(source,prepare);
  const details=make('details'),summary=make('summary','Archived record & cabin details');
  const archive=make('p','Archived NASA record','sl-section'),record=make('p'),fields=make('dl'),missing=make('p');
  const current=make('p','Current cabin applicability','sl-section'),cabin=make('p'),limits=make('p'),request=make('p');
  const taskLimit=make('p',null,'sl-scope');
  details.append(summary,archive,record,fields,missing,current,cabin,limits,request);
  element.append(title,verdict,counts,actions,difference,scope,taskLimit,details);
  let model=null,key='',disposed=false,canPrepare=false;
  const open=()=>{if(model&&typeof onSource==='function')onSource({material:model.materialId,concern:model.concern,rowId:model.record?.id});};
  const handoff=()=>{if(model&&canPrepare&&typeof onPrepare==='function')onPrepare({material:model.materialId,concern:model.concern});};
  source.addEventListener('click',open);prepare.addEventListener('click',handoff);
  function update(next,{handoffAvailable=false,handoffReady=false}={}){
    if(disposed)return;const nextKey=JSON.stringify([next,handoffAvailable,handoffReady]);if(nextKey===key)return;
    if(next?.questionId!==model?.questionId)details.open=false;
    key=nextKey;model=next;element.hidden=!next;if(!next)return;
    title.textContent=`${next.material} · ${next.concern}`;
    verdict.textContent=next.applicability;verdict.dataset.coverage=next.status;
    counts.textContent=`${next.nearbyCount} nearby / ${next.rowCount??'unknown'} indexed rows · ${next.findingCount} findings`
      +(next.pressure?.inferred?` · ${next.pressure.inferred} nearby with facility-inferred pressure`:'');
    const condition=next.conditionDifference;
    difference.textContent=condition?`${condition.kind==='finding'?'Finding':'Row'} ${condition.recordId}: ${condition.detail}`
      :next.requestReason||'Check source assumptions and the variables outside matching before transferring evidence to this cabin.';
    source.textContent=next.record?'Open source':next.status==='NEVER_TESTED'?'Inspect evidence gap':'Open evidence';
    source.disabled=typeof onSource!=='function';
    canPrepare=handoffAvailable&&typeof onPrepare==='function';prepare.hidden=!canPrepare;
    prepare.textContent=handoffReady?'View crew handoff':'Prepare crew handoff';
    taskLimit.hidden=handoffAvailable;taskLimit.textContent=handoffAvailable?'':'No virtual kit is modelled for this material. Source review and report export remain available.';
    const row=next.record;summary.textContent=row?`Archived record ${row.id} & cabin details`:'Source availability & cabin details';
    record.textContent=row?`${row.id}${row.label?` · ${row.label}`:''}${row.specimen?` · ${row.specimen}`:''}`:'No archived source row selected for this question.';
    fields.replaceChildren();for(const field of row?.fields||[]){const group=make('div');group.append(make('dt',field.name.replaceAll('_',' ')),make('dd',recordedFieldText(field)));fields.append(group);}
    fields.hidden=!row?.fields.length;
    missing.hidden=Boolean(row?.fields.length);missing.textContent=next.state==='record-unavailable'?'The selected source row is unavailable in this collection.':row?'No outcome fields are reported in this record. Open the original source for context.':'No table outcome is available for this question; this does not imply that NASA has never tested the material.';
    const c=next.cabin;cabin.textContent=`${c.oxygen??'unknown'}% O₂ · ${c.pressure??'unknown'} kPa · ${c.gravity??'unknown'} gravity. ${next.applicability}.`;
    limits.textContent=next.limitation+' Airflow, geometry, thickness, ignition and suppressant are not matched.';
    request.textContent=next.requestReason||'';request.hidden=!next.requestReason;
  }
  return {element,update,focus(){title.focus({preventScroll:true});},dispose(){if(disposed)return;disposed=true;source.removeEventListener('click',open);prepare.removeEventListener('click',handoff);model=null;element.remove();}};
}
