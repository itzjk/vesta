import { build as buildVesta } from './vesta.js';
import { build as buildFlame } from './flame.js';
import { build as buildMars } from './mars.js';

export const still = 'assets/scene/hero.jpg';

export async function build(ctx) {
  const { THREE, camera } = ctx;
  const group = new THREE.Group();
  const [vesta, flame, mars] = await Promise.all([buildVesta(ctx), buildFlame({ ...ctx, opaqueFlame: true }), buildMars(ctx)]);
  group.add(vesta.group, flame.group, mars.group);
  const wall = new THREE.MeshStandardMaterial({ color: 0x171716, roughness: .84, metalness: .24 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x242321, roughness: .61, metalness: .5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x696258, roughness: .44, metalness: .72 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x07090b });
  const box = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  box(26, 16, .16, 0, 0, -3.3, wall);
  const floor = box(26, .16, 12, 0, -2.5, -1, panel);
  box(.06, 10, .07, 6.0, 0, -3.16, trim);
  box(.06, 10, .07, -.25, 0, -3.16, panel);
  for (let i = 0; i < 4; i++) box(3.4, .018, .04, 6.7, -1.5 + i * 1.05, -3.14, panel);
  const porthole = new THREE.Group();
  const recess = new THREE.Mesh(new THREE.CircleGeometry(1.94, 64), dark);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.98, .12, 12, 64), trim);
  const inset = new THREE.Mesh(new THREE.TorusGeometry(1.83, .035, 8, 64), panel);
  porthole.add(recess, rim, inset); group.add(porthole);
  for (let i = 0; i < 12; i++) {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(.034, 8, 6), panel);
    bolt.position.set(Math.cos(i * Math.PI / 6) * 1.98, Math.sin(i * Math.PI / 6) * 1.98, .1);
    porthole.add(bolt);
  }
  const ambient = new THREE.HemisphereLight(0xe8e4db, 0x171513, 1.05);
  const key = new THREE.DirectionalLight(0xffddb8, 3.0); key.position.set(-3, 5, 6);
  const edge = new THREE.DirectionalLight(0xaac7e5, 3.1); edge.position.set(4, 2, -1);
  const windowLight = new THREE.PointLight(0xe2854e, 9, 9, 2); windowLight.position.set(1.9, 1.7, -1.8);
  group.add(ambient, key, edge, windowLight);
  const pose = { ...vesta.defaults, z: .55, yaw: .14, armR: .55, armFwdR: .38, thrust: .65, beacon: .22, beaconWarm: 1, idle: 1 };
  const capture = new URLSearchParams(location.hash.split('?')[1] || '').get('capture') === '1';
  let aspect = 0, previous, space, lookX = 0, lookY = 0;
  return {
    group, still, defaults: { space: 1, pointerX: 0, pointerY: 0 },
    update(t, state = {}) {
      const phone = camera.aspect < .9, compact = state.framing === 'panel' || camera.aspect < 1.65 && !phone;
      if (aspect !== camera.aspect) {
        aspect = camera.aspect;
        const targetY = phone ? -.35 : .1;
        camera.position.set(0, targetY, phone ? 9.3 : compact ? 9.2 : 9);
        camera.lookAt(0, targetY, 0); camera.fov = 36; camera.updateProjectionMatrix();
        porthole.position.set(phone ? -.05 : compact ? -.55 : 1.65, phone ? 1.65 : 1.1, -3.05);
        mars.group.position.copy(porthole.position).add(new THREE.Vector3(-.1, .02, .16));
        mars.group.scale.setScalar(1.76);
        flame.group.position.set(phone ? 1.02 : compact ? 1.5 : 3.65, phone ? 1.2 : .1, .15);
        flame.group.scale.setScalar(phone ? .62 : compact ? .82 : 1.05);
        floor.position.y = phone ? -3.3 : -2.5;
      }
      const dt = previous === undefined ? 0 : Math.min(.1, Math.max(1 / 240, t - previous)); previous = t;
      const target = Math.max(0, Math.min(1, state.space ?? 1));
      if (space === undefined || capture) space = target;
      const reaction = Math.abs(target - space);
      const ease = capture ? 1 : 1 - Math.exp(-dt * 8);
      space += (target - space) * ease;
      lookX += ((state.pointerX || 0) - lookX) * (capture ? 1 : 1 - Math.exp(-dt * 10));
      lookY += ((state.pointerY || 0) - lookY) * (capture ? 1 : 1 - Math.exp(-dt * 10));
      pose.x = phone ? -.78 : compact ? -.85 : 1.2;
      pose.y = (phone ? 1.17 : .14) + Math.sin(t * .85) * .10;
      pose.scale = phone ? 1.95 : compact ? 2.65 : 3.15;
      pose.yaw = .12 + lookX * .25 + reaction * .18; pose.pitch = -lookY * .09;
      pose.lookX = lookX * .85 + reaction * .4; pose.lookY = lookY * .65;
      pose.roll = Math.sin(t * .7) * .045 - reaction * .10;
      const blinkPhase = t % 5.8;
      pose.blink = Math.max(0, 1 - Math.abs(blinkPhase - 4.7) / .14);
      pose.armR = .42 + space * .18 + reaction * .55; pose.eyeWide = reaction * .7;
      pose.armFwdR = .25 + reaction * .55;
      vesta.update(t, pose); flame.update(t, { ...state, space }); mars.update(t, state);
    }
  };
}
