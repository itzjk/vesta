import { hardware, tube } from './materials.js';
import { build as buildMars } from './mars.js';
import { buildDeck } from './deck.js';
import { build as buildSilence } from './silence.js';

export const still = 'assets/scene/cabin.jpg';

export function cabinState(state = {}) {
  const frame = state.frame || {};
  return {
    flow: Number.isFinite(frame.airflow_cm_s) ? Math.max(0, frame.airflow_cm_s) : 0,
    flame: frame.flame_visible === true,
    pose: state.activeStep?.state === 'NO_SOURCE' ? 'nosource' : state.activeStep?.step === 'S1' ? 'alert' : state.activeStep ? 'point' : 'standby',
    time: Number.isFinite(state.t) ? state.t : -30,
  };
}

export async function build(ctx) {
  const { THREE, camera } = ctx;
  const sharedOfficer = ctx.vesta;
  const group = new THREE.Group();
  const [vestaModule, flameModule] = await Promise.all([import('./vesta.js'), import('./candle.js')]);
  const officer = sharedOfficer || await vestaModule.build(ctx), flame = await flameModule.build(ctx), silence = await buildSilence(ctx);
  const interior = new THREE.Group();
  group.add(interior);
  if (ctx.world) { silence.group.position.set(0, 2.2, 0); silence.group.scale.setScalar(1.5); }
  if (!sharedOfficer) officer.group.name = 'incident-officer';
  flame.group.name = 'scripted-flame';
  flame.group.position.set(1.25, 0.95, 0.35);
  flame.group.scale.setScalar(0.78);
  if (!sharedOfficer) interior.add(officer.group);
  interior.add(flame.group);
  group.add(silence.group);
  const steel = hardware(THREE, 'metal', { color: 0x737b7e, metalness: .45, roughness: .67, envMapIntensity: .06 });
  const wall = hardware(THREE, 'fabric', { color: 0x626561, roughness: .96, envMapIntensity: .025 });
  const trim = hardware(THREE, 'metal', { color: 0xa0a7aa, roughness: .48, envMapIntensity: .08 });
  const panelVariants = [steel, hardware(THREE, 'metal', { color: 0x676d6b, metalness: .38, roughness: .79, envMapIntensity: .06 }), hardware(THREE, 'metal', { color: 0x80827a, metalness: .4, roughness: .7, envMapIntensity: .06 })];
  const boxes = new Map();
  const box = (w, h, d, x, y, z, material) => {
    if (!boxes.has(material)) boxes.set(material, []);
    boxes.get(material).push([w, h, d, x, y, z]);
  };
  box(10, 4.1, 0.15, 0, 1.3, -1.65, wall);
  if (ctx.world) {
    const deck = buildDeck({ THREE }); deck.group.position.set(0, 1.95, 2.2); deck.group.scale.set(.65, 1, .6); interior.add(deck.group);
    box(10.5, 0.12, 7, 0, -1.22, 1.7, wall);
    box(10.5, 0.12, 7, 0, 3.65, 1.7, wall);
    for (const x of [-5.2, 5.2]) {
      box(0.12, 4.8, 7, x, 1.2, 1.7, steel);
      for (const z of [-1.3, 0.7, 2.7, 4.7]) {
        box(0.14, 4.7, 0.09, x + (x < 0 ? 0.12 : -0.12), 1.2, z, trim);
        box(10.3, 0.08, 0.09, 0, 3.5, z, trim);
        box(10.3, 0.018, 0.03, 0, -1.16, z, trim);
      }
    }
    for (const x of [-3.5, 3.5]) box(0.045, 0.025, 6.6, x, -1.1, 1.7, trim);
  }
  for (let i = 0; i < 6; i++) {
    box(1.5, 3.7, 0.08, -4 + i * 1.6, 1.3, -1.52, panelVariants[i % 3]);
    box(0.025, 4, 0.12, -4.8 + i * 1.6, 1.3, -1.4, trim);
  }
  for (const y of [-0.72, 3.3]) box(10, 0.09, 0.13, 0, y, -1.35, trim);
  const porthole = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 12, 48), trim);
  porthole.position.set(-2.55, 1.65, -1.23); interior.add(porthole);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48), new THREE.MeshPhysicalMaterial({ color: 0xb5cede, transparent: true, opacity: .09, roughness: .1, metalness: .1, clearcoat: 1, envMapIntensity: 1.2 }));
  glass.position.set(-2.55, 1.65, -.52); interior.add(glass);
  const mars = await buildMars({ THREE, mode: ctx.mode, camera }); mars.group.scale.setScalar(.68);
  mars.group.position.set(-2.55, 1.65, -1.3); interior.add(mars.group);
  box(1.35, 1.64, 0.46, 2.05, 0.3, -0.96, wall);
  for (let i = 0; i < 4; i++) {
    box(1.2, 0.3, 0.06, 2.05, -0.3 + i * 0.4, -0.7, steel);
    box(0.06, 0.06, 0.03, 1.56, -0.3 + i * 0.4, -0.65, trim);
  }
  box(1.8, 0.65, 0.3, 2.2, 2.55, -0.85, wall);
  for (let i = 0; i < 10; i++) box(0.06, 0.53, 0.06, 1.48 + i * 0.16, 2.55, -0.65, trim);
  const bag = hardware(THREE, 'fabric', { color: 0x777364, roughness: .97, bumpScale: .018, envMapIntensity: .025 });
  const strap = hardware(THREE, 'fabric', { color: 0x272a27, roughness: 1, envMapIntensity: 0 });
  box(.82, .64, .3, -4, .15, -1.12, bag);
  for (const x of [-4.25, -3.75]) box(.055, .72, .34, x, .15, -1.1, strap);
  for (let i = 0; i < 15; i++) box(.012 + Math.sin(i * 17) ** 2 * .09, .003, .004, .19 + Math.sin(i * 12) * .16, -.35 + i * .055, -.968, trim);
  const matrix = new THREE.Matrix4(), orientation = new THREE.Quaternion();
  for (const [material, items] of boxes) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
    items.forEach(([w, h, d, x, y, z], i) => {
      matrix.compose(new THREE.Vector3(x, y, z), orientation, new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; interior.add(mesh);
  }
  const air = new THREE.Group(); air.name = 'scripted-airflow'; interior.add(air);
  const airMaterial = new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: 0.55 });
  const streaks = Array.from({ length: ctx.mode === 'low' ? 10 : 20 }, (_, i) => {
    const path = new THREE.CubicBezierCurve3(new THREE.Vector3(1.5 + (i % 7) * 0.19, 2.5, -0.59), new THREE.Vector3(1.1, 2.5 + (i % 4) * 0.07, 0), new THREE.Vector3(-0.3, 2.7 + (i % 6) * 0.06, 0.1), new THREE.Vector3(-1.9, 2.5 + (i % 5) * 0.09, 0.25));
    const positions = new Float32Array(7 * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, airMaterial); air.add(line);
    return { path, geometry, positions, phase: i / (ctx.mode === 'low' ? 10 : 20) };
  });
  const dustGeometry = new THREE.BufferGeometry(), dustPositions = new Float32Array((ctx.mode === 'low' ? 20 : 48) * 3);
  for (let i = 0; i < dustPositions.length; i++) dustPositions[i] = Math.sin(i * 127.1 + 0.7) * (i % 3 === 1 ? 1.6 : 4);
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xb9ae9d, size: 0.012, transparent: true, opacity: 0.25, depthWrite: false }));
  if (ctx.world) interior.add(dust);
  const ambient = new THREE.HemisphereLight(0x9baab5, 0x15100d, .045);
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0xd4dacd, emissive: 0xe0d6bd, emissiveIntensity: 1.6, roughness: .45 });
  for (const x of [-3.2, 2.8]) {
    const fixtureZ = x < 0 ? 1.4 : -.6;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(.78, .14, .32), steel); housing.position.set(x, 3.44, fixtureZ); interior.add(housing);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(.62, .025, .22), fixtureMaterial); lens.position.set(x, 3.36, fixtureZ + .01); lens.layers.enable(1); interior.add(lens);
    const pool = new THREE.SpotLight(0xe5dbc8, 11, 9, .72, .62, 2); pool.position.set(x, 3.28, fixtureZ + .1); pool.target.position.set(x * .75, .25, -.25);
    pool.castShadow = ctx.mode !== 'low'; pool.shadow.mapSize.set(512, 512); pool.shadow.bias = -.0001; pool.shadow.normalBias = .025; pool.shadow.radius = 2;
    interior.add(pool, pool.target);
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.76, .35), new THREE.MeshStandardMaterial({ color: 0x14252b, emissive: 0x6e9eac, emissiveIntensity: .65, roughness: .52 }));
  screen.position.set(2.05, 1.15, -.65); screen.layers.enable(1); interior.add(screen);
  const screenLight = new THREE.PointLight(0x8cb2c0, .32, 2.8, 2); screenLight.position.set(2.05, 1.16, -.52); interior.add(screenLight);
  const alarm = new THREE.PointLight(0xe09a43, 0, 5, 2);
  alarm.name = 'scripted-alarm-light';
  alarm.position.set(2, 2.6, -.45);
  const alarmLens = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6a4020, emissive: 0xe09a43, emissiveIntensity: 0, roughness: .3 }));
  alarmLens.position.copy(alarm.position); interior.add(alarmLens, alarm, ambient);
  alarmLens.layers.enable(1);
  const rubber = hardware(THREE, 'metal', { color: 0x1b2025, roughness: .85, metalness: .08 });
  for (const x of [-3.8, .2, 3.3]) {
    tube(THREE, [[x, -.6, -1.25], [x, -.35, -.98], [x, .7, -.98], [x, .9, -1.25]], .035, trim, interior);
    tube(THREE, [[x - .1, -1, -1.3], [x - .12, .3, -1.2], [x + .15, 1.2, -1.2], [x + .15, 2.9, -1.3]], .026, rubber, interior);
  }
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.78, .78, .24, 48, 1, true), trim); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(-2.55, 1.65, -1.16); interior.add(sleeve);
  return {
    group, still,
    update(t, state) {
      const s = cabinState(state), tm = t;
      mars.update(tm);
      dust.rotation.y = tm * 0.012;
      dust.position.y = Math.sin(tm * 0.18) * 0.08;
      const outside = ctx.world && state.shot === 'silence';
      interior.visible = !outside;
      camera.userData.focusDistance = outside ? (camera.aspect < .9 ? 27 : 10) : (camera.aspect < .9 ? 13.5 : 8.5);
      camera.userData.aperture = outside ? .5 : 1.3;
      silence.group.visible = ctx.world ? outside : true;
      const smoke = Number(state.frame?.smoke_pct_alarm) || 0;
      const alarmThreshold = state.alarmThreshold;
      const inAlarm = Number.isFinite(alarmThreshold) && smoke >= alarmThreshold;
      const alarmGain = inAlarm ? 0.65 + 0.35 * Math.sin(tm * 4.2) ** 2 : 0;
      alarm.intensity = alarmGain * 3.8;
      alarmLens.material.emissiveIntensity = alarmGain * 2;
      const aspect = ctx.size().width / ctx.size().height;
      if (!ctx.world && camera.userData.cabinAspect !== aspect) {
        camera.userData.cabinAspect = aspect;
        camera.fov = 35; camera.position.set(0, 0.25, Math.max(9.3, 11.4 / aspect));
        camera.lookAt(0, 0.25, 0); camera.updateProjectionMatrix();
      }
      officer.group.visible = !outside;
      officer.update(tm, { ...officer.defaults, ...(state.officerAt || { x: -0.95, y: 0.65, z: 0.5 }), scale: ctx.world ? (state.officerScale || 2.1) : 2.6, pose: s.pose,
        blink: Math.max(0, 1 - Math.abs((tm % 4.7) - 4.4) / 0.09),
        yaw: s.pose === 'point' ? 0.16 : -0.12, lookX: s.pose === 'point' ? 0.5 : 0, eyeWide: s.pose === 'alert' ? 1 : 0.1,
        mouth: s.pose === 'alert' ? 1 : 0, browTilt: s.pose === 'nosource' ? 0.7 : -0.4,
        armL: s.pose === 'nosource' || s.pose === 'alert' ? 0.85 : 0.15, armR: s.pose === 'point' ? 0.75 : s.pose === 'nosource' || s.pose === 'alert' ? 0.85 : 0.25,
        armFwd: s.pose === 'point' ? 0.6 : 0, roll: s.pose === 'nosource' ? -0.12 : s.pose === 'point' ? -0.04 : 0, browY: s.pose === 'alert' ? 0.9 : 0, beacon: state.alarmed ? 1.2 : 0.2, beaconWarm: 1, thrust: 0.45 });
      flame.group.visible = s.flame;
      flame.update(tm, { ...flame.defaults, space: 1 });
      flame.group.traverse(o => { if (o.name === 'candle-key') o.visible = s.flame; });
      air.visible = s.flow > 0;
      if (s.flow > 0) for (const item of streaks) {
        const head = ((Number(state.flowTime) || 0) * 0.32 + item.phase) % 1;
        for (let j = 0; j < 7; j++) item.path.getPoint(Math.max(0, head - j * 0.012)).toArray(item.positions, j * 3);
        item.geometry.attributes.position.needsUpdate = true;
      }
      silence.update(tm, state, camera);
      group.userData.incident = { ...s, signal: state.clock?.progress ?? null };
    },
    dispose() { if (!sharedOfficer) officer.dispose?.(); flame.dispose?.(); silence.dispose?.(); },
  };
}
