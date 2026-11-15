import { createHumanoidInspector } from '../scene/humanoid-inspector.js';
import { ensureInformationPolishStyles } from './information-polish.js?v=sebas-20261115-2';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-robotics]')) {
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('../../css/robotics.css?v=sebas-20261115-2',import.meta.url).href;sheet.dataset.vestaRobotics='';document.head.append(sheet);
}

import { advanceInspection, inspectionReport, INSPECTION_STEPS } from './inspection.js';

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const messages={
  ready:'Observe first. Inspect only with your approval.',
  observe:'Observer: a scripted visual cue. Its cause is unknown.',
  evidence:'Evidence agent: checking the selected cabin against the collection.',
  review:'Coordinator: visual inspection proposed. Waiting for your approval.',
  inspect:'Inspection approved. Scripted camera motion; no live camera feed.',
  return:'Returning to the dock. No hardware is connected.',
  complete:'Demo complete. Keep the evidence and decision record.'
};
const labels={ready:'Begin inspection',observe:'Check cabin evidence',evidence:'Review the proposal',review:'Approve inspection',inspect:'Return to dock',return:'Finish inspection',complete:'Run again'};

export async function build(world) {
  ensureInformationPolishStyles();
  world.host.classList.add('information-polish');
  const {THREE:T,stage,db,core}=world, group=new T.Group(); group.name='digital-robotics-lab';
  const materials=new Set(), geometries=new Set();
  const mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.5,metalness:.4,...options});materials.add(m);return m;};
  const dark=mat(0x46565b), metal=mat(0x657275), blue=mat(0x86a4b6,{emissive:0x527d91,emissiveIntensity:.5}), amber=mat(0xc99b5c,{emissive:0x925d24,emissiveIntensity:.4});
  const mesh=(parent,geometry,material,xyz=[0,0,0])=>{geometries.add(geometry);const object=new T.Mesh(geometry,material);object.position.fromArray(xyz);parent.add(object);return object;};
  const box=(parent,size,material,xyz)=>mesh(parent,new T.BoxGeometry(...size),material,xyz);
  const sphere=(parent,radius,material,xyz)=>mesh(parent,new T.SphereGeometry(radius,20,12),material,xyz);
  box(group,[9,.12,5.5],metal,[0,-1.5,-.3]);
  box(group,[9,3.8,.1],dark,[0,.46,-3.1]);
  box(group,[1.8,2.4,.65],dark,[2.65,-.25,-1.8]);
  for(let i=0;i<4;i++){box(group,[1.5,.42,.12],metal,[2.65,-1+i*.52,-1.42]);box(group,[.75,.025,.04],blue,[2.45,-.95+i*.52,-1.33]);}
  const cue=sphere(group,.09,amber,[3.18,.7,-1.3]);
  const pad=mesh(group,new T.CylinderGeometry(.95,1,.12,48),metal,[-2,-1.51,1]);
  const dockRing=mesh(group,new T.TorusGeometry(.7,.025,8,48),blue,[-2,-1.437,1]);dockRing.rotation.x=-Math.PI/2;dockRing.scale.z=.12;
  const humanoid=createHumanoidInspector({THREE:T,groundY:-1.43});group.add(humanoid.group);
  group.add(new T.HemisphereLight(0xd7e0e0,0x32241c,1.1));
  const key=new T.PointLight(0xf3dcc0,22,15,2);key.position.set(-2,4,5);group.add(key);
  const rim=new T.PointLight(0x7d9bb0,10,12,2);rim.position.set(4,2,-2);group.add(rim);
  const panel=node('section',null,'robotics-console');panel.setAttribute('aria-label','Robotics agent log');
  const heading=node('h2','Inspection agents');
  const log=node('ol',null,'robotics-log');
  const scope=node('p','Concept demo · scripted inspection · human approval required.','robotics-scope');
  const limits=node('details',null,'robotics-limits');
  limits.append(node('summary','What this demo does'),node('p','Cabin evidence is calculated from VESTA’s collection. The inspection is a scripted software concept, with no live camera or connected robot.'),node('p','Locomotion, freefall anchoring and hardware control are not implemented.'));
  panel.append(heading,scope,log,limits);
  const references=node('nav',null,'robotics-references');references.setAttribute('aria-label','Robotics research context');
  for(const [text,href] of [['NASA Robonaut: humanoid robotics research ↗','https://www.nasa.gov/robonaut2/what-is-a-robonaut/'],['NASA Astrobee: a different, free-flying approach ↗','https://www.nasa.gov/ames/astrobee/']]){const link=node('a',text);link.href=href;link.target='_blank';link.rel='noopener';references.append(link);}panel.append(references);
  const caption=node('section',null,'robotics-caption');caption.dataset.stationUi='robotics';caption.append(node('h1','Humanoid inspection'),node('p','Concept demo · scripted inspection · human approval required.'));caption.hidden=true;world.host.querySelector('.world-overlay').append(caption);
  const holo=world.hologram(panel,{at:[-3,0,1],width:440,dock:'left',manual:true,marker:false,phoneRatio:.28});
  let active=false,phase='ready',lastTime=0,changed=0,savedAperture,lastQ='';
  const coverage=()=>core.status.tally(core.status.cells(world.q,db));
  function refresh(){
    const counts=coverage(),report=inspectionReport(world.q,counts,phase),index=INSPECTION_STEPS.indexOf(phase);
    log.replaceChildren();
    for(const [name,text,step] of [
      ['Observer','Scripted visual cue; no diagnosis.',1],
      ['Evidence agent',`VESTA collection: ${counts.PROVEN} questions with nearby evidence · ${counts.EXTRAPOLATED} with other or incomplete support · ${counts.NEVER_TESTED} with no source.`,2],
      ['Coordinator','Proposes inspection, never suppression.',3],
      ['Human review',report.human_approved?'Inspection approved in this demo.':'Approval required before the inspection step.',4]
    ]){const item=node('li');item.dataset.state=index>=step?'complete':'pending';item.append(node('strong',name),node('span',text));log.append(item);}
    world.answer?.(messages[phase]);
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsApproved=String(report.human_approved);
    lastQ=JSON.stringify(world.q);
  }
  function change(event='next'){
    phase=advanceInspection(phase,event);changed=lastTime;
    refresh();world.invalidate?.();
  }
  function save(){const report=inspectionReport(world.q,coverage(),phase),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='vesta-digital-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {
    group,
    camera(){
      const {width,height}=stage.size(),compact=width<760,open=holo.target>0;
      if(!compact)return {position:open?[3.2,3.3,12.5]:[4.6,2.8,11],target:open?[-1.4,-.1,0]:[0,-.1,0],fov:40};
      const scale=Math.max(1,height/width/(595/425))*(open?1.15:1),y=-.9-(open?Math.max(1.4,(760-height)*.016):0);
      return {position:[4.6*scale,y+4.15*scale,13*scale],target:[0,y,0],fov:48};
    },
    actions:()=>[
      {id:'inspection',label:()=>labels[phase],primary:true,run:()=>change(phase==='review'?'approve':phase==='complete'?'reset':'next')},
      {id:'agents',label:'Agent log',expanded:()=>holo.target>0,run:()=>{refresh();if(!holo.target)panel.style.removeProperty('display');holo.toggle();}},
      {id:'reset',label:'Reset',run:()=>change('reset')},
      {id:'report',label:'Save report',disabled:()=>phase!=='complete',run:save}
    ],
    enter(){active=true;group.visible=true;caption.hidden=false;savedAperture=stage.camera.userData.aperture;refresh();},
    leave(){active=false;group.visible=false;caption.hidden=true;holo.close();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;lastTime=t;const still=state.reduced||state.capture;
      if(lastQ!==JSON.stringify(world.q))refresh();
      stage.camera.userData.aperture=0;
      humanoid.update({phase,elapsed:Math.max(0,t-changed),still});
      cue.material.emissiveIntensity=phase==='observe'&&!still?.5+Math.sin(t*3)*.25:.25;
      dockRing.material.emissiveIntensity=phase==='return'?.9:.4;
      const compact=stage.size().width<760;
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:compact?3.5:4.1,y:-.3,z:2,scale:compact?.8:1.1,yaw:-.45,lookX:-.8,armL:phase==='review'?.7:.2,armR:.15,idle:still?0:.3,thrust:.35,beacon:phase==='review'?.7:.2,beaconWarm:1});
    },
    holograms:()=>[],
    dispose(){humanoid.dispose();caption.remove();holo.dispose();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());delete world.host.dataset.roboticsPhase;delete world.host.dataset.roboticsApproved;}
  };
}
