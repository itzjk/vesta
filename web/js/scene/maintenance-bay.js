import { nasaTexture, NASA_TEXTURES } from './imagery.js';

// A bounded procedural interior with an existing, credited NASA Earth photograph. No
// shadow maps, telemetry feeds or physical sensor model are used here. Surface labels are
// drawn by this file; every status shown on the console is supplied by the caller.
const KIT_MATERIALS = ['pmma', 'kapton', 'silicone'];
const KIT_INK = { pmma: '#7fb6c8', kapton: '#d9a13f', silicone: '#d8765e' };
const STATUS_TEXT = { PROVEN: 'Nearby evidence', EXTRAPOLATED: 'Other conditions', NEVER_TESTED: 'No source' };

export function createMaintenanceBay({ THREE: T, groundY = -1.43 } = {}) {
  const group = new T.Group(); group.name = 'lunar-crew-support-habitat';
  let disposed = false;
  const g = groundY, HALF_PI = Math.PI / 2, RIB = 1.55;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const geo = value => { geometries.add(value); return value; };
  const keep = value => { materials.add(value); return value; };
  const mat = (color, options = {}) => keep(new T.MeshStandardMaterial({ color, roughness: .72, metalness: .22, ...options }));
  function drawn(width, height, paint, repeat = false) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); paint(context, width, height);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
    if (repeat) texture.wrapS = texture.wrapT = T.RepeatWrapping;
    textures.add(texture); return { texture, context };
  }

  // Wall panels, deck plates, equipment labels and terrain marks are original
  // drawings. The separately loaded Earth disc uses the credited archival photo.
  const wallSkin = drawn(256, 256, (c, w, h) => {
    c.fillStyle = '#a5a295'; c.fillRect(0, 0, w, h);
    const shade = c.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, '#ffffff2e'); shade.addColorStop(.55, '#ffffff00'); shade.addColorStop(1, '#00000036');
    c.fillStyle = shade; c.fillRect(0, 0, w, h);
    c.fillStyle = '#55544d'; c.fillRect(0, 0, w, 6); c.fillRect(0, 0, 6, h);
    c.fillStyle = '#ffffff33'; c.fillRect(6, 6, w - 6, 2); c.fillRect(6, 6, 2, h - 6);
    c.fillStyle = '#4b4a44'; for (const [x, y] of [[24, 24], [w - 16, 24], [24, h - 16], [w - 16, h - 16]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    c.fillStyle = '#7f7d72'; c.fillRect(w * .5 - 36, h - 42, 72, 12);
  }, true).texture;
  const deckSkin = drawn(256, 256, (c, w, h) => {
    c.fillStyle = '#3b464a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2b3438'; for (let row = 0, y = 14; y < h; y += 22, row++) for (let x = 10 + (row % 2) * 11; x < w; x += 22) c.fillRect(x, y, 8, 3);
    c.fillStyle = '#1a2226'; c.fillRect(0, 0, w, 5); c.fillRect(0, 0, 5, h);
    c.fillStyle = '#ffffff1c'; c.fillRect(5, 5, w - 5, 2); c.fillRect(5, 5, 2, h - 5);
  }, true).texture;
  const A = 1024, P = {
    bench: [0, 0, 416, 368], benchTop: [0, 368, 416, 160], console: [0, 528, 416, 272],
    kitPmma: [416, 0, 256, 210], kitKapton: [416, 210, 256, 210], kitSilicone: [416, 420, 256, 210], kitTop: [416, 630, 256, 170],
    locker: [672, 0, 256, 512], skin: [936, 8, 80, 80], light: [936, 104, 80, 80],
    deck: [672, 512, 352, 114], bag: [912, 800, 112, 112],
    tagPmma: [0, 912, 264, 56], tagKapton: [264, 912, 264, 56], tagSilicone: [0, 968, 264, 56], tagDock: [264, 968, 264, 56], tagAirlock: [528, 992, 264, 32]
  };
  const kitRegion = id => `kit${id[0].toUpperCase()}${id.slice(1)}`;
  const atlasSkin = drawn(A, A, c => {
    const rect = (x, y, w, h, fill) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
    const text = (value, x, y, size, fill = '#e9e1cd', align = 'left', weight = 600) => { c.fillStyle = fill; c.font = `${weight} ${size}px sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(value, x, y); };
    const door = (x, y, w, h, fill = '#35434a') => { rect(x, y, w, h, '#12191d'); rect(x + 3, y + 3, w - 6, h - 6, fill); rect(x + 3, y + 3, w - 6, 3, '#ffffff26'); rect(x + 3, y + h - 8, w - 6, 5, '#00000045'); };
    const pull = (x, y, w) => { rect(x, y, w, 8, '#0c1215'); rect(x, y, w, 2, '#b6c1c2'); };
    const lamp = (x, y, fill, r = 5) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    rect(0, 0, A, A, '#2a353b');
    { // Kit staging bench, the face towards the room: its sign and one bay per material.
      const [x, y, w, h] = P.bench; rect(x, y, w, h, '#1f292e'); rect(x, y, w, 76, '#11181c');
      text('MATERIAL REVIEW KITS', x + w / 2, y + 30, 30, '#ece4cf', 'center'); text('one kit per material question', x + w / 2, y + 58, 16, '#9db0b4', 'center', 400);
      for (const [i, id] of KIT_MATERIALS.entries()) {
        const cx = x + 80 + i * 128; rect(cx - 56, y + 88, 112, 40, '#11181c'); rect(cx - 56, y + 88, 10, 40, KIT_INK[id]); text(id.toUpperCase(), cx + 4, y + 109, id.length > 6 ? 19 : 22, '#e9e1cd', 'center');
        door(cx - 58, y + 138, 116, 150); pull(cx - 30, y + 158, 60); rect(cx - 40, y + 214, 46, 26, '#c9c2b0'); lamp(cx + 34, y + 228, '#86d3ad', 4);
      }
      rect(x + 10, y + 298, w - 20, 60, '#161e22'); for (let i = 0; i < 4; i++) rect(x + 24, y + 310 + i * 11, w - 48, 5, '#0a0f12');
    }
    { // Bench top: one recessed cradle per kit.
      const [x, y, w, h] = P.benchTop; rect(x, y, w, h, '#b6b2a4'); rect(x, y, w, 4, '#ffffff40'); rect(x, y + h - 6, w, 6, '#00000030');
      for (let i = 0; i < 3; i++) { const cx = x + 80 + i * 128; rect(cx - 57, y + 34, 114, 92, '#8f8b7e'); rect(cx - 52, y + 39, 104, 82, '#2a343a'); }
    }
    { // Crew-review console, the face towards the room.
      const [x, y, w] = P.console; rect(x, y, w, 272, '#1f292e'); rect(x, y, w, 58, '#11181c'); text('CREW REVIEW STATION', x + w / 2, y + 30, 29, '#ece4cf', 'center');
      door(x + 10, y + 68, 194, 150); door(x + 212, y + 68, 194, 150); pull(x + 72, y + 90, 70); pull(x + 274, y + 90, 70); rect(x + 28, y + 150, 80, 34, '#c9c2b0'); rect(x + 230, y + 150, 80, 34, '#c9c2b0');
      rect(x + 10, y + 228, w - 20, 34, '#11181c'); for (let i = 0; i < 14; i++) rect(x + 24 + i * 27, y + 238, 14, 14, '#0a0f12');
    }
    for (const id of KIT_MATERIALS) {
      const [x, y, w, h] = P[kitRegion(id)]; rect(x, y, w, h, '#d9d4c5'); rect(x, y, w, 46, KIT_INK[id]); rect(x, y + 46, w, 3, '#00000030'); rect(x, y + h - 16, w, 16, '#8f8b7e');
      text(id.toUpperCase(), x + w / 2, y + 104, id.length > 6 ? 42 : 52, '#182024', 'center', 700); text('REVIEW KIT', x + w / 2, y + 160, 24, '#4a4f4c', 'center');
    }
    { const [x, y, w, h] = P.kitTop; rect(x, y, w, h, '#d9d4c5'); rect(x + 14, y + 14, w - 28, h - 28, '#c5c0b1'); rect(x + 30, y + 62, w - 60, 46, '#2a343a'); }
    { // Wall stowage locker.
      const [x, y, w, h] = P.locker; rect(x, y, w, h, '#222d32');
      for (let row = 0; row < 4; row++) {
        const dy = y + 8 + row * 125; door(x + 8, dy, w - 16, 119, row % 2 ? '#39474d' : '#33414a'); pull(x + 88, dy + 20, 80);
        rect(x + 24, dy + 64, 84, 34, '#c9c2b0'); text(`STOW ${'ABCD'[row]}${row + 1}`, x + 66, dy + 82, 16, '#1d262a', 'center'); lamp(x + w - 40, dy + 80, row === 1 ? '#d2a94e' : '#86d3ad', 4);
      }
    }
    { const [x, y, w, h] = P.skin; rect(x - 8, y - 8, w + 16, h + 16, '#263137'); rect(x, y, w, h, '#2c383e'); }
    { const [x, y, w, h] = P.light; rect(x - 8, y - 8, w + 16, h + 16, '#b3b0a3'); }
    { // Console deck: the marked cradle where a kit is staged, and a keyboard under the screen.
      const [x, y, w, h] = P.deck; rect(x, y, w, h, '#b6b2a4'); rect(x, y, w, 3, '#ffffff40'); rect(x, y + h - 5, w, 5, '#00000030');
      rect(x + 150, y + 56, 168, 46, '#2a343a'); for (let row = 0; row < 3; row++) for (let key = 0; key < 12; key++) rect(x + 157 + key * 13, y + 62 + row * 13, 9, 9, '#8d999b');
      const cx = x + 47.5, cy = y + 50; c.strokeStyle = '#b8792e'; c.lineWidth = 4; c.strokeRect(cx - 40, cy - 34, 80, 68); rect(cx - 26, cy - 38, 52, 8, '#b6b2a4'); rect(cx - 26, cy + 30, 52, 8, '#b6b2a4'); text('KIT', cx, cy, 18, '#8a8474', 'center');
    }
    { const [x, y, w, h] = P.bag; rect(x, y, w, h, '#cfcabb'); rect(x, y, w, 5, '#ffffff50'); rect(x + 18, y, 9, h, '#3d6f95'); rect(x + w - 27, y, 9, h, '#3d6f95'); rect(x + 38, y + 40, 36, 26, '#f0ead9'); rect(x + 42, y + 48, 28, 3, '#55606a'); rect(x + 42, y + 56, 20, 3, '#55606a'); }
    for (const [key, value] of [['tagPmma', 'HAB-PMMA-01'], ['tagKapton', 'HAB-KAPTON-02'], ['tagSilicone', 'HAB-SILICONE-03'], ['tagDock', 'ROBOT DOCK'], ['tagAirlock', 'AIRLOCK']]) {
      const [x, y, w, h] = P[key]; rect(x, y, w, h, '#141c20'); rect(x + 3, y + 3, w - 6, h - 6, '#1d282d'); text(value, x + w / 2, y + h / 2 + 1, h > 40 ? 26 : 20, '#e3dcc8', 'center');
    }
  }).texture;
  const moonSkin = drawn(512, 256, (c, w, h) => {
    const sun = c.createLinearGradient(0, 0, 0, h); sun.addColorStop(0, '#b3b2ab'); sun.addColorStop(1, '#8d8c86'); c.fillStyle = sun; c.fillRect(0, 0, w, h);
    let seed = 11; const next = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = next() * w, y = next() * h, r = 4 + next() * 20; c.fillStyle = '#6f6e6a'; c.beginPath(); c.ellipse(x, y, r, r * .42, 0, 0, 7); c.fill();
      c.strokeStyle = '#cfcdc5'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y + 1, r, r * .42, 0, .2, 2.9); c.stroke();
    }
  }).texture;
  const shadeSkin = drawn(64, 64, c => { const fade = c.createRadialGradient(32, 32, 4, 32, 32, 32); fade.addColorStop(0, '#000000b0'); fade.addColorStop(.6, '#00000070'); fade.addColorStop(1, '#00000000'); c.fillStyle = fade; c.fillRect(0, 0, 64, 64); }).texture;


  const unitBox = geo(new T.BoxGeometry(1, 1, 1));
  const unitCylinder = geo(new T.CylinderGeometry(1, 1, 1, 16));
  const graphite = mat(0x1d262a), trim = mat(0x566267, { metalness: .35 });
  const steel = mat(0x8b9697, { metalness: .6, roughness: .46 }), copper = mat(0xa4795c, { metalness: .48 });
  const wall = mat(0xffffff, { map: wallSkin, roughness: .86, metalness: .04 });
  const deck = mat(0xffffff, { map: deckSkin, roughness: .78, metalness: .3 });
  const equipment = mat(0xffffff, { map: atlasSkin, emissive: 0xffffff, emissiveMap: atlasSkin, emissiveIntensity: .2, roughness: .6, metalness: .2 });
  const glow = mat(0xfff3dc, { emissive: 0xffe9c4, emissiveIntensity: 1.0, toneMapped: false });
  const acrylic = mat(0xa9cbd6, { emissive: 0x4d7482, emissiveIntensity: .35, roughness: .12, metalness: .1, transparent: true, opacity: .45 });
  const amber = mat(0xd39a35, { emissive: 0x9a6418, emissiveIntensity: .35, roughness: .5 });
  const gasket = mat(0xb9573f, { roughness: .9, metalness: 0 });
  const regolith = keep(new T.MeshBasicMaterial({ map: moonSkin })), farHills = keep(new T.MeshBasicMaterial({ color: 0xa3a29c })), nearHills = keep(new T.MeshBasicMaterial({ color: 0x77766f }));
  const shade = keep(new T.MeshBasicMaterial({ map: shadeSkin, transparent: true, depthWrite: false }));
  const space = keep(new T.MeshBasicMaterial({ color: 0x020305 }));

  const cueMaterial = mat(0xc69a5c, { emissive: 0xb78243, emissiveIntensity: .3 });
  const ringMaterial = mat(0xd7b478, { emissive: 0xb68d4f, emissiveIntensity: .7 });
  const sweep = mat(0x9bb7c0, { emissive: 0x718f9c, emissiveIntensity: .45 });

  function mesh(shape, finish, size, at, parent = group) {
    const item = new T.Mesh(shape, finish); item.scale.set(...size); item.position.set(...at);
    item.castShadow = item.receiveShadow = false; parent.add(item); return item;
  }
  const box = (size, at, finish = trim, parent = group) => mesh(unitBox, finish, size, at, parent);
  const cylinder = (radius, length, at, finish = steel, parent = group) => mesh(unitCylinder, finish, [radius, length, radius], at, parent);
  const up = new T.Vector3(0, 1, 0), direction = new T.Vector3();
  function pipe(a, b, radius, finish) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    const item = cylinder(radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(.5).toArray(), finish);
    item.quaternion.setFromUnitVectors(up, direction.subVectors(end, start).normalize());
    return item;
  }
  function region(shape, name, from = 0, count = shape.attributes.uv.count) {
    const [x, y, w, h] = P[name], uv = shape.attributes.uv;
    for (let i = from; i < from + count; i++) uv.setXY(i, (x + uv.getX(i) * w) / A, 1 - (y + (1 - uv.getY(i)) * h) / A);
    return shape;
  }
  // A box whose six faces each show one region of the equipment atlas.
  function tbox(size, at, faces = {}, parent = group) {
    const shape = geo(new T.BoxGeometry(...size));
    ['px', 'nx', 'py', 'ny', 'pz', 'nz'].forEach((face, index) => region(shape, faces[face] || faces.all || 'skin', index * 4, 4));
    return mesh(shape, equipment, [1, 1, 1], at, parent);
  }
  function plate(name, width, height, at, turn = 0, flat = false) {
    const item = mesh(region(geo(new T.PlaneGeometry(width, height)), name), equipment, [1, 1, 1], at);
    if (flat) item.rotation.x = -HALF_PI; else item.rotation.y = turn;
    return item;
  }
  const ground = (width, depth, x, z) => { mesh(geo(new T.PlaneGeometry(width, depth)), shade, [1, 1, 1], [x, g + .004, z]).rotation.x = -HALF_PI; };

  // A continuous interior envelope contains every camera pose. The Moon is visible
  // only through the rear viewport; this is a visual set, not a pressure model.
  // Exterior terrain is illustrative geometry; Earth is an archival NASA photo, not a live view or sky-position model.
  const rearZ = -3.82, frontZ = 10.4;
  const vaultPositions = [], vaultUvs = [], vaultIndices = [], vaultSegments = 32;
  for (let i = 0; i <= vaultSegments; i++) {
    const angle = i / vaultSegments * Math.PI, x = 5 * Math.cos(angle), y = g + 4.4 * Math.sin(angle);
    vaultPositions.push(x, y, rearZ, x, y, frontZ); vaultUvs.push(i / vaultSegments * 8, rearZ / RIB, i / vaultSegments * 8, frontZ / RIB);
    if (i < vaultSegments) { const a = i * 2; vaultIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const vault = geo(new T.BufferGeometry()); vault.setAttribute('position', new T.Float32BufferAttribute(vaultPositions, 3));
  vault.setAttribute('uv', new T.Float32BufferAttribute(vaultUvs, 2)); vault.setIndex(vaultIndices); vault.computeVertexNormals();
  // Inward winding lights the room-facing surface without transparent/double-sided walls.
  mesh(vault, wall, [1, 1, 1], [0, 0, 0]);
  const panelUv = shape => { const uv = shape.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.25, (uv.getY(i) - g) / 1.25); return shape; };
  const shell = new T.Shape(); shell.moveTo(-5, g); shell.lineTo(5, g);
  shell.absellipse(0, g, 5, 4.4, 0, Math.PI, false); shell.closePath();
  mesh(panelUv(geo(new T.ExtrudeGeometry(shell, { depth: .18, bevelEnabled: false, curveSegments: 28 }))), wall, [1, 1, 1], [0, 0, frontZ]);
  const port = new T.Path(); port.moveTo(-1.85, -.45); port.lineTo(-1.85, 2.05);
  port.quadraticCurveTo(-1.85, 2.23, -1.67, 2.23); port.lineTo(1.67, 2.23);
  port.quadraticCurveTo(1.85, 2.23, 1.85, 2.05); port.lineTo(1.85, -.45); port.closePath(); shell.holes.push(port);
  mesh(panelUv(geo(new T.ExtrudeGeometry(shell, { depth: .18, bevelEnabled: false, curveSegments: 28 }))), wall, [1, 1, 1], [0, 0, rearZ]);
  box([10.2, .16, 14.4], [0, g - .13, 3.3], graphite);
  const deckShape = geo(new T.PlaneGeometry(9.5, 14.2)); deckShape.rotateX(-HALF_PI);
  { const uv = deckShape.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7.6, uv.getY(i) * 11.36); }
  mesh(deckShape, deck, [1, 1, 1], [0, g, 3.29]);
  // Structural ribs follow the vault; none of them crosses the work in front of the robot.
  const arch = geo(new T.TorusGeometry(5, .05, 6, 32, Math.PI));
  for (let z = -3.1; z < 9.6; z += RIB) mesh(arch, trim, [1, .88, 1], [0, g, z]);
  for (const x of [-4.5, 4.5]) { box([.48, .46, 13.9], [x, g + .23, 3.25], trim); box([.50, .04, 13.9], [x, g + .48, 3.25], steel); }
  for (const x of [-4.15, 4.15]) box([.035, .006, 13.9], [x, g + .003, 3.25], copper);
  // A marked aisle gives the open deck in front of the row a purpose.
  for (const x of [-1.75, 1.75]) box([.05, .006, 8.2], [x, g + .003, 5.0], amber);
  for (const z of [1.6, 3.4, 5.2, 7.0]) box([3.45, .006, .04], [0, g + .003, z], trim);
  // Ceiling: a service spine and a row of light panels between the ribs.
  box([.4, .04, 13.8], [0, 2.945, 3.25], trim);
  for (let z = -2.33; z < 9; z += RIB) for (const side of [-1, 1]) {
    box([1.14, .05, 1.04], [side * 2.512, 2.322, z], trim).rotation.z = side * -.48;
    box([1.0, .035, .9], [side * 2.5, 2.3, z], glow).rotation.z = side * -.48;
  }
  group.userData.enclosure = { kind: 'visual-interior', rearZ, frontZ, halfWidth: 5, vaultHeight: 4.4, groundY: g, viewport: 'rear-bulkhead-only' };

  // Outside the viewport: black sky, the archival Earth photo and illustrative regolith.
  mesh(geo(new T.PlaneGeometry(44, 20)), space, [1, 1, 1], [0, 4, -19.2]);
  const earthMaterial = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); materials.add(earthMaterial);
  const earth = mesh(geo(new T.CircleGeometry(1.05, 48)), earthMaterial, [1, 1, 1], [-1, 1.25, -14]);
  earth.name = 'archival-earth-through-viewport'; earth.visible = false;
  // Draw the photo after the opaque room while retaining normal depth occlusion.
  earth.renderOrder = 2;
  earth.userData = { nasa_id: NASA_TEXTURES.earth.id, credit: NASA_TEXTURES.earth.credit,
    source: `https://images.nasa.gov/details/${NASA_TEXTURES.earth.id}`,
    projection: 'cropped orthographic photograph', scenic: true, live: false };
  group.userData.earthImage = { ...earth.userData, state: 'loading' };
  // Reuse the established orthographic crop; do not wrap a hemispheric photograph
  // around a sphere or invent its unseen side. Async completion respects disposal.
  const earthReady = nasaTexture(T, 'earth', true).then(texture => {
    if (disposed) { texture.dispose(); return false; }
    texture.anisotropy = 1; textures.add(texture); earthMaterial.map = texture;
    earthMaterial.needsUpdate = true; earth.visible = true; group.userData.earthImage.state = 'ready'; return true;
  }).catch(() => { if (!disposed) group.userData.earthImage.state = 'unavailable'; return false; });
  const terrain = geo(new T.PlaneGeometry(22, 15, 24, 16)); terrain.rotateX(-HALF_PI);
  const terrainPositions = terrain.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) { const x = terrainPositions.getX(i), z = terrainPositions.getZ(i); terrainPositions.setY(i, .22 * Math.sin(x * .8 + z * .4) + .16 * Math.cos(z * 1.1) + .05 * Math.sin(x * 3.5 - z)); }
  terrain.computeVertexNormals(); mesh(terrain, regolith, [1, 1, 1], [0, g - .1, -12.2]);
  const hills = (points, depth, finish, at) => {
    const outline = new T.Shape(); outline.moveTo(-13, -3); for (const [x, y] of points) outline.lineTo(x, y); outline.lineTo(13, -3); outline.closePath();
    mesh(geo(new T.ExtrudeGeometry(outline, { depth, bevelEnabled: false })), finish, [1, 1, 1], at);
  };
  hills([[-13, 0], [-10, .6], [-8, .25], [-6, 1.1], [-4, .55], [-1, .85], [1, .38], [3, 1.2], [5, .3], [8, .8], [13, .1]], 1.1, farHills, [0, -.35, -14.6]);
  hills([[-13, .1], [-9, .38], [-7, .15], [-4.5, .5], [-2, .2], [0, .42], [2.5, .12], [4.5, .5], [7, .2], [9.5, .4], [13, .1]], .8, nearHills, [0, -1.0, -9.6]);
  const rock = geo(new T.DodecahedronGeometry(1, 0));
  for (const [x, z, r] of [[-2.6, -6.3, .3], [1.8, -6.7, .22], [3.4, -8, .5], [-4, -9, .42], [.3, -9.6, .18]]) mesh(rock, nearHills, [r, r * .55, r * .8], [x, g + .03, z]);
  // Viewport frame, its handrail and the silicone seal around the pane.
  for (const x of [-1.96, 1.96]) box([.16, 2.9, .28], [x, .88, -3.56], graphite);
  for (const y of [-.55, 2.35]) box([4.08, .16, .28], [0, y, -3.56], graphite);
  for (const x of [-1.8, 1.8]) box([.055, 2.62, .05], [x, .89, -3.68], gasket);
  for (const y of [-.4, 2.18]) box([3.6, .055, .05], [0, y, -3.68], gasket);
  pipe([-1.87, -.72, -3.36], [1.87, -.72, -3.36], .045, copper);
  plate('tagSilicone', .66, .14, [2.52, .30, -3.73]);
  // Sealed airlock on the rear bulkhead.
  mesh(geo(new T.CircleGeometry(1.13, 40)), trim, [1, 1, 1], [-3.55, -.05, -3.6]);
  mesh(geo(new T.TorusGeometry(1.13, .095, 8, 40)), graphite, [1, 1, 1], [-3.55, -.05, -3.56]);
  mesh(geo(new T.TorusGeometry(.42, .04, 6, 28)), steel, [1, 1, 1], [-3.55, -.05, -3.5]);
  mesh(geo(new T.CircleGeometry(.24, 24)), acrylic, [1, 1, 1], [-3.55, .52, -3.52]);
  pipe([-3.97, -.05, -3.5], [-3.13, -.05, -3.5], .03, steel);
  for (const x of [-4.3, -2.8]) pipe([x, -.35, -3.42], [x, .45, -3.42], .045, copper);
  plate('tagAirlock', .9, .11, [-3.55, 1.28, -3.6]);
  // Stowage along both walls and cargo bags by the forward lockers.
  for (const z of [-1.9, -.6, .7, 2.0]) tbox([.8, 2.5, 1.25], [-4.1, g + 1.25, z], { px: 'locker' });
  for (const z of [-2.45, -1.2]) tbox([.8, 2.5, 1.25], [4.1, g + 1.25, z], { nx: 'locker' });
  for (const [x, y, z] of [[-3.25, .21, 3.5], [-3.2, .63, 3.55], [-3.3, .21, 4.25]]) tbox([.62, .42, .56], [x, g + y, z], { all: 'bag' });

  // The kit mission happens along one row that faces the room: a staging bench with one
  // labelled review kit per material, and the crew-review console that receives a kit. The
  // humanoid works from behind the row, facing the room. These numbers are its contract:
  // a kit is carried by its top handle, and "position" is the centre of a kit at rest.
  const ROW = .25, STAND = ROW - .6, handleLocal = Object.freeze([0, .205, 0]);
  const rest = (x, extra = {}) => {
    const position = Object.freeze([x, 0, ROW]);
    return Object.freeze({ position, point: position, handlePosition: Object.freeze([x, .205, ROW]), robotPosition: Object.freeze([x + .25, g, STAND]), robotYaw: 0, ...extra });
  };
  const kit = Object.freeze({
    dimensions: Object.freeze([.34, .28, .28]), handleLocal,
    slots: Object.freeze({ pmma: rest(.9, { material: 'pmma' }), kapton: rest(1.35, { material: 'kapton' }), silicone: rest(1.8, { material: 'silicone' }) }),
    fixture: rest(-1.25),
    dock: Object.freeze({ robotPosition: Object.freeze([2.9, g, -1.5]), robotYaw: -.35 })
  });
  group.userData.kitLayout = kit;
  tbox([1.46, 1.29, .56], [1.35, g + .645, ROW], { pz: 'bench', py: 'benchTop' });
  tbox([1.85, 1.29, .57], [-.575, g + .645, ROW + .035], { pz: 'console', py: 'deck' });
  for (const spot of [...Object.values(kit.slots), kit.fixture]) for (const side of [-.192, .192]) box([.025, .05, .31], [spot.position[0] + side, -.115, ROW], copper);
  const kits = {};
  for (const id of KIT_MATERIALS) {
    const label = kitRegion(id), item = tbox(kit.dimensions, kit.slots[id].position, { pz: label, nz: label, py: 'kitTop', all: 'light' });
    item.userData.live = true; item.name = `review-kit-${id}`;
    for (const x of [-.105, .105]) box([.028, .075, .036], [x, .165, 0], steel, item);
    box([.24, .035, .045], [0, .205, 0], graphite, item);
    const handle = new T.Object3D(); handle.name = 'kit-handle'; handle.position.fromArray(handleLocal); item.add(handle);
    kits[id] = item;
  }
  // The console screen shows the caller's real tally and task state; it is not a sensor display.
  const screenTilt = -.14;
  box([1.16, .68, .07], [-.3, .24, .055], graphite).rotation.x = screenTilt;
  box([.14, .12, .10], [-.3, -.10, .05], trim);
  const screen = drawn(640, 360, c => { c.fillStyle = '#101c22'; c.fillRect(0, 0, 640, 360); });
  const screenMaterial = keep(new T.MeshBasicMaterial({ map: screen.texture, toneMapped: false }));
  const screenPlane = mesh(geo(new T.PlaneGeometry(1.08, .6)), screenMaterial, [1, 1, 1], [-.3, .24, .096]); screenPlane.rotation.x = screenTilt; screenPlane.userData.live = true;
  cylinder(.8, .065, [2.9, g - .030, -1.5], graphite);
  const dockRing = mesh(geo(new T.TorusGeometry(.73, .015, 6, 40)), sweep, [1, 1, 1], [2.9, g + .012, -1.5]); dockRing.rotation.x = -HALF_PI;
  for (const x of [2.4, 3.4]) box([.1, .018, .36], [x, g + .01, -1.62], copper);
  plate('tagDock', 1.1, .23, [2.9, g + .006, -.48], 0, true);

  // Illustrative material-linked components, not measured or flight-certified hardware.
  // Their evidence/status is supplied by the review engine; geometry creates no data.
  tbox([.9, 1.0, 1.2], [3.95, g + .5, .35], { nx: 'locker' });
  box([.035, .8, .9], [3.52, .20, .35], acrylic);
  for (const z of [-.12, .82]) box([.05, .86, .05], [3.52, .20, z], copper);
  box([.06, .05, 1.0], [3.52, .625, .35], copper);
  plate('tagPmma', .66, .14, [3.49, .79, .35], -HALF_PI);
  box([1.7, .10, .20], [3.1, .92, -3.68], steel);
  for (const y of [.99, 1.03, 1.07]) pipe([2.28, y, -3.62], [3.92, y, -3.62], .022, amber);
  pipe([3.5, .97, -3.66], [3.5, .52, -3.66], .03, amber);
  tbox([.42, .36, .14], [3.5, .40, -3.71]);
  plate('tagKapton', .66, .14, [3.0, .72, -3.73]);
  const targetSpec = (label, tag, point, robotPosition, robotYaw) => Object.freeze({ label, tag, point: Object.freeze(point), robotPosition: Object.freeze(robotPosition), robotYaw });
  const workTargets = Object.freeze({
    pmma: targetSpec('PMMA work-zone panel', 'HAB-PMMA-01', [3.50, .25, .35], [2.70, g, .35], HALF_PI),
    kapton: targetSpec('Kapton cable tray', 'HAB-KAPTON-02', [3.0, .95, -3.60], [2.45, g, -2.75], 2.58),
    silicone: targetSpec('Silicone viewport seal', 'HAB-SILICONE-03', [1.80, .45, -3.64], [.95, g, -2.45], 2.52)
  });
  const ringTurn = { pmma: HALF_PI, kapton: 0, silicone: 0 };
  const cuePosition = new T.Vector3(3.49, .25, .35);
  const cue = box([.018, .10, .10], cuePosition.toArray(), cueMaterial); cue.name = 'panel-traceability-target'; cue.userData.live = true;
  const targetRing = mesh(geo(new T.TorusGeometry(.23, .014, 6, 36)), ringMaterial, [1, 1, 1], [3.47, .25, .35]); targetRing.name = 'evidence-target-ring'; targetRing.rotation.y = HALF_PI; targetRing.visible = false; targetRing.userData.live = true;
  const scan = box([.012, .014, .82], [3.47, .25, .35], sweep); scan.visible = false; scan.userData.live = true;
  const beamGeometry = geo(new T.BufferGeometry()); beamGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
  const beamMaterial = keep(new T.LineBasicMaterial({ color: 0xa7c7ce, transparent: true, opacity: .4, depthWrite: false }));
  const beam = new T.Line(beamGeometry, beamMaterial); group.add(beam); beam.visible = false;
  const routeGeometry = geo(new T.BufferGeometry().setFromPoints([new T.Vector3(2.9, g + .06, -1.5), new T.Vector3(2.7, g + .06, .35)]));
  const routeMaterial = keep(new T.LineDashedMaterial({ color: 0xc5a270, dashSize: .18, gapSize: .12, transparent: true, opacity: .45 }));
  const route = new T.Line(routeGeometry, routeMaterial); route.computeLineDistances(); group.add(route); route.visible = false;
  ground(2.9, 1.7, -.575, .3); ground(2.4, 1.7, 1.35, .27); ground(1.9, 3.5, 3.95, -1.8); ground(2.0, 2.3, 3.9, .35); ground(1.9, 6.6, -4.05, .05);
  group.add(new T.HemisphereLight(0xd9e0de, 0x3b3028, .4));
  const key = new T.PointLight(0xf4e4c8, 26, 13, 2); key.position.set(.4, 2.1, 2.4); group.add(key);
  const task = new T.PointLight(0xbfd2d8, 14, 9, 2); task.position.set(2.2, 1.7, -.9); group.add(task);

  // Fixed opaque pieces share a draw submission per finish. Kits, cue, ring and the
  // screen stay independent so their transforms and live texture remain updateable.
  let authoredMeshes = 0; group.traverse(item => { if (item.isMesh) authoredMeshes++; });
  const buckets = new Map();
  for (const item of group.children) if (item.isMesh && !item.userData.live) {
    if (!buckets.has(item.material)) buckets.set(item.material, []);
    buckets.get(item.material).push(item);
  }
  for (const [finish, pieces] of buckets) {
    if (pieces.length < 2) continue;
    const parts = pieces.map(item => { item.updateMatrix(); return (item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone()).applyMatrix4(item.matrix); });
    const vertices = parts.reduce((count, part) => count + part.attributes.position.count, 0);
    const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), uvs = new Float32Array(vertices * 2); let offset = 0;
    for (const part of parts) {
      positions.set(part.attributes.position.array, offset * 3); normals.set(part.attributes.normal.array, offset * 3);
      if (part.attributes.uv) uvs.set(part.attributes.uv.array, offset * 2);
      offset += part.attributes.position.count; part.dispose();
    }
    const shape = geo(new T.BufferGeometry()); shape.setAttribute('position', new T.BufferAttribute(positions, 3));
    shape.setAttribute('normal', new T.BufferAttribute(normals, 3)); shape.setAttribute('uv', new T.BufferAttribute(uvs, 2));
    shape.computeBoundingBox(); shape.computeBoundingSphere(); pieces.forEach(item => group.remove(item));
    mesh(shape, finish, [1, 1, 1], [0, 0, 0]).name = 'fixed-bay-material-batch';
  }

  let screenKey = '';
  function show(key, title, lines, foot) {
    const next = JSON.stringify(key); if (next === screenKey) return; screenKey = next;
    const c = screen.context; c.fillStyle = '#101c22'; c.fillRect(0, 0, 640, 360); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#b8cad0'; c.font = '500 32px sans-serif'; c.fillText(title, 34, 50, 572);
    c.fillStyle = '#31454d'; c.fillRect(34, 68, 572, 2);
    let y = 124;
    for (const [value, size = 30, color = '#e8e3d6', weight = 400] of lines) { c.fillStyle = color; c.font = `${weight} ${size}px sans-serif`; c.fillText(value, 34, y, 572); y += size + 18; }
    c.fillStyle = '#d4b17b'; c.font = '26px sans-serif'; c.fillText(foot, 34, 336, 572); screen.texture.needsUpdate = true;
  }
  function paintReview(review, target) {
    const validCounts = Number.isSafeInteger(review.completed) && Number.isSafeInteger(review.total) && review.completed >= 0 && review.total >= review.completed;
    const status = STATUS_TEXT[review.status] || 'Awaiting result';
    const rowId = typeof review.rowId === 'string' && review.rowId.trim() ? review.rowId : null;
    show(['review', review.material, review.concern, status, validCounts ? review.completed : null, validCounts ? review.total : null, rowId, review.running === true],
      target?.tag || 'MATERIAL EVIDENCE', [[status, 46, '#e8e3d6', 600], [validCounts ? `${review.completed} / ${review.total} checks reviewed` : 'Review count unavailable'],
        [`${typeof review.material === 'string' ? review.material : 'Unknown material'} / ${typeof review.concern === 'string' ? review.concern : 'unavailable'}`, 28], [rowId ? `Source row: ${rowId}` : 'No source row linked', 26]],
      review.running === true ? 'Evidence review running' : status === 'Awaiting result' ? 'Record unavailable' : 'Showing computed record');
  }
  // A kit only leaves its cradle for a current, approved task. Everything else draws it at rest.
  const kitState = mission => mission.plan_valid === true && mission.approval?.granted === true && mission.phase !== 'cancelled' && ['attached', 'staged'].includes(mission.virtual_object_state) ? mission.virtual_object_state : 'docked';
  // The kit screen repeats what the caller's task state and plan say; no line is invented here.
  function paintKit(mission) {
    const plan = mission.plan, state = kitState(mission), granted = mission.approval?.granted === true, tag = workTargets[plan.material_id].tag;
    const where = state === 'staged' ? 'Kit staged for crew review' : state === 'attached' ? 'Kit in transit'
      : mission.phase === 'cancelled' ? 'Task cancelled · kit at rest' : granted ? 'Kit requested' : 'Kit at rest · approval required';
    const label = typeof plan.evidence_label === 'string' && plan.evidence_label.trim() ? plan.evidence_label : STATUS_TEXT[plan.evidence_status] || 'Evidence status unavailable';
    const q = plan.query || {}, cabin = [q.o2 != null && `${q.o2}% O2`, q.p != null && `${q.p} kPa`, q.g != null && `${q.g} gravity`].filter(Boolean).join(' · ');
    const question = typeof plan.question_id === 'string' ? plan.question_id : `${plan.material_id} / ${plan.concern ?? 'unavailable'}`;
    show(['kit', plan.material_id, question, state, mission.phase === 'cancelled', granted, label, cabin], `CREW REVIEW · ${tag}`,
      [[where, 44, '#e8e3d6', 600], [question, 30], [`Evidence: ${label}`, 30, state === 'staged' ? '#e9c18e' : '#e8e3d6'], [cabin || 'Cabin not supplied', 26, '#b8cad0']],
      state === 'staged' ? 'Virtual kit · crew review required' : 'Illustrative robot motion · no sensor data');
  }
  function paintMonitor(phase, counts, mission) {
    const active = ['evidence', 'review', 'inspect', 'return', 'complete'].includes(phase);
    const lines = !active ? [['Awaiting evidence', 34]]
      : mission ? [[STATUS_TEXT[mission.question?.status] || 'Unavailable', 46, '#e8e3d6', 600], [`${mission.question?.nearby_row_ids?.length ?? 0} nearby source rows`], [`Nearest: ${mission.nearest_source?.id || 'unavailable'}`, 26], [phase === 'complete' ? 'VISUAL PASS LOGGED' : 'HUMAN REVIEW', 26, '#d4b17b']]
        : [['PROVEN', 'nearby'], ['EXTRAPOLATED', 'other / incomplete'], ['NEVER_TESTED', 'no source']].map(([id, label]) => [`${counts?.[id] ?? '—'}   ${label}`, 34]);
    show(['monitor', phase, counts, mission?.question, mission?.nearest_source?.id], 'HAB-PMMA-01 / EVIDENCE', lines, mission ? 'Crew review still required' : 'material–concern questions');
  }
  const kitMatrix = new T.Matrix4(), handleInverse = new T.Matrix4().makeTranslation(-handleLocal[0], -handleLocal[1], -handleLocal[2]);
  // docked: in its cradle. attached: hanging from the humanoid's grip by its handle. staged: seated on the console.
  function placeKits(mission, grip) {
    const id = mission && typeof mission === 'object' && KIT_MATERIALS.includes(mission.plan?.material_id) ? mission.plan.material_id : null;
    const state = id ? kitState(mission) : 'docked';
    for (const name of KIT_MATERIALS) {
      const item = kits[name], active = name === id; item.name = active ? 'virtual-review-kit' : `review-kit-${name}`;
      item.matrixAutoUpdate = true;
      if (active && state === 'attached' && grip?.isObject3D) {
        // The grip's world pose is brought into the bay's own frame, then moved from the handle to the kit centre.
        grip.updateWorldMatrix(true, false); group.updateWorldMatrix(true, false);
        kitMatrix.copy(group.matrixWorld).invert().multiply(grip.matrixWorld).multiply(handleInverse);
        // Preserve the full inverse-parent matrix, including scale/shear.
        item.matrixAutoUpdate = false; item.matrix.copy(kitMatrix);
        kitMatrix.decompose(item.position, item.quaternion, item.scale); item.matrixWorldNeedsUpdate = true;
      } else {
        // A missing grip cannot leave a stale carried pose suspended in the room.
        item.position.fromArray(active && state === 'staged' ? kit.fixture.position : kit.slots[name].position);
        item.quaternion.identity(); item.scale.set(1, 1, 1); item.updateMatrix();
      }
      item.userData.virtual_object_state = active && state === 'attached' && grip?.isObject3D ? 'attached' : active && state === 'staged' ? 'staged' : 'docked';
      item.userData.grip_unavailable = Boolean(active && state === 'attached' && !grip?.isObject3D);
      item.userData.material_id = name; item.userData.question_id = active ? mission.plan.question_id || null : null; item.userData.source_ids = active ? mission.plan.source_ids || null : null;
    }
    group.userData.kit = { material: id, state: id ? state : null };
    return id;
  }
  const sensorPoint = new T.Vector3(), sweepPoint = new T.Vector3();
  function update({ phase, elapsed = 0, still = false, counts, mission = null, approved = false, sensor = null, scanAt = 4.15, review = null, kitMission = null, kitGrip = null } = {}) {
    // The kit is placed first, so no early return below can leave it behind.
    const planned = placeKits(kitMission, kitGrip);
    if (review && typeof review === 'object') {
      const selected = typeof review.material === 'string' && Object.hasOwn(workTargets, review.material) ? workTargets[review.material] : null;
      if (planned) paintKit(kitMission); else paintReview(review, selected);
      targetRing.visible = Boolean(selected);
      if (selected) { targetRing.position.fromArray(selected.point); targetRing.rotation.y = ringTurn[review.material]; }
      targetRing.scale.setScalar(1); ringMaterial.emissiveIntensity = .55; cueMaterial.emissiveIntensity = .12;
      // Motion points to an already computed record. No laser, sensor sweep or fake work progress.
      scan.visible = beam.visible = route.visible = false;
      group.userData.phase = phase; group.userData.scanning = false; group.userData.sensorData = false;
      group.userData.reviewMaterial = selected ? review.material : null; group.userData.dataWorkRunning = review.running === true;
      return;
    }
    delete group.userData.reviewMaterial; delete group.userData.dataWorkRunning;
    targetRing.position.set(3.47, .25, .35); targetRing.rotation.y = HALF_PI;
    if (planned) paintKit(kitMission); else paintMonitor(phase, counts, mission);
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
  placeKits(null, null); paintMonitor('ready', null, null);
  // Suggested cameras for the station controller. Every one lies inside the enclosure.
  const view = (position, target, fov) => Object.freeze({ position: Object.freeze(position), target: Object.freeze(target), fov });
  const wide = view([-.9, .8, 5.4], [-.1, .2, -.2], 47), narrow = view([.2, 1.0, 7.2], [.2, 1.0, 0], 52);
  const cameraHints = Object.freeze({ wide, narrow, overview: wide, compact: narrow, task: view([.6, .85, 4.6], [.5, .15, 0], 47),
    taskBounds: Object.freeze({ min: Object.freeze([-1.9, g, -.6]), max: Object.freeze([2.3, 1.4, .6]) }) });
  let meshes = 0, triangles = 0, lights = 0;
  group.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.attributes.position.count) / 3; } if (item.isLight) lights++; });
  const stats = Object.freeze({ meshes, authoredMeshes, triangles, lights, shadowMaps: 0, textures: textures.size + 1, externalAssets: 1 });
  group.userData.budget = stats;
  return { group, stats, cuePosition, workTargets, kit, cameraHints, earthReady, lightingScale: .6, update, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); } };
}
