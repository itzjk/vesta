import { createHumanoidInspector, HUMANOID_TIMING } from '../scene/humanoid-inspector.js?v=expert-20261115-1';
import { createMaintenanceBay } from '../scene/maintenance-bay.js?v=expert-20261115-1';
import { ensureInformationPolishStyles } from './information-polish.js?v=expert-20261115-1';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-robotics]')) {
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('../../css/robotics.css?v=expert-20261115-1',import.meta.url).href;sheet.dataset.vestaRobotics='';document.head.append(sheet);
}

import { advanceInspection, advanceInspectionClock, settleInspectionPose, buildInspectionMission, inspectionReport, INSPECTION_STEPS } from './inspection.js?v=expert-20261115-1';

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const messages={
  ready:'Mission: link the PMMA work-zone panel to evidence before crew review.',
  observe:'Observer · locating the tagged PMMA panel in the crew work zone.',
  evidence:'Evidence agent · checking PMMA fire-prevention coverage for the selected cabin.',
  review:'Approve an illustrative panel inspection. Crew work remains unapproved.',
  inspect:'Approved mission · approach, inspect with the handheld tool, then return.',
  return:'Returning to dock · attaching evidence and unresolved gaps to the record.',
  complete:'Visual pass logged. Crew review is still required; no sensor condition was measured.'
};
const labels={ready:'Review mission',observe:'Locating panel…',evidence:'Checking evidence…',review:'Approve mission',inspect:'Mission running…',return:'Returning…',complete:'New mission'};
const meaning={PROVEN:'Nearby source conditions',EXTRAPOLATED:'Other or incomplete conditions',NEVER_TESTED:'No source for this question'};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);

