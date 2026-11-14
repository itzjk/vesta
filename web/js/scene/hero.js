import { build as buildVesta } from './vesta.js';
import { build as buildFlame } from './flame.js';
import { build as buildMars } from './mars.js';

export const still = 'assets/scene/hero.jpg';

export async function build(ctx) {
  const { THREE, camera } = ctx;
  const group = new THREE.Group();
  const [vesta, flame, mars] = await Promise.all([buildVesta(ctx), buildFlame(ctx), buildMars(ctx)]);
  group.add(vesta.group, flame.group, mars.group);
  const wall = new THREE.MeshStandardMaterial({ color: 0x191715, roughness: .82, metalness: .2 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x28241f, roughness: .55, metalness: .4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x5d554a, roughness: .37, metalness: .75 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x070808 });
  const box = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  box(12, 9, .1, 0, 0, -2.2, wall);
  box(3.0, 3.8, .18, 2.15, -.15, -2.02, panel);
  for (let i = 0; i < 4; i++) box(2.65, .015, .02, 2.15, -1.5 + i * .85, -1.91, trim);
  box(.045, 5, .04, -.1, 0, -2.0, trim);
  box(7, .045, .04, 0, -1.85, -1.9, trim);
  const porthole = new THREE.Group();
  porthole.position.set(-1.48, .76, -1.97);
  const recess = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), dark);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.28, .10, 12, 64), trim);
  const inset = new THREE.Mesh(new THREE.TorusGeometry(1.16, .025, 8, 64), panel);
  porthole.add(recess, rim, inset); group.add(porthole);
  for (let i = 0; i < 8; i++) {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), panel);
    bolt.position.set(Math.cos(i * Math.PI / 4) * 1.28, Math.sin(i * Math.PI / 4) * 1.28, .09);
    porthole.add(bolt);
  }
  mars.group.position.set(-1.57, .79, -1.86); mars.group.scale.setScalar(1.02);
  flame.group.position.set(1.04, .0, .05); flame.group.scale.setScalar(.76);
  const ambient = new THREE.HemisphereLight(0xede4d4, 0x191715, 1.25);
  const key = new THREE.DirectionalLight(0xffdfb5, 3.2); key.position.set(-3, 4, 6);
  const edge = new THREE.DirectionalLight(0x8fa3b5, 2.5); edge.position.set(3, 1, -1);
  group.add(ambient, key, edge);
  const pose = { ...vesta.defaults, x: -1.05, y: -.24, z: .24, scale: 1.85, yaw: .14, armR: .67, armFwdR: .38, thrust: .65, beacon: .18, idle: 1 };
  let aspect = 0;
  return {
    group, still, defaults: { space: 1, pointerX: 0, pointerY: 0 },
    update(t, state = {}) {
      if (aspect !== camera.aspect) {
        aspect = camera.aspect;
        camera.position.set(0, .15, aspect < 1.1 ? 8.6 : 7.3);
        camera.lookAt(0, .13, 0); camera.fov = 36; camera.updateProjectionMatrix();
      }
      const px = state.pointerX || 0, py = state.pointerY || 0;
      pose.yaw = .14 + px * .23; pose.pitch = -py * .08; pose.lookX = px * .8; pose.lookY = py * .65;
      pose.y = -.24 + Math.sin(t * .8) * .065;
      pose.roll = Math.sin(t * .65) * .035;
      vesta.update(t, pose); flame.update(t, state); mars.update(t, state);
    }
  };
}
