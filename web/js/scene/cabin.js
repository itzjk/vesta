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
  const group = new THREE.Group();
  const [vestaModule, flameModule] = await Promise.all([import('./vesta.js'), import('./flame.js')]);
  const officer = await vestaModule.build(ctx), flame = await flameModule.build(ctx), silence = await buildSilence(ctx);
  officer.group.name = 'incident-officer';
  flame.group.name = 'scripted-flame';
  flame.group.position.set(1.25, 0.95, 0.35);
  flame.group.scale.setScalar(0.78);
  group.add(officer.group, flame.group, silence.group);
  const steel = new THREE.MeshStandardMaterial({ color: 0x252d35, metalness: 0.4, roughness: 0.65 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x171d23, metalness: 0.25, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x58616a, metalness: 0.6, roughness: 0.45 });
  const boxes = new Map();
  const box = (w, h, d, x, y, z, material) => {
    if (!boxes.has(material)) boxes.set(material, []);
    boxes.get(material).push([w, h, d, x, y, z]);
  };
  box(10, 4.1, 0.15, 0, 1.3, -1.65, wall);
  for (let i = 0; i < 6; i++) {
    box(1.5, 3.7, 0.08, -4 + i * 1.6, 1.3, -1.52, steel);
    box(0.025, 4, 0.12, -4.8 + i * 1.6, 1.3, -1.4, trim);
  }
  for (const y of [-0.72, 3.3]) box(10, 0.09, 0.13, 0, y, -1.35, trim);
  const porthole = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 12, 48), trim);
  porthole.position.set(-2.55, 1.65, -1.23); group.add(porthole);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48), new THREE.MeshBasicMaterial({ color: 0x12100e }));
  glass.position.set(-2.55, 1.65, -1.3); group.add(glass);
  const mars = new THREE.Mesh(new THREE.SphereGeometry(0.68, 32, 24), new THREE.MeshStandardMaterial({ color: 0x8f3a28, emissive: 0x6b2010, emissiveIntensity: 0.5, roughness: 1 }));
  mars.position.set(-2.55, 1.65, -1.3); group.add(mars);
  box(1.35, 1.64, 0.46, 2.05, 0.3, -0.96, wall);
  for (let i = 0; i < 4; i++) {
    box(1.2, 0.3, 0.06, 2.05, -0.3 + i * 0.4, -0.7, steel);
    box(0.06, 0.06, 0.03, 1.56, -0.3 + i * 0.4, -0.65, trim);
  }
  box(1.8, 0.65, 0.3, 2.2, 2.55, -0.85, wall);
  for (let i = 0; i < 10; i++) box(0.06, 0.53, 0.06, 1.48 + i * 0.16, 2.55, -0.65, trim);
  const matrix = new THREE.Matrix4(), orientation = new THREE.Quaternion();
  for (const [material, items] of boxes) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
    items.forEach(([w, h, d, x, y, z], i) => {
      matrix.compose(new THREE.Vector3(x, y, z), orientation, new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  const air = new THREE.Group(); air.name = 'scripted-airflow'; group.add(air);
  const airMaterial = new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: 0.55 });
  const streaks = Array.from({ length: ctx.mode === 'low' ? 10 : 20 }, (_, i) => {
    const path = new THREE.CubicBezierCurve3(new THREE.Vector3(1.5 + (i % 7) * 0.19, 2.5, -0.59), new THREE.Vector3(1.1, 2.5 + (i % 4) * 0.07, 0), new THREE.Vector3(-0.3, 2.7 + (i % 6) * 0.06, 0.1), new THREE.Vector3(-1.9, 2.5 + (i % 5) * 0.09, 0.25));
    const positions = new Float32Array(7 * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, airMaterial); air.add(line);
    return { path, geometry, positions, phase: i / (ctx.mode === 'low' ? 10 : 20) };
  });
  const ambient = new THREE.HemisphereLight(0xede4d4, 0x171d23, 1.65);
  const key = new THREE.DirectionalLight(0xffd7a5, 3.3); key.position.set(-4, 5, 7);
  const rim = new THREE.DirectionalLight(0x8fa3b5, 2.8); rim.position.set(4, 1, 4);
  group.add(ambient, key, rim);
  return {
    group, still,
    update(t, state) {
      const s = cabinState(state), tm = t;
      const aspect = ctx.size().width / ctx.size().height;
      if (camera.userData.cabinAspect !== aspect) {
        camera.userData.cabinAspect = aspect;
        camera.fov = 35; camera.position.set(0, 0.25, Math.max(9.3, 11.4 / aspect));
        camera.lookAt(0, 0.25, 0); camera.updateProjectionMatrix();
      }
      officer.update(tm, { ...officer.defaults, x: -0.95, y: 0.65, z: 0.5, scale: 2.6, pose: s.pose,
        yaw: s.pose === 'point' ? 0.16 : -0.12, lookX: s.pose === 'point' ? 0.5 : 0, eyeWide: s.pose === 'alert' ? 1 : 0.1,
        mouth: s.pose === 'alert' ? 1 : 0, browTilt: s.pose === 'nosource' ? 0.7 : -0.4,
        armL: s.pose === 'nosource' || s.pose === 'alert' ? 0.85 : 0.15, armR: s.pose === 'point' ? 0.75 : s.pose === 'nosource' || s.pose === 'alert' ? 0.85 : 0.25,
        armFwd: s.pose === 'point' ? 0.6 : 0, roll: s.pose === 'nosource' ? -0.12 : s.pose === 'point' ? -0.04 : 0, browY: s.pose === 'alert' ? 0.9 : 0, beacon: state.alarmed ? 1.2 : 0.2, beaconWarm: 1, thrust: 0.45 });
      flame.group.visible = s.flame;
      flame.update(tm, { ...flame.defaults, space: 1 });
      air.visible = s.flow > 0;
      if (s.flow > 0) for (const item of streaks) {
        const head = ((Number(state.flowTime) || 0) * 0.32 + item.phase) % 1;
        for (let j = 0; j < 7; j++) item.path.getPoint(Math.max(0, head - j * 0.012)).toArray(item.positions, j * 3);
        item.geometry.attributes.position.needsUpdate = true;
      }
      silence.update(tm, state, camera);
      group.userData.incident = { ...s, signal: state.clock?.progress ?? null };
    },
    dispose() { officer.dispose?.(); flame.dispose?.(); silence.dispose?.(); },
  };
}
