import { createHumanoidInspector, HUMANOID_TIMING } from '../scene/humanoid-inspector.js?v=sebas-20261115-3';
import { createMaintenanceBay } from '../scene/maintenance-bay.js?v=sebas-20261115-3';
import { ensureInformationPolishStyles } from './information-polish.js?v=sebas-20261115-3';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-robotics]')) {
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('../../css/robotics.css?v=sebas-20261115-3',import.meta.url).href;sheet.dataset.vestaRobotics='';document.head.append(sheet);
}

import { advanceInspection, inspectionReport, INSPECTION_STEPS } from './inspection.js?v=sebas-20261115-3';

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const messages={
  ready:'Concept · consult cabin evidence before approving an inspection.',
  observe:'Observer · cue highlighted; cause unknown.',
  evidence:'Evidence · checking the selected cabin in VESTA’s collection.',
  review:'Coordinator · visual inspection proposed. Your approval is required.',
  inspect:'Inspector · scripted visual scan; no sensor data.',
  return:'Returning · retracting the arm and docking.',
  complete:'Complete · save the evidence and decision record.'
};
const labels={ready:'Begin inspection',observe:'Check cabin evidence',evidence:'Review the proposal',review:'Approve inspection',inspect:'Return to dock',return:'Finish inspection',complete:'Run again'};
const dwell={observe:1.1,evidence:1.2,inspect:HUMANOID_TIMING.inspection,return:HUMANOID_TIMING.return};
const busyLabels={observe:'Observing…',evidence:'Showing evidence…',inspect:'Inspecting…',return:'Returning…'};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);

