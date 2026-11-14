import { hardware, softShadow, tube, balanceWorldLight } from '../scene/materials.js';
import { photoPlanet, NASA_TEXTURES } from '../scene/imagery.js';
import { build as buildMars } from '../scene/mars.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, db, stage } = world;
  const balanceLight = balanceWorldLight(world, .12);
  const group = new THREE.Group();
  group.name = 'transit-ship';
  stage.scene.add(group);
  const hull = hardware(THREE, 'fabric', { color: 0xc9c6b8, roughness: .62, metalness: .16 });
  const seam = hardware(THREE, 'metal', { color: 0x8a9297, roughness: .34 });
  const dark = hardware(THREE, 'metal', { color: 0x18242f, roughness: .48 });
  const rust = hardware(THREE, 'metal', { color: 0xc8553d, roughness: .5, metalness: .3 });
  const vessel = new THREE.Group();
  vessel.rotation.y = -.42; vessel.position.z = 7;
  group.add(vessel);
  function cylinder(radius, length, z, material, open = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, stage.mode === 'low' ? 24 : 48, 1, open), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.z = z; mesh.castShadow = mesh.receiveShadow = true; vessel.add(mesh); return mesh;
  }
  function ring(radius, tube, z, material = seam) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48), material);
    mesh.position.z = z; mesh.castShadow = mesh.receiveShadow = true; vessel.add(mesh); return mesh;
  }
  function strut(a, b, radius = .035) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), seam);
    mesh.position.copy(av).add(bv).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); vessel.add(mesh);
  }
  cylinder(1.25, 3.3, .1, hull, true);
  cylinder(.93, 1.6, -4.8, hull);
  cylinder(.58, .8, -6, dark);
  cylinder(.82, .22, 1.84, dark, true);
  ring(.79, .09, 1.99); ring(.64, .035, 2.05, rust);
  for (let i = 0; i < 8; i++) ring(1.27, .025, -1.5 + i * .45);
  for (let i = 0; i < 5; i++) {
    const z = -1.7 - i * .58;
    ring(1.1, .04, z);
    for (let j = 0; j < 6; j++) {
      const a = j * Math.PI / 3, b = (j + 1) * Math.PI / 3;
      strut([Math.cos(a) * 1.1, Math.sin(a) * 1.1, z], [Math.cos(b) * 1.1, Math.sin(b) * 1.1, z - .58]);
      strut([Math.cos(a) * 1.1, Math.sin(a) * 1.1, z], [Math.cos(a) * 1.1, Math.sin(a) * 1.1, z - .58]);
    }
  }
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.8, .055, 1.5), dark);
    wing.position.set(side * 3, 0, -2.5); vessel.add(wing);
    for (let i = 0; i < 8; i++) {
      const wire = new THREE.Mesh(new THREE.BoxGeometry(.018, .065, 1.5), seam);
      wire.position.set(side * (1.25 + i * .48), .004, -2.5); vessel.add(wire);
    }
  }
  const panelMat = hardware(THREE, 'metal', { color: 0xabaea7, roughness: .6, metalness: .42 });
  for (let ringIndex = 0; ringIndex < 6; ringIndex++) for (let sector = 0; sector < 10; sector++) {
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(1.259, 1.259, .48, 5, 1, true, sector * Math.PI / 5 + .012, Math.PI / 5 - .024), (ringIndex + sector) % 3 ? hull : panelMat);
    panel.rotation.x = Math.PI / 2; panel.position.z = -1.28 + ringIndex * .53; panel.castShadow = panel.receiveShadow = true; vessel.add(panel);
  }
  for (const side of [-1, 1]) {
    tube(THREE, [[side * 1.08, -.42, -1.3], [side * 1.15, -.46, -.8], [side * 1.15, -.46, .8], [side * .95, -.42, 1.6]], .024, dark, vessel);
    for (const z of [-.8, .3, 1.1]) tube(THREE, [[side * .82, .94, z], [side * .85, 1.04, z], [side * .36, 1.34, z], [side * .31, 1.24, z]], .028, seam, vessel);
    for (let x = 0; x < 12; x++) for (let z = 0; z < 4; z++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(.28, .012, .3), panelMat); cell.material = dark;
      cell.position.set(side * (1.2 + x * .3), .038, -3.06 + z * .36); vessel.add(cell);
    }
  }
  const mars = await buildMars({ THREE, mode: stage.mode, camera: stage.camera });
  mars.group.position.set(-11, 2, -23); mars.group.scale.setScalar(3.1); group.add(mars.group);
  const earth = await photoPlanet(THREE, 'earth', stage.mode); earth.scale.setScalar(.22);
  earth.position.set(6, 3.6, -5); group.add(earth);
  const from = new THREE.Vector3(.5, 1.25, 6.7), to = earth.position.clone();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: .4 }));
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8), new THREE.MeshBasicMaterial({ color: 0xede4d4 }));
  group.add(line, pulse); pulse.layers.enable(1);
  const sun = softShadow(new THREE.DirectionalLight(0xffeed5, 3.2), 1024, 12); sun.position.set(-6, 8, 8);
  group.add(sun, sun.target, new THREE.HemisphereLight(0xede4d4, 0x12100e, .8));
  const comm = db.findingById[db.scenario?.meta?.comm?.one_way_finding];
  const panel = document.createElement('section'); panel.className = 'world-transit'; panel.style.width = 'min(560px, 88vw)';
  const title = document.createElement('h1'); title.textContent = 'VESTA';
  const sentence = document.createElement('p');
  if (comm) sentence.append(world.cite(comm.quote, comm.id));
  else sentence.textContent = 'Communication evidence unavailable.';
  const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = 'Enter the cabin'; skip.dataset.transitSkip = ''; skip.hidden = Boolean(world.overlay?.querySelector('.world-skip'));
  const advance = () => world.navigate ? world.navigate('flame') : world.go('#/brief?station=flame');
  skip.addEventListener('click', advance);
  panel.append(title, sentence, skip);
  const credits = document.createElement('p');
  for (const name of ['mars', 'earth', 'stars']) { const entry = NASA_TEXTURES[name], link = document.createElement('a'); link.href = `https://images.nasa.gov/details/${entry.id}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `${entry.title}, ${entry.credit}`; credits.append(link, document.createElement('br')); } panel.append(credits);
  const holo = world.hologram(panel, { at: [.5, 1.25, 6.7], label: 'Read the communication observation and image credits', width: 440 });
  let active = false, started, advanced = false;
  const api = {
    group, anchor: [0, 0, 0], camera: { position: [8, 3, 19], target: [0, 0, 4], fov: 38 },
    enter() { balanceLight(true); active = true; started = undefined; advanced = false; group.visible = true; const compact = comm?.quote?.match(/up to [^.]+/i)?.[0] || comm?.quote; world.answer?.(compact ? compact[0].toUpperCase() + compact.slice(1) : 'Communication evidence unavailable.'); },
    leave() { balanceLight(false); active = false; holo.close(); },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (started === undefined) started = t;
      const local = state.localTime ?? t - started;
      const still = state.capture || world.params?.capture === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      const phone = stage.camera.aspect < .9;
      earth.quaternion.copy(stage.camera.quaternion);
      earth.position.set(phone ? 0 : 6, phone ? 5 : 3.6, phone ? -2 : -5); to.copy(earth.position);
      line.geometry.attributes.position.setXYZ(1, to.x, to.y, to.z); line.geometry.attributes.position.needsUpdate = true;
      mars.update(still ? 2 : t);
      if (!still && world.host?.dataset.film !== 'true' && local > 2.6) {
        const approach = smooth((local - 2.6) / 1.4);
        world.setCamera?.({ position: [8 + (-.8 - 8) * approach, 3 + (.35 - 3) * approach, 19 + (11.1 - 19) * approach], target: [0, .1 * approach, 4 * (1 - approach)], fov: 38 });
      }
      vessel.position.y = still ? 0 : Math.sin(local * .6) * .035;
      const progress = smooth((local - .45) / 2.9);
      pulse.position.lerpVectors(from, to, progress);
      pulse.visible = local < 3.5; line.material.opacity = .25 + .25 * smooth(local / .6);
      if (!still && world.host?.dataset.film !== 'true' && local >= 4 && !advanced) { advanced = true; advance(); }
    },
    holograms: () => [holo],
    dispose() { balanceLight(false); skip.removeEventListener('click', advance); holo.dispose(); group.removeFromParent(); }
  };
  group.visible = false;
  return api;
}
