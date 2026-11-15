import { createHumanoidInspector } from '../scene/humanoid-inspector.js?v=earth-task-20261115-1';
import { createMaintenanceBay } from '../scene/maintenance-bay.js?v=earth-task-20261115-1';
import { ensureInformationPolishStyles } from './information-polish.js?v=habitat-20261115-1';
import { createInventoryReviewSession, reviewToMarkdown } from '../core/inventory-review.js?v=habitat-20261115-1';
import { createInventoryReviewPanel } from './inventory-review-panel.js?v=habitat-20261115-1';
import { openCitation } from './cite.js?v=habitat-20261115-1';
import { proposeKitMission, createKitMission, kitInputSignature } from './kit-mission.js?v=earth-task-20261115-1';
import { createKitMissionPanel } from './kit-mission-panel.js?v=earth-task-20261115-1';
import { createRecordedReviewPanel } from './recorded-claude-review.js';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-robotics]')) {
  for (const file of ['robotics']) {
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL(`../../css/${file}.css?v=earth-task-20261115-1`,import.meta.url).href;sheet.dataset.vestaRobotics='';document.head.append(sheet);
  }
}
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const meaning={PROVEN:'Nearby evidence',EXTRAPOLATED:'Other or incomplete conditions',NEVER_TESTED:'No source in this collection',NOT_INDEXED:'Material not indexed'};

