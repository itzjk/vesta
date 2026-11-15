export const HUMANOID_PHASES = Object.freeze([
  'ready', 'observe', 'evidence', 'review', 'inspect', 'return', 'complete'
]);

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const angleMix = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const triangleCosine = (a, b, c) => Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)));

export function createHumanoidInspector({ THREE: T, groundY = -1.43 } = {}) {
  if (!T?.Group || !T?.MeshStandardMaterial) throw new TypeError('Humanoid inspector requires THREE.');
  if (!Number.isFinite(groundY)) throw new TypeError('Humanoid ground height must be finite.');

  const group = new T.Group();
  group.name = 'vesta-humanoid-inspection-concept';
  group.userData = {
    concept: true, scripted: true, hardwareConnected: false,
    movementModel: 'illustrative-choreography', requiresHumanApprovalForInspection: true
  };
  const geometries = new Set(), materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new T.MeshStandardMaterial({ color, roughness: .66, metalness: .28, ...extra });
    materials.add(value); return value;
  };
  const graphite = material(0x252d30);
  const ivory = material(0xd7d2c6, { metalness: .18 });
  const steel = material(0x79817d, { metalness: .62, roughness: .48 });
  const rust = material(0xa65c40, { metalness: .22 });
  const visor = material(0x15232a, { metalness: .42, roughness: .28 });
  const sensor = material(0x9ebfcd, { emissive: 0x7694a0, emissiveIntensity: .35, toneMapped: false });
  const contactMaterial = new T.MeshBasicMaterial({ color: 0x050909, transparent: true, opacity: .22, depthWrite: false });
  materials.add(contactMaterial);
  const boxGeometry = geometry(new T.BoxGeometry(1, 1, 1));
  const jointGeometry = geometry(new T.CylinderGeometry(1, 1, 1, 12));
  const headGeometry = geometry(new T.SphereGeometry(1, 12, 8));
  const eyeGeometry = geometry(new T.SphereGeometry(1, 8, 6));
  const chestGeometry = geometry(new T.CylinderGeometry(.43, .33, .72, 6));
  const contactGeometry = geometry(new T.CircleGeometry(1, 16));

  function mesh(parent, shape, finish, size, x = 0, y = 0, z = 0, name = '') {
    const object = new T.Mesh(shape, finish);
    object.name = name;
    object.scale.set(...size); object.position.set(x, y, z);
    object.castShadow = false; object.receiveShadow = false;
    parent.add(object); return object;
  }
  const box = (parent, finish, size, x = 0, y = 0, z = 0, name = '') => mesh(parent, boxGeometry, finish, size, x, y, z, name);
  function pivot(parent, name, x, y, z = 0) {
    const value = new T.Group(); value.name = name; value.position.set(x, y, z); parent.add(value); return value;
  }
  function hinge(parent, radius, width) {
    const value = mesh(parent, jointGeometry, steel, [radius, width, radius]);
    value.rotation.z = Math.PI / 2; return value;
  }

  const hipHeight = 1.18, upperLeg = .58, lowerLeg = .55, ankleHeight = .10;
  box(group, graphite, [.62, .28, .38], 0, hipHeight + .02);
  box(group, rust, [.64, .075, .405], 0, hipHeight + .12);
  mesh(group, jointGeometry, steel, [.20, .14, .20], 0, 1.40);
  const torso = pivot(group, 'articulated-torso', 0, 1.43);
  mesh(torso, chestGeometry, ivory, [1, 1, .61], 0, .36);
  box(torso, graphite, [.33, .55, .12], 0, .35, -.24);
  box(torso, ivory, [.58, .29, .045], 0, .39, .27);
  box(torso, rust, [.23, .035, .025], .13, .48, .304);

  const neck = pivot(torso, 'articulated-head', 0, .84);
  mesh(neck, jointGeometry, steel, [.105, .13, .105], 0, .015);
  mesh(neck, headGeometry, ivory, [.225, .265, .205], 0, .235);
  mesh(neck, headGeometry, visor, [.204, .132, .12], 0, .255, .149);
  for (const x of [-.073, .073]) mesh(neck, eyeGeometry, sensor, [.026, .026, .022], x, .255, .263);

  function arm(side) {
    const shoulder = pivot(torso, side > 0 ? 'right-shoulder' : 'left-shoulder', side * .52, .60);
    hinge(shoulder, .125, .18);
    box(shoulder, ivory, [.19, .40, .215], 0, -.235);
    box(shoulder, rust, [.202, .075, .23], 0, -.10);
    const elbow = pivot(shoulder, 'elbow', 0, -.45);
    hinge(elbow, .091, .19);
    box(elbow, ivory, [.16, .365, .19], 0, -.205);
    const wrist = pivot(elbow, 'wrist', 0, -.43);
    box(wrist, graphite, [.17, .16, .14], 0, -.055);
    return { shoulder, elbow, wrist };
  }
  const leftArm = arm(-1), rightArm = arm(1);
  for (const side of [-1, 1]) box(rightArm.wrist, steel, [.035, .11, .11], side * .085, -.13, .015);
  box(rightArm.wrist, ivory, [.17, .17, .17], 0, -.15, .015, 'illustrative-inspection-camera');
  mesh(rightArm.wrist, jointGeometry, sensor, [.052, .024, .052], 0, -.247, .015, 'illustrative-camera-aperture');

  function leg(side) {
    const hip = pivot(group, side > 0 ? 'right-hip' : 'left-hip', side * .225, hipHeight);
    hinge(hip, .13, .20);
    box(hip, ivory, [.24, .47, .25], 0, -.29);
    const knee = pivot(hip, 'knee', 0, -upperLeg);
    hinge(knee, .115, .25);
    box(knee, graphite, [.12, .44, .16], 0, -.27, -.035);
    box(knee, ivory, [.23, .39, .12], 0, -.255, .105);
    const ankle = pivot(knee, 'ankle', 0, -lowerLeg);
    box(ankle, graphite, [.27, .14, .43], 0, -.015, .085, 'foot');
    box(ankle, rust, [.275, .03, .44], 0, -.085, .085, 'sole');
    const contact = mesh(group, contactGeometry, contactMaterial, [.20, .28, 1], side * .225, .003, .085);
    contact.rotation.x = -Math.PI / 2;
    return { hip, knee, ankle, contact };
  }
  const leftLeg = leg(-1), rightLeg = leg(1);


  function placeLeg(value, forward, lift) {
    const down = hipHeight - ankleHeight - lift;
    const distance = Math.min(upperLeg + lowerLeg - .0001, Math.hypot(down, forward));
    const hip = Math.atan2(-forward, down) - Math.acos(triangleCosine(upperLeg, distance, lowerLeg));
    const knee = Math.PI - Math.acos(triangleCosine(upperLeg, lowerLeg, distance));
    value.hip.rotation.x = hip; value.knee.rotation.x = knee;
    value.ankle.rotation.x = -hip - knee;
    value.contact.position.z = forward + .085;
    value.contact.visible = lift < .015;
  }

  const dock = new T.Vector3(-2, groundY, 1);
  const inspection = new T.Vector3(1.85, groundY, -.05);
  const from = dock.clone(), target = dock.clone();
  group.position.copy(dock); group.rotation.y = .18;
  let previousPhase = null, fromYaw = .18, disposed = false;

  function update({ phase = 'ready', elapsed = 0, still = false } = {}) {
    if (disposed) return;
    if (!HUMANOID_PHASES.includes(phase)) throw new TypeError(`Unknown humanoid inspection phase: ${phase}`);
    if (!Number.isFinite(elapsed)) throw new TypeError('Humanoid phase elapsed time must be finite.');
    const age = Math.max(0, elapsed);
    if (phase !== previousPhase) {
      from.copy(group.position); fromYaw = group.rotation.y;
      target.copy(phase === 'inspect' ? inspection : dock);
      previousPhase = phase;
    }
    const distance = from.distanceTo(target);
    const duration = phase === 'inspect' || phase === 'return' ? 3.4 : 1.1;
    const progress = still ? 1 : ease(age / duration);
    group.position.lerpVectors(from, target, progress);
    const moving = distance > .05 && progress < 1 && !still;
    const travellingYaw = distance > .05 ? Math.atan2(target.x - from.x, target.z - from.z) : fromYaw;
    const arrivalYaw = phase === 'inspect' ? 2.25 : phase === 'observe' || phase === 'evidence' ? 1.2 : .18;
    const movementYaw = angleMix(travellingYaw, arrivalYaw, ease((progress - .76) / .24));
    group.rotation.y = still ? arrivalYaw : angleMix(fromYaw, movementYaw, ease(age / .32));
    if (!moving) group.rotation.y = angleMix(fromYaw, arrivalYaw, still ? 1 : ease(age / .5));

    const gait = progress * Math.PI * 8;
    const envelope = moving ? Math.sin(Math.PI * progress) : 0;
    const stride = Math.sin(gait) * .28 * envelope;
    placeLeg(leftLeg, stride, moving ? Math.max(0, Math.sin(gait)) * .065 * envelope : 0);
    placeLeg(rightLeg, -stride, moving ? Math.max(0, -Math.sin(gait)) * .065 * envelope : 0);

    torso.rotation.set(0, 0, 0);
    neck.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(.10 + stride * .8, 0, -.09);
    rightArm.shoulder.rotation.set(.10 - stride * .8, 0, .09);
    leftArm.elbow.rotation.x = -.18; rightArm.elbow.rotation.x = -.18;
    leftArm.wrist.rotation.set(0, 0, 0); rightArm.wrist.rotation.set(0, 0, 0);

    if (phase === 'observe' || phase === 'evidence') {
      neck.rotation.y = .48; neck.rotation.x = -.06;
      torso.rotation.y = .10;
    } else if (phase === 'review') {

      neck.rotation.y = -.12;
      leftArm.shoulder.rotation.x = -.34;
      leftArm.elbow.rotation.x = -.70;
      leftArm.wrist.rotation.z = -.18;
    } else if (phase === 'inspect') {
      const reach = still ? 1 : ease((age - duration + .20) / .65);
      rightArm.shoulder.rotation.x = .10 - reach * 1.05;
      rightArm.elbow.rotation.x = -.18 - reach * .84;
      leftArm.shoulder.rotation.x = .10 - reach * .14;
      leftArm.elbow.rotation.x = -.18 - reach * .15;
      neck.rotation.x = -.07 * reach;
      neck.rotation.y = .10 * reach;
    }
    group.userData.phase = phase;
    group.userData.atInspectionView = phase === 'inspect' && (still || age >= duration + .45);
  }

  let meshCount = 0, triangles = 0;
  group.traverse(object => {
    if (object.isMesh) {
      meshCount++;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    }
  });
  const stats = Object.freeze({ meshCount, triangles, geometries: geometries.size, materials: materials.size, lights: 0, shadowMaps: 0, externalAssets: 0 });
  update({ phase: 'ready', still: true });
  return {
    group, update, stats,
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
      geometries.clear(); materials.clear();
    }
  };
}
