import { build as buildMars } from '../scene/mars.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, db, stage } = world;
  const group = new THREE.Group();
  group.name = 'transit-ship';
  stage.scene.add(group);
  const hull = new THREE.MeshStandardMaterial({ color: 0xede4d4, roughness: .64, metalness: .38 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x5d5750, roughness: .46, metalness: .8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211e1b, roughness: .75, metalness: .5 });
  const rust = new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: .5, metalness: .3 });
  const vessel = new THREE.Group();
  vessel.rotation.y = -.42; vessel.position.z = 7;
  group.add(vessel);
  function cylinder(radius, length, z, material, open = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, stage.mode === 'low' ? 24 : 48, 1, open), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.z = z; vessel.add(mesh); return mesh;
  }
  function ring(radius, tube, z, material = seam) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48), material);
    mesh.position.z = z; vessel.add(mesh); return mesh;
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
  const mars = await buildMars({ THREE, mode: stage.mode });
  mars.group.position.set(-11, 2, -23); mars.group.scale.setScalar(3.1); group.add(mars.group);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8fa3b5 }));
  earth.position.set(6, 3.6, -5); group.add(earth);
  const from = new THREE.Vector3(.5, 1.25, 6.7), to = earth.position.clone();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: .4 }));
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8), new THREE.MeshBasicMaterial({ color: 0xede4d4 }));
  group.add(line, pulse);
  const sun = new THREE.DirectionalLight(0xffdfb5, 4); sun.position.set(-6, 8, 8);
  group.add(sun, new THREE.HemisphereLight(0xede4d4, 0x12100e, .8));
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
  const holo = world.hologram(panel, { at: [0, -2.2, 1], width: 560 });
  let active = false, started, advanced = false;
  const api = {
    group, anchor: [0, 0, 0], camera: { position: [8, 3, 19], target: [0, 0, 4], fov: 38 },
    enter() { active = true; started = undefined; advanced = false; group.visible = true; holo.open(); },
    leave() { active = false; holo.close(); },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (started === undefined) started = t;
      const local = state.localTime ?? t - started;
      const still = state.capture || world.params?.capture === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      const phone = stage.camera.aspect < .9;
      earth.position.set(phone ? 0 : 6, phone ? 5 : 3.6, phone ? -2 : -5); to.copy(earth.position);
      line.geometry.attributes.position.setXYZ(1, to.x, to.y, to.z); line.geometry.attributes.position.needsUpdate = true;
      mars.update(still ? 2 : t);
      if (!still && local > 2.6) {
        const approach = smooth((local - 2.6) / 1.4);
        world.setCamera?.({ position: [8 + (-.8 - 8) * approach, 3 + (.35 - 3) * approach, 19 + (11.1 - 19) * approach], target: [0, .1 * approach, 4 * (1 - approach)], fov: 38 });
      }
      vessel.position.y = still ? 0 : Math.sin(local * .6) * .035;
      const progress = smooth((local - .45) / 2.9);
      pulse.position.lerpVectors(from, to, progress);
      pulse.visible = local < 3.5; line.material.opacity = .25 + .25 * smooth(local / .6);
      if (!still && local >= 4 && !advanced) { advanced = true; advance(); }
    },
    holograms: () => [holo],
    dispose() { skip.removeEventListener('click', advance); holo.dispose(); group.removeFromParent(); }
  };
  group.visible = false;
  return api;
}
