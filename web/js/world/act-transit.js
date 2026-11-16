import { softShadow, balanceWorldLight } from '../scene/materials.js';
import { photoPlanet, globePlanet, NASA_TEXTURES } from '../scene/imagery.js';
import { build as buildMars } from '../scene/mars.js';
import { buildShip } from '../scene/ship.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, db, stage } = world;
  const balanceLight = balanceWorldLight(world, 0);
  const group = new THREE.Group();
  group.name = 'transit-ship';
  stage.scene.add(group);
  const ship = buildShip({ THREE, mode: stage.mode }), vessel = ship.group;
  vessel.rotation.y = -.42; vessel.position.z = 7; group.add(vessel);
  const mars = await buildMars({ THREE, mode: stage.mode, camera: stage.camera });
  mars.group.position.set(-11, 2, -23); mars.group.scale.setScalar(3.1); group.add(mars.group);
  const earth = await globePlanet(THREE, 'earth', stage.mode); earth.scale.setScalar(.22);
  earth.position.set(6, 3.6, -5); group.add(earth);
  const from = new THREE.Vector3(.5, 1.25, 6.7), to = earth.position.clone();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: .4 }));
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8), new THREE.MeshBasicMaterial({ color: 0xede4d4 }));
  group.add(line, pulse); pulse.layers.enable(1);
  const sun = softShadow(new THREE.DirectionalLight(0xfff3df, 3.6), stage.mode === 'low' ? 512 : 1024, 12);
  sun.position.set(6, 8, 12); sun.target.position.set(0, 0, 4); sun.shadow.radius = 0;
  const bounce = new THREE.PointLight(0xb65b35, 8, 0, 2); bounce.position.copy(mars.group.position);
  group.add(sun, sun.target, bounce);
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
  for (const name of ['marsGlobe', 'earthGlobe', 'stars']) { const entry = NASA_TEXTURES[name], link = document.createElement('a'); link.href = entry.url || `https://images.nasa.gov/details/${entry.id}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `${entry.title}, ${entry.credit}`; credits.append(link, document.createElement('br')); } panel.append(credits);
  const holo = world.hologram(panel, { at: [.5, 1.25, 6.7], label: 'Read the communication observation and image credits', width: 440 });
  let active = false, started;
  const api = {
    group, anchor: [0, 0, 0], camera: () => { const spread = Math.min(1, .49 / stage.camera.aspect); return stage.camera.aspect < .9 ? { position: [16 * spread, 6 * spread, 3 + 36 * spread], target: [0, 0, 3], fov: 44 } : { position: [8, 3, 19], target: [0, 0, 4], fov: 38 }; },
    enter() { balanceLight(true); active = true; started = undefined; group.visible = true; const compact = comm?.quote?.match(/up to [^.]+/i)?.[0] || comm?.quote; world.answer?.(compact ? compact[0].toUpperCase() + compact.slice(1) : 'Communication evidence unavailable.'); },
    leave() { delete stage.camera.userData.focusDistance; delete stage.camera.userData.aperture; balanceLight(false); active = false; holo.close(); },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (started === undefined) started = t;
      const local = state.localTime ?? t - started;
      const still = state.capture || world.params?.capture === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      const phone = stage.camera.aspect < .9;
      earth.userData.spin(still ? 2 : t);
      earth.position.set(phone ? 0 : 6, phone ? 5 : 3.6, phone ? -2 : -5); to.copy(earth.position);
      line.geometry.attributes.position.setXYZ(1, to.x, to.y, to.z); line.geometry.attributes.position.needsUpdate = true;
      mars.update(still ? 2 : t);
      stage.camera.userData.focusDistance = stage.camera.position.distanceTo(new THREE.Vector3(0, 0, 6));
      stage.camera.userData.aperture = .55;
      ship.update(still ? 2 : t, still ? undefined : local);
      // Free drift: 16 s bob, 19 s roll, 14 s pitch. The hotspot and the line start stay at their fixed world point.
      vessel.position.y = still ? 0 : Math.sin(local * .393) * .06;
      vessel.rotation.z = still ? 0 : Math.sin(local * .331) * .045;
      vessel.rotation.x = still ? 0 : Math.sin(local * .449 + 1) * .02;
      // The signal leaves for Earth again every 4.6 s; frozen time keeps the single opening pass.
      const since = still ? local - .45 : (local - .45) % 4.6;
      pulse.position.lerpVectors(from, to, smooth(since / (still ? 2.9 : 4.6)));
      pulse.visible = still ? local < 3.5 : local > .45; line.material.opacity = .25 + .25 * smooth(local / .6);
    },
    holograms: () => [holo],
    dispose() { balanceLight(false); skip.removeEventListener('click', advance); holo.dispose(); group.removeFromParent(); }
  };
  group.visible = false;
  return api;
}
