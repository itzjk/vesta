import { hardware, tube } from './materials.js';
import { buildSample } from './sample-kit.js';
import { lampProgress } from './lamp-sequence.js?v=habitat-20261115-1';

const concerns = ['prevention', 'detection', 'suppression'];
const states = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];

export async function buildSamples({ THREE, mode = 'high', db }) {
  if (!THREE || !db?.materials || Object.keys(db.materials).length !== 15) throw new Error('samples: expected THREE and the 15 indexed cabin materials');
  const ids = Object.keys(db.materials), group = new THREE.Group();
  group.name = 'evidence-materials-locker';
  const metal = hardware(THREE, 'metal', { color: 0x596268, roughness: .54 });
  const wallMat = hardware(THREE, 'metal', { color: 0x59646b, metalness: .32, roughness: .84 });
  const trayMat = hardware(THREE, 'metal', { color: 0x707776, metalness: .65, roughness: .6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252d32, roughness: .84, metalness: .2 });
  const box = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  const mesh = (geometry, material, parent = group) => { const o = new THREE.Mesh(geometry, material); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const instanced = (geometry, material, count) => { const o = new THREE.InstancedMesh(geometry, material, count); o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); o.receiveShadow = true; group.add(o); return o; };
  const trays = instanced(box, trayMat, 15), backs = instanced(box, dark, 15), dividers = instanced(box, metal, 30);
  const washPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, edge = Math.min(x, y, 63 - x, 63 - y) / 12; washPixels[i] = washPixels[i + 1] = washPixels[i + 2] = 255; washPixels[i + 3] = Math.round(255 * Math.min(1, edge) * (.6 + .4 * y / 63)); }
  const washTexture = new THREE.DataTexture(washPixels, 64, 64); washTexture.needsUpdate = true;
  const compartmentWash = instanced(new THREE.PlaneGeometry(1.23, 1.49), new THREE.MeshBasicMaterial({ map: washTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 15);
  compartmentWash.layers.enable(1);
  const bezels = instanced(new THREE.CylinderGeometry(.193, .193, .042, 20).rotateX(Math.PI / 2), metal, 45);
  const bulbs = instanced(new THREE.SphereGeometry(.17, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 45);
  bulbs.layers.enable(1);
  const screw = instanced(new THREE.CylinderGeometry(.027, .027, .02, 8).rotateX(Math.PI / 2), metal, 60);
  const wall = mesh(box, wallMat), frame = mesh(box, metal), recess = mesh(box, dark);
  const fixture = mesh(box, dark), diffuser = mesh(box, new THREE.MeshBasicMaterial({ color: 0xc2d8df, toneMapped: false }));
  diffuser.layers.enable(1);
  const light = new THREE.SpotLight(0xd6e8f1, 85, 25, 1.1, .8, 2); group.add(light, light.target);
  light.castShadow = mode === 'high'; light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = .015; light.shadow.bias = -.0001;
  light.shadow.camera.near = .2; light.shadow.camera.far = 25;
  const wash = new THREE.PointLight(0xd8e6ed, 38, 18, 2); group.add(wash);
  const warm = new THREE.PointLight(0xe9ae78, 8, 14, 2); group.add(warm);
  const harness = new THREE.Group(); group.add(harness);
  const samples = new Map(), lampColors = { PROVEN: new THREE.Color('#e57052'), EXTRAPOLATED: new THREE.Color('#87622e'), NEVER_TESTED: new THREE.Color('#12191c') };
  const washColors = { PROVEN: new THREE.Color('#c45332').multiplyScalar(.65), EXTRAPOLATED: new THREE.Color('#7b571e').multiplyScalar(.24), NEVER_TESTED: new THREE.Color(0) };
  const brightness = { PROVEN: 1.08, EXTRAPOLATED: .55, NEVER_TESTED: .12 };
  const lamps = ids.flatMap(material => concerns.map(concern => ({ material, concern, from: lampColors.NEVER_TESTED.clone(), to: lampColors.NEVER_TESTED.clone(), color: lampColors.NEVER_TESTED.clone(), position: new THREE.Vector3() })));
  const selectedMaterials = new Set(ids), lampColor = new THREE.Color(), litColor = new THREE.Color(0xd6e8f1);
  let aspect = 1.6, layoutMode = 'default', geometryKey = '', panel = false, selected = null, time = 0, changeAt = 0, stateKey = '', firstCells = true, disposed = false;
  let interactionSurface = null, clickableSurface = null;
  let sequence = null;
  const markInteractive = () => {};
  function syncInteractionSurface() {
    const next = group.visible && layoutMode === 'compact-wide' ? interactionSurface : null;
    if (next === clickableSurface) return;
    clickableSurface?.removeEventListener('click', markInteractive);
    clickableSurface = next;
    clickableSurface?.addEventListener('click', markInteractive);
  }
  const smooth = x => { const a = THREE.MathUtils.clamp(x, 0, 1); return a * a * (3 - 2 * a); };
  const put = (o, index, position, scale = [1, 1, 1]) => { dummy.position.set(...position); dummy.rotation.set(0, 0, 0); dummy.scale.set(...scale); dummy.updateMatrix(); o.setMatrixAt(index, dummy.matrix); };
  for (const id of ids) {
    const sample = await buildSample({ THREE, id, mode });
    if (!sample?.group?.isObject3D) throw new Error(`samples: invalid kit sample ${id}`);
    const holder = new THREE.Group(); holder.name = `sample-${id}`; holder.add(sample.group); group.add(holder);
    const materials = [], seen = new Set();
    sample.group.traverse(o => { if (!o.isMesh) return; for (const m of [o.material].flat()) if (m.color && !seen.has(m)) { seen.add(m); materials.push({ m, color: m.color.clone(), emissive: m.emissive?.clone() }); } });
    samples.set(id, { holder, position: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), scaleFrom: 1, scaleTo: 1, at: 0, materials, wash: new THREE.Color(0), washFrom: new THREE.Color(0), washTo: new THREE.Color(0), light: .12, lightFrom: .12, lightTo: .12, lit: 0, litFrom: 0, litTo: 0, litAt: -1 });
  }
  function setLayout(options = {}) {
    const next = options.aspect ?? aspect, wasPortrait = aspect < .9;
    if (!Number.isFinite(next) || next <= 0) throw new Error('samples: aspect must be positive');
    aspect = next; panel = !!options.panel; layoutMode = options.layout ?? layoutMode;
    const portrait = aspect < .9, compact = layoutMode === 'compact-wide';
    const nextKey = compact ? layoutMode : portrait ? 'portrait' : 'wide';
    wash.intensity = portrait ? 55 : 48;
    if (geometryKey === nextKey) { if (selected && portrait !== wasPortrait) focus(selected, true); return; }
    geometryKey = nextKey;
    const columns = compact ? 5 : portrait ? 3 : 5, rows = 15 / columns, pitch = compact ? 2 : 1.35;
    const width = columns * pitch + .4, height = rows * 1.94 + .35, bay = compact ? pitch - .1 : 1.25;
    const divider = compact ? pitch / 2 - .035 : .64, screwOffset = compact ? pitch / 2 - .115 : .56;
    frame.position.set(0, 0, -.46); frame.scale.set(width, height, .34);
    recess.position.set(0, 0, -.26); recess.scale.set(width - .13, height - .13, .09);
    wall.position.set(0, 0, -.75); wall.scale.set(width + 17, height + 12, .2);
    for (const [i, id] of ids.entries()) {
      const x = (i % columns - (columns - 1) / 2) * pitch, y = ((rows - 1) / 2 - Math.floor(i / columns)) * 1.94 - .68;
      const item = samples.get(id); item.position.set(x, y, .08); item.to.copy(item.position); item.from.copy(item.position); item.holder.position.copy(item.position);
      put(trays, i, [x, y - .04, .06], [bay, .1, .75]);
      put(backs, i, [x, y + .64, -.16], [compact ? bay - .01 : 1.24, 1.53, .07]);
      put(compartmentWash, i, [x, y + .64, -.105], [compact ? (bay - .02) / 1.23 : 1, 1, 1]);
      put(dividers, i * 2, [x - divider, y + .65, -.04], [.035, 1.83, .55]);
      put(dividers, i * 2 + 1, [x + divider, y + .65, -.04], [.035, 1.83, .55]);
      for (let c = 0; c < 3; c++) {
        const li = i * 3 + c, lp = [x + (c - 1) * .4, y - .24, .39];
        lamps[li].position.fromArray(lp); put(bezels, li, [lp[0], lp[1], lp[2] - .035]); put(bulbs, li, lp, [1, 1, .5]);
      }
      for (let c = 0; c < 4; c++) put(screw, i * 4 + c, [x + (c % 2 ? 1 : -1) * screwOffset, y + (c < 2 ? 1.4 : -.3), .015]);
    }
    fixture.position.set(0, height / 2 + .27, .65); fixture.scale.set(width - .6, .18, .65);
    diffuser.position.set(0, height / 2 + .18, .65); diffuser.scale.set(width - .85, .025, .47);
    light.position.set(0, height / 2 + .1, 2.1); light.target.position.set(0, -1, 0);
    wash.position.set(-width * .28, height * .34, 3.2);
    warm.position.set(width * .5, -height * .3, 2);
    for (const o of [...harness.children]) { o.geometry.dispose(); harness.remove(o); }
    tube(THREE, [[-width / 2 - .18, height / 2 + .7, -.3], [-width / 2 - .26, height / 2 - .4, -.2], [-width / 2 - .22, -height / 2 - .2, -.2], [-width / 2 + .4, -height / 2 - .4, -.2]], .055, dark, harness);
    for (const o of [trays, backs, compartmentWash, dividers, bezels, bulbs, screw]) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
    if (selected) focus(selected, true);
  }
  function camera(options = {}) {
    const nextPanel = options.panel ?? panel;
    if ((options.aspect ?? aspect) !== aspect || (options.layout ?? layoutMode) !== layoutMode) setLayout({ ...options, panel: nextPanel });
    else panel = !!nextPanel;
    interactionSurface = options.surface ?? interactionSurface; syncInteractionSurface();
    const portrait = aspect < .9, compact = layoutMode === 'compact-wide';
    const height = compact ? portrait ? 6.9 : 8 : portrait ? 10.9 : 6.35, width = compact ? 10.9 : portrait ? 4.6 : 7.7;
    const pixels = options.height ?? (portrait ? 844 : 900), horizontal = options.width ?? pixels * aspect;
    const insets = { top: portrait ? 140 : 135, bottom: portrait ? 190 : 120, left: portrait ? 15 : 70, right: portrait ? 15 : 70, ...options.insets };
    if (![pixels, horizontal, ...Object.values(insets)].every(Number.isFinite) || pixels <= 0 || horizontal <= 0 || Object.values(insets).some(v => v < 0)) throw new Error('samples: invalid camera dimensions or insets');
    const usableY = 1 - (insets.top + insets.bottom) / pixels, usableX = 1 - (insets.left + insets.right) / horizontal;
    if (usableY <= 0 || usableX <= 0) throw new Error('samples: camera insets leave no visible area');
    const tangent = Math.tan(THREE.MathUtils.degToRad(32) / 2);
    const distance = Math.max(height / usableY, width / (aspect * usableX)) / (2 * tangent) * 1.04;
    const shiftY = (insets.top - insets.bottom) / pixels * distance * tangent;
    const shiftX = (insets.right - insets.left) / horizontal * distance * tangent * aspect;
    const target = [panel && !portrait ? -1.5 : shiftX - .25, panel && portrait ? -2.3 : shiftY + .08, 0];
    const position = [target[0] + .45, target[1] + .55, distance];
    return { position, target, fov: 32, focusDistance: distance - (selected ? 2.2 : .2), aperture: selected ? 1.6 : .65, exposure: 1.6 };
  }
  function setCells(cells) {
    if (!Array.isArray(cells) || cells.length !== lamps.length) throw new Error('samples: setCells requires all 45 core.status.cells');
    const found = new Map();
    for (const cell of cells) { if (!cell || typeof cell !== 'object') throw new Error('samples: each cell must be a core.status.cell object'); const key = `${cell.material}:${cell.concern}`; if (!samples.has(cell.material) || !concerns.includes(cell.concern) || !states.includes(cell.status) || found.has(key)) throw new Error(`samples: invalid or duplicate cell ${key}`); found.set(key, cell.status); }
    const key = lamps.map(l => found.get(`${l.material}:${l.concern}`)).join('|'); if (key === stateKey) return;
    stateKey = key; changeAt = time;
    for (const l of lamps) { l.from.copy(l.color); l.to.copy(lampColors[found.get(`${l.material}:${l.concern}`)]); if (firstCells) l.color.copy(l.to); }
    for (const [id, item] of samples) {
      const statuses = concerns.map(c => found.get(`${id}:${c}`));
      const state = statuses.includes('PROVEN') ? 'PROVEN' : statuses.includes('EXTRAPOLATED') ? 'EXTRAPOLATED' : 'NEVER_TESTED';
      item.washFrom.copy(item.wash); item.washTo.copy(washColors[state]); item.lightFrom = item.light; item.lightTo = brightness[state];
    }
    if (firstCells) { firstCells = false; changeAt = time - 1; }
    update(time);
  }
  function highlight(materialIds = null) {
    if (materialIds !== null && (!Array.isArray(materialIds) || materialIds.some(id => !samples.has(id)))) throw new Error('samples: highlight expects known material ids or null');
    selectedMaterials.clear(); for (const id of materialIds ?? ids) selectedMaterials.add(id);
    update(time);
  }
  function focus(material, snap = false) {
    if (material !== null && !samples.has(material)) throw new Error(`samples: unknown focus material ${material}`);
    selected = material;
    for (const [id, item] of samples) {
      item.from.copy(item.holder.position); item.scaleFrom = item.holder.scale.x; item.at = snap ? time - 1 : time;
      item.to.copy(item.position); item.scaleTo = 1;
      if (id === material) { item.to.set(aspect < .9 ? 0 : -.4, aspect < .9 ? .35 : -.65, 2.5); item.scaleTo = 1.7; }
    }
    if (snap) update(time);
  }
  // Keeps one sample softly lit (the material whose question is open or was last opened). Settles in .6 s; null clears it.
  function mark(material, snap = false) {
    if (material !== null && !samples.has(material)) throw new Error(`samples: unknown marked material ${material}`);
    for (const [id, item] of samples) {
      const next = id === material ? 1 : 0;
      if (item.litTo === next && !snap) continue;
      item.litFrom = snap ? next : item.lit; item.litTo = next; item.litAt = snap ? time - 1 : time;
    }
    if (snap) update(time);
  }
  function anchor(material, concern = null) {
    const item = samples.get(material); if (!item) throw new Error(`samples: unknown anchor ${material}`);
    if (concern !== null) { const lamp = lamps.find(l => l.material === material && l.concern === concern); if (!lamp) throw new Error(`samples: unknown concern ${concern}`); return lamp.position.clone(); }
    return item.holder.position.clone().add(new THREE.Vector3(0, selected === material ? -.18 : -.48, .35));
  }
  function pick(raycaster) {
    if (!group.visible || disposed) return null;
    group.updateWorldMatrix(true, true);
    const hits = raycaster.intersectObjects([bulbs, bezels, ...[...samples.values()].map(s => s.holder)], true);
    for (const hit of hits) {
      if (hit.object === bulbs || hit.object === bezels) { const l = lamps[hit.instanceId]; return { material: l.material, concern: l.concern }; }
      let o = hit.object; while (o && o !== group) { if (o.name.startsWith('sample-') && samples.has(o.name.slice(7))) return { material: o.name.slice(7), concern: null }; o = o.parent; }
    }
    return null;
  }
  function update(t, options = {}) {
    if (!Number.isFinite(t)) throw new Error('samples: update time must be seconds');
    time = t;
    const snap = options.reduced || options.capture, mix = snap ? 1 : smooth((t - changeAt) / .32);
    for (const [i, l] of lamps.entries()) {
      const order = sequence?.lamps.get(`${l.material}:${l.concern}`);
      const amount = order == null ? mix : lampProgress(sequence.elapsed, order, sequence.snap);
      l.color.copy(l.from).lerp(l.to, amount); const dim = selectedMaterials.has(l.material) ? 1 : .18; lampColor.copy(l.color).multiplyScalar(dim); bulbs.setColorAt(i, lampColor);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    for (const [index, id] of ids.entries()) {
      const item = samples.get(id);
      const blend = snap ? 1 : smooth((t - item.at) / .42);
      item.holder.position.lerpVectors(item.from, item.to, blend); item.holder.scale.setScalar(THREE.MathUtils.lerp(item.scaleFrom, item.scaleTo, blend));
      const dim = selectedMaterials.has(id) && (!selected || selected === id) ? 1 : .28;
      const order = sequence?.materials.get(id), amount = order == null ? mix : lampProgress(sequence.elapsed, order, sequence.snap);
      item.wash.copy(item.washFrom).lerp(item.washTo, amount); item.light = THREE.MathUtils.lerp(item.lightFrom, item.lightTo, amount);
      const litK = snap ? 1 : THREE.MathUtils.clamp((t - item.litAt) / .6, 0, 1);
      item.lit = THREE.MathUtils.lerp(item.litFrom, item.litTo, smooth(litK));
      const glow = item.lit + (item.litTo > item.litFrom ? .45 * Math.sin(Math.PI * litK) : 0);
      lampColor.copy(item.wash).multiplyScalar(selectedMaterials.has(id) ? 1 : .15);
      if (glow > 0) { lampColor.r += litColor.r * .14 * glow; lampColor.g += litColor.g * .14 * glow; lampColor.b += litColor.b * .14 * glow; }
      compartmentWash.setColorAt(index, lampColor);
      for (const { m, color, emissive } of item.materials) {
        m.color.copy(color).multiplyScalar(dim * item.light);
        if (m.emissive) { m.emissive.copy(emissive).add(lampColor.copy(item.wash).multiplyScalar(.18 * dim)); if (glow > 0) { m.emissive.r += litColor.r * .025 * glow; m.emissive.g += litColor.g * .025 * glow; m.emissive.b += litColor.b * .025 * glow; } }
      }
    }
    if (compartmentWash.instanceColor) compartmentWash.instanceColor.needsUpdate = true;
  }
  setLayout(); update(0);
  return { group, camera, setLayout, setCells, highlight, pick, focus, mark, anchor, update, materialIds: ids.slice(), kitReady: true,
    beginSequence(keys) {
      const known = new Set(lamps.map(lamp => `${lamp.material}:${lamp.concern}`));
      if (!Array.isArray(keys) || keys.some(key => !known.has(key)) || new Set(keys).size !== keys.length) throw new Error('samples: invalid lamp sequence');
      const materials = new Map(); keys.forEach((key, index) => { const material = key.split(':')[0]; if (!materials.has(material)) materials.set(material, index); });
      sequence = { lamps: new Map(keys.map((key, index) => [key, index])), materials, elapsed: 0, snap: false };
    },
    advanceSequence(elapsed, snap = false) { if (sequence) { sequence.elapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0; sequence.snap = snap; } },
    endSequence() { sequence = null; },
    setVisible(value) { group.visible = !!value; syncInteractionSurface(); },
    dispose() { if (disposed) return; disposed = true; interactionSurface = null; syncInteractionSurface(); washTexture.dispose(); const seen = new Set(); group.traverse(o => { o.shadow?.dispose(); for (const resource of [o.geometry, ...[o.material].flat()]) if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose?.(); } }); group.removeFromParent(); }
  };
}
