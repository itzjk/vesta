import { softShadow } from './materials.js';
import { buildShip } from './ship.js';
import { build as buildMars } from './mars.js';
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
  const vessel = buildShip({ THREE, mode }), ship = vessel.group;
  ship.rotation.set(.35, -1.05, -.08); ship.scale.setScalar(.26); ship.position.set(-2.5, -1.95, 0); group.add(ship);
  const sun = softShadow(new THREE.DirectionalLight(0xfff3df, 3.6), mode === 'low' ? 512 : 1024, 6);
  sun.position.set(-7, 8, 9); sun.target.position.copy(ship.position); sun.shadow.radius = 0;
  const bounce = new THREE.PointLight(0xb65b35, 2.4, 0, 2); bounce.position.set(-5.9, -.6, -12);
  group.add(sun, sun.target, bounce);
  const mars = await buildMars({ THREE, mode, camera, sunDirection: [-4.5, 9.95, 9] }); mars.group.position.set(-5.9, -.6, -12); mars.group.scale.setScalar(2.8); group.add(mars.group);
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
      vessel.update(t); mars.update(t);
      const s = signalState(state.clock, state.elapsed, state.alarmed);
      pulse.visible = s.visible; reply.visible = s.visible && s.returning;
      pulse.position.copy(curve.getPoint(s.outbound));
      reply.position.copy(curve.getPoint(1 - s.inbound));
      route.material.opacity = s.visible ? 0.48 : 0.17;
    },
  };
}
