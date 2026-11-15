// A bounded, procedural set for the software inspection concept. No external assets,
// shadow maps, telemetry feeds or physical sensor model are used here.
export function createMaintenanceBay({ THREE: T, groundY = -1.43 } = {}) {
  const group = new T.Group(); group.name = 'lunar-crew-support-habitat';
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const geo = value => { geometries.add(value); return value; };
  const mat = (color, options = {}) => {
    const value = new T.MeshStandardMaterial({ color, roughness: .72, metalness: .22, ...options });
    materials.add(value); return value;
  };
  const unitBox = geo(new T.BoxGeometry(1, 1, 1));
  const unitCylinder = geo(new T.CylinderGeometry(1, 1, 1, 16));
  const unitSphere = geo(new T.SphereGeometry(1, 12, 8));
  const graphite = mat(0x222b30), deck = mat(0x4a5557), recess = mat(0x121b20);
  const ceramic = mat(0xb9b7aa, { metalness: .12 }), panel = mat(0x6c7777), copper = mat(0xa4795c, { metalness: .48 });
  const steel = mat(0x8b9697, { metalness: .6, roughness: .48 });
  const warm = mat(0xe8ddc5, { emissive: 0xe5d6b5, emissiveIntensity: 1.15, toneMapped: false });
  const blue = mat(0x9bb7c0, { emissive: 0x718f9c, emissiveIntensity: .45 });
  const cueMaterial = mat(0xc69a5c, { emissive: 0xb78243, emissiveIntensity: .3 });
  const ringMaterial = mat(0xd7b478, { emissive: 0xb68d4f, emissiveIntensity: .7 });
  function mesh(shape, finish, size, at, parent = group) {
    const item = new T.Mesh(shape, finish); item.scale.set(...size); item.position.set(...at);
    item.castShadow = item.receiveShadow = false; parent.add(item); return item;
  }
  const box = (size, at, finish = panel, parent = group) => mesh(unitBox, finish, size, at, parent);
  const cylinder = (radius, length, at, finish = steel, parent = group) => mesh(unitCylinder, finish, [radius, length, radius], at, parent);
  const sphere = (radius, at, finish = steel) => mesh(unitSphere, finish, [radius, radius, radius], at);
  const up = new T.Vector3(0, 1, 0), direction = new T.Vector3();
  function pipe(a, b, radius, finish) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    const item = cylinder(radius, start.distanceTo(end), start.add(end).multiplyScalar(.5).toArray(), finish);
    item.quaternion.setFromUnitVectors(up, direction.subVectors(new T.Vector3(...b), new T.Vector3(...a)).normalize());
    return item;
  }
  function decal(text, width, height, at, color = '#d8d2c3') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d'); context.fillStyle = '#1c282d'; context.fillRect(0, 0, 512, 128);
    context.fillStyle = color; context.font = '500 54px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 64);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; textures.add(texture);
    const finish = new T.MeshBasicMaterial({ map: texture, toneMapped: false }); materials.add(finish);
    return mesh(geo(new T.PlaneGeometry(width, height)), finish, [1, 1, 1], at);
  }

  // A continuous interior envelope contains every camera pose. The Moon is visible
  // only through the rear viewport; this is a visual set, not a pressure model.
  // All exterior terrain is original illustrative geometry, not a NASA image.
  const rearZ=-3.82,frontZ=10.4;
  const vaultPositions=[],vaultIndices=[],vaultSegments=32;
  for(let i=0;i<=vaultSegments;i++){
    const angle=i/vaultSegments*Math.PI,x=5*Math.cos(angle),y=groundY+4.4*Math.sin(angle);
    vaultPositions.push(x,y,rearZ,x,y,frontZ);
    if(i<vaultSegments){const a=i*2;vaultIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const vault=geo(new T.BufferGeometry());vault.setAttribute('position',new T.Float32BufferAttribute(vaultPositions,3));vault.setIndex(vaultIndices);vault.computeVertexNormals();
  // Inward winding lights the room-facing surface without transparent/double-sided walls.
  mesh(vault,ceramic,[1,1,1],[0,0,0]);
  const shell = new T.Shape(); shell.moveTo(-5,groundY); shell.lineTo(5,groundY);
  shell.absellipse(0,groundY,5,4.4,0,Math.PI,false); shell.closePath();
  const forwardBulkhead=geo(new T.ExtrudeGeometry(shell,{depth:.18,bevelEnabled:false,curveSegments:28}));
  mesh(forwardBulkhead,ceramic,[1,1,1],[0,0,frontZ]);
  const port = new T.Path(); port.moveTo(-1.85,-.45); port.lineTo(-1.85,2.05);
  port.quadraticCurveTo(-1.85,2.23,-1.67,2.23); port.lineTo(1.67,2.23);
  port.quadraticCurveTo(1.85,2.23,1.85,2.05); port.lineTo(1.85,-.45); port.closePath(); shell.holes.push(port);
  mesh(geo(new T.ExtrudeGeometry(shell,{depth:.18,bevelEnabled:false,curveSegments:28})),ceramic,[1,1,1],[0,0,rearZ]);
  box([10.2,.16,14.4],[0,groundY-.13,3.3],graphite);
  for(const x of [-3.35,0,3.35])for(const z of [-2.0,1.5,5.0,8.5])box([3.26,.025,3.42],[x,groundY-.0125,z],deck);
  const archShape=geo(new T.TorusGeometry(5,.045,6,48,Math.PI));
  // Structural ribs stay behind the task; no foreground rib crosses the robot/tool.
  for(const z of [-3.1,-1.8])mesh(archShape,steel,[1,.88,1],[0,groundY,z]);
  for(const x of [-4.5,4.5]){
    box([.48,.68,13.9],[x,groundY+.34,3.25],graphite);
    box([.50,.045,13.9],[x,groundY+.70,3.25],steel);
  }
  for(const x of [-2.9,2.9]){box([.16,.10,12.9],[x,2.10,3.0],graphite);box([.045,.035,12.5],[x,2.015,3.0],warm);}
  // Recessed ceiling service spine and broad floor edges reinforce interior depth.
  box([.65,.045,13.8],[0,2.945,3.25],panel);
  for(const x of [-4.15,4.15])box([.035,.006,13.9],[x,groundY+.003,3.25],copper);
  group.userData.enclosure={kind:'visual-interior',rearZ,frontZ,halfWidth:5,vaultHeight:4.4,groundY,viewport:'rear-bulkhead-only'};
  const lunar=mat(0x807e75,{roughness:1,metalness:0});
  const terrain=geo(new T.PlaneGeometry(22,15,24,16));terrain.rotateX(-Math.PI/2);
  const terrainPositions=terrain.attributes.position;
  for(let i=0;i<terrainPositions.count;i++){const x=terrainPositions.getX(i),z=terrainPositions.getZ(i);terrainPositions.setY(i,.22*Math.sin(x*.8+z*.4)+.16*Math.cos(z*1.1)+.05*Math.sin(x*3.5-z));}
  terrain.computeVertexNormals();mesh(terrain,lunar,[1,1,1],[0,groundY-.1,-12.2]);
  const ridge=new T.Shape();ridge.moveTo(-12,-3);
  for(const [x,y] of [[-12,0],[-10,.6],[-8,.25],[-6,1.1],[-4,.55],[-1,.85],[1,.38],[3,1.2],[5,.3],[8,.8],[12,.1]])ridge.lineTo(x,y);
  ridge.lineTo(12,-3);ridge.closePath();mesh(geo(new T.ExtrudeGeometry(ridge,{depth:1.1,bevelEnabled:false})),lunar,[1,1,1],[0,-.4,-11.8]);
  const rock=geo(new T.DodecahedronGeometry(1,0));
  for(const [x,z,r] of [[-2.6,-6.3,.3],[1.8,-6.7,.22],[3.4,-8,.5],[-4,-9,.42],[.3,-9.6,.18]])mesh(rock,lunar,[r,r*.55,r*.8],[x,groundY+.03,z]);
  for(const x of [-1.96,1.96])box([.16,2.9,.28],[x,.88,-3.56],graphite);
  for(const y of [-.55,2.35])box([4.08,.16,.28],[0,y,-3.56],graphite);
  pipe([-1.87,-.34,-3.36],[1.87,-.34,-3.36],.055,copper);
  // Sealed airlock with handrails; a separate desk is the crew's work area.
  mesh(geo(new T.CircleGeometry(1.13,32)),panel,[1,1,1],[-3.55,-.05,-3.55]);
  mesh(geo(new T.TorusGeometry(1.13,.095,8,40)),graphite,[1,1,1],[-3.55,-.05,-3.47]);
  mesh(geo(new T.CircleGeometry(.29,24)),blue,[1,1,1],[-3.55,.24,-3.44]);
  for(const x of [-4.25,-2.85])pipe([x,-.25,-3.31],[x,.45,-3.31],.055,copper);
  decal('AIRLOCK',1.35,.32,[-3.55,1.25,-3.49]);
  for(const x of [3.3,4.45])box([.12,.8,.12],[x,groundY+.4,1.95],graphite);
  box([1.55,.12,.85],[3.88,groundY+.88,1.95],ceramic);
  box([.9,.58,.1],[3.88,groundY+1.24,2.15],graphite);box([.78,.45,.025],[3.88,groundY+1.25,2.22],blue);
  cylinder(.28,.08,[3.88,groundY+.56,2.78],graphite);cylinder(.045,.52,[3.88,groundY+.26,2.78],steel);
  decal('CREW WORK ZONE',1.45,.28,[3.88,groundY+1.72,2.22]);
  // A tagged concept PMMA panel replaces the unexplained alarm cabinet.
  box([1.95,.12,1.12],[2.65,-.48,-1.65],ceramic);
  for(const x of [1.85,3.45])box([.13,.86,.80],[x,groundY+.43,-1.65],graphite);
  box([1.38,1.16,.10],[2.65,.28,-1.19],graphite);box([1.22,1.02,.035],[2.65,.28,-1.115],blue);
  for(const x of [2.02,3.28])box([.04,1.15,.035],[x,.28,-1.07],copper);
  decal('HAB-PMMA-01',1.38,.30,[2.65,1.05,-1.10]);
  // Illustrative material-linked components, not measured or flight-certified hardware.
  // Their evidence/status is supplied by the review engine; geometry creates no data.
  box([1.25,.62,.10],[-3.65,.28,-1.17],graphite);
  for(const y of [-.05,.61])box([1.3,.055,.22],[-3.65,y,-1.10],steel);
  for(const y of [.16,.28,.40])pipe([-4.15,y,-1.07],[-3.15,y,-1.07],.025,copper);
  for(const y of [0,.5])pipe([-4.55,y,-1.17],[-4.15,y,-1.17],.045,steel);
  decal('KAPTON CABLE',1.30,.28,[-3.65,.83,-1.07]);
  for(const x of [-1.82,1.82])box([.045,2.55,.035],[x,.86,-3.33],recess);
  for(const y of [-.42,2.14])box([3.66,.045,.035],[0,y,-3.33],recess);
  decal('SILICONE SEAL',1.45,.28,[2.70,1.77,-3.30]);
  const targetSpec=(label,tag,point,robotPosition,robotYaw)=>Object.freeze({label,tag,point:Object.freeze(point),robotPosition:Object.freeze(robotPosition),robotYaw});
  const workTargets=Object.freeze({
    pmma:targetSpec('PMMA work-zone panel','HAB-PMMA-01',[2.65,.28,-1.025],[1.65,groundY,-.05],2.44),
    kapton:targetSpec('Kapton cable tray','HAB-KAPTON-02',[-3.65,.28,-1.025],[-2.65,groundY,-.05],-2.44),
    silicone:targetSpec('Silicone viewport seal','HAB-SILICONE-03',[1.82,.45,-3.32],[.9,groundY,-2.2],2.45)
  });
  const cuePosition=new T.Vector3(2.65,.28,-1.06);
  const cue=box([.10,.10,.018],cuePosition.toArray(),cueMaterial);cue.name='panel-traceability-target';
  const targetRing=mesh(geo(new T.TorusGeometry(.23,.014,6,36)),ringMaterial,[1,1,1],[2.65,.28,-1.035]);targetRing.name='evidence-target-ring';targetRing.visible=false;
  const scan=box([.82,.014,.012],[2.65,.28,-1.025],blue);scan.visible=false;
  const beamGeometry=geo(new T.BufferGeometry());beamGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));
  const beamMaterial=new T.LineBasicMaterial({color:0xa7c7ce,transparent:true,opacity:.4,depthWrite:false});materials.add(beamMaterial);
  const beam=new T.Line(beamGeometry,beamMaterial);group.add(beam);beam.visible=false;
  cylinder(.8,.065,[-2,groundY-.030,1],graphite);
  const dockRing=mesh(geo(new T.TorusGeometry(.73,.015,6,40)),blue,[1,1,1],[-2,groundY+.012,1]);dockRing.rotation.x=-Math.PI/2;
  for(const x of [-2.5,-1.5])box([.1,.018,.36],[x,groundY+.01,.88],copper);
  decal('ROBOT DOCK',1.2,.24,[-2,groundY+.24,.1]);
  const routeGeometry=geo(new T.BufferGeometry().setFromPoints([new T.Vector3(-2,groundY+.06,1),new T.Vector3(1.65,groundY+.06,-.05)]));
  const routeMaterial=new T.LineDashedMaterial({color:0xc5a270,dashSize:.18,gapSize:.12,transparent:true,opacity:.45});materials.add(routeMaterial);
  const route=new T.Line(routeGeometry,routeMaterial);route.computeLineDistances();group.add(route);route.visible=false;
  group.add(new T.HemisphereLight(0xd9e0de,0x3b3028,.75));
  const key=new T.PointLight(0xf1e2c7,19,14,2);key.position.set(-2.4,2.35,2.2);group.add(key);
  const task=new T.PointLight(0xb7cbd2,9,10,2);task.position.set(3.35,1.8,.5);group.add(task);

  // The wall monitor shows the real software tally; it is not a sensor display.
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 384;
  const screenContext = screenCanvas.getContext('2d'), screenTexture = new T.CanvasTexture(screenCanvas); screenTexture.colorSpace = T.SRGBColorSpace; textures.add(screenTexture);
  const screenMaterial = new T.MeshBasicMaterial({ map: screenTexture, toneMapped: false }); materials.add(screenMaterial);
  box([1.6, 1.28, .14], [-.6, .38, -2.69], graphite);
  box([.16, .95, .16], [-.6, groundY + .48, -2.76], steel);
  mesh(geo(new T.PlaneGeometry(1.42, 1.06)), screenMaterial, [1, 1, 1], [-.6, .38, -2.60]);
  // Fixed opaque pieces share a draw submission. Keep the moving cue/scan and every
  // texture plane independent so their transforms and live monitor remain updateable.
  const moving = new Set([cue, targetRing, scan]);
  const buckets = new Map();
  for (const item of group.children) if (item.isMesh && !moving.has(item) && !item.material.map) {
    if (!buckets.has(item.material)) buckets.set(item.material, []);
    buckets.get(item.material).push(item);
  }
  let authoredMeshes = 0; group.traverse(item => { if (item.isMesh) authoredMeshes++; });
  for (const [finish, pieces] of buckets) {
    if (pieces.length < 2) continue;
    const parts = pieces.map(item => { item.updateMatrix(); return (item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone()).applyMatrix4(item.matrix); });
    const vertices = parts.reduce((count, part) => count + part.attributes.position.count, 0);
    const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3); let offset = 0;
    for (const part of parts) { positions.set(part.attributes.position.array, offset); normals.set(part.attributes.normal.array, offset); offset += part.attributes.position.array.length; part.dispose(); }
    const shape = geo(new T.BufferGeometry()); shape.setAttribute('position', new T.BufferAttribute(positions, 3)); shape.setAttribute('normal', new T.BufferAttribute(normals, 3));
    shape.computeBoundingBox(); shape.computeBoundingSphere(); pieces.forEach(item => group.remove(item));
    const batch = mesh(shape, finish, [1, 1, 1], [0, 0, 0]); batch.name = 'fixed-bay-material-batch';
  }
  let screenKey = '';
  function paintReview(review,target){
    const validCounts=Number.isSafeInteger(review.completed)&&Number.isSafeInteger(review.total)&&review.completed>=0&&review.total>=review.completed;
    const status=({PROVEN:'Nearby evidence',EXTRAPOLATED:'Other conditions',NEVER_TESTED:'No source'})[review.status]||'Awaiting result';
    const rowId=typeof review.rowId==='string'&&review.rowId.trim()?review.rowId:null;
    const key=JSON.stringify(['review',review.material,review.concern,status,validCounts?review.completed:null,validCounts?review.total:null,rowId,review.running===true]);
    if(key===screenKey)return;screenKey=key;
    const c=screenContext;c.fillStyle='#101c22';c.fillRect(0,0,512,384);
    c.fillStyle='#b8cad0';c.font='500 25px sans-serif';c.fillText(target?.tag||'MATERIAL EVIDENCE',28,49);
    c.fillStyle='#e8e3d6';c.font='500 34px sans-serif';c.fillText(status,28,122);
    c.font='26px sans-serif';c.fillText(validCounts?`${review.completed} / ${review.total} checks reviewed`:'Review count unavailable',28,181);
    c.font='24px sans-serif';c.fillText(`${typeof review.material==='string'?review.material:'Unknown material'} / ${typeof review.concern==='string'?review.concern:'unavailable'}`,28,234);
    c.font='22px sans-serif';c.fillText(rowId?`Source row: ${rowId}`:'No source row linked',28,284,456);
    c.fillStyle='#d4b17b';c.font='23px sans-serif';c.fillText(review.running===true?'Evidence review running':status==='Awaiting result'?'Record unavailable':'Showing computed record',28,352);screenTexture.needsUpdate=true;
  }
  function paintMonitor(phase, counts, mission) {
    const show = ['evidence', 'review', 'inspect', 'return', 'complete'].includes(phase);
    const key = JSON.stringify([phase, counts, mission?.question, mission?.nearest_source?.id]); if (key === screenKey) return; screenKey = key;
    const c = screenContext; c.fillStyle = '#101c22'; c.fillRect(0, 0, 512, 384);
    c.fillStyle = '#b8cad0'; c.font = '500 27px sans-serif'; c.fillText('HAB-PMMA-01 / EVIDENCE', 28, 49);
    c.fillStyle = '#e8e3d6';
    if (!show) { c.font = '32px sans-serif'; c.fillText('Awaiting evidence', 28, 179); }
    else if (mission) {
      c.font='500 34px sans-serif';c.fillText(({PROVEN:'Nearby evidence',EXTRAPOLATED:'Other conditions',NEVER_TESTED:'No source'})[mission.question?.status]||'Unavailable',28,122);
      c.font='25px sans-serif';c.fillText(`${mission.question?.nearby_row_ids?.length??0} nearby source rows`,28,182);
      c.font='22px sans-serif';c.fillText(`Nearest: ${mission.nearest_source?.id||'unavailable'}`,28,238);
      c.fillStyle='#d4b17b';c.font='26px sans-serif';c.fillText(phase==='complete'?'VISUAL PASS LOGGED':'HUMAN REVIEW',28,298);
    } else for (const [i, [key, label]] of [['PROVEN', 'nearby'], ['EXTRAPOLATED', 'other / incomplete'], ['NEVER_TESTED', 'no source']].entries()) {
      c.font = '500 48px sans-serif'; c.fillText(String(counts?.[key] ?? '—'), 28, 122 + i * 77);
      c.font = '25px sans-serif'; c.fillText(label, 125, 117 + i * 77);
    }
    c.fillStyle = '#9cb1b8'; c.font = '23px sans-serif'; c.fillText(mission?'Crew review still required':'material–concern questions', 28, 352); screenTexture.needsUpdate = true;
  }
  const sensorPoint = new T.Vector3(), sweepPoint = new T.Vector3();
  function update({ phase, elapsed = 0, still = false, counts, mission = null, approved = false, sensor = null, scanAt = 4.15, review = null } = {}) {
    if(review&&typeof review==='object'){
      const selected=typeof review.material==='string'&&Object.hasOwn(workTargets,review.material)?workTargets[review.material]:null;paintReview(review,selected);
      targetRing.visible=Boolean(selected);if(selected)targetRing.position.fromArray(selected.point);
      targetRing.scale.setScalar(1);ringMaterial.emissiveIntensity=.55;cueMaterial.emissiveIntensity=.12;
      // Motion points to an already computed record. No laser, sensor sweep or fake work progress.
      scan.visible=beam.visible=route.visible=false;
      group.userData.phase=phase;group.userData.scanning=false;group.userData.sensorData=false;
      group.userData.reviewMaterial=selected?review.material:null;group.userData.dataWorkRunning=review.running===true;
      return;
    }
    delete group.userData.reviewMaterial;delete group.userData.dataWorkRunning;
    targetRing.position.set(2.65,.28,-1.035);
    paintMonitor(phase, counts, mission);
    const visible = phase !== 'ready'; targetRing.visible = visible;
    const pulse = still ? 1 : .5 + .5 * Math.sin(elapsed * 3.2);
    const highlighting = phase === 'observe';
    targetRing.scale.setScalar(highlighting ? 1 + .18 * pulse : 1);
    cueMaterial.emissiveIntensity = highlighting ? .5 + .5 * pulse : .25;
    ringMaterial.emissiveIntensity = phase === 'review' ? .9 : .5;
    route.visible = ['review', 'inspect', 'return'].includes(phase);
    routeMaterial.opacity = phase === 'review' ? .6 : .22;
    const scanning = phase === 'inspect' && approved && (still || elapsed >= scanAt);
    scan.visible = scanning; beam.visible = scanning && Boolean(sensor);
    if (scanning) {
      scan.position.y = cuePosition.y + (still ? .06 : Math.sin((elapsed - scanAt) * 1.6) * .34);
      if (sensor) {
        group.updateWorldMatrix(true, false); sensor.updateWorldMatrix(true, false);
        group.worldToLocal(sensor.getWorldPosition(sensorPoint)); sweepPoint.copy(scan.position);
        const points = beamGeometry.attributes.position;
        points.setXYZ(0, sensorPoint.x, sensorPoint.y, sensorPoint.z); points.setXYZ(1, sweepPoint.x, sweepPoint.y, sweepPoint.z); points.needsUpdate = true;
        beamGeometry.computeBoundingSphere();
      }
    }
    group.userData.phase = phase; group.userData.scanning = scanning;
    group.userData.sensorData = false;
  }
  let meshes = 0, triangles = 0, lights = 0;
  group.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.attributes.position.count) / 3; } if (item.isLight) lights++; });
  const stats = Object.freeze({ meshes, authoredMeshes, triangles, lights, shadowMaps: 0, textures: textures.size, externalAssets: 0 });
  group.userData.budget = stats;
  return { group, stats, cuePosition, workTargets, update, dispose() { group.removeFromParent(); geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); } };
}
