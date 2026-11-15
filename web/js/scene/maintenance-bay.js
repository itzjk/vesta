// A bounded, procedural set for the software inspection concept. No external assets,
// shadow maps, telemetry feeds or physical sensor model are used here.
export function createMaintenanceBay({ THREE: T, groundY = -1.43 } = {}) {
  const group = new T.Group(); group.name = 'spacecraft-maintenance-bay';
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

  // Raised, segmented deck and service-wall structure give the room a human scale.
  // The subfloor is recessed: coplanar deck/base faces caused distant z-fighting.
  box([9.4, .16, 6.2], [0, groundY - .13, -.25], graphite);
  for (const x of [-2.3, 2.3]) for (const z of [-1.8, 1.2]) box([4.5, .025, 2.95], [x, groundY - .0125, z], deck);
  for (const z of [.55, .95, 1.35]) box([1.3, .006, .10], [-2, groundY + .003, z], recess);
  box([9.4, 4.65, .22], [0, .88, -3.3], graphite);
  for (const x of [-3.55, -1.25, 1.05, 3.35]) {
    box([2.08, 2.8, .10], [x, .35, -3.12], ceramic);
    box([2.08, .7, .15], [x, 2.15, -3.08], panel);
    box([.075, 4.5, .28], [x - 1.13, .85, -2.98], steel);
    for (const y of [-.7, 1.38]) box([1.8, .025, .04], [x, y, -3.045], graphite);
  }
  for (const x of [-4.63, 4.63]) {
    box([.18, 4.6, 5.9], [x, .85, -.25], panel);
    box([.28, .16, 5.7], [x, 2.96, -.25], steel);
    box([.30, .20, 5.7], [x, groundY + .17, -.25], graphite);
  }
  for (const z of [-2.8, .2, 2.5]) box([9.2, .14, .20], [0, 2.95, z], steel);
  for (const x of [-2.7, .7]) {
    box([2.1, .14, .40], [x, 2.76, -.35], graphite);
    box([1.85, .025, .28], [x, 2.67, -.35], warm);
  }
  // Fixed practical lights, without expensive real-time shadow maps.
  group.add(new T.HemisphereLight(0xd9e0de, 0x3b3028, .65));
  const key = new T.PointLight(0xf1e2c7, 17, 13, 2); key.position.set(-2.4, 2.35, 2.2); group.add(key);
  const task = new T.PointLight(0xb7cbd2, 8, 8, 2); task.position.set(3.35, 1.8, .5); group.add(task);

  // Handrails and protected cable conduits are geometry, not wall illustrations.
  pipe([-3.9, -.28, -2.84], [-3.9, .95, -2.84], .055, copper);
  pipe([-.3, -.28, -2.84], [-.3, .95, -2.84], .055, copper);
  for (const x of [-3.9, -.3]) for (const y of [-.28, .95]) pipe([x, y, -3.04], [x, y, -2.84], .055, copper);
  for (const y of [1.92, 2.10]) {
    pipe([-4.1, y, -2.82], [1.55, y, -2.82], .045, graphite);
    pipe([1.55, y, -2.82], [1.55, y, -1.76], .045, graphite);
    pipe([1.55, y, -1.76], [2.65, y, -1.76], .045, graphite);
    for (const x of [-3.2, -1.6, 0]) box([.065, .16, .10], [x, y, -2.80], steel);
  }

  // Dock and a supported maintenance cabinet share the robot's actual choreography coordinates.
  cylinder(.85, .08, [-2, groundY - .038, 1], graphite);
  const dockRing = mesh(geo(new T.TorusGeometry(.76, .018, 8, 48)), blue, [1, 1, 1], [-2, groundY + .012, 1]); dockRing.rotation.x = -Math.PI / 2;
  for (const x of [-2.6, -1.4]) box([.13, 2.40, .20], [x, groundY + 1.2, .35], graphite);
  box([1.35, .17, .24], [-2, groundY + 2.38, .35], ceramic);
  for (const x of [-2.55, -1.45]) box([.17, .018, .42], [x, groundY + .005, .92], copper);
  decal('DOCK 01', 1.05, .26, [-2, groundY + 2.39, .49]);
  box([1.86, 2.72, 1.1], [2.65, -.05, -1.8], graphite);
  box([1.68, 2.52, .07], [2.65, -.05, -1.205], ceramic);
  for (const x of [1.87, 3.43]) box([.075, 2.5, .10], [x, -.05, -1.15], steel);
  for (const y of [-.98, -.85, -.72]) box([1.25, .06, .025], [2.65, y, -1.15], recess);
  box([1.3, .83, .065], [2.65, .28, -1.14], panel);
  for (const x of [2.12, 3.18]) for (const y of [-.03, .59]) sphere(.028, [x, y, -1.08], steel);
  box([.1, .45, .13], [3.35, .33, -1.06], copper);
  decal('SERVICE 02', 1.25, .25, [2.65, 1.10, -1.14]);
  const cuePosition = new T.Vector3(2.65, .28, -1.12);
  const cue = sphere(.065, cuePosition.toArray(), cueMaterial); cue.name = 'scripted-equipment-cue';
  const targetRing = mesh(geo(new T.TorusGeometry(.23, .018, 8, 40)), ringMaterial, [1, 1, 1], [2.65, .28, -1.06]);
  targetRing.visible = false;
  const scan = box([.60, .012, .012], [2.65, .28, -1.045], blue); scan.visible = false;
  const beamGeometry = geo(new T.BufferGeometry()); beamGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
  const beamMaterial = new T.LineBasicMaterial({ color: 0xa7c7ce, transparent: true, opacity: .45, depthWrite: false }); materials.add(beamMaterial);
  const beam = new T.Line(beamGeometry, beamMaterial); group.add(beam); beam.visible = false;
  const routeGeometry = geo(new T.BufferGeometry().setFromPoints([new T.Vector3(-2, groundY + .09, 1), new T.Vector3(1.65, groundY + .09, -.05)]));
  const routeMaterial = new T.LineDashedMaterial({ color: 0xc5a270, dashSize: .18, gapSize: .12, transparent: true, opacity: .6 }); materials.add(routeMaterial);
  const route = new T.Line(routeGeometry, routeMaterial); route.computeLineDistances(); group.add(route); route.visible = false;

  // The wall monitor shows the real software tally; it is not a sensor display.
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 384;
  const screenContext = screenCanvas.getContext('2d'), screenTexture = new T.CanvasTexture(screenCanvas); screenTexture.colorSpace = T.SRGBColorSpace; textures.add(screenTexture);
  const screenMaterial = new T.MeshBasicMaterial({ map: screenTexture, toneMapped: false }); materials.add(screenMaterial);
  box([1.6, 1.28, .14], [-.6, .38, -2.89], graphite);
  mesh(geo(new T.PlaneGeometry(1.42, 1.06)), screenMaterial, [1, 1, 1], [-.6, .38, -2.80]);
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
  function paintMonitor(phase, counts) {
    const show = ['evidence', 'review', 'inspect', 'return', 'complete'].includes(phase);
    const key = JSON.stringify([show, counts]); if (key === screenKey) return; screenKey = key;
    const c = screenContext; c.fillStyle = '#101c22'; c.fillRect(0, 0, 512, 384);
    c.fillStyle = '#b8cad0'; c.font = '500 27px sans-serif'; c.fillText('VESTA COLLECTION', 28, 49);
    c.fillStyle = '#e8e3d6';
    if (!show) { c.font = '32px sans-serif'; c.fillText('Awaiting evidence', 28, 179); }
    else for (const [i, [key, label]] of [['PROVEN', 'nearby'], ['EXTRAPOLATED', 'other / incomplete'], ['NEVER_TESTED', 'no source']].entries()) {
      c.font = '500 48px sans-serif'; c.fillText(String(counts?.[key] ?? '—'), 28, 122 + i * 77);
      c.font = '25px sans-serif'; c.fillText(label, 125, 117 + i * 77);
    }
    c.fillStyle = '#9cb1b8'; c.font = '23px sans-serif'; c.fillText('material–concern questions', 28, 352); screenTexture.needsUpdate = true;
  }
  const sensorPoint = new T.Vector3(), sweepPoint = new T.Vector3();
  function update({ phase, elapsed = 0, still = false, counts, approved = false, sensor = null, scanAt = 4.15 } = {}) {
    paintMonitor(phase, counts);
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
      scan.position.y = cuePosition.y + (still ? .06 : Math.sin((elapsed - scanAt) * 2.2) * .23);
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
  return { group, stats, cuePosition, update, dispose() { group.removeFromParent(); geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); } };
}
