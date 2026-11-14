import { TOL } from '../core/match.js';
export const still = 'assets/scene/field.jpg';
const planes = [{ key: '0g', label: '0 g · microgravity', z: 4.5 }, { key: 'moon', label: '1/6 g · Moon', z: 1.5 }, { key: 'mars', label: '3/8 g · Mars', z: -1.5 }, { key: '1g', label: '1 g · Earth', z: -4.5 }];
export function fieldRows(db) {
  return db.tests.filter(r => r.n?.o2 != null).map(r => ({ row: r, p: r.n.p ?? r.n.p_inferred ?? null, o2: r.n.o2,
    plane: r.n.gclass === 'micro' ? '0g' : r.n.gclass === 'normal' ? '1g' : r.gravity === '1/6 g' ? 'moon' : r.gravity === '3/8 g' ? 'mars' : 'unknown',
    layer: r.n.cabin ? 'solid' : r.n.fuel_class === 'liquid_droplet' ? 'droplet' : 'gas' }));
}
export function nearestSolid(db, q) {
  if (!Number.isFinite(q.p) || !Number.isFinite(q.o2)) return null;
  return fieldRows(db).filter(p => p.layer === 'solid' && p.p != null && p.plane !== 'unknown').sort((a, b) => {
    const score = p => ((p.p - q.p) / TOL.p) ** 2 + ((p.o2 - q.o2) / TOL.o2) ** 2;
    return score(a) - score(b) || a.row.id.localeCompare(b.row.id);
  })[0] || null;
}
export async function build(ctx) {
  const { THREE: T, camera, renderer } = ctx, group = new T.Group(), host = renderer.domElement.parentElement;
  const overlay = document.createElement('div'); overlay.className = 'field-labels'; host.append(overlay);
  const labels = [], disposers = [];
  const label = (text, position, cls = '') => { const el = document.createElement('span'); el.className = 'field-label ' + cls; el.textContent = text; overlay.append(el); labels.push({ el, position: new T.Vector3(...position) }); return el; };
  const line = (coords, color, opacity = 1) => new T.Line(new T.BufferGeometry().setFromPoints(coords.map(p => new T.Vector3(...p))), new T.LineBasicMaterial({ color, transparent: true, opacity }));
  for (const plane of planes) {
    const edge = line([[-4,-2.7,plane.z],[4,-2.7,plane.z],[4,2.7,plane.z],[-4,2.7,plane.z],[-4,-2.7,plane.z]], plane.key === 'moon' || plane.key === 'mars' ? 0xc8553d : 0x8fa3b5, .45);
    group.add(edge);
    const face = new T.Mesh(new T.PlaneGeometry(8, 5.4), new T.MeshBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: .025, side: T.DoubleSide, depthWrite: false }));
    face.position.z = plane.z; group.add(face);
    label(plane.label, [-4, -3.05, plane.z], plane.key === 'moon' || plane.key === 'mars' ? 'field-gap-label' : '');
  }
  const planeSummary = document.createElement('div'); planeSummary.className = 'field-plane-summary'; overlay.append(planeSummary);
  const counts = planes.map(p => { const el = document.createElement('span'); el.dataset.plane = p.key; planeSummary.append(el); return el; });
  label('Air pressure (kPa) →', [0, -3.7, 5.2]); label('Oxygen % ↑', [-4.8, 3.2, 4.5]);
  label('Pressure not in table', [5.2, 3.1, 4.5], 'field-rail-label');
  group.add(line([[5.2,-2.7,4.5],[5.2,2.7,4.5]],0x8fa3b5,.45));
  const cabin = new T.Mesh(new T.OctahedronGeometry(.19), new T.MeshBasicMaterial({ color: 0xc8553d })); group.add(cabin);
  const ring = new T.Mesh(new T.TorusGeometry(.3,.018,6,40),new T.MeshBasicMaterial({ color: 0xc8553d })); group.add(ring);
  const link = line([[0,0,0],[0,0,0]],0xe2795f,.9); group.add(link);
  const cabinLabel = label('Your cabin', [0,0,0], 'field-cabin-label');
  let shown = ['solid','droplet','gas'], pMax = 110, nearest, data = [], cloud, priorDb, lastKey, from = new T.Vector3(), target = new T.Vector3(), changeT = 0;
  let yaw = .68, pitch = .18, distance = 15, drag = null;
  const pointers = new Map(); let pinch;
  const canvas = renderer.domElement;
  const listen = (name, fn, options) => { canvas.addEventListener(name, fn, options); disposers.push(() => canvas.removeEventListener(name, fn, options)); };
  listen('pointerdown', e => { pointers.set(e.pointerId,[e.clientX,e.clientY]); drag = [e.clientX,e.clientY]; canvas.setPointerCapture(e.pointerId); });
  listen('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if (pointers.size === 2) { const [a,b] = [...pointers.values()], d = Math.hypot(a[0]-b[0],a[1]-b[1]); if (pinch) distance = Math.max(10,Math.min(32,distance * pinch/d)); pinch = d; }
    else if (drag) { yaw = Math.max(-1.1,Math.min(1.1,yaw + (e.clientX-drag[0])*.006)); pitch = Math.max(-.6,Math.min(.7,pitch + (e.clientY-drag[1])*.004)); }
    drag = [e.clientX,e.clientY];
  });
  const end = e => { pointers.delete(e.pointerId); pinch = null; drag = null; };
  listen('pointerup',end); listen('pointercancel',end);
  listen('wheel',e => { e.preventDefault(); distance = Math.max(10,Math.min(32,distance * Math.exp(e.deltaY*.001))); },{passive:false});
  const pos = p => new T.Vector3(p.p == null ? 5.2 : (p.p - 20)/(pMax - 20)*8 - 4, (p.o2-55)/45*2.7, planes.find(g=>g.key===p.plane)?.z ?? -7.5);
  const ray = new T.Raycaster(); ray.params.Points.threshold = .13;
  function populate(db) {
    data = fieldRows(db); priorDb = db; pMax = Math.ceil(Math.max(110,...data.map(p=>p.p || 0))/100)*100;
    for(const p of [20,100,300,pMax]) label(`${p}`,[(p-20)/(pMax-20)*8-4,-3.25,4.5],'field-tick');
    for(const o of [20,60,100]) label(`${o} %`,[-4.6,(o-55)/45*2.7,4.5],'field-tick');
    const geometry = new T.BufferGeometry(), positions = [], colors = [], flags = [], layers = [];
    for (const p of data) { positions.push(...pos(p).toArray()); layers.push(p.layer === 'solid' ? 0 : p.layer === 'droplet' ? 1 : 2); colors.push(...new T.Color(p.layer === 'solid' ? 0xede4d4 : 0x5d7185).toArray()); flags.push(p.row.n.p == null ? 1 : 0); }
    geometry.setAttribute('layer',new T.Float32BufferAttribute(layers,1));
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3)); geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3)); geometry.setAttribute('inferred',new T.Float32BufferAttribute(flags,1));
    const material = new T.ShaderMaterial({ vertexColors:true, transparent:true, depthWrite:false, uniforms:{uLayers:{value:new T.Vector3(1,1,1)}},
      vertexShader:'attribute float layer; varying float vLayer; attribute float inferred; varying vec3 vColor; varying float vRing; void main(){vLayer=layer;vColor=color;vRing=inferred;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(85.0/-mv.z,3.0,9.0);}',
      fragmentShader:'uniform vec3 uLayers; varying float vLayer; varying vec3 vColor; varying float vRing; void main(){if((vLayer<.5 && uLayers.x<.5)||(vLayer>.5 && vLayer<1.5 && uLayers.y<.5)||(vLayer>1.5 && uLayers.z<.5))discard;float d=length(gl_PointCoord-.5);if(d>.5 || (vRing>.5 && d<.28))discard;gl_FragColor=vec4(vColor, .9);}' });
    cloud = new T.Points(geometry,material); group.add(cloud);
    planes.forEach((p,i) => { const n = data.filter(d=>d.plane===p.key).length; counts[i].textContent = `${p.label}: ${n ? `${n} test rows` : 'no test row'}`; });
    if (data.some(p=>p.plane==='unknown')) label('Gravity not stated',[-4,-3.05,-7.5]);
  }
  return { group, still,
    update(t,state) {
      if (!state.db || !state.q) return;
      if (priorDb !== state.db) populate(state.db);
      shown=state.show || ['solid','droplet','gas']; cloud.material.uniforms.uLayers.value.set(...['solid','droplet','gas'].map(k=>shown.includes(k)?1:0));
      const valid = Number.isFinite(state.q.p) && Number.isFinite(state.q.o2); cabin.visible=ring.visible=valid; cabinLabel.hidden=!valid;
      const q=state.q, key=[q.p,q.o2,q.g].join('|'), next=pos({p:q.p,o2:q.o2,plane:q.g});
      if (key!==lastKey) { from.copy(lastKey ? cabin.position : next); target.copy(next); changeT=t; lastKey=key; nearest=nearestSolid(state.db,q); }
      const a = state.capture || ctx.mode==='still' ? 1 : Math.min(1,Math.max(0,(t-changeT)/.75)), ease=1-(1-a)**3;
      cabin.position.lerpVectors(from,target,ease); ring.position.copy(cabin.position); ring.quaternion.copy(camera.quaternion);
      link.visible=!!nearest;
      if (nearest) { const points=link.geometry.attributes.position; points.setXYZ(0,...cabin.position.toArray()); points.setXYZ(1,...pos(nearest).toArray()); points.needsUpdate=true; link.geometry.computeBoundingSphere(); }
      const fitDistance=distance*Math.max(1,1.6/camera.aspect);
      camera.position.set(Math.sin(yaw)*fitDistance,Math.sin(pitch)*fitDistance,Math.cos(yaw)*fitDistance); camera.lookAt(.4,0,0); camera.updateMatrixWorld(); group.updateMatrixWorld(true);
      const b=host.getBoundingClientRect(), scale=b.width/(host.clientWidth||1);
      labels.find(l=>l.el===cabinLabel).position.copy(cabin.position).add(new T.Vector3(.3,.35,0));
      for(const l of labels) { const v=l.position.clone().project(camera); l.el.style.left=`${(v.x+1)/2*b.width/scale}px`; l.el.style.top=`${(1-v.y)/2*b.height/scale}px`; l.el.hidden=v.z>1; }
      host.dataset.fieldRows=String(data.length);
    },
    pick(x,y) { if(!cloud)return null; ray.setFromCamera({x,y},camera); const hit=ray.intersectObject(cloud).find(h=>shown.includes(data[h.index].layer)); const p=hit && data[hit.index]; return p ? {id:p.row.id,kind:'test',row:p.row} : null; },
    dispose() { disposers.forEach(fn=>fn()); overlay.remove(); }
  };
}
