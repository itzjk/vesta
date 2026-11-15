import { advanceInspection, inspectionReport, INSPECTION_STEPS } from './inspection.js';

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const ease=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
const messages={
  ready:'A digital inspection, from observation to a human-reviewed action.',
  observe:'Observer: a scripted visual cue. Its cause is unknown.',
  evidence:'Evidence agent: checking the selected cabin against the collection.',
  review:'Coordinator: visual inspection proposed. Waiting for your approval.',
  inspect:'Inspection approved. The digital robot records an illustrative view.',
  return:'Returning to the dock with the inspection record.',
  complete:'Demo complete. Keep the evidence and decision record.'
};
const labels={ready:'Begin inspection',observe:'Check cabin evidence',evidence:'Review the proposal',review:'Approve inspection',inspect:'Return to dock',return:'Finish inspection',complete:'Run again'};

export async function build(world) {
  const {THREE:T,stage,db,core}=world, group=new T.Group(); group.name='digital-robotics-lab';
  const materials=new Set(), geometries=new Set();
  const mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.5,metalness:.4,...options});materials.add(m);return m;};
  const dark=mat(0x242b2c), metal=mat(0x657275), ivory=mat(0xd5d2c8), rust=mat(0x9f4932), blue=mat(0x86a4b6,{emissive:0x527d91,emissiveIntensity:.5}), amber=mat(0xc99b5c,{emissive:0x925d24,emissiveIntensity:.4});
  const mesh=(parent,geometry,material,xyz=[0,0,0])=>{geometries.add(geometry);const object=new T.Mesh(geometry,material);object.position.fromArray(xyz);parent.add(object);return object;};
  const box=(parent,size,material,xyz)=>mesh(parent,new T.BoxGeometry(...size),material,xyz);
  const sphere=(parent,radius,material,xyz)=>mesh(parent,new T.SphereGeometry(radius,20,12),material,xyz);
  box(group,[9,.12,5.5],dark,[0,-1.5,-.3]);
  for(let i=-4;i<=4;i++)box(group,[.012,.012,5.2],metal,[i,-1.43,-.3]);
  for(let z=-2.7;z<=2.1;z+=.8)box(group,[8.6,.012,.012],metal,[0,-1.43,z]);
  // Equipment bay, docking pad and an articulated inspection robot drawn in code.
  box(group,[1.8,2.4,.65],dark,[2.65,-.25,-1.8]);
  for(let i=0;i<4;i++){box(group,[1.5,.42,.12],metal,[2.65,-1+i*.52,-1.42]);box(group,[.75,.025,.04],blue,[2.45,-.95+i*.52,-1.33]);}
  const cue=sphere(group,.09,amber,[3.18,.7,-1.3]);
  const pad=mesh(group,new T.CylinderGeometry(.95,1,.12,48),metal,[-2,-1.32,1]);
  const dockRing=mesh(group,new T.TorusGeometry(.7,.025,8,48),blue,[-2,-1.24,1]);dockRing.rotation.x=-Math.PI/2;
  const robot=new T.Group();group.add(robot);
  box(robot,[1.25,.9,1.05],dark);
  box(robot,[1.28,.12,1.08],rust,[0,.49,0]);box(robot,[1.28,.12,1.08],ivory,[0,-.49,0]);
  for(const x of [-.64,.64])box(robot,[.08,.8,.9],ivory,[x,0,0]);
  const fans=[];
  for(const x of [-.42,.42]) {
    mesh(robot,new T.TorusGeometry(.23,.055,8,32),metal,[x,0,.56]);
    const fan=new T.Group();fan.position.set(x,0,.56);robot.add(fan);
    for(let i=0;i<4;i++){const blade=box(fan,[.08,.36,.025],dark);blade.rotation.z=i*Math.PI/2;}
    sphere(fan,.06,metal);fans.push(fan);
  }
  const gimbal=new T.Group();gimbal.position.set(0,.08,.61);robot.add(gimbal);
  sphere(gimbal,.2,dark);sphere(gimbal,.1,blue,[0,0,.17]);
  const arm=new T.Group();arm.position.set(.64,-.2,0);robot.add(arm);
  sphere(arm,.1,metal);box(arm,[.6,.09,.09],ivory,[.3,0,0]);sphere(arm,.08,metal,[.62,0,0]);
  const wrist=new T.Group();wrist.position.x=.62;arm.add(wrist);box(wrist,[.38,.07,.07],rust,[.19,0,0]);
  for(const y of [-.08,.08])box(wrist,[.18,.035,.06],metal,[.46,y,0]);
  const lens=mat(0x88a5b3,{transparent:true,opacity:.08,depthWrite:false,side:T.DoubleSide});
  const scan=mesh(group,new T.ConeGeometry(.65,2.4,28,1,true),lens);scan.rotation.z=-Math.PI/2;scan.visible=false;
  group.add(new T.HemisphereLight(0xd7e0e0,0x32241c,1.1));
  const key=new T.PointLight(0xf3dcc0,22,15,2);key.position.set(-2,4,5);group.add(key);
  const rim=new T.PointLight(0x7d9bb0,10,12,2);rim.position.set(4,2,-2);group.add(rim);
  const panel=node('section',null,'robotics-console');panel.setAttribute('aria-label','Robotics agent log');
  const heading=node('h2','Inspection agents'), description=node('p','Concept simulation. Observation and motion are scripted; cabin coverage is calculated from VESTA’s evidence collection.','robotics-scope');
  const log=node('ol',null,'robotics-log');
  panel.append(heading,description,log);
  const learn=node('a','NASA Astrobee: the real robotics reference ↗');learn.href='https://www.nasa.gov/directorates/stmd/astrobee/';learn.target='_blank';learn.rel='noopener';panel.append(learn);
  const holo=world.hologram(panel,{at:[-3,0,1],width:440,dock:'left',manual:true,marker:false,phoneRatio:.56});
  let active=false,phase='ready',lastTime=0,changed=0,savedAperture,lastQ='';
  const position=new T.Vector3(-2,0,1),from=position.clone(),target=position.clone();
  const coverage=()=>core.status.tally(core.status.cells(world.q,db));
  function refresh(){
    const counts=coverage(),report=inspectionReport(world.q,counts,phase),index=INSPECTION_STEPS.indexOf(phase);
    log.replaceChildren();
    for(const [name,text,step] of [
      ['Observer','Scripted visual cue; no diagnosis.',1],
      ['Evidence agent',`${counts.PROVEN} questions with nearby evidence; ${counts.EXTRAPOLATED} under other or incomplete conditions; ${counts.NEVER_TESTED} with no source found in this collection.`,2],
      ['Coordinator','Proposes a visual inspection; does not command suppression.',3],
      ['Human review',report.human_approved?'Inspection approved in this demo.':'Approval required before the inspection step.',4]
    ]){const item=node('li');item.dataset.state=index>=step?'complete':'pending';item.append(node('strong',name),node('span',text));log.append(item);}
    world.answer?.(`Concept simulation. ${messages[phase]}`);
    world.host.dataset.roboticsPhase=phase;world.host.dataset.roboticsApproved=String(report.human_approved);
    lastQ=JSON.stringify(world.q);
  }
  function change(event='next'){
    phase=advanceInspection(phase,event);changed=lastTime;from.copy(position);
    target.set(...(['ready','return','complete'].includes(phase)?[-2,0,1]:phase==='inspect'?[1,.15,-.4]:[-.35,.45,.6]));
    refresh();world.invalidate?.();
  }
  function save(){const report=inspectionReport(world.q,coverage(),phase),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='vesta-digital-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {
    group,
    camera(){const compact=stage.size().width<760;return {position:compact?[5,6.6,16]:[5,3,13],target:compact?[0,2.8,0]:[0,-.2,0],fov:compact?48:40};},
    actions:()=>[
      {id:'inspection',label:()=>labels[phase],primary:true,run:()=>change(phase==='review'?'approve':phase==='complete'?'reset':'next')},
      {id:'agents',label:'Agent log',expanded:()=>holo.target>0,run:()=>{refresh();holo.toggle();}},
      {id:'reset',label:'Reset',run:()=>change('reset')},
      {id:'report',label:'Save report',disabled:()=>phase!=='complete',run:save}
    ],
    enter(){active=true;group.visible=true;savedAperture=stage.camera.userData.aperture;refresh();},
    leave(){active=false;group.visible=false;holo.close();if(savedAperture==null)delete stage.camera.userData.aperture;else stage.camera.userData.aperture=savedAperture;},
    update(t,state={}){
      if(!active)return;lastTime=t;const still=state.reduced||state.capture;
      if(lastQ!==JSON.stringify(world.q))refresh();
      stage.camera.userData.aperture=0;
      position.lerpVectors(from,target,still?1:ease((t-changed)/1.8));robot.position.copy(position);
      robot.position.y+=still?0:Math.sin(t*1.2)*.035;
      robot.rotation.y=phase==='inspect'?.6:phase==='return'?-.35:.1;
      fans.forEach((fan,i)=>fan.rotation.z=still?i*.5:t*(i?8:-8));
      gimbal.rotation.y=phase==='inspect'?(still?.2:Math.sin(t)*.25):0;
      arm.rotation.z=phase==='inspect'?.6:-1;wrist.rotation.z=phase==='inspect'?-.6:-.8;
      scan.visible=phase==='inspect';scan.position.set(1.85,.1,-1);scan.rotation.y=still?0:Math.sin(t)*.12;
      cue.material.emissiveIntensity=phase==='observe'&&!still?.5+Math.sin(t*3)*.25:.25;
      dockRing.material.emissiveIntensity=phase==='return'?.9:.4;
      const compact=stage.size().width<760;
      world.vesta?.update?.(still?2:t,{...world.vesta.defaults,x:compact?3.5:4.1,y:-.3,z:2,scale:compact?.8:1.1,yaw:-.45,lookX:-.8,armL:phase==='review'?.7:.2,armR:.15,idle:still?0:.3,thrust:.35,beacon:phase==='review'?.7:.2,beaconWarm:1});
    },
    holograms:()=>[],
    dispose(){holo.dispose();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());delete world.host.dataset.roboticsPhase;delete world.host.dataset.roboticsApproved;}
  };
}