export async function build(world) {
  ensureInformationPolishStyles();
  world.host.classList.add('information-polish');
  const {THREE:T,stage,db}=world, group=new T.Group(); group.name='lunar-crew-support';
  const bay=createMaintenanceBay({THREE:T,groundY:-1.43}); group.add(bay.group);
  const humanoid=createHumanoidInspector({THREE:T,groundY:-1.43});group.add(humanoid.group);
  const sensor=humanoid.group.getObjectByName('inspection-sensor-origin');
  group.userData.resourceBudget={bay:bay.stats,humanoid:humanoid.stats};
  const panel=node('section',null,'robotics-console');panel.setAttribute('aria-label','Crew-support mission brief');
  const heading=node('h2','Crew-support mission');
  const log=node('ol',null,'robotics-log');
  const scope=node('p','Trace HAB-PMMA-01 before crew review.','robotics-scope');
  const evidence=node('section',null,'robotics-evidence');
  const limits=node('details',null,'robotics-limits');
  limits.append(node('summary','Mission limits'),node('p','The fixed lunar habitat is a concept setting. The evidence query follows your selected cabin; PMMA and fire prevention define this mission. NASA source coverage does not validate the robot or this concept panel.'),node('p','Walking, tool handling and the visual pass are scripted; there are no live sensor measurements, physics, hardware control or crew-work clearance. Reduced motion uses representative poses.'));
  panel.append(heading,scope,evidence,log,limits);
  const references=node('nav',null,'robotics-references');references.setAttribute('aria-label','Robotics research context');
  for(const [text,href] of [['NASA Robonaut: humanoid robotics research ↗','https://www.nasa.gov/robonaut2/what-is-a-robonaut/'],['NASA Astrobee: a different, free-flying approach ↗','https://www.nasa.gov/ames/astrobee/']]){const link=node('a',text);link.href=href;link.target='_blank';link.rel='noopener';references.append(link);}panel.append(references);
  const caption=node('section',null,'robotics-caption');caption.dataset.stationUi='robotics';
  const evidenceStatus=node('p',null,'robotics-mission-evidence'),handoff=node('p','Crew review required','robotics-handoff');handoff.hidden=true;
  caption.append(node('p','LUNAR HABITAT CONCEPT · CREW SUPPORT','robotics-eyebrow'),node('h1','Trace the work zone.'),node('p','PMMA panel → source evidence → approved inspection → crew review','robotics-bridge'),evidenceStatus,handoff,node('p','Scripted mission · no connected hardware','robotics-caption-scope'));caption.hidden=true;world.host.querySelector('.world-overlay').append(caption);
  const holo=world.hologram(panel,{at:[-3,0,1],width:440,dock:'left',manual:true,marker:false,phoneRatio:.72,phoneBottom:64});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,phase='ready',lastTime=0,changed=0,savedAperture,lastCabin='',parkedAt=null,cabinReset=false;
  let still=Boolean(world.capture||reduced.matches),counts=null,mission=null;
  const cabinKey=()=>JSON.stringify([world.q.preset,world.q.o2,world.q.p,world.q.g,world.q.gclass]);
  const canAdvance=()=>['ready','review','complete'].includes(phase);
  const report=()=>inspectionReport(world.q,counts,phase,mission,{reducedMotion:still});
  function refresh(){
    // Source actions can run between frames: do not rebind old approval to a new cabin.
    if(lastCabin&&lastCabin!==cabinKey()){phase='ready';changed=lastTime;cabinReset=true;}
    mission=buildInspectionMission(world.q,db);counts=mission.counts;
    const record=report(),index=INSPECTION_STEPS.indexOf(phase);
    const statusText=meaning[mission.question.status]||'Coverage unavailable';
    const cabinName=db.presetById[world.q.preset]?.label||'Custom cabin';
    evidenceStatus.textContent=`Evidence cabin: ${cabinName}\nPMMA · ${statusText.toLowerCase()}`;
    handoff.hidden=phase!=='complete';
    evidence.replaceChildren(node('h3',`Evidence cabin: ${cabinName}`),node('p',statusText,'robotics-evidence-status'),node('p',`${mission.question.nearby_row_ids.length} nearby source rows for PMMA / prevention in the selected cabin.`));
    if(mission.nearest_source)evidence.append(world.cite(`Inspect nearest source row · ${mission.nearest_source.id}`,mission.nearest_source.id));
    evidence.append(node('p','A source link is not a matching lunar test or permission for crew work.','robotics-evidence-limit'));
    log.replaceChildren();
    for(const [name,text,step] of [
      ['Observer','Locates HAB-PMMA-01. The panel condition is unknown.',1],
      ['Evidence agent',`PMMA / prevention: ${statusText.toLowerCase()}. The collection has ${counts.PROVEN} questions with nearby evidence in this cabin.`,2],
      ['Coordinator','Proposes a visual traceability pass, then a crew-review handoff.',3],
      ['Human review',record.human_approved?'Illustrative inspection approved. Crew work remains unapproved.':'Your approval is required before the robot approaches.',4]
    ]){const item=node('li');item.dataset.state=index>=step?'complete':'pending';item.append(node('strong',name),node('span',text));log.append(item);}
    world.answer?.(phase==='ready'&&cabinReset?'Cabin changed · the prior mission approval is cleared. Review the new evidence.':phase==='evidence'?`PMMA / prevention: ${statusText.toLowerCase()}. Human review comes next.`:messages[phase]);
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsApproved=String(record.human_approved);
    world.host.dataset.roboticsDisposition=mission.disposition;
    lastCabin=cabinKey();
  }
  function change(event='next'){
    if(event!=='reset'&&lastCabin!==cabinKey()){refresh();world.invalidate?.();return;}
    if(event!=='reset'&&!canAdvance())return;
    phase=advanceInspection(phase,event);changed=lastTime;cabinReset=false;
    holo.close();
    refresh();world.invalidate?.();
  }
  function save(){if(lastCabin!==cabinKey()){refresh();world.invalidate?.();return;}if(phase!=='complete')return;const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='vesta-crew-support-mission.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {
    group,
    camera(){
      const {width,height}=stage.size(),compact=width<760,open=holo.target>0;
      const elapsed=Math.max(0,lastTime-changed);
      const progress=phase==='inspect'?(still?1:smooth(elapsed/HUMANOID_TIMING.approach)):phase==='return'?(still?0:1-smooth((elapsed-HUMANOID_TIMING.retract)/HUMANOID_TIMING.approach)):0;
      if(!compact)return {position:mix([-2.8,1.7,8.3],[5.3,1.3,6.2],progress),target:mix([.1,-.05,.1],[1.9,-.05,-.45],progress),fov:39.5};
      const distance=Math.max(10.5,3.8/(2*Math.tan(19*Math.PI/180)*(width/height))),y=open?-.75:.1;
      const inspectY=open?-.85:-.25;
      return {position:mix([-5.2,y+2.3,distance],[4.6,inspectY+1.7,8.3],progress),target:mix([.15,y,-.4],[1.9,inspectY,-.4],progress),fov:38};
    },
    actions:()=>[
      {id:'inspection',label:()=>labels[phase],disabled:()=>!canAdvance(),primary:true,run:()=>change(phase==='review'?'approve':phase==='complete'?'reset':'next')},
      {id:'cabin-evidence',label:'Inspect PMMA evidence',run:()=>{world.setQ({material:'pmma',concern:'prevention'},{render:false});world.navigate('evidence',{evidenceQuestion:{material:'pmma',concern:'prevention'}});}},
      {id:'agents',label:'Mission brief',expanded:()=>holo.target>0,run:()=>{refresh();if(!holo.target)panel.style.removeProperty('display');holo.toggle();}},
      {id:'reset',label:'Reset',run:()=>change('reset')},
      {id:'report',label:'Save mission record',disabled:()=>phase!=='complete',run:save}
    ],
    enter(){active=true;group.visible=true;caption.hidden=false;savedAperture=stage.camera.userData.aperture;if(lastCabin&&lastCabin!==cabinKey()){phase='ready';changed=lastTime;cabinReset=true;}refresh();},
    leave(){active=false;parkedAt=lastTime;group.visible=false;caption.hidden=true;holo.close();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;
      if(parkedAt!=null){changed+=Math.max(0,t-parkedAt);parkedAt=null;}
      lastTime=t;still=Boolean(state.reduced||state.reducedMotion||state.capture||world.capture||reduced.matches);
      if(lastCabin!==cabinKey()){phase='ready';changed=t;cabinReset=true;refresh();}
      if(still){const next=settleInspectionPose(phase);if(next!==phase){phase=next;changed=t;refresh();}}
      stage.camera.userData.aperture=0;
      const elapsed=Math.max(0,t-changed),approved=['inspect','return','complete'].includes(phase);
      humanoid.update({phase,elapsed,still});
      bay.update({phase,elapsed,still,counts,mission,approved,sensor,scanAt:HUMANOID_TIMING.reach});
      world.host.dataset.roboticsScanning=String(bay.group.userData.scanning);
      world.host.dataset.roboticsMotionReady=String(canAdvance());
      const compact=stage.size().width<760;
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:-3.65,y:-.65,z:1.85,scale:compact?.6:.78,yaw:.55,lookX:.85,armL:phase==='review'?.7:.2,armR:phase==='observe'?.65:.15,idle:still?0:.25,thrust:.3,beacon:phase==='review'?.7:.2,beaconWarm:1});
      const next=advanceInspectionClock(phase,elapsed);
      if(next!==phase){phase=next;changed=t;refresh();world.invalidate?.();}
    },
    holograms:()=>[],
    dispose(){humanoid.dispose();bay.dispose();caption.remove();holo.dispose();group.removeFromParent();for(const key of ['roboticsPhase','roboticsApproved','roboticsScanning','roboticsMotionReady','roboticsDisposition'])delete world.host.dataset[key];}
  };
}