export async function build(world) {
  ensureInformationPolishStyles();
  world.host.classList.add('information-polish');
  const {THREE:T,stage,db,core}=world, group=new T.Group(); group.name='digital-robotics-lab';
  const bay=createMaintenanceBay({THREE:T,groundY:-1.43}); group.add(bay.group);
  const humanoid=createHumanoidInspector({THREE:T,groundY:-1.43});group.add(humanoid.group);
  const sensor=humanoid.group.getObjectByName('inspection-sensor-origin');
  group.userData.resourceBudget={bay:bay.stats,humanoid:humanoid.stats};
  const panel=node('section',null,'robotics-console');panel.setAttribute('aria-label','Robotics agent log');
  const heading=node('h2','Inspection agents');
  const log=node('ol',null,'robotics-log');
  const scope=node('p','Concept demo · scripted inspection · human approval required.','robotics-scope');
  const limits=node('details',null,'robotics-limits');
  limits.append(node('summary','What this demo does'),node('p','Cabin evidence comes from VESTA’s collection. It does not validate robot motion. Walking, reaching and scanning are scripted animation; there is no live camera or connected robot.'),node('p','Physical locomotion, freefall anchoring and hardware control are not implemented. The visual cue has no diagnosed cause.'));
  panel.append(heading,scope,log,limits);
  const references=node('nav',null,'robotics-references');references.setAttribute('aria-label','Robotics research context');
  for(const [text,href] of [['NASA Robonaut: humanoid robotics research ↗','https://www.nasa.gov/robonaut2/what-is-a-robonaut/'],['NASA Astrobee: a different, free-flying approach ↗','https://www.nasa.gov/ames/astrobee/']]){const link=node('a',text);link.href=href;link.target='_blank';link.rel='noopener';references.append(link);}panel.append(references);
  const caption=node('section',null,'robotics-caption');caption.dataset.stationUi='robotics';caption.append(node('h1','Humanoid inspection'),node('p','Observe → consult cabin evidence → human review → inspect','robotics-bridge'),node('p','Scripted concept · human approval required.','robotics-caption-scope'));caption.hidden=true;world.host.querySelector('.world-overlay').append(caption);
  const holo=world.hologram(panel,{at:[-3,0,1],width:440,dock:'left',manual:true,marker:false,phoneRatio:.28});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,phase='ready',lastTime=0,changed=0,savedAperture,lastCabin='',parkedAt=null,cabinReset=false;
  let still=Boolean(world.capture||reduced.matches),counts=null;
  const cabinKey=()=>JSON.stringify([world.q.preset,world.q.o2,world.q.p,world.q.g,world.q.gclass]);
  const canAdvance=()=>still||Math.max(0,lastTime-changed)>=(dwell[phase]||0);
  const coverage=()=>core.status.tally(core.status.cells(world.q,db));
  function refresh(){
    counts=coverage();const report=inspectionReport(world.q,counts,phase),index=INSPECTION_STEPS.indexOf(phase);
    log.replaceChildren();
    for(const [name,text,step] of [
      ['Observer','Highlights the service-panel cue; cause unknown.',1],
      ['Evidence agent',`VESTA collection: ${counts.PROVEN} questions with nearby evidence · ${counts.EXTRAPOLATED} with other or incomplete support · ${counts.NEVER_TESTED} with no source.`,2],
      ['Coordinator','Proposes a visual inspection, never suppression.',3],
      ['Human review',report.human_approved?'Inspection approved in this demo.':'Approval required before the inspection step.',4]
    ]){const item=node('li');item.dataset.state=index>=step?'complete':'pending';item.append(node('strong',name),node('span',text));log.append(item);}
    const total=Object.values(counts).reduce((sum,value)=>sum+value,0);
    world.answer?.(phase==='ready'&&cabinReset?'Cabin changed · start a new review; prior approval cleared.':phase==='evidence'?`Evidence · ${counts.PROVEN} / ${total} questions nearby in VESTA’s collection.`:messages[phase]);
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsApproved=String(report.human_approved);
    lastCabin=cabinKey();
  }
  function change(event='next'){
    if(event!=='reset'&&!canAdvance())return;
    phase=advanceInspection(phase,event);changed=lastTime;cabinReset=false;
    holo.close();
    refresh();world.invalidate?.();
  }
  function save(){const report=inspectionReport(world.q,coverage(),phase),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='vesta-digital-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {
    group,
    camera(){
      const {width,height}=stage.size(),compact=width<760,open=holo.target>0;
      const elapsed=Math.max(0,lastTime-changed);
      const progress=phase==='inspect'?(still?1:smooth(elapsed/HUMANOID_TIMING.approach)):phase==='return'?(still?0:1-smooth((elapsed-HUMANOID_TIMING.retract)/HUMANOID_TIMING.approach)):0;
      if(!compact)return {position:mix([-4.6,1.5,7.4],[5.3,1.3,6.2],progress),target:mix([-1.35,-.05,.1],[1.9,-.05,-.45],progress),fov:38};
      const distance=Math.max(10.5,3.8/(2*Math.tan(19*Math.PI/180)*(width/height))),y=open?-.75:.1;
      const inspectY=open?-.85:-.25;
      return {position:mix([-5.2,y+2.3,distance],[4.6,inspectY+1.7,8.3],progress),target:mix([.15,y,-.4],[1.9,inspectY,-.4],progress),fov:38};
    },
    actions:()=>[
      {id:'inspection',label:()=>canAdvance()?labels[phase]:busyLabels[phase],disabled:()=>!canAdvance(),primary:true,run:()=>change(phase==='review'?'approve':phase==='complete'?'reset':'next')},
      {id:'cabin-evidence',label:'View cabin evidence',run:()=>world.navigate('evidence')},
      {id:'agents',label:'Agent log',expanded:()=>holo.target>0,run:()=>{refresh();if(!holo.target)panel.style.removeProperty('display');holo.toggle();}},
      {id:'reset',label:'Reset',run:()=>change('reset')},
      {id:'report',label:'Save report',disabled:()=>phase!=='complete',run:save}
    ],
    enter(){active=true;group.visible=true;caption.hidden=false;savedAperture=stage.camera.userData.aperture;if(lastCabin&&lastCabin!==cabinKey()){phase='ready';changed=lastTime;cabinReset=true;}refresh();},
    leave(){active=false;parkedAt=lastTime;group.visible=false;caption.hidden=true;holo.close();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;
      if(parkedAt!=null){changed+=Math.max(0,t-parkedAt);parkedAt=null;}
      lastTime=t;still=Boolean(state.reduced||state.reducedMotion||state.capture||world.capture||reduced.matches);
      if(lastCabin!==cabinKey()){phase='ready';changed=t;cabinReset=true;refresh();}
      stage.camera.userData.aperture=0;
      const elapsed=Math.max(0,t-changed),approved=['inspect','return','complete'].includes(phase);
      humanoid.update({phase,elapsed,still});
      bay.update({phase,elapsed,still,counts,approved,sensor,scanAt:HUMANOID_TIMING.reach});
      world.host.dataset.roboticsScanning=String(bay.group.userData.scanning);
      world.host.dataset.roboticsMotionReady=String(canAdvance());
      const compact=stage.size().width<760;
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:-3.65,y:-.65,z:1.85,scale:compact?.6:.78,yaw:.55,lookX:.85,armL:phase==='review'?.7:.2,armR:phase==='observe'?.65:.15,idle:still?0:.25,thrust:.3,beacon:phase==='review'?.7:.2,beaconWarm:1});
    },
    holograms:()=>[],
    dispose(){humanoid.dispose();bay.dispose();caption.remove();holo.dispose();group.removeFromParent();for(const key of ['roboticsPhase','roboticsApproved','roboticsScanning','roboticsMotionReady'])delete world.host.dataset[key];}
  };
}
