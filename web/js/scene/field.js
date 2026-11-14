import { TOL } from '../core/match.js';
export const still = 'assets/scene/field.jpg';
const planes = [{ key: '0g', label: '0 g · microgravity', z: 4.5 }, { key: 'moon', label: '1/6 g · Moon', z: 1.5 }, { key: 'mars', label: '3/8 g · Mars', z: -1.5 }, { key: '1g', label: '1 g · Earth', z: -4.5 }];
const KPA_PER_PSI = 6.894757293;
let entered = false;
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
  const integrated = ctx.world === true;
  const phone = !integrated && ctx.mode === 'low' && innerWidth < 760;
  if(phone)group.scale.set(.5,1,.7);
  const overlay = document.createElement('div'); overlay.className = 'field-labels'; host.append(overlay);
  const labels = [], disposers = [], projection = new T.Vector3();
  const label = (text, position, cls = '') => { const el = document.createElement('span'); el.className = 'field-label ' + cls; el.textContent = text; overlay.append(el); const item = { el, position: new T.Vector3(...position) }; labels.push(item); return item; };
  const line = (coords, color, opacity = 1) => new T.Line(new T.BufferGeometry().setFromPoints(coords.map(p => new T.Vector3(...p))), new T.LineBasicMaterial({ color, transparent: true, opacity }));
  const planeLabels = planes.map(plane => {
    group.add(line([[-6,-2.7,plane.z],[6,-2.7,plane.z],[6,2.7,plane.z],[-6,2.7,plane.z],[-6,-2.7,plane.z]], plane.key === '0g' ? 0x8fa3b5 : 0xc78973, .6));
    const face = new T.Mesh(new T.PlaneGeometry(12, 5.4), new T.MeshBasicMaterial({ color: plane.key === '0g' ? 0x8fa3b5 : 0xad7b67, transparent: true, opacity: plane.key === '0g' ? .075 : .055, side: T.DoubleSide, depthWrite: false }));
    face.position.z = plane.z; group.add(face);
    return label(plane.label, [plane.key === '0g' ? (phone ? -2.2 : -4.9) : 5.7, plane.key === '0g' ? 3.35 : phone ? [0,2.1,-1.2,-4.1][planes.indexOf(plane)] : 2.1 - planes.indexOf(plane)*1.65, plane.z], 'field-plane-label' + (plane.key === '0g' ? ' field-data-label' : ' field-gap-label'));
  });
  const pressureLabel = label('Air pressure · psia · log scale →', [-1.5, phone ? -4.35 : -3.8, 4.5], 'field-axis');
  label('Oxygen %', [-6.8, 3.35, 4.5], 'field-axis field-oxygen-title');
  label('Pressure not in table', [6.65, 2.9, 4.5], 'field-rail-label');
  group.add(line([[6.65,-2.7,4.5],[6.65,2.7,4.5]],0x8fa3b5,.4));
  const cabin = new T.Mesh(new T.OctahedronGeometry(.17), new T.MeshBasicMaterial({ color: 0xee9b7b })); group.add(cabin);
  const ring = new T.Mesh(new T.TorusGeometry(.29,.018,8,48),new T.MeshBasicMaterial({ color: 0xee9b7b })); group.add(ring);
  const link = line([[0,0,0],[0,0,0]],0xee9b7b,.9); group.add(link);
  const cabinLabel = label('Your cabin', [0,0,0], 'field-cabin-label');
  const deltaLabel = label('', [0,0,0], 'field-delta-label');
  const hoverLabel = label('', [0,0,0], 'field-hover-label'); hoverLabel.el.hidden = true;
  let shown = ['solid','droplet','gas'], nearest, data = [], cloud, priorDb, lastKey, from = new T.Vector3(), target = new T.Vector3(), changeT = 0, hovered = null, selected = null;
  let yaw = .76, pitch = .1, distance = phone ? 17 : 17.4, drag = null, interacted = false, introStart = null;
  let oMax = 42, pMin = 2, pMax = 80, axisKey;
  const animateEntry = !entered; entered = true;
  const pointers = new Map(); let pinch;
  const canvas = renderer.domElement;
  const listen = (name, fn, options, surface = canvas) => { if(integrated)return; surface.addEventListener(name, fn, options); disposers.push(() => surface.removeEventListener(name, fn, options)); };
  const clearHover = () => { hovered = null; hoverLabel.el.hidden = true; if(cloud)cloud.material.uniforms.uHover.value.set(999,999,999); };
  listen('pointerdown', e => { interacted = true; clearHover(); pointers.set(e.pointerId,[e.clientX,e.clientY]); drag = [e.clientX,e.clientY]; canvas.setPointerCapture(e.pointerId); });
  listen('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    clearHover();
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if (pointers.size === 2) { const [a,b] = [...pointers.values()], d = Math.hypot(a[0]-b[0],a[1]-b[1]); if (pinch && d > 0) distance = Math.max(10,Math.min(32,distance * pinch/d)); pinch = d; }
    else if (drag) { yaw = Math.max(-1.1,Math.min(1.1,yaw + (e.clientX-drag[0])*.006)); pitch = Math.max(-.6,Math.min(.7,pitch + (e.clientY-drag[1])*.004)); }
    drag = [e.clientX,e.clientY];
  });
  const end = e => { pointers.delete(e.pointerId); pinch = null; drag = null; };
  listen('pointerup',end); listen('pointercancel',end); listen('pointerleave',clearHover);
  listen('wheel',e => { e.preventDefault(); interacted = true; distance = Math.max(10,Math.min(32,distance * Math.exp(e.deltaY*.001))); },{passive:false},host);
  const x = psi => (Math.log(psi / pMin) / Math.log(pMax / pMin)) * 12 - 6;
  const y = oxygen => (oxygen-10)/(oMax-10)*5.4-2.7;
  const pos = p => new T.Vector3(p.p == null ? 6.65 : x(p.p/KPA_PER_PSI), y(p.o2), planes.find(g=>g.key===p.plane)?.z ?? -7.5);
  const oxygenTicks = [10,20,30,40].map(o => label(`${o}`, [-6.35,y(o),4.5], 'field-tick field-oxygen-tick'));
  const pressureTicks = [2,5,10,20,40,80].map(p => label(`${p}`, [x(p),-2.98,4.5], 'field-tick'));
  const ray = new T.Raycaster();
  const markKey = p => [p.p,p.o2,p.plane,p.layer,p.row.n.p == null].join('|');
  const signed = v => `${v>0?'+':''}${Math.round(v*10)/10}`;
  function populate(db) {
    data = fieldRows(db); priorDb = db;
    const multiplicity = new Map();
    for(const p of data) multiplicity.set(markKey(p),(multiplicity.get(markKey(p)) || 0)+1);
    const geometry = new T.BufferGeometry(), positions = [], colors = [], flags = [], layers = [], sizes = [];
    for (const p of data) {
      positions.push(...pos(p).toArray()); layers.push(p.layer === 'solid' ? 0 : p.layer === 'droplet' ? 1 : 2);
      colors.push(...new T.Color(p.layer === 'solid' ? 0xf1e9d8 : 0x708394).toArray()); flags.push(p.row.n.p == null ? 1 : 0);
      sizes.push(Math.min(16,(p.layer === 'solid' ? 6.5 : 4.5)+Math.log2(multiplicity.get(markKey(p)))*1.8));
    }
    geometry.setAttribute('layer',new T.Float32BufferAttribute(layers,1));
    geometry.setAttribute('selected',new T.Float32BufferAttribute(data.map(p=>!selected || p.row.psi_id===selected ? 1 : 0),1));
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3)); geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3)); geometry.setAttribute('inferred',new T.Float32BufferAttribute(flags,1)); geometry.setAttribute('pointSize',new T.Float32BufferAttribute(sizes,1));
    const material = new T.ShaderMaterial({ vertexColors:true, transparent:true, depthWrite:false, uniforms:{uLayers:{value:new T.Vector3(1,1,1)},uDpr:{value:1},uHover:{value:new T.Vector3(999,999,999)},uTime:{value:0},uSelected:{value:0}},
      vertexShader:'attribute float layer; attribute float inferred; attribute float pointSize; attribute float selected; uniform float uDpr; uniform vec3 uHover; uniform float uTime; uniform float uSelected; varying float vLayer; varying vec3 vColor; varying float vRing; varying float vAlpha; void main(){vLayer=layer;vColor=color;vRing=inferred;vAlpha=mix(.09,1.,selected);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);float shimmer=1.+.045*sin(uTime*1.5+position.x*2.+position.y);gl_PointSize=(pointSize*shimmer+uSelected*selected*2.+(distance(position,uHover)<.001?5.0:0.0))*uDpr;}',
      fragmentShader:'uniform vec3 uLayers; varying float vLayer; varying vec3 vColor; varying float vRing; varying float vAlpha; void main(){if((vLayer<.5 && uLayers.x<.5)||(vLayer>.5 && vLayer<1.5 && uLayers.y<.5)||(vLayer>1.5 && vLayer<2.5 && uLayers.z<.5))discard;float d=length(gl_PointCoord-.5);if(d>.5 || (vRing>.5 && d<.28))discard;gl_FragColor=vec4(vColor,vAlpha);\n#include <colorspace_fragment>\n}' });
    if(cloud){group.remove(cloud);cloud.geometry.dispose();cloud.material.dispose();}
    cloud = new T.Points(geometry,material); group.add(cloud);
    planes.forEach((p,i) => { const n = data.filter(d=>d.plane===p.key).length; planeLabels[i].el.replaceChildren(document.createTextNode(p.label),Object.assign(document.createElement('small'),{textContent:integrated && innerWidth < 760 ? `${n} plotted rows` : n ? `${n} test rows` : integrated ? 'no plotted row in the evidence base' : 'no test row in the evidence base'})); });
  }
  return { group, still,
    update(t,state) {
      if (!state.db || !state.q) return;
      const q=state.q;
      const domain=[Math.max(42,Number.isFinite(q.o2)?q.o2:42),Math.min(2,Number.isFinite(q.p)&&q.p>0?q.p/KPA_PER_PSI:2),Math.max(80,Number.isFinite(q.p)?q.p/KPA_PER_PSI:80)];
      const nextAxis=domain.join('|');
      if(axisKey!==nextAxis){[oMax,pMin,pMax]=domain;axisKey=nextAxis;oxygenTicks.forEach((l,i)=>l.position.y=y([10,20,30,40][i]));pressureTicks.forEach((l,i)=>l.position.x=x([2,5,10,20,40,80][i]));populate(state.db);lastKey=null;}
      else if (priorDb !== state.db) populate(state.db);
      shown=state.show || ['solid','droplet','gas']; cloud.material.uniforms.uLayers.value.set(...['solid','droplet','gas'].map(k=>shown.includes(k)?1:0)); cloud.material.uniforms.uDpr.value=renderer.getPixelRatio();
      if(selected !== (state.investigation || null)) {
        selected=state.investigation || null;
        const attr=cloud.geometry.attributes.selected;
        data.forEach((p,i)=>attr.setX(i,!selected || p.row.psi_id===selected ? 1 : 0)); attr.needsUpdate=true; clearHover();
      }
      cloud.material.uniforms.uTime.value=t;
      cloud.material.uniforms.uSelected.value=selected ? 1 : 0;
      const valid = Number.isFinite(q.p) && q.p>0 && Number.isFinite(q.o2); cabin.visible=ring.visible=valid; cabinLabel.el.hidden=deltaLabel.el.hidden=!valid;
      const key=[q.p,q.o2,q.g].join('|'), next=pos({p:q.p,o2:q.o2,plane:q.g});
      if (key!==lastKey) { from.copy(lastKey ? cabin.position : next); target.copy(next); changeT=t; lastKey=key; nearest=nearestSolid(state.db,q); }
      const a = state.capture || state.reduced || ctx.mode==='still' ? 1 : Math.min(1,Math.max(0,(t-changeT)/1.15)), ease=a*a*(3-2*a);
      cabin.position.lerpVectors(from,target,ease); cabin.position.y+=Math.sin(a*Math.PI)*.6; ring.position.copy(cabin.position);
      link.visible=valid&&!!nearest; deltaLabel.el.hidden=!link.visible;
      if (nearest && valid) {
        const at=pos(nearest), points=link.geometry.attributes.position; points.setXYZ(0,...cabin.position.toArray()); points.setXYZ(1,...at.toArray()); points.needsUpdate=true; link.geometry.computeBoundingSphere();
        deltaLabel.position.copy(cabin.position).add(new T.Vector3(.3,-.42,0));
        deltaLabel.el.textContent=`Cabin − solid row: ${signed(q.o2-nearest.o2)} pp O₂ · ${signed((q.p-nearest.p)/KPA_PER_PSI)} psia`;
      }
      introStart ??= t;
      const entry=state.capture||!animateEntry||interacted?0:Math.max(0,1-(t-introStart)/1.45)**3;
      const fitDistance=phone ? distance : distance*Math.max(1,1.65/camera.aspect), lookYaw=yaw-entry*.22;
      if(!integrated){camera.position.set(Math.sin(lookYaw)*fitDistance,Math.sin(pitch+entry*.06)*fitDistance,Math.cos(lookYaw)*fitDistance); camera.lookAt(.4,phone ? 0 : -.65,0);}
      camera.updateMatrixWorld(); group.updateMatrixWorld(true); ring.quaternion.copy(camera.quaternion);
      cabinLabel.position.copy(cabin.position).add(new T.Vector3(.25,.4,0));
      if(hovered)hoverLabel.position.copy(pos(hovered)).add(new T.Vector3(.15,.22,0));
      for(const l of labels) {
        if(l===hoverLabel&&!hovered)continue;
        if((l===cabinLabel||l===deltaLabel)&&!valid)continue;
        projection.copy(l.position).applyMatrix4(group.matrixWorld).project(camera); let left=(projection.x+1)/2*host.clientWidth, top=(1-projection.y)/2*host.clientHeight;
        if(phone && l.el.classList.contains('field-gap-label'))left=Math.min(host.clientWidth-l.el.offsetWidth-12,left+8);
        if(phone && l.el.classList.contains('field-axis'))left=Math.max(16,Math.min(host.clientWidth-l.el.offsetWidth-12,left));
        if(phone && l.el.classList.contains('field-oxygen-title'))top=103;
        if(integrated && host.clientWidth<760){left=Math.max(8,Math.min(host.clientWidth-l.el.offsetWidth-8,left));if(l===planeLabels[0])top=Math.max(top,host.clientHeight*.315);}
        l.el.style.left=`${left}px`; l.el.style.top=`${top}px`; l.el.hidden=projection.z>1 || projection.z< -1 || (integrated && !group.visible);
      }
      host.dataset.fieldRows=String(data.length); host.dataset.fieldCabin=cabin.position.toArray().map(n=>n.toFixed(3)).join(','); host.dataset.fieldCamera=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
      host.dataset.fieldMinPointPx='4.5'; pressureLabel.el.dataset.axis='psia-log';
    },
    pick(x,y) {
      if(!cloud)return null;
      ray.params.Points.threshold=integrated ? .17 : .14*distance/17.4; ray.setFromCamera({x,y},camera);
      const hit=ray.intersectObject(cloud).find(h=>shown.includes(data[h.index].layer) && (!selected || data[h.index].row.psi_id===selected)), p=hit&&data[hit.index];
      if(!p){clearHover();return null;}
      hovered=p; cloud.material.uniforms.uHover.value.copy(pos(p)); hoverLabel.el.hidden=false;
      hoverLabel.el.textContent=`${p.row.investigation} · ${p.row.fuel || 'fuel not stated'} · ${Math.round(p.o2*10)/10}% O₂ · ${p.p==null?'pressure not stated':`${Math.round(p.p/KPA_PER_PSI*10)/10} psia`}`;
      return {id:p.row.id,kind:'test',row:p.row};
    },
    setVisible(value) { group.visible=value; overlay.hidden=!value; if(!value)clearHover(); },
    get rows() { return data; },
    dispose() { disposers.forEach(fn=>fn()); overlay.remove(); }
  };
}
