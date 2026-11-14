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

export async function build({ THREE }) {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xede4d4, roughness: 0.48, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x5d7185, roughness: 0.6, metalness: 0.7 });
  const foil = new THREE.MeshStandardMaterial({ color: 0x9e794c, roughness: 0.5, metalness: 0.72 });
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
  ship.rotation.set(0.35, -0.25, -0.08); ship.position.set(-2.4, -1.7, 0); group.add(ship);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 18), new THREE.MeshStandardMaterial({ color: 0x8fa3b5, roughness: 0.85, metalness: 0.05 }));
  earth.position.set(2.5, -1.47, -1.1); group.add(earth);
  for (let i = 0; i < 3; i++) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.223, 16, 8, i * 1.8, 0.65, 0.6 + i * 0.25, 0.7), new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 1 }));
    earth.add(patch);
  }
  const start = new THREE.Vector3(-1.78, -1.56, 0), end = earth.position.clone();
  const curve = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(0.2, -1.12, -0.5), end);
  const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineBasicMaterial({ color: 0x8fa3b5, transparent: true, opacity: 0.32 }));
  group.add(route);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xede4d4 });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), pulseMaterial);
  const reply = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fa3b5 }));
  group.add(pulse, reply);
  return {
    group,
    update(t, state) {
      const s = signalState(state.clock, state.elapsed, state.alarmed);
      pulse.visible = s.visible; reply.visible = s.visible && s.returning;
      pulse.position.copy(curve.getPoint(s.outbound));
      reply.position.copy(curve.getPoint(1 - s.inbound));
      route.material.opacity = s.visible ? 0.48 : 0.17;
    },
  };
}
