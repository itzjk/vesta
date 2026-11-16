import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../web/vendor/three/three.module.js';
import { createHumanoidInspector, HUMANOID_PHASES, HUMANOID_TIMING } from '../../web/js/scene/humanoid-inspector.js';

// Triangle count of the model before the realism pass; the pass may move it by 20% at most.
const TRIANGLES_BEFORE = 24440;
const ground = -1.43, row = .25, stand = row - .6, handleLocal = [0, .205, 0];
// Same contract the bay publishes: a kit rests on the row and is carried by its top handle.
const rest = x => ({ position: [x, 0, row], point: [x, 0, row], handlePosition: [x, handleLocal[1], row], robotPosition: [x + .25, ground, stand], robotYaw: 0 });
const layout = { handleLocal, slots: { pmma: rest(.9), kapton: rest(1.35), silicone: rest(1.8) }, fixture: rest(-1.25), dock: { robotPosition: [2.9, ground, -1.5], robotYaw: -.35 } };
const STAGES = ['approach', 'retrieve', 'carry', 'place', 'handoff'];
const JOINTS = ['articulated-torso', 'articulated-head', 'left-shoulder', 'left-elbow', 'left-wrist', 'right-shoulder', 'right-elbow', 'right-wrist',
  'left-hip', 'left-knee', 'left-ankle', 'right-hip', 'right-knee', 'right-ankle', 'pelvic-frame', 'kit-grip', 'inspection-sensor-origin', 'inspection-sensor-aim'];

function build() {
  const scene = new T.Group(), robot = createHumanoidInspector({ THREE: T, groundY: ground });
  scene.add(robot.group); robot.update({ phase: 'ready', still: true, kitLayout: layout });
  return robot;
}
const mission = (id, phase, progress) => ({ approval: { granted: true }, phase, phase_progress: progress, plan: { material_id: id } });
const kit = (robot, id, phase, progress) => robot.update({ phase: 'ready', kitLayout: layout, kitMission: mission(id, phase, progress) });
const part = (robot, name) => robot.group.getObjectByName(name);
const meshesUnder = (node, own = true) => { const out = []; (own ? node.children : [node]).forEach(c => c.traverse?.(m => { if (m.isMesh && (!own || m.parent === node)) out.push(m); })); return out; };
const luminance = m => m.color.r * .2126 + m.color.g * .7152 + m.color.b * .0722;
const grip = robot => robot.getKitGrip().getWorldPosition(new T.Vector3());

test('humanoid keeps its public surface, rig frames and resource limits', () => {
  const robot = build();
  assert.deepEqual(Object.keys(robot).sort(), ['dispose', 'getKitGrip', 'group', 'stats', 'update']);
  for (const name of JOINTS) assert.ok(part(robot, name), `missing rig frame ${name}`);
  assert.equal(robot.getKitGrip(), part(robot, 'kit-grip'));
  assert.equal(robot.getKitGrip().parent, part(robot, 'left-wrist'));
  let triangles = 0, meshes = 0;
  robot.group.traverse(m => {
    if (!m.isMesh) return; meshes++;
    triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    assert.equal(m.castShadow || m.receiveShadow, false); assert.equal(m.material.map ?? null, null);
    assert.equal(m.isLight ?? false, false);
  });
  assert.equal(robot.stats.triangles, triangles); assert.equal(robot.stats.meshCount, meshes);
  assert.ok(Math.abs(triangles - TRIANGLES_BEFORE) <= TRIANGLES_BEFORE * .2, `triangles ${triangles}`);
  assert.equal(robot.stats.lights + robot.stats.shadowMaps + robot.stats.externalAssets, 0);
  assert.equal(robot.group.userData.hardwareConnected, false); assert.equal(robot.group.userData.scripted, true);
  assert.deepEqual(HUMANOID_TIMING, { approach: 3.4, reach: 4.15, inspection: 8, retract: .65, return: 4.05 });
  assert.equal(HUMANOID_PHASES.length, 7);
  robot.dispose();
});

test('shell, joint sleeves and visor are separate material zones', () => {
  const robot = build(), materials = new Set();
  robot.group.traverse(m => { if (m.isMesh && m.material.isMeshStandardMaterial) materials.add(m.material); });
  const all = [...materials], brightest = all.reduce((a, b) => luminance(a) >= luminance(b) ? a : b);
  const darkest = all.reduce((a, b) => luminance(a) <= luminance(b) ? a : b);
  // The lightest finish is the matte shell: rougher than every metal on the model.
  for (const m of all) if (m !== brightest && m.metalness > .3) assert.ok(brightest.roughness > m.roughness);
  assert.ok(brightest.metalness < .1 && brightest.roughness > .7);
  // Every limb joint and the neck carry a dark, fully matte sleeve finish.
  const sleeves = all.filter(m => m.metalness === 0 && m.roughness > .9 && luminance(m) < luminance(brightest) / 4);
  assert.equal(sleeves.length, 1);
  for (const name of ['articulated-head', 'left-shoulder', 'right-shoulder', 'left-elbow', 'right-elbow', 'left-hip', 'right-hip', 'left-knee', 'right-knee', 'left-ankle', 'right-ankle']) {
    const finishes = meshesUnder(part(robot, name)).map(m => m.material);
    assert.ok(finishes.includes(sleeves[0]), `${name} has no joint sleeve`);
  }
  // The visor is the glossiest finish and sits on the head only.
  const glossy = all.reduce((a, b) => a.roughness <= b.roughness ? a : b);
  assert.notEqual(glossy, brightest); assert.notEqual(glossy, sleeves[0]); assert.ok(glossy.roughness < .2);
  const owners = []; robot.group.traverse(m => { if (m.isMesh && m.material === glossy) owners.push(m.parent.name); });
  assert.deepEqual(owners, ['articulated-head']);
  assert.ok(luminance(darkest) < luminance(brightest) / 4);
  // Each finger is a pale segment ending in a dark pad, on both hands.
  for (const side of ['left', 'right']) for (let i = 1; i <= 4; i++) {
    const finger = part(robot, `${side}-finger-${i}`), tip = finger.getObjectByName('distal-finger-joint');
    assert.equal(meshesUnder(finger)[0].material, brightest);
    assert.ok(luminance(meshesUnder(tip)[0].material) < luminance(brightest) / 4);
  }
  robot.dispose();
});

