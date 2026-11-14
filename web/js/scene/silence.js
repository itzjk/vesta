import { hardware } from './materials.js';
import { photoPlanet } from './imagery.js';
export function signalState(clock = {}, elapsed = -1, alarmed = false) {
  const known = Number.isFinite(clock.heard) && clock.heard > 0;
  const returning = known && Number.isFinite(clock.reply) && clock.reply > clock.heard && elapsed >= clock.heard;
  return {
    visible: known && alarmed,
    outbound: Math.min(1, Math.max(0, Number(clock.progress) || 0)),
    returning,
    inbound: returning ? Math.min(1, Math.max(0, (elapsed - clock.heard) / (clock.reply - clock.heard))) : 0,
  };
}

export async function build({ THREE, camera, mode }) {
  const group = new THREE.Group();
  const hull = hardware(THREE, 'fabric', { color: 0xc9c6b8, roughness: .64, metalness: .16 });
  const metal = hardware(THREE, 'metal', { color: 0x7b8792, roughness: .42 });
  const foil = hardware(THREE, 'metal', { color: 0x9e794c, roughness: .5 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x303b43, roughness: 0.7, metalness: 0.5 });
  const ship = new THREE.Group();
  const cylinder = (r, len, x, material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), material);
    m.rotation.z = Math.PI / 2; m.position.x = x; ship.add(m); return m;
  };
  cylinder(0.15, 0.46, -0.2, hull); cylinder(0.12, 0.29, 0.32, hull);
  cylinder(0.042, 1, 0, metal); cylinder(0.1, 0.14, -0.51, foil);
  for (const x of [-0.36, -0.2, -0.04, 0.24, 0.4]) cylinder(0.153, 0.012, x, metal);
  for (const y of [-0.31, 0.31]) {
    const array = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.22, 0.025), panel);
    array.position.set(0.05, y, 0); ship.add(array);
    for (let i = 0; i < 5; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.22, 0.027), metal);
      seam.position.set(-0.19 + i * 0.12, y, 0); ship.add(seam);
    }
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hull);
  dish.rotation.z = -0.7; dish.position.set(0.28, 0.24, 0.08); ship.add(dish);
  ship.rotation.set(0.35, -0.25, -0.08); ship.scale.setScalar(1.25); ship.position.set(-2.5, -1.95, 0); group.add(ship);
  const earth = await photoPlanet(THREE, 'earth', mode); earth.scale.setScalar(.34);
  earth.position.set(2.65, -1.85, -0.4); group.add(earth);
  const start = new THREE.Vector3(-1.65, -1.82, 0), end = earth.position.clone();
  const curve = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(0.2, -1.12, -0.3), end);
  const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: 0.32 }));
  group.add(route);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xede4d4 });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), pulseMaterial);
  const reply = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fa3b5 }));
  group.add(pulse, reply); pulse.layers.enable(1); reply.layers.enable(1);
  return {
    group,
    update(t, state) {
      if (camera) earth.quaternion.copy(camera.quaternion);
      const s = signalState(state.clock, state.elapsed, state.alarmed);
      pulse.visible = s.visible; reply.visible = s.visible && s.returning;
      pulse.position.copy(curve.getPoint(s.outbound));
      reply.position.copy(curve.getPoint(1 - s.inbound));
      route.material.opacity = s.visible ? 0.48 : 0.17;
    },
  };
}
