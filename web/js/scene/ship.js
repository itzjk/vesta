const TAU = Math.PI * 2;
const hash = n => { const s = Math.sin(n * 127.1 + 61.7) * 43758.5453; return s - Math.floor(s); };

function blanketMap(THREE, low) {
  const size = low ? 256 : 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size);
  const folds = Array.from({ length: 64 }, (_, i) => {
    const a = hash(i * 8 + 2) * TAU;
    return { x: hash(i * 8) * size, y: hash(i * 8 + 1) * size, cosine: Math.cos(a), sine: Math.sin(a), length: 15 + hash(i * 8 + 3) * size * .3, width: 1 + hash(i * 8 + 4) * 3, strength: (hash(i * 8 + 5) - .5) * 130 };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 128 + (hash(x + y * size) - .5) * 13;
    for (const fold of folds) {
      const dx = x - fold.x, dy = y - fold.y, u = dx * fold.cosine + dy * fold.sine, v = -dx * fold.sine + dy * fold.cosine;
      value += fold.strength * Math.exp(-v * v / (fold.width * fold.width) - u * u / (fold.length * fold.length));
    }
    const p = (y * size + x) * 4;
    image.data[p] = image.data[p + 1] = image.data[p + 2] = value; image.data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(7, 2); texture.anisotropy = low ? 2 : 8;
  return texture;
}

function solarMap(THREE) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#56534a'; ctx.fillRect(0, 0, 1024, 512);
  for (let col = 0; col < 24; col++) for (let row = 0; row < 8; row++) {
    const x = col * 42.66 + 2, y = row * 64 + 2, shade = hash(col + row * 24);
    ctx.fillStyle = `rgb(${12 + shade * 9},${19 + shade * 10},${30 + shade * 13})`; ctx.fillRect(x, y, 38.5, 59);
    ctx.fillStyle = '#879599'; ctx.fillRect(x + 18, y, .9, 59);
    ctx.fillStyle = 'rgba(158,174,179,.35)';
    for (let k = 1; k < 12; k++) ctx.fillRect(x, y + k * 5, 38, .5);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

function foilShell(THREE, r0, r1, z0, z1, low, phase) {
  const nx = low ? 64 : 128, ny = low ? 16 : 40, positions = [], uvs = [], colors = [], indices = [];
  const folds = Array.from({ length: 22 }, (_, i) => [hash(i * 7 + phase) * TAU, hash(i * 7 + 1 + phase), .06 + hash(i * 7 + 2 + phase) * .24, (hash(i * 7 + 3 + phase) - .5) * .045]);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, a = u * TAU;
    let relief = .003 * Math.sin(a * 39 + v * 71 + phase) * Math.sin(a * 23 - v * 49);
    for (const [center, along, slope, height] of folds) {
      const d = Math.atan2(Math.sin(a - center - (v - along) * slope), Math.cos(a - center - (v - along) * slope));
      relief += height * Math.exp(-d * d / .0018 - (v - along) * (v - along) / .08);
    }
    relief *= Math.sin(Math.PI * v) ** .35;
    const r = r0 + (r1 - r0) * v + relief;
    positions.push(Math.cos(a) * r, Math.sin(a) * r, z0 + (z1 - z0) * v); uvs.push(u, v);
    const panel = Math.floor(u * 8), band = Math.floor(v * 4), shade = .83 + hash(panel * 13 + band * 7 + phase) * .17;
    colors.push(shade, shade, shade);
    if (i < nx && j < ny) { const k = j * (nx + 1) + i; indices.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function buildShip({ THREE, mode = 'high' }) {
  const low = mode === 'low', group = new THREE.Group(); group.name = 'vesta-exterior';
  const bump = blanketMap(THREE, low), cellMap = solarMap(THREE), batches = new Map();
  const physical = props => new THREE.MeshPhysicalMaterial({ envMapIntensity: 0, ...props });
  const silver = physical({ color: 0xc8cbc9, metalness: .63, roughness: .64, roughnessMap: bump, bumpMap: bump, bumpScale: .028, vertexColors: true });
  const gold = physical({ color: 0xa88b42, metalness: .82, roughness: .6, roughnessMap: bump, bumpMap: bump, bumpScale: .038, vertexColors: true });
  const titanium = physical({ color: 0x9a9f9e, metalness: .78, roughness: .3 });
  const ceramic = physical({ color: 0xb9bcba, metalness: .14, roughness: .66 });
  const dark = physical({ color: 0x24262a, metalness: .48, roughness: .48 });
  const gasket = physical({ color: 0x101113, metalness: .02, roughness: .84 });
  const copper = physical({ color: 0x564637, metalness: .62, roughness: .4 });
  const solar = physical({ map: cellMap, color: 0xc3c8d0, metalness: .42, roughness: .24, clearcoat: 1, clearcoatRoughness: .13 });
  const warm = new THREE.MeshStandardMaterial({ color: 0x332b20, emissive: 0xffc273, emissiveIntensity: .65, roughness: .38, envMapIntensity: 0 });
  const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, low ? 6 : 8), boxGeometry = new THREE.BoxGeometry(1, 1, 1), boltGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  function add(geometry, material, name, parent = group) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function instance(key, geometry, material, position, scale, quaternion) {
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [] });
    dummy.position.set(...position); dummy.scale.set(...scale); dummy.quaternion.identity(); if (quaternion) dummy.quaternion.copy(quaternion); dummy.updateMatrix(); batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function box(key, material, position, scale, quaternion) { instance(key, boxGeometry, material, position, scale, quaternion); }
  function localBox(key, material, parent, position, scale) {
    const p = new THREE.Vector3(...position).applyQuaternion(parent.quaternion).add(parent.position);
    box(key, material, p.toArray(), scale, parent.quaternion);
  }
  function rod(a, b, radius = .022, material = titanium, key = 'structure') {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av), mid = av.clone().add(bv).multiplyScalar(.5);
    instance(key, rodGeometry, material, mid.toArray(), [radius, delta.length(), radius], new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()));
  }
  function cylinder(r0, r1, length, z, material, name, open = false) {
    const mesh = add(new THREE.CylinderGeometry(r1, r0, length, low ? 48 : 80, 1, open), material, name); mesh.rotation.x = Math.PI / 2; mesh.position.z = z; return mesh;
  }
  function ring(radius, thickness, z, material, name) { const mesh = add(new THREE.TorusGeometry(radius, thickness, low ? 6 : 8, low ? 48 : 80), material, name); mesh.position.z = z; return mesh; }
  function annulus(inner, outer, z, material, name) { const mesh = add(new THREE.RingGeometry(inner, outer, low ? 48 : 80), material, name); mesh.position.z = z; return mesh; }
  function cable(points, radius = .018, material = gasket) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, low ? 20 : 40, radius, 6, false), material, 'external-harness');
  }
  add(foilShell(THREE, 1.25, 1.25, -1.55, 1.53, low, 17), silver, 'silver-multilayer-insulation');
  add(foilShell(THREE, 1.25, .81, 1.53, 1.9, low, 73), silver, 'forward-pressure-shoulder');
  cylinder(1.23, 1.23, .06, -1.57, dark, 'aft-bulkhead');
  for (const z of [-1.52, -.76, .02, .8, 1.52]) cylinder(1.262, 1.262, .025, z, titanium, 'blanket-edge-tape', true);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + .12, x = Math.cos(a), y = Math.sin(a);
    rod([x * 1.263, y * 1.263, -1.52], [x * 1.263, y * 1.263, 1.5], .009, copper, 'blanket-longitudinal-tape');
  }
  cylinder(.81, .81, .28, 1.91, titanium, 'docking-barrel', true);
  cylinder(.635, .635, .23, 1.94, gasket, 'viewport-recess', true);
  annulus(.63, .82, 2.065, titanium, 'docking-machined-face');
  annulus(.60, .645, 2.071, gasket, 'pressure-seal');
  ring(.813, .016, 2.06, titanium, 'docking-outer-lip');
  ring(.653, .013, 2.079, copper, 'viewport-inner-lip');
  const boltRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  for (let i = 0; i < 24; i++) {
    const a = i * TAU / 24;
    instance('docking-fasteners', boltGeometry, titanium, [Math.cos(a) * .738, Math.sin(a) * .738, 2.087], [.022, .025, .022], boltRotation);
    if (i % 4 === 0) box('docking-latches', dark, [Math.cos(a) * .88, Math.sin(a) * .88, 1.96], [.10, .10, .15]);
  }
  const glass = physical({ color: 0x18221f, metalness: .2, roughness: .08, transparent: true, opacity: .32, clearcoat: 1, depthWrite: false });
  add(new THREE.CircleGeometry(.599, low ? 48 : 80), glass, 'viewport-glass').position.z = 2.025;
  cylinder(.598, .598, .92, 1.52, dark, 'viewport-inner-liner', true).material.side = THREE.DoubleSide;
  cylinder(.6, .6, .03, .98, gasket, 'cabin-dark-bulkhead');
  for (const x of [-.36, .36]) box('cabin-fixtures', warm, [x, .3, 1.08], [.028, .26, .025]);
  box('cabin-seat-shadow', dark, [.07, -.16, 1.1], [.23, .36, .18]);
  for (const a of [.53, 2.3, 4.2]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2));
    const x = Math.cos(a), y = Math.sin(a);
    box('window-surround', dark, [x * 1.264, y * 1.264, .84], [.28, .035, .15], q);
    box('warm-scale-windows', warm, [x * 1.287, y * 1.287, .84], [.19, .012, .075], q);
  }
  for (const a of [.9, 2.6, 4.0]) {
    const n = [Math.cos(a), Math.sin(a)];
    for (const z of [.6, 1.17]) {
      const p0 = [n[0] * 1.26, n[1] * 1.26, z - .17], p1 = [n[0] * 1.36, n[1] * 1.36, z - .17], p2 = [n[0] * 1.36, n[1] * 1.36, z + .17], p3 = [n[0] * 1.26, n[1] * 1.26, z + .17];
      rod(p0, p1, .018); rod(p1, p2, .018); rod(p2, p3, .018);
      box('rail-footplates', titanium, p0, [.065, .065, .06]); box('rail-footplates', titanium, p3, [.065, .065, .06]);
    }
  }
  for (const side of [-1, 1]) {
    cable([[side * .95, -.85, 1.54], [side * 1.1, -.69, 1.25], [side * 1.14, -.61, .5], [side * 1.14, -.61, -1.3], [side * .9, -.6, -1.7]], .024);
    cable([[side * 1.02, -.76, 1.51], [side * 1.16, -.57, 1.2], [side * 1.18, -.52, -.8], [side * .84, -.52, -1.72]], .009, copper);
  }
  cylinder(.28, .28, 3.05, -3.03, dark, 'service-spine');
  for (let j = 0; j < 4; j++) {
    const z = -1.68 - j * .72;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6, b = (i + 1) * TAU / 6;
      const p = t => [Math.cos(t) * .99, Math.sin(t) * .99];
      rod([...p(a), z], [...p(b), z], .018);
      rod([...p(a), z], [...p(a), z - .72], .024);
      rod([...p(a), z], [...p(b), z - .72], .016);
    }
  }
  for (const z of [-2.1, -3.05, -3.8]) box('service-avionics', dark, [.15, -.04, z], [.8, .72, .42]);
  add(foilShell(THREE, .93, .93, -5.59, -4.0, low, 119), gold, 'aft-gold-thermal-blanket');
  cylinder(.95, .95, .075, -4.04, titanium, 'service-forward-collar');
  cylinder(.94, .94, .06, -5.57, titanium, 'service-aft-collar');
  cylinder(.58, .33, .75, -6.01, dark, 'engine-bell', true);
  ring(.58, .018, -6.385, titanium, 'nozzle-lip');
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    rod([Math.cos(a) * .36, Math.sin(a) * .36, -5.66], [Math.cos(a) * .565, Math.sin(a) * .565, -6.36], .01, dark, 'nozzle-cooling-lines');
  }
  for (const side of [-1, 1]) {
    rod([side * .3, 0, -2.5], [side * 4.9, 0, -2.5], .06, titanium, 'array-spars');
    const wing = new THREE.Group(); wing.name = 'solar-array'; wing.position.set(side * 3, .04, -2.5); wing.rotation.x = .29; group.add(wing);
    localBox('photovoltaic-cells', solar, wing, [0, 0, 0], [3.8, .025, 1.5]);
    for (const z of [-.758, .758]) {
      localBox('array-frame', titanium, wing, [0, -.005, z], [3.84, .045, .025]);
    }
    for (const x of [-1.91, -.64, .64, 1.91]) localBox('array-frame', titanium, wing, [x, -.006, 0], [.024, .04, 1.5]);
    const radiator = new THREE.Group(); radiator.name = 'radiator'; radiator.position.set(side * .73, 1.02, -3.01); radiator.rotation.z = side * -.28; group.add(radiator);
    localBox('radiator-faces', ceramic, radiator, [0, 0, 0], [.64, .035, 2.1]);
    for (let j = 0; j < 10; j++) {
      localBox('radiator-heat-pipes', titanium, radiator, [-.28 + j * .062, .022, 0], [.009, .008, 2.02]);
    }
    rod([side * .9, .4, -3.85], [side * .73, 1.02, -3.85], .025);
    rod([side * .9, .4, -2.16], [side * .73, 1.02, -2.16], .025);
    cable([[side * .8, .35, -4.2], [side * 1.02, .25, -3.8], [side * 1.12, .06, -2.5], [side * 1.45, .04, -2.5]], .018);
  }
  const antenna = new THREE.Group(); antenna.name = 'high-gain-antenna'; antenna.position.set(.42, 1.2, -4.65); antenna.rotation.set(.42, .1, -.25); group.add(antenna);
  const dishGeometry = new THREE.SphereGeometry(.43, low ? 24 : 40, 12, 0, TAU, 0, .85);
  dishGeometry.scale(1, .45, 1);
  add(dishGeometry, ceramic, 'antenna-reflector', antenna).material.side = THREE.DoubleSide;
  for (const a of [0, TAU / 3, TAU * 2 / 3]) {
    const av = new THREE.Vector3(Math.cos(a) * .29, .13, Math.sin(a) * .29), bv = new THREE.Vector3(0, .5, 0), d = bv.clone().sub(av);
    const support = add(new THREE.CylinderGeometry(.008, .008, d.length(), 6), titanium, 'antenna-feed-support', antenna); support.position.copy(av).add(bv).multiplyScalar(.5); support.quaternion.setFromUnitVectors(up, d.normalize());
  }
  const feed = add(new THREE.CylinderGeometry(.04, .03, .1, 12), dark, 'antenna-feed', antenna); feed.position.y = .48;
  rod([.42, .45, -4.65], [.42, 1.22, -4.65], .055);
  for (const side of [-1, 1]) for (const z of [-4.45, -5.25]) {
    box('attitude-thruster-blocks', dark, [side * .91, -.18, z], [.17, .24, .25]);
    rod([side * .96, -.18, z], [side * 1.13, -.18, z], .052, dark, 'attitude-nozzles');
  }
  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length); mesh.name = name;
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.castShadow = true; mesh.receiveShadow = name !== 'photovoltaic-cells'; mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  return { group, update(t) { antenna.rotation.y = .1 + Math.sin((Number.isFinite(t) ? t : 0) * .012) * .025; } };
}