test('kit carry still puts the grip exactly on the handle while the torso shifts', () => {
  for (const id of Object.keys(layout.slots)) {
    const robot = build(), torso = part(robot, 'articulated-torso');
    let leaned = 0;
    for (const stage of STAGES.slice(1)) for (let i = 0; i <= 40; i++) {
      kit(robot, id, stage, i / 40);
      assert.ok(robot.group.userData.kitGripError < 1e-9, `${id} ${stage} ${i}`);
      leaned = Math.max(leaned, Math.abs(torso.rotation.x));
    }
    assert.ok(leaned > .03 && leaned < .12, `lean ${leaned}`);
    kit(robot, id, 'retrieve', 1); assert.ok(grip(robot).distanceTo(new T.Vector3(...layout.slots[id].handlePosition)) < 1e-9);
    kit(robot, id, 'place', 1); assert.ok(grip(robot).distanceTo(new T.Vector3(...layout.fixture.handlePosition)) < 1e-9);
    robot.dispose();
  }
});

test('secondary motion is continuous, deterministic and ends at rest', () => {
  const robot = build(), torso = part(robot, 'articulated-torso'), head = part(robot, 'articulated-head');
  const id = Object.keys(layout.slots)[1], pose = () => [torso.rotation.x, torso.rotation.z, head.rotation.x, head.rotation.y];
  const apart = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  let previous = null, steps = 400, bodyYaw = 0;
  for (const stage of STAGES) for (let i = 0; i <= steps; i++) {
    kit(robot, id, stage, i / steps); const now = pose();
    // Includes every stage boundary: progress 1 of one stage, then progress 0 of the next.
    // The head may counter-turn as fast as the body turns under it, and little more.
    const turned = previous ? Math.abs(Math.atan2(Math.sin(robot.group.rotation.y - bodyYaw), Math.cos(robot.group.rotation.y - bodyYaw))) : 0;
    if (previous) assert.ok(apart(now, previous) < turned + .012, `${stage} ${i} jumps ${apart(now, previous)}`);
    assert.ok(Math.abs(now[2]) < .5 && Math.abs(now[3]) < 1);
    previous = now; bodyYaw = robot.group.rotation.y;
  }
  const settled = pose(); kit(robot, id, 'complete', 0); assert.ok(apart(pose(), settled) < 1e-9);
  assert.ok(Math.abs(torso.rotation.x) < 1e-9 && Math.abs(torso.rotation.z) < 1e-9);
  kit(robot, id, 'carry', .5); const once = pose(); kit(robot, id, 'place', .2); kit(robot, id, 'carry', .5); assert.ok(apart(pose(), once) < 1e-9);
  robot.dispose();
});

test('head faces the kit when lifting and the console when placing', () => {
  const robot = build(), head = part(robot, 'articulated-head'), id = Object.keys(layout.slots)[0];
  const facing = point => {
    robot.group.updateWorldMatrix(true, true);
    const eye = head.localToWorld(new T.Vector3(0, .24, 0)), forward = new T.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new T.Quaternion()));
    return forward.dot(new T.Vector3(...point).sub(eye).normalize());
  };
  const body = point => { const saved = head.rotation.clone(); head.rotation.set(0, 0, 0); const value = facing(point); head.rotation.copy(saved); return value; };
  kit(robot, id, 'retrieve', 1);
  assert.ok(facing(layout.slots[id].handlePosition) > body(layout.slots[id].handlePosition));
  kit(robot, id, 'place', 1);
  assert.ok(facing(layout.fixture.handlePosition) > body(layout.fixture.handlePosition));
  robot.dispose();
});

test('standing by shows only a small slow sway and a still frame shows none', () => {
  const robot = build(), frames = ['articulated-torso', 'articulated-head', 'left-shoulder', 'right-shoulder', 'left-elbow', 'right-elbow', 'left-hip', 'right-hip', 'left-knee', 'right-knee'];
  const snapshot = () => frames.map(name => part(robot, name).quaternion.clone());
  robot.update({ phase: 'ready', elapsed: 3, still: true, kitLayout: layout }); const still = snapshot(), where = robot.group.position.clone();
  robot.update({ phase: 'ready', elapsed: 9, still: true, kitLayout: layout });
  snapshot().forEach((q, i) => assert.ok(q.angleTo(still[i]) < 1e-6));
  let widest = 0, legs = 0;
  for (let t = 2; t < 14; t += .05) {
    robot.update({ phase: 'ready', elapsed: t, kitLayout: layout });
    snapshot().forEach((q, i) => { const a = q.angleTo(still[i]); if (frames[i].includes('hip') || frames[i].includes('knee')) legs = Math.max(legs, a); else widest = Math.max(widest, a); });
    assert.ok(robot.group.position.distanceTo(where) < 1e-9);
  }
  assert.ok(widest > .003 && widest < .02, `sway ${widest}`); assert.ok(legs < 1e-6);
  robot.dispose();
});
