import { createHumanoidInspector } from '../scene/humanoid-inspector.js?v=trust-explore-20261115-1';
import { createMaintenanceBay } from '../scene/maintenance-bay.js?v=question-lab-20261115-3';
import { ensureInformationPolishStyles } from './information-polish.js?v=habitat-20261115-1';
import { createInventoryReviewSession, reviewToMarkdown } from '../core/inventory-review.js?v=pressure-basis-20261115-1';
import { createInventoryReviewPanel } from './inventory-review-panel.js?v=lab-actions-20261115-1';
import { openCitation } from './cite.js?v=habitat-20261115-1';
import { proposeKitMission, createKitMission, kitInputSignature } from './kit-mission.js?v=crew-workspace-20261115-1';
import { createKitMissionPanel } from './kit-mission-panel.js?v=lab-actions-20261115-1';
import { createRecordedReviewPanel } from './recorded-claude-review.js';
import { createHabitatCamera, createHabitatGesture, habitatKeyInput } from './habitat-camera.js?v=trust-explore-20261115-1';
import { requestedReviewSelection, chooseReviewFocus } from './review-selection.js?v=question-lab-20261115-3';
import { spaceLabRecord } from './space-lab-record.js?v=lab-actions-20261115-1';
import { createSpaceLabPanel } from './space-lab-panel.js?v=lab-actions-20261115-1';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-robotics]')) {
  for (const file of ['robotics']) {
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL(`../../css/${file}.css?v=lab-actions-20261115-1`,import.meta.url).href;sheet.dataset.vestaRobotics='';document.head.append(sheet);
  }
}
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const meaning={PROVEN:'Nearby evidence',EXTRAPOLATED:'Other or incomplete conditions',NEVER_TESTED:'No source in this collection',NOT_INDEXED:'Material not indexed'};

// Pure framing calculation. View choice never reads or advances a task, and the
// work camera is fixed across its phases rather than following the robot.
export function roboticsCameraFrame({width=1280,height=720,view='overview',workspaceOpen=false,hints={},region=null}={}){
  const compact=width<760,shift=workspaceOpen&&!compact?1.8:0;
  if(view!=='work')return {position:compact?[0,1.8,9.6]:[-.9,1.05,6.2],target:[(compact?0:-.5)+shift,compact?-2.2:.1,-.25],fov:compact?70:50};
  const task=hints.task||{position:[.6,.85,4.6],target:[.5,.15,0],fov:47};
  const bounds=hints.taskBounds||{min:[-1.9,-1.43,-.6],max:[2.3,1.4,.6]};
  // Work view concentrates on the upper body, hands and both work surfaces.
  // Overview remains available for the full humanoid and environmental context.
  const point=region?.point||[.9,0,.25];
  // On a phone, a deliberate pickup/handoff inspection focuses on the hands and
  // work surface. Fitting the whole room would put the camera outside its wall.
  const low=compact?[point[0]-.82,-.28,point[2]-.42]:[bounds.min[0],Math.max(bounds.min[1],-.42),bounds.min[2]];
  const high=compact?[point[0]+.82,.62,point[2]+.42]:bounds.max;
  const center=low.map((n,i)=>(n+high[i])/2),aspect=Math.max(.20,width/Math.max(1,height));
  const fov=compact?62:task.fov,tangent=Math.tan(fov*Math.PI/360);
  const direction=task.position.map((n,i)=>n-task.target[i]),length=Math.hypot(...direction);
  const back=direction.map(n=>n/length),right=[back[2],0,-back[0]],rightLength=Math.hypot(...right);
  right.forEach((n,i)=>right[i]=n/rightLength);
  const up=[back[1]*right[2]-back[2]*right[1],back[2]*right[0]-back[0]*right[2],back[0]*right[1]-back[1]*right[0]];
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  let halfWidth=0,halfHeight=0,depth=0;
  for(const x of [low[0],high[0]])for(const y of [low[1],high[1]])for(const z of [low[2],high[2]]){
    const delta=[x-center[0],y-center[1],z-center[2]];
    halfWidth=Math.max(halfWidth,Math.abs(dot(delta,right)));halfHeight=Math.max(halfHeight,Math.abs(dot(delta,up)));depth=Math.max(depth,Math.abs(dot(delta,back)));
  }
  const left=compact?14:Math.min(380,width*.30),rightInset=compact?48:76;
  const top=compact?82:98,bottom=compact?Math.min(326,height*.55):122;
  const usableX=Math.max(.30,(width-left-rightInset)/width),usableY=Math.max(.25,(height-top-bottom)/height);
  const distance=Math.max(3.1,halfWidth/(tangent*aspect*usableX),halfHeight/(tangent*usableY))*1.06+depth;
  const offsetX=(left-rightInset)/width*distance*tangent*aspect,offsetY=(bottom-top)/height*distance*tangent;
  const target=center.map((n,i)=>n-right[i]*offsetX-up[i]*offsetY);
  const position=target.map((n,i)=>n+back[i]*distance);target[0]+=shift;
  return {position,target,fov};
}