export async function build(world) {
  ensureInformationPolishStyles();world.host.classList.add('information-polish');
  const {THREE:T,stage,db}=world,group=new T.Group();group.name='lunar-inventory-review';
  const bay=createMaintenanceBay({THREE:T,groundY:-1.43});group.add(bay.group);
  bay.earthReady?.then(()=>world.invalidate?.());
  const humanoid=createHumanoidInspector({THREE:T,groundY:-1.43});group.add(humanoid.group);
  group.userData.resourceBudget={bay:bay.stats,humanoid:humanoid.stats};
  let active=false,disposed=false,lastTime=0,changed=0,savedAperture,parkedAt=null;
  let phase='ready',still=false,selected=['pmma','kapton','silicone'],session=null,report=null,generation=0,lastCabin='';
  let focus={material:'pmma',concern:'prevention'},workspaceOpen=false,notice='';
  let kit=null,kitState=null,kitSignature=null,kitFrame=null;
  let recordedPanel=null;
  const cabinKey=()=>JSON.stringify([world.q.preset,world.q.habitat,world.q.o2,world.q.p,world.q.g,world.q.gclass]);
  const currentQuestion=()=>report?.questions.find(q=>q.material_id===focus.material&&q.concern===focus.concern);
  const caption=node('section',null,'robotics-caption robotics-work-caption');caption.dataset.stationUi='robotics';caption.hidden=true;
  const targetLabel=node('p','Material inventory → evidence → review requests','robotics-mission-evidence');
  const outcome=node('p','Select materials and run the evidence review.','robotics-work-outcome');
  const selectedResult=node('p',null,'robotics-work-result');
  const locationButton=node('button','Open this question','robotics-question-button');locationButton.type='button';locationButton.dataset.action='review-question';
  locationButton.onclick=()=>{openWorkspace();panel.element.querySelector(`[data-question-id="${focus.material}/${focus.concern}"]`)?.scrollIntoView({block:'nearest'});};
  caption.append(node('p','LUNAR HABITAT · CREW SUPPORT','robotics-eyebrow'),node('h1','Prepare the crew review.'),targetLabel,outcome,selectedResult,locationButton,node('p','Evidence analysis + virtual kit staging','robotics-caption-scope'));
  const kitPanel=createKitMissionPanel({onApprove:approveKit,onCancel:cancelKit,onReset:prepareKit,onDownload:downloadKit,onEvidence:()=>locationButton.click()});
  const kitCabin=node('p',null,'robotics-kit-cabin');kitCabin.hidden=true;caption.append(kitCabin,kitPanel.element);
  const imageCredit=node('details',null,'robotics-image-credit');
  const earthSource=node('a','NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring');
  earthSource.href='https://images.nasa.gov/details/GSFC_20171208_Archive_e001386';earthSource.target='_blank';earthSource.rel='noopener noreferrer';
  imageCredit.append(node('summary','Earth imagery · credit'),earthSource,node('p','Archival Blue Marble photograph used as scenery. Planet position and scale are illustrative.'));
  caption.append(imageCredit);
  world.host.querySelector('.world-overlay').append(caption);
  const workspace=node('aside',null,'inventory-review-workspace');workspace.hidden=true;workspace.setAttribute('aria-label','Material evidence review workspace');
  const back=node('button','Back to habitat','inventory-review-back');back.type='button';back.onclick=()=>closeWorkspace();
  const panel=createInventoryReviewPanel({db,onRun:run,onCancel:cancel,onReset:reset,onMaterialsChange:ids=>{selected=[...ids];reset('Inventory changed. Run a new review.');},onEvidence:openEvidence,onFocus:locate,onDownload:download});
  workspace.append(back,panel.element);world.host.append(workspace);
  const recordedSlot=node('details',null,'inventory-recorded-review'),recordedSummary=node('summary','Recorded Claude review · 12 tool calls');
  recordedSlot.append(recordedSummary,node('p','Loading the recorded external review…'));
  panel.element.insertBefore(recordedSlot,panel.element.querySelector('.inventory-export'));
  const recordedAbort=new AbortController();
  fetch(new URL('../../data/claude-review.json',import.meta.url),{signal:recordedAbort.signal}).then(response=>{
    if(!response.ok)throw new Error('Recorded review unavailable');return response.json();
  }).then(record=>{
    if(disposed)return;
    recordedPanel=createRecordedReviewPanel({record,db,onEvidence:({id,query})=>{
      if(guardCabin())openCitation(id,document.activeElement,world,{query:{...query,material:null,concern:'all'}});
    }});
    recordedSlot.replaceChildren(recordedSummary,recordedPanel.element);recordedPanel.update(report);
  }).catch(error=>{if(!disposed&&error.name!=='AbortError')recordedSlot.replaceChildren(recordedSummary,node('p','The recorded Claude review could not be loaded. The current evidence calculation remains available.'));});
  const markers=Object.entries(bay.workTargets||{}).map(([material,target])=>{
    const marker=world.marker(null,{at:target.point,label:`${target.label}: locate evidence`,onClick:()=>locate({material,concern:focus.concern})});
    marker.element.dataset.reviewMaterial=material;return marker;
  });
  function openWorkspace(){workspaceOpen=true;workspace.hidden=false;world.host.dataset.roboticsWorkspace='true';world.invalidate?.();}
  function closeWorkspace(){workspaceOpen=false;workspace.hidden=true;world.host.dataset.roboticsWorkspace='false';world.invalidate?.();}
  function clearRun(reason){
    discardKit(reason||'A new evidence review is required.');
    generation++;session?.cancel(reason);session=null;report=null;panel.update(null);notice=reason||'';
    phase='ready';changed=lastTime;lastCabin=cabinKey();refresh();
  }
  function reset(reason='Review cleared. Select materials to start again.'){clearRun(reason);}
  function guardCabin(){if(lastCabin&&lastCabin!==cabinKey()){clearRun('Cabin changed. Previous results cleared; run a new review.');return false;}return true;}
  function refresh(){
    const q=currentQuestion(),target=bay.workTargets?.[focus.material];
    back.textContent=report?.status==='complete'&&kitState?.phase==='ready'
      ? 'View robot task · approval required'
      : report?.status==='complete' ? 'View robot & review kit' : 'Back to habitat';
    recordedPanel?.update(report);
    if(!report){const line=panel.element.querySelector('.inventory-cabin');if(line)line.textContent=`Current cabin · ${world.q.o2??'unknown'}% O2 · ${world.q.p??'unknown'} kPa · ${world.q.g??'unknown gravity'}`;}
    targetLabel.textContent=target?`${target.tag} · ${target.label}`:`${db.materials[focus.material]?.label||focus.material} · no scene component`;
    selectedResult.textContent=q?`${q.concern[0].toUpperCase()+q.concern.slice(1)}: ${meaning[q.status]||q.label}`:'The component tags are a concept inventory. Source applicability has to be checked.';
    if(report?.status==='complete')outcome.textContent=`${report.counts.completed_questions} questions reviewed · ${report.requests.length} review requests ready.`;
    else if(report?.status==='running')outcome.textContent=`${report.counts.completed_questions} / ${report.counts.questions} questions reviewed · ${report.progress.completed} / ${report.progress.total} operations completed.`;
    else if(report?.status==='cancelled')outcome.textContent='Review cancelled. Partial results cannot be exported as a completed review.';
    else if(report?.status==='error')outcome.textContent=`Review stopped: ${report.error}`;
    else outcome.textContent=notice||'Check the selected cabin against material evidence and prepare the next human review.';
    locationButton.hidden=!q;
    world.answer?.(report?.status==='complete'?'Select a component to locate its evidence and unresolved questions. The report is ready now.':report?.status==='running'?'Checking source coverage and condition differences for the selected inventory.':'The useful output: cited findings, condition differences and a review request for every material question.');
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsReview=report?.status||'idle';world.host.dataset.roboticsMaterial=focus.material;
    world.host.dataset.roboticsApproved=String(Boolean(kitState?.approval.granted));world.host.dataset.roboticsScanning='false';
    world.host.dataset.roboticsKitPhase=kitState?.phase||'unplanned';world.host.dataset.roboticsKitObject=kitState?.virtual_object_state||'docked';
    caption.classList.toggle('has-kit-task',Boolean(kitState));
    kitCabin.hidden=!kitState;kitCabin.textContent=kitState?`${kitState.plan.query.o2}% O2 · ${kitState.plan.query.p} kPa · ${kitState.plan.query.g} gravity`:'';
    world.host.dataset.roboticsMotionReady=String(report?.status!=='running');
  }
  async function run(ids=selected){
    if(disposed)return;clearRun('');selected=[...ids];const token=generation;
    try{
      session=createInventoryReviewSession({db,query:{...world.q},materials:selected,onEvent:()=>{
        if(token!==generation||disposed)return;
        report=session.snapshot();panel.update(report);refresh();world.invalidate?.();
      }});
      report=session.snapshot();panel.update(report);openWorkspace();
      // Release the UI after the immutable collection snapshot before calculating
      // its receipt. This is a scheduling boundary, not staged analysis progress.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(token!==generation||disposed)return;
      const result=await session.run();
      if(token!==generation||disposed)return;
      report=result;panel.update(report);
      if(result.status==='complete'){
        const first=result.priority.find(p=>bay.workTargets?.[p.question_id.split('/')[0]]);
        if(first){const [material,concern]=first.question_id.split('/');locate({material,concern},false);}
      }
      refresh();world.invalidate?.();
    }catch(error){notice=`Could not start review: ${error.message}`;refresh();world.invalidate?.();}
  }
  function cancel(){if(!guardCabin())return;session?.cancel();report=session?.snapshot()||null;panel.update(report);refresh();world.invalidate?.();}
  function discardKit(reason){
    kit?.advance({type:'cancel',reason});kit=null;kitState=null;kitSignature=null;kitFrame=null;kitPanel.update(null);
  }
  function prepareKit(){
    if(!guardCabin()||report?.status!=='complete')return;
    discardKit('A different review question was selected.');
    const questionId=`${focus.material}/${focus.concern}`;
    if(!bay.workTargets?.[focus.material])return;
    try{
      const plan=proposeKitMission(report,questionId);kitSignature=plan.input_signature;
      kit=createKitMission(plan);kitState=kit.snapshot();kitPanel.update(kitState);
      phase='ready';changed=lastTime;refresh();world.invalidate?.();
    }catch(error){notice=`Kit unavailable: ${error.message}`;refresh();}
  }
  function approveKit(){
    if(!guardCabin()||!kit||report?.status!=='complete')return;
    try{
      kitSignature=kitInputSignature(report,`${focus.material}/${focus.concern}`);
      kitState=kit.advance({type:'approve',inputSignature:kitSignature});kitFrame=lastTime;
      kitPanel.update(kitState);refresh();world.invalidate?.();
    }catch(error){cancelKit();notice=error.message;refresh();}
  }
  function cancelKit(){
    if(!kit)return;kitState=kit.advance({type:'cancel',reason:'Virtual task cancelled by the reviewer.'});
    kitFrame=null;kitPanel.update(kitState);phase='ready';refresh();world.invalidate?.();
  }
  function downloadKit(){
    if(!guardCabin()||!kit||report?.status!=='complete')return;
    try{
      kitState=kit.advance({type:'input_changed',inputSignature:kitInputSignature(report,`${focus.material}/${focus.concern}`)});
      kitPanel.update(kitState);refresh();
      const result=kit.exportReport();
      const text=`# VESTA crew review handoff\n\n${result.label}\n\nQuestion: ${result.question_id}\n\nEvidence: ${result.evidence_label}\n\n${result.request.reason}\n\n${result.request.next_step}\n\nVirtual kit: staged at the crew-review fixture. No hardware action or physical test was performed. Crew review is still required.\n\nCollection SHA-256: ${result.collection.digest}\n\n${reviewToMarkdown(report)}`;
      download({content:text,mime:'text/markdown;charset=utf-8',filename:'vesta-crew-review-handoff.md',report});
    }catch(error){notice=error.message;refresh();}
  }
  function locate({material,concern},close=true){
    if(!guardCabin())return;focus={material,concern};
    // Selecting evidence prepares a task; only explicit approval starts motion.
    phase='ready';changed=lastTime;prepareKit();
    if(close)closeWorkspace();refresh();world.invalidate?.();
  }
  function nextQuestion(){
    if(!guardCabin()||report?.status!=='complete')return;
    const mapped=report.priority.filter(item=>bay.workTargets?.[item.question_id.split('/')[0]]);
    if(!mapped.length)return;const at=mapped.findIndex(item=>item.question_id===`${focus.material}/${focus.concern}`);
    const [material,concern]=mapped[(at+1)%mapped.length].question_id.split('/');locate({material,concern});
  }
  function openEvidence({material,concern,rowId}){
    if(!guardCabin())return;
    if(rowId){openCitation(rowId,document.activeElement,world,{query:{...world.q,material,concern}});return;}
    closeWorkspace();world.setQ({material,concern},{render:false});
    world.navigate('evidence',{evidenceQuestion:{material,concern}});
  }
  function download({content,mime,filename,report:sourceReport}){
    if(!guardCabin()||report?.status!=='complete'||sourceReport!==report)return;
    const url=URL.createObjectURL(new Blob([content],{type:mime})),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadReport(){if(!guardCabin()||report?.status!=='complete')return;download({content:reviewToMarkdown(report),mime:'text/markdown;charset=utf-8',filename:'vesta-inventory-review.md',report});}
  const onKey=event=>{if(event.key==='Escape'&&active&&workspaceOpen){closeWorkspace();event.stopPropagation();}};
  workspace.addEventListener('keydown',onKey);
  return {
    group,
    camera(){
      const {width}=stage.size(),compact=width<760;
      // Keep the pickup and handoff within one view; evidence remains in its own
      // readable workspace and is never delayed by camera or robot choreography.
      const shift=workspaceOpen&&!compact?1.8:0;
      if(bay.kit)return {position:compact?[0,1.8,9.6]:[.8,1.6,7.4],target:[(compact?0:-.4)+shift,compact?-2.2:-.15,-.25],fov:compact?70:52};
      if(!compact)return {position:[-1.0,1.1,7.8],target:[.7+shift,0,-.4],fov:49};
      return {position:[.8,.8,8.2],target:[1.2,-.15,0],fov:56};
    },
    actions:()=>[
      {id:'inventory-run',label:()=>report?.status==='running'?'Review running…':'Run evidence review',disabled:()=>!selected.length||report?.status==='running',primary:true,run:()=>run()},
      {id:'inventory-workspace',label:()=>report?.status==='complete'?'Review results':'Materials & method',expanded:()=>workspaceOpen,run:()=>workspaceOpen?closeWorkspace():openWorkspace()},
      {id:'inventory-next',label:'Next review question',disabled:()=>report?.status!=='complete',run:nextQuestion},
      {id:'inventory-download',label:'Save review',disabled:()=>report?.status!=='complete',run:downloadReport}
    ],
    enter(){active=true;group.visible=true;caption.hidden=false;world.setBaseLightScale?.(bay.lightingScale??1);savedAperture=stage.camera.userData.aperture;guardCabin();lastCabin=cabinKey();refresh();},
    leave(){active=false;parkedAt=lastTime;group.visible=false;caption.hidden=true;world.setBaseLightScale?.(1);closeWorkspace();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;if(parkedAt!=null){changed+=Math.max(0,t-parkedAt);kitFrame=t;parkedAt=null;}lastTime=t;
      still=Boolean(state.reduced||state.reducedMotion||state.capture||world.capture||matchMedia('(prefers-reduced-motion: reduce)').matches);
      guardCabin();stage.camera.userData.aperture=0;
      const target=bay.workTargets?.[focus.material],q=currentQuestion(),elapsed=Math.max(0,t-changed);
      if(kitState?.approval.granted&&kitState.phase!=='complete'){
        const previous=kitState.phase;
        kitState=kit.advance({type:'tick',dt:Math.min(.1,Math.max(0,t-(kitFrame??t))),still,inputSignature:kitSignature});kitFrame=t;
        if(previous!==kitState.phase){kitPanel.update(kitState);refresh();}
      }
      humanoid.update({phase,elapsed,still,targetPoint:target?.point,workPosition:target?.robotPosition,workYaw:target?.robotYaw,kitMission:kitState,kitLayout:bay.kit});
      bay.update({phase,elapsed,still,kitMission:kitState,kitGrip:humanoid.getKitGrip?.(),review:{material:focus.material,concern:focus.concern,status:q?.status||null,completed:report?.counts.completed_questions??0,total:selected.length*3,rowId:q?.sources.rows[0]?.id||null,running:report?.status==='running'}});
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:-4.2,y:-.8,z:2.6,scale:.5,yaw:.55,lookX:.6,armL:.1,armR:.1,idle:0,thrust:0,beacon:.15});
    },
    holograms:()=>[],
    dispose(){disposed=true;generation++;recordedAbort.abort();recordedPanel?.dispose();session?.cancel('Workspace disposed');kit?.advance({type:'cancel',reason:'Workspace disposed'});kitPanel.dispose();workspace.removeEventListener('keydown',onKey);panel.dispose();workspace.remove();markers.forEach(m=>m.dispose());humanoid.dispose();bay.dispose();caption.remove();group.removeFromParent();for(const key of ['roboticsPhase','roboticsApproved','roboticsScanning','roboticsMotionReady','roboticsDisposition','roboticsReview','roboticsWorkspace','roboticsMaterial','roboticsKitPhase','roboticsKitObject'])delete world.host.dataset[key];}
  };
}