export async function build(world) {
  ensureInformationPolishStyles();world.host.classList.add('information-polish');
  const {THREE:T,stage,db}=world,group=new T.Group();group.name='lunar-inventory-review';
  const bay=createMaintenanceBay({THREE:T,groundY:-1.43});group.add(bay.group);
  bay.earthReady?.then(()=>world.invalidate?.());
  const humanoid=createHumanoidInspector({THREE:T,groundY:-1.43});group.add(humanoid.group);
  group.userData.resourceBudget={bay:bay.stats,humanoid:humanoid.stats};
  let active=false,disposed=false,lastTime=0,changed=0,savedAperture,parkedAt=null;
  let phase='ready',still=false,selected=['pmma','kapton','silicone'],session=null,report=null,generation=0,lastCabin='';
  let focus={material:'pmma',concern:'prevention'},workspaceOpen=false,notice='',cameraView='overview',workRegion=null,cameraCache=null;
  let focusExplicit=false,pendingReviewQuestion=null;
  let preparing=false,showTask=false,viewError='';
  const initialQuestion=requestedReviewSelection({material:world.q.material,concern:world.q.concern},db.materials,selected);
  if(initialQuestion){focus=initialQuestion.focus;selected=initialQuestion.materials;focusExplicit=true;}
  let kit=null,kitState=null,kitSignature=null,kitFrame=null;
  let recordedPanel=null;
  const explore=createHabitatCamera(),canvas=stage.renderer.domElement,inputCleanups=[],gesture=createHabitatGesture();
  const canvasAttributes={tabindex:canvas.getAttribute('tabindex'),label:canvas.getAttribute('aria-label')};
  let panMode=false,objectSelection=null;
  const cabinKey=()=>JSON.stringify([world.q.preset,world.q.habitat,world.q.o2,world.q.p,world.q.g,world.q.gclass]);
  const currentQuestion=()=>report?.questions.find(q=>q.material_id===focus.material&&q.concern===focus.concern);
  const caption=node('section',null,'robotics-caption robotics-work-caption');caption.dataset.stationUi='robotics';caption.hidden=true;
  const labError=node('p',null,'robotics-lab-error');labError.hidden=true;labError.setAttribute('role','alert');
  const targetLabel=node('p','Material inventory → evidence → review requests','robotics-mission-evidence');
  const outcome=node('p','Check which materials have applicable NASA source evidence for this cabin, then prepare a human review request.','robotics-work-outcome');
  const selectedResult=node('p',null,'robotics-work-result');
  const locationButton=node('button','Open this question','robotics-question-button');locationButton.type='button';locationButton.dataset.action='review-question';
  locationButton.onclick=()=>{openWorkspace();panel.element.querySelector(`[data-question-id="${focus.material}/${focus.concern}"]`)?.scrollIntoView({block:'nearest'});};
  caption.append(labError,node('p','SPACE LAB · ROBOTICS CONCEPT','robotics-eyebrow'),node('h1','Bring evidence to the lab bench.'),node('p','Question → source evidence → optional crew handoff','robotics-lab-path'),targetLabel,outcome,selectedResult,locationButton,node('p','Evidence analysis + virtual kit staging','robotics-caption-scope'));
  const labProgress=node('section',null,'robotics-lab-progress');labProgress.hidden=true;
  const progressQuestion=node('h3'),progressText=node('p'),progressCancel=node('button','Cancel review');progressCancel.type='button';progressCancel.onclick=cancel;
  progressText.setAttribute('role','status');progressText.setAttribute('aria-live','polite');labProgress.append(progressQuestion,progressText,progressCancel);caption.append(labProgress);
  const labPanel=createSpaceLabPanel({onSource:openEvidence,onPrepare:showHandoff});caption.append(labPanel.element);
  const answerButton=node('button','Back to lab answer','robotics-question-button');answerButton.type='button';answerButton.hidden=true;
  answerButton.onclick=()=>{showTask=false;refresh();caption.scrollTop=0;labPanel.focus();};caption.append(answerButton);
  const kitPanel=createKitMissionPanel({onApprove:approveKit,onCancel:cancelKit,onReset:prepareKit,onDownload:downloadKit,onEvidence:openKitEvidence});
  const kitCabin=node('p',null,'robotics-kit-cabin');kitCabin.hidden=true;caption.append(kitCabin,kitPanel.element);
  const imageCredit=node('details',null,'robotics-image-credit');
  const earthSource=node('a','NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring');
  earthSource.href='https://images.nasa.gov/details/GSFC_20171208_Archive_e001386';earthSource.target='_blank';earthSource.rel='noopener noreferrer';
  imageCredit.append(node('summary','Earth imagery · credit'),earthSource,node('p','Archival Blue Marble photograph used as scenery. Planet position and scale are illustrative.'));
  caption.append(imageCredit);
  world.host.querySelector('.world-overlay').append(caption);
  const workspace=node('aside',null,'inventory-review-workspace');workspace.hidden=true;workspace.setAttribute('aria-label','Material evidence review workspace');
  const back=node('button','Back to habitat','inventory-review-back');back.type='button';back.onclick=()=>{
    if(report?.status==='complete'&&cameraView==='explore')setExplore(false);
    if(report?.status==='complete')showTask=false;
    closeWorkspace();refresh();caption.scrollTop=0;
  };
  const panel=createInventoryReviewPanel({db,onRun:ids=>run(ids,{stayInLab:false}),onCancel:cancel,onReset:reset,onMaterialsChange:ids=>{selected=[...ids];if(!selected.includes(focus.material))focusExplicit=false;reset('Inventory changed. Run a new review.');},onEvidence:openEvidence,onFocus:locate,onDownload:download});
  if(initialQuestion)panel.setMaterials(selected);
  const questionNotice=node('p',null,'inventory-intro');questionNotice.hidden=true;questionNotice.setAttribute('role','status');
  const workspaceError=node('p',null,'robotics-lab-error');workspaceError.hidden=true;workspaceError.setAttribute('role','alert');
  workspace.append(back,workspaceError,questionNotice,panel.element);world.host.append(workspace);
  const explorer=node('section',null,'robotics-explorer');explorer.hidden=true;explorer.setAttribute('aria-label','Explore habitat camera');
  const cameraButtons=node('div',null,'robotics-camera-buttons');
  function cameraButton(label,action,title){const b=node('button',label);b.type='button';b.onclick=action;if(title)b.title=title;cameraButtons.append(b);return b;}
  const orbitButton=cameraButton('Orbit',()=>{panMode=false;syncExplorer();},'Drag to turn the camera');
  const panButton=cameraButton('Pan',()=>{panMode=true;syncExplorer();},'Drag to move the camera aim');
  cameraButton('−',()=>moveCamera({zoom:.18}),'Zoom out');cameraButton('+',()=>moveCamera({zoom:-.18}),'Zoom in');
  cameraButton('Reset',()=>{explore.reset(stage.size().width<760);world.invalidate?.();},'Reset Explore camera');
  cameraButton('Done',()=>setExplore(false),'Return to Overview and task controls');
  const cameraHint=node('p','Drag to orbit · Pan or two fingers to move · wheel / pinch to zoom.');
  const objectPicker=node('select');objectPicker.setAttribute('aria-label','Choose a habitat object');
  for(const [value,label] of [['','Choose an object…'],['pmma','PMMA review kit'],['kapton','Kapton review kit'],['silicone','Silicone review kit'],['crew','Crew review station']]){const option=node('option',label);option.value=value;objectPicker.append(option);}
  objectPicker.onchange=()=>{if(objectPicker.value)openObject(objectPicker.value);};
  const keyboardHint=node('p','Keyboard: arrows orbit · Shift + arrows pan · + / − zoom · 0 reset · Esc exits.','robotics-key-hint');
  explorer.append(cameraButtons,cameraHint,objectPicker,keyboardHint);world.host.append(explorer);
  const objectCard=node('section',null,'robotics-object-card');objectCard.hidden=true;objectCard.setAttribute('aria-label','Selected habitat object');
  const objectTitle=node('h2'),objectText=node('p'),objectActions=node('div',null,'robotics-object-actions');
  objectTitle.tabIndex=-1;
  const objectEvidence=node('button'),objectTask=node('button'),objectClose=node('button','Close');
  for(const b of [objectEvidence,objectTask,objectClose]){b.type='button';objectActions.append(b);}
  objectClose.onclick=()=>{objectSelection=null;objectPicker.value='';syncObject();};
  objectCard.onkeydown=event=>{if(event.key==='Escape'){objectClose.click();event.preventDefault();event.stopPropagation();}};
  objectEvidence.onclick=()=>{
    if(!guardCabin()||!objectSelection)return;
    if(objectSelection==='crew'){openWorkspace();return;}
    const id=`${objectSelection}/prevention`,q=report?.questions.find(item=>item.id===id||item.question_id===id||`${item.material_id}/${item.concern}`===id);
    if(q){openWorkspace();panel.focusQuestion(id,{expandSources:true});}
    else {focus={material:objectSelection,concern:'prevention'};focusExplicit=true;run([objectSelection]);}
  };
  objectTask.onclick=()=>{
    if(!guardCabin()||!objectSelection||objectSelection==='crew'||report?.status!=='complete'||kitRunning())return;
    const material=objectSelection;objectSelection=null;setExplore(false);locate({material,concern:'prevention'});showHandoff();
  };
  objectCard.append(objectTitle,objectText,objectActions);world.host.append(objectCard);
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
    recordedSlot.replaceChildren(recordedSummary,recordedPanel.element);if(workspaceOpen)recordedPanel.update(report);
  }).catch(error=>{if(!disposed&&error.name!=='AbortError')recordedSlot.replaceChildren(recordedSummary,node('p','The recorded Claude review could not be loaded. The current evidence calculation remains available.'));});
  const markers=Object.entries(bay.workTargets||{}).map(([material,target])=>{
    const marker=world.marker(null,{at:target.point,label:`${target.label}: review actions`,onClick:()=>openObject(material)});
    marker.element.dataset.reviewMaterial=material;return marker;
  });
  function presentationError(error){
    viewError=`The review view could not be updated: ${error?.message||String(error)}. Try opening the full review again or run a new review.`;
    for(const target of [labError,workspaceError]){target.textContent=viewError;target.hidden=false;}
  }
  function updateInventory(){
    if(!workspaceOpen)return;
    try{
      panel.update(report);recordedPanel?.update(report);
      if(viewError.startsWith('The review view could not be updated:')){
        viewError='';for(const target of [labError,workspaceError]){target.textContent='';target.hidden=true;}
      }
    }catch(error){presentationError(error);}
  }
  function openWorkspace(){workspaceOpen=true;workspace.hidden=false;world.host.dataset.roboticsWorkspace='true';updateInventory();releasePointers();syncExplorer();syncObject();world.invalidate?.();}
  function closeWorkspace(){workspaceOpen=false;workspace.hidden=true;world.host.dataset.roboticsWorkspace='false';syncExplorer();syncObject();world.invalidate?.();}
  function kitRunning(){return ['approved','approach','retrieve','carry','place','handoff'].includes(kitState?.phase);}
  function reviewBusy(){return preparing||report?.status==='running';}
  function openObject(id){if(!active||!guardCabin()||!['crew',...Object.keys(bay.kit.slots)].includes(id))return;objectSelection=id;objectPicker.value=id;syncObject();objectTitle.focus({preventScroll:true});world.invalidate?.();}
  function syncObject(){
    objectCard.hidden=!active||workspaceOpen||!objectSelection;if(objectCard.hidden)return;
    const crew=objectSelection==='crew',label=db.materials[objectSelection]?.label||objectSelection;
    const q=report?.questions.find(item=>item.material_id===objectSelection&&item.concern==='prevention');
    objectTitle.textContent=crew?'Crew review station':`${label} review kit`;
    objectText.textContent=crew?(report?.status==='complete'?`${report.counts.completed_questions} material questions reviewed. Open the source records and human review requests. A staged kit adds no experimental evidence.`:'Check selected materials against NASA source conditions for this cabin. The result is cited evidence and questions for human review, not a safety clearance.')
      :q?`${q.label||meaning[q.status]}. Open the exact source comparison, or prepare this question’s virtual handoff for separate approval.`
        :`Check ${label} against this cabin’s oxygen, pressure and gravity. This starts a new material review and replaces any current task; it does not move the robot.`;
    objectEvidence.textContent=crew?'Open review workspace':q?'Open source comparison':`Review ${label} only`;
    objectEvidence.disabled=reviewBusy()||(!q&&!crew&&kitRunning());
    objectTask.textContent='Prepare crew handoff';objectTask.hidden=crew||!q;objectTask.disabled=kitRunning()||report?.status!=='complete';
  }
  function syncExplorer(){
    const enabled=active&&cameraView==='explore'&&!workspaceOpen;
    explorer.hidden=!enabled;world.host.dataset.roboticsExploring=String(enabled);
    orbitButton.setAttribute('aria-pressed',String(!panMode));panButton.setAttribute('aria-pressed',String(panMode));
    if(enabled){canvas.tabIndex=0;canvas.setAttribute('aria-label','Explore the 3D habitat. Arrow keys orbit; Shift arrows pan; plus and minus zoom; zero resets; Escape returns to Overview.');}
    else for(const [name,value] of [['tabindex',canvasAttributes.tabindex],['aria-label',canvasAttributes.label]]){if(value==null)canvas.removeAttribute(name);else canvas.setAttribute(name,value);}
  }
  function setExplore(value){
    const returnFocus=!value&&(document.activeElement===canvas||explorer.contains(document.activeElement));
    releasePointers();cameraView=value?'explore':'overview';workRegion=null;objectSelection=null;objectPicker.value='';
    if(value)explore.reset(stage.size().width<760);syncExplorer();syncObject();refresh();world.invalidate?.();
    if(value)canvas.focus({preventScroll:true});
    else if(returnFocus)world.host.querySelector('[data-station-action="inventory-explore"]')?.focus({preventScroll:true});
  }
  function moveCamera(delta){explore.move(delta);world.invalidate?.();}
  function releasePointers(){for(const id of gesture.clear())if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}
  function sceneInputEnabled(){return active&&!disposed&&cameraView==='explore'&&!workspaceOpen&&!world.filmActive&&world.host.dataset.flying!=='true'&&!document.querySelector('dialog[open],[role="dialog"]:not([hidden])');}
  function ownsSceneInput(event){return (active&&!disposed&&!workspaceOpen&&objectCard.contains(event.target))||(sceneInputEnabled()&&(event.target===canvas||explorer.contains(event.target)||gesture.owns(event.pointerId)));}
  function listenInput(type,fn,options){canvas.addEventListener(type,fn,options);inputCleanups.push(()=>canvas.removeEventListener(type,fn,options));}
  listenInput('pointerdown',event=>{if(!sceneInputEnabled())return;gesture.begin(event.pointerId,event.clientX,event.clientY);canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});event.preventDefault();},{capture:true});
  listenInput('pointermove',event=>{
    if(!sceneInputEnabled())return;
    const delta=gesture.move(event.pointerId,event.clientX,event.clientY,panMode||event.shiftKey||event.buttons===2);if(!delta)return;
    moveCamera(delta);event.preventDefault();event.stopPropagation();
  },{capture:true});
  listenInput('pointerup',event=>{const result=gesture.end(event.pointerId);if(!result.owned)return;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(result.dragged){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  listenInput('pointercancel',()=>releasePointers(),{capture:true});
  listenInput('lostpointercapture',event=>gesture.end(event.pointerId),{capture:true});
  listenInput('wheel',event=>{if(!sceneInputEnabled())return;moveCamera({zoom:Math.max(-.22,Math.min(.22,event.deltaY*.0015))});event.preventDefault();event.stopPropagation();},{passive:false});
  listenInput('contextmenu',event=>{if(sceneInputEnabled())event.preventDefault();});
  function cameraKeydown(event){
    if(!sceneInputEnabled()||event.target.closest?.('select,input,textarea,[contenteditable]'))return;
    const delta=habitatKeyInput(event);
    if(delta)moveCamera(delta);
    else if(event.key==='0'||event.key==='Home'){explore.reset(stage.size().width<760);world.invalidate?.();}
    else if(event.key==='Escape')setExplore(false);
    else return;
    event.preventDefault();event.stopPropagation();
  }
  listenInput('keydown',cameraKeydown);
  explorer.addEventListener('keydown',cameraKeydown);inputCleanups.push(()=>explorer.removeEventListener('keydown',cameraKeydown));
  const raycaster=new T.Raycaster(),pickPoint=new T.Vector3(),pickNdc=new T.Vector2();
  function pick(x,y){
    if(!active||workspaceOpen||world.host.dataset.flying==='true'||gesture.count||Math.abs(x)>1||Math.abs(y)>1)return null;
    raycaster.setFromCamera(pickNdc.set(x,y),stage.camera);group.updateWorldMatrix(true,true);
    const hit=raycaster.intersectObject(group,true).find(item=>{for(let object=item.object;object&&object!==group;object=object.parent)if(!object.visible)return false;return item.object.material?.opacity!==0;});if(!hit)return null;
    for(let item=hit.object;item&&item!==group;item=item.parent)if(item.userData.material_id&&bay.kit.slots[item.userData.material_id])return {kind:'habitat-object',material:item.userData.material_id};
    pickPoint.copy(hit.point);bay.group.worldToLocal(pickPoint);
    if(pickPoint.x> -1.6&&pickPoint.x<.45&&pickPoint.y> -1.43&&pickPoint.y<.65&&pickPoint.z>-.3&&pickPoint.z<.65)return {kind:'habitat-object',material:'crew'};
    for(const [material,target] of Object.entries(bay.workTargets))if(pickPoint.distanceTo(new T.Vector3(...target.point))<.65)return {kind:'habitat-object',material};
    return null;
  }
  function openKitEvidence(request){
    if(disposed||!guardCabin()||!kitState?.plan_valid)return;
    const questionId=request?.questionId||kitState.plan.question_id;
    if(questionId!==kitState.plan.question_id)return;
    openWorkspace();panel.focusQuestion(questionId,{expandSources:true});
  }
  function toggleCameraView(){
    releasePointers();
    cameraView=cameraView==='work'?'overview':'work';
    if(cameraView==='work'){
      const staged=kitState?.phase==='complete'&&kitState?.virtual_object_state==='staged';
      const spot=staged?bay.kit.fixture:bay.kit.slots[focus.material];
      workRegion={point:[...(spot?.point||spot?.position||[.9,0,.25])],material:focus.material,kind:staged?'handoff':'pickup'};
    }
    syncExplorer();world.host.dataset.roboticsView=cameraView;world.host.dataset.roboticsViewTarget=cameraView==='work'&&workRegion?`${workRegion.material}/${workRegion.kind}`:'';world.invalidate?.();
  }
  function clearRun(reason){
    discardKit(reason||'A new evidence review is required.');
    generation++;preparing=false;viewError='';session?.cancel(reason);session=null;report=null;updateInventory();notice=reason||'';
    phase='ready';changed=lastTime;lastCabin=cabinKey();refresh();
  }
  function reset(reason='Review cleared. Select materials to start again.'){clearRun(reason);}
  function guardCabin(){if(lastCabin&&lastCabin!==cabinKey()){clearRun('Cabin changed. Previous results cleared; run a new review.');return false;}return true;}
  function refresh(){
    const q=currentQuestion(),target=bay.workTargets?.[focus.material];
    const labResult=report?.status==='complete'?spaceLabRecord(db,q,report.input.query):null;
    labPanel.update(labResult,{handoffAvailable:Boolean(target),handoffReady:Boolean(kitState?.plan_valid)});
    labPanel.element.hidden=!labResult||showTask;
    caption.classList.toggle('has-lab-result',Boolean(labResult)&&!showTask);
    caption.classList.toggle('has-lab-progress',reviewBusy());
    caption.classList.toggle('has-lab-error',Boolean(viewError||report?.status==='error'));
    labProgress.hidden=!reviewBusy();progressQuestion.textContent=`${db.materials[focus.material]?.label||focus.material} · ${focus.concern}`;
    progressText.textContent=preparing?'Preparing the source collection…':`Checking source evidence · ${report?.counts.completed_questions??0} / ${report?.counts.questions??selected.length*3} inventory questions reviewed.`;
    const visibleError=viewError||(report?.status==='error'?`Review failed: ${report.error}. Run the review again to retry.`:'');
    for(const target of [labError,workspaceError]){target.textContent=visibleError;target.hidden=!visibleError;}
    answerButton.hidden=!showTask;
    questionNotice.hidden=!focusExplicit;
    if(focusExplicit)questionNotice.textContent=`Selected question: ${db.materials[focus.material]?.label||focus.material} · ${focus.concern}. ${report?.status==='complete'?'Report scope':'Next review'}: ${selected.length} ${selected.length===1?'material':'materials'} × 3 concerns. This question stays in focus.${target?'':' No virtual kit is modelled for this material; evidence review and export remain available.'}`;
    back.textContent=report?.status==='complete'?'View lab answer':'Back to habitat';
    if(!report){const line=panel.element.querySelector('.inventory-cabin');if(line)line.textContent=`Current cabin · ${world.q.o2??'unknown'}% O2 · ${world.q.p??'unknown'} kPa · ${world.q.g??'unknown gravity'}`;}
    targetLabel.textContent=target?`${target.tag} · ${target.label}`:`${db.materials[focus.material]?.label||focus.material} · no scene component`;
    selectedResult.textContent=q?`${q.concern[0].toUpperCase()+q.concern.slice(1)}: ${q.label||meaning[q.status]}`:`Selected question: ${db.materials[focus.material]?.label||focus.material} · ${focus.concern}`;
    if(report?.status==='complete')outcome.textContent=`${report.counts.completed_questions} questions reviewed · ${report.requests.length} review requests ready.`;
    else if(report?.status==='running')outcome.textContent=`${report.counts.completed_questions} / ${report.counts.questions} questions reviewed · ${report.progress.completed} / ${report.progress.total} operations completed.`;
    else if(report?.status==='cancelled')outcome.textContent='Review cancelled. Partial results cannot be exported as a completed review.';
    else if(report?.status==='error')outcome.textContent=`Review stopped: ${report.error}`;
    else outcome.textContent=notice||'Check which materials have applicable NASA source evidence for this cabin, then prepare questions for human review.';
    locationButton.hidden=!q;
    world.answer?.(report?.status==='complete'?'Select a component to locate its evidence and unresolved questions. The report is ready now.':report?.status==='running'?'Checking source coverage and condition differences for the selected inventory.':'The useful output: cited findings, condition differences and a review request for every material question.');
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsReview=report?.status||'idle';world.host.dataset.roboticsMaterial=focus.material;
    world.host.dataset.roboticsApproved=String(Boolean(kitState?.approval.granted));world.host.dataset.roboticsScanning='false';
    world.host.dataset.roboticsKitPhase=kitState?.phase||'unplanned';world.host.dataset.roboticsKitObject=kitState?.virtual_object_state||'docked';
    caption.classList.toggle('has-kit-task',showTask&&Boolean(kitState));
    kitPanel.element.hidden=!showTask||!kitState;
    kitCabin.hidden=!showTask||!kitState;kitCabin.textContent=kitState?`${kitState.plan.query.o2}% O2 · ${kitState.plan.query.p} kPa · ${kitState.plan.query.g} gravity`:'';
    world.host.dataset.roboticsMotionReady=String(!reviewBusy());
    world.host.dataset.roboticsView=cameraView;
    world.host.dataset.roboticsViewTarget=cameraView==='work'&&workRegion?`${workRegion.material}/${workRegion.kind}`:'';
    syncObject();syncExplorer();
  }
  async function run(ids=selected,{stayInLab=true}={}){
    if(disposed||reviewBusy())return;
    clearRun('');selected=[...ids];panel.setMaterials(selected);
    // The primary lab action answers the question on screen. A broader inventory
    // report may still include other questions; its review queue never steals focus.
    if(stayInLab){
      if(!selected.includes(focus.material)&&selected.length)focus={material:selected[0],concern:focus.concern};
      focusExplicit=true;showTask=false;if(cameraView==='explore')setExplore(false);closeWorkspace();caption.scrollTop=0;
    }else openWorkspace();
    const token=generation,query={...world.q},requestedCabin=cabinKey();preparing=true;refresh();world.invalidate?.();
    try{
      // Paint the selected question and cancellation control before the bounded,
      // synchronous collection snapshot. No artificial progress or minimum delay.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(token!==generation||disposed)return;
      if(requestedCabin!==cabinKey()){clearRun('Cabin changed. Run a new review.');return;}
      session=createInventoryReviewSession({db,query,materials:selected,onEvent:()=>{
        if(token!==generation||disposed)return;
        // Core observers deliberately cannot throw into the scientific workflow.
        // Catch here so a view failure remains visible instead of being swallowed.
        try{report=session.snapshot();updateInventory();refresh();world.invalidate?.();}
        catch(error){presentationError(error);world.invalidate?.();}
      }});
      report=session.snapshot();updateInventory();
      const job=session.run();preparing=false;refresh();
      const result=await job;
      if(token!==generation||disposed)return;
      report=result;updateInventory();
      if(result.status==='complete'){
        const nextFocus=chooseReviewFocus(result,focus,focusExplicit);
        if(nextFocus)locate(nextFocus,false,nextFocus.explicit);
        // Detailed source inspection is an explicit action. The initial result
        // is the lab answer, not an expanded wall of comparison records.
        if(stayInLab&&active){closeWorkspace();caption.scrollTop=0;labPanel.focus();}
      }
      refresh();world.invalidate?.();
    }catch(error){
      if(token!==generation||disposed)return;
      preparing=false;session?.cancel('Presentation or startup failure');report=session?.snapshot()||null;
      viewError=`Could not complete review: ${error.message}. Run the review again to retry.`;
      updateInventory();try{refresh();}catch(renderError){presentationError(renderError);}world.invalidate?.();
    }
  }
  function cancel(){if(!guardCabin())return;if(preparing){clearRun('Review cancelled. Run again when ready.');world.invalidate?.();return;}session?.cancel();report=session?.snapshot()||null;updateInventory();refresh();world.invalidate?.();}
  function discardKit(reason){
    kit?.advance({type:'cancel',reason});kit=null;kitState=null;kitSignature=null;kitFrame=null;showTask=false;kitPanel.update(null);
  }
  function showHandoff(){
    if(!guardCabin()||report?.status!=='complete'||!bay.workTargets?.[focus.material])return;
    if(cameraView==='explore')setExplore(false);closeWorkspace();
    if(!kitState?.plan_valid)prepareKit();else {showTask=true;refresh();}
    caption.scrollTop=0;
  }
  function prepareKit(){
    if(!guardCabin()||report?.status!=='complete')return;
    viewError='';
    discardKit('A different review question was selected.');
    const questionId=`${focus.material}/${focus.concern}`;
    if(!bay.workTargets?.[focus.material])return;
    try{
      const plan=proposeKitMission(report,questionId);kitSignature=plan.input_signature;
      kit=createKitMission(plan);kitState=kit.snapshot();kitPanel.update(kitState);
      showTask=true;phase='ready';changed=lastTime;refresh();world.invalidate?.();
    }catch(error){viewError=`Crew handoff unavailable: ${error.message}`;refresh();}
  }
  function approveKit(){
    if(!guardCabin()||!kit||report?.status!=='complete')return;
    try{
      kitSignature=kitInputSignature(report,`${focus.material}/${focus.concern}`);
      kitState=kit.advance({type:'approve',inputSignature:kitSignature});kitFrame=lastTime;
      kitPanel.update(kitState);refresh();world.invalidate?.();
    }catch(error){cancelKit();viewError=error.message;refresh();}
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
    }catch(error){viewError=error.message;refresh();}
  }
  function locate({material,concern},close=true,explicit=true){
    if(!guardCabin())return;
    if(workRegion&&workRegion.material!==material){cameraView='overview';workRegion=null;}
    focus={material,concern};focusExplicit=explicit;
    // Selecting an answer does not prepare or approve a task. Handoff preparation
    // is a separate deliberate step after its evidence and limits are visible.
    discardKit('A different review question was selected.');phase='ready';changed=lastTime;
    if(close)closeWorkspace();refresh();world.invalidate?.();
  }
  function applyRequestedQuestion(request){
    const next=requestedReviewSelection(request,db.materials,selected);if(!next)return false;guardCabin();
    const changedQuestion=focus.material!==next.focus.material||focus.concern!==next.focus.concern;
    if(next.inventoryChanged)clearRun('The selected question adds a material. Run a new review for this inventory.');
    else if(changedQuestion)discardKit('A different review question was selected; any earlier task approval is cleared.');
    focus=next.focus;focusExplicit=true;selected=next.materials;panel.setMaterials(selected);
    if(workRegion&&workRegion.material!==focus.material){cameraView='overview';workRegion=null;}
    showTask=false;if(cameraView==='explore')setExplore(false);closeWorkspace();refresh();caption.scrollTop=0;
    world.invalidate?.();return true;
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
    requestQuestion(request){
      if(disposed||!requestedReviewSelection(request,db.materials,selected))return false;
      pendingReviewQuestion={material:request.material,concern:request.concern};world.invalidate?.();return true;
    },
    pick,select(hit){if(hit?.kind!=='habitat-object')return false;openObject(hit.material);return true;},ownsSceneInput,
    camera(){
      const {width,height}=stage.size();
      if(cameraView==='explore'&&!workspaceOpen){
        if(cameraCache?.view!=='explore'||cameraCache.width!==width||cameraCache.height!==height||cameraCache.revision!==explore.revision)cameraCache={view:'explore',width,height,revision:explore.revision,frame:explore.frame(width<760)};
        return cameraCache.frame;
      }
      // Framing changes only on an explicit view choice, resize or workspace toggle.
      if(!cameraCache||cameraCache.width!==width||cameraCache.height!==height||cameraCache.view!==cameraView||cameraCache.workspaceOpen!==workspaceOpen||cameraCache.region!==workRegion){
        cameraCache={width,height,view:cameraView,workspaceOpen,region:workRegion,frame:roboticsCameraFrame({width,height,view:cameraView,workspaceOpen,hints:bay.cameraHints,region:workRegion})};
      }
      return cameraCache.frame;
    },
    actions:()=>[
      {id:'inventory-run',label:()=>reviewBusy()?'Reviewing lab evidence…':'Run lab review',disabled:()=>!selected.length||reviewBusy(),primary:true,run:()=>run()},
      {id:'inventory-workspace',label:()=>report?.status==='complete'?'Full inventory review':'Materials & method',expanded:()=>workspaceOpen,run:()=>workspaceOpen?closeWorkspace():openWorkspace()},
      {id:'inventory-view',label:()=>cameraView==='work'?'Overview':stage.size().width<760&&bay.workTargets?.[focus.material]?`Inspect ${db.materials[focus.material]?.label||focus.material} ${kitState?.phase==='complete'?'handoff':'pickup'}`:'Work view',run:toggleCameraView},
      {id:'inventory-explore',label:()=>cameraView==='explore'?'Exit Explore':'Explore base',run:()=>setExplore(cameraView!=='explore')},
      {id:'inventory-next',label:'Next review question',disabled:()=>report?.status!=='complete',run:nextQuestion},
      {id:'inventory-download',label:'Save full inventory',disabled:()=>report?.status!=='complete',run:downloadReport}
    ],
    enter(){active=true;group.visible=true;caption.hidden=false;world.setBaseLightScale?.(bay.lightingScale??1);savedAperture=stage.camera.userData.aperture;guardCabin();lastCabin=cabinKey();refresh();},
    leave(){active=false;pendingReviewQuestion=null;parkedAt=lastTime;group.visible=false;caption.hidden=true;releasePointers();syncExplorer();syncObject();world.setBaseLightScale?.(1);closeWorkspace();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;if(parkedAt!=null){changed+=Math.max(0,t-parkedAt);kitFrame=t;parkedAt=null;}lastTime=t;
      if(pendingReviewQuestion&&world.host.dataset.flying!=='true'&&world.host.dataset.worldLoading!=='true'){
        const request=pendingReviewQuestion;pendingReviewQuestion=null;applyRequestedQuestion(request);
      }
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
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:-2.65,y:-1,z:1.25,scale:.4,yaw:.55,lookX:.6,armL:.1,armR:.1,idle:0,thrust:0,beacon:.15});
    },
    holograms:()=>[],
    dispose(){disposed=true;active=false;generation++;releasePointers();syncExplorer();inputCleanups.forEach(remove=>remove());explorer.remove();objectCard.remove();recordedAbort.abort();recordedPanel?.dispose();session?.cancel('Workspace disposed');kit?.advance({type:'cancel',reason:'Workspace disposed'});kitPanel.dispose();labPanel.dispose();workspace.removeEventListener('keydown',onKey);panel.dispose();workspace.remove();markers.forEach(m=>m.dispose());humanoid.dispose();bay.dispose();caption.remove();group.removeFromParent();for(const key of ['roboticsPhase','roboticsApproved','roboticsScanning','roboticsMotionReady','roboticsDisposition','roboticsReview','roboticsWorkspace','roboticsMaterial','roboticsKitPhase','roboticsKitObject','roboticsView','roboticsViewTarget','roboticsExploring'])delete world.host.dataset[key];}
  };
}
