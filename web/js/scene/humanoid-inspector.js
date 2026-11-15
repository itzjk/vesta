export const HUMANOID_PHASES = Object.freeze(['ready', 'observe', 'evidence', 'review', 'inspect', 'return', 'complete']);
export const HUMANOID_TIMING = Object.freeze({ approach: 3.4, reach: 4.15, inspection: 8, retract: .65, return: 4.05 });
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const angleMix = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const triangleCosine = (a, b, c) => clamp((a * a + b * b - c * c) / (2 * a * b), -1, 1);

// Original grounded concept: illustrative choreography, no sensing, contact solver,
// autonomous planning or hardware control. Human approval belongs to the scene controller.
export function createHumanoidInspector({ THREE: T, groundY = -1.43 } = {}) {
  if (!T?.Group || !T?.MeshStandardMaterial) throw new TypeError('Humanoid inspector requires THREE.');
  if (!Number.isFinite(groundY)) throw new TypeError('Humanoid ground height must be finite.');
  const group = new T.Group(); group.name = 'vesta-humanoid-inspection-concept';
  group.userData = { concept: true, scripted: true, hardwareConnected: false,
    movementModel: 'illustrative-choreography', requiresHumanApprovalForInspection: true,
    inspectionSensor: 'inspection-sensor-origin', inspectionSensorDirection: 'inspection-sensor-aim', timing: HUMANOID_TIMING };
  const geometries = new Set(), materials = new Set(), roundedCache = new Map();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: .48, metalness: .28, ...extra }); materials.add(m); return m; };
  const shell = material(0xd0cec2, { roughness: .57, metalness: .14 });
  const graphite = material(0x222a2e, { roughness: .58, metalness: .38 });
  const titanium = material(0x8a9699, { roughness: .31, metalness: .72 });
  const copper = material(0xa56f4c, { roughness: .44, metalness: .58 });
  const glass = material(0x15262f, { roughness: .28, metalness: .24 });
  const signal = material(0xc2a46e, { emissive: 0xc79242, emissiveIntensity: .24, roughness: .3 });
  const optics = material(0x7eabb7, { emissive: 0x6e9aa9, emissiveIntensity: .13, roughness: .2, metalness: .3 });
  const contactMaterial = new T.MeshBasicMaterial({ color: 0x080b0c, transparent: true, opacity: .17, depthWrite: false }); materials.add(contactMaterial);
  const sphereGeometry = geometry(new T.SphereGeometry(1, 16, 10));
  const smallSphere = geometry(new T.SphereGeometry(1, 8, 6));
  const cylinderGeometry = geometry(new T.CylinderGeometry(1, 1, 1, 16));
  const capsuleGeometry = geometry(new T.CapsuleGeometry(1, 1, 4, 10));
  const contactGeometry = geometry(new T.CircleGeometry(1, 24));
  function mesh(parent, shape, finish, size, x = 0, y = 0, z = 0, name = '') {
    const m = new T.Mesh(shape, finish); m.name = name; m.scale.set(...size); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = false; parent.add(m); return m;
  }
  function pivot(parent, name, x = 0, y = 0, z = 0) {
    const p = new T.Group(); p.name = name; p.position.set(x, y, z); parent.add(p); return p;
  }
  // Broad machined faces with analytic smooth edge normals, shared by equal-sized shells.
  function roundedGeometry(w, h, d, r) {
    const key = [w, h, d, r].join(':'); if (roundedCache.has(key)) return roundedCache.get(key);
    const g = geometry(new T.BoxGeometry(w, h, d, 4, 4, 4)), p = g.attributes.position, n = g.attributes.normal;
    const corner = new T.Vector3(), delta = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      corner.set(clamp(p.getX(i), -w / 2 + r, w / 2 - r), clamp(p.getY(i), -h / 2 + r, h / 2 - r), clamp(p.getZ(i), -d / 2 + r, d / 2 - r));
      delta.set(p.getX(i), p.getY(i), p.getZ(i)).sub(corner).normalize();
      p.setXYZ(i, corner.x + delta.x * r, corner.y + delta.y * r, corner.z + delta.z * r); n.setXYZ(i, delta.x, delta.y, delta.z);
    }
    g.computeBoundingBox(); g.computeBoundingSphere(); roundedCache.set(key, g); return g;
  }
  const panel = (parent, finish, size, xyz, radius = .025, name = '') => mesh(parent, roundedGeometry(...size, Math.min(radius, Math.min(...size) * .45)), finish, [1, 1, 1], ...xyz, name);
  const ellipsoid = (parent, finish, size, xyz) => mesh(parent, sphereGeometry, finish, size, ...xyz);
  const cylinder = (parent, finish, radius, width, xyz = [0, 0, 0], axle = 'y') => {
    const m = mesh(parent, cylinderGeometry, finish, [radius, width, radius], ...xyz);
    if (axle === 'x') m.rotation.z = Math.PI / 2; if (axle === 'z') m.rotation.x = Math.PI / 2; return m;
  };
  function hinge(parent, radius, width) {
    cylinder(parent, graphite, radius, width, [0, 0, 0], 'x');
    for (const side of [-1, 1]) {
      cylinder(parent, titanium, radius * .77, .012, [side * (width / 2 + .006), 0, 0], 'x');
      cylinder(parent, copper, radius * .32, .014, [side * (width / 2 + .014), 0, 0], 'x');
    }
  }
  function cable(parent, points, radius = .011) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    mesh(parent, geometry(new T.TubeGeometry(curve, 10, radius, 5, false)), graphite, [1, 1, 1]);
  }
  function taperedShell(parent, finish, length, top, bottom, xyz, depth = .78) {
    const profile = [[0, -.5], [bottom * .65, -.49], [bottom, -.43], [top, .32], [top * .94, .45], [top * .6, .5], [0, .5]];
    return mesh(parent, geometry(new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y * length)), 16)), finish, [1, 1, depth], ...xyz);
  }
  function chestPlate(side) {
    const shape = new T.Shape(), points = [[.025, .61], [.17, .67], [.33, .58], [.35, .39], [.27, .24], [.055, .25]];
    points.forEach(([x, y], i) => i ? shape.lineTo(side * x, y) : shape.moveTo(side * x, y)); shape.closePath();
    const g = geometry(new T.ExtrudeGeometry(shape, { depth: .032, bevelEnabled: true, bevelThickness: .012, bevelSize: .014, bevelSegments: 2, steps: 1, curveSegments: 3 }));
    return mesh(torso, g, shell, [1, 1, 1], 0, 0, .145);
  }
  const hipHeight = 1.37, upperLeg = .66, lowerLeg = .63, ankleHeight = .10;
  const pelvis = pivot(group, 'pelvic-frame', 0, hipHeight + .035);
  panel(pelvis, graphite, [.43, .25, .28], [0, 0, 0], .055);
  for (const side of [-1, 1]) {
    const plate = panel(pelvis, shell, [.19, .18, .075], [side * .115, .015, .15], .035); plate.rotation.z = side * -.14;
    panel(pelvis, copper, [.018, .09, .015], [side * .21, .045, .09], .006);
  }
  cylinder(group, graphite, .18, .13, [0, 1.57, 0]);
  for (const y of [1.525, 1.565, 1.605]) cylinder(group, titanium, .183, .014, [0, y, 0]);
  const torso = pivot(group, 'articulated-torso', 0, 1.60);
  taperedShell(torso, graphite, .70, .34, .23, [0, .32, 0], .60); chestPlate(-1); chestPlate(1);
  panel(torso, titanium, [.038, .26, .025], [0, .43, .194], .01);
  panel(torso, signal, [.07, .016, .018], [.17, .53, .199], .006);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const rib = panel(torso, shell, [.19, .052, .055], [side * .18, .08 + i * .053, .143], .018); rib.rotation.z = side * .13;
  }
  panel(torso, graphite, [.43, .50, .19], [0, .34, -.22], .06, 'utility-pack');
  panel(torso, shell, [.38, .43, .055], [0, .35, -.333], .04);
  for (let i = 0; i < 5; i++) panel(torso, graphite, [.24, .018, .014], [0, .28 + i * .043, -.365], .005);
  panel(torso, copper, [.20, .028, .018], [0, .155, -.365], .007);
  for (const side of [-1, 1]) {
    cable(torso, [[side * .16, .12, -.29], [side * .29, .07, -.25], [side * .29, -.04, -.13], [side * .12, -.11, -.11]]);
    cable(torso, [[side * .17, .52, -.27], [side * .30, .67, -.22], [side * .42, .64, -.06]], .014);
  }
  const neck = pivot(torso, 'articulated-head', 0, .745);
  cylinder(neck, graphite, .072, .10, [0, .012, 0]); cylinder(neck, titanium, .078, .022, [0, .045, 0]);
  ellipsoid(neck, shell, [.168, .205, .161], [0, .245, -.003]);
  // Cheek and jaw surfaces clarify the adult head silhouette without changing
  // the articulated head frame, eye line, shoulder reach or any grip endpoint.
  for (const side of [-1, 1]) {
    const cheek = panel(neck, shell, [.044, .09, .065], [side * .12, .165, .12], .016);
    cheek.rotation.z = side * -.20;
  }
  panel(neck, shell, [.17, .065, .065], [0, .115, .11], .023, 'lower-face-shell');
  panel(neck, glass, [.289, .108, .05], [0, .242, .141], .035, 'sensor-visor');
  panel(neck, graphite, [.30, .014, .026], [0, .306, .138], .006);
  panel(neck, graphite, [.10, .025, .024], [0, .13, .142], .008);
  panel(neck, optics, [.046, .012, .009], [.065, .242, .17], .004);
  cylinder(neck, titanium, .020, .012, [-.09, .242, .17], 'z'); cylinder(neck, glass, .013, .014, [-.09, .242, .177], 'z');
  panel(neck, signal, [.011, .011, .009], [-.116, .242, .178], .003);
  for (const side of [-1, 1]) {
    cylinder(neck, graphite, .063, .018, [side * .163, .222, -.015], 'x');
    cylinder(neck, titanium, .041, .023, [side * .17, .222, -.015], 'x');
  }
  const defaultSensorTarget = new T.Vector3(2.65, groundY + 1.71, -1.025), sensorTarget = defaultSensorTarget.clone(); let sensorOrigin;
  const fingers = [];
  function hand(wrist, side) {
    panel(wrist, graphite, [.145, .14, .075], [0, -.055, 0], .025);
    panel(wrist, shell, [.138, .115, .023], [0, -.05, .042], .018); cylinder(wrist, titanium, .057, .04, [0, .025, 0]);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .034, length = [.075, .086, .081, .065][i];
      const base = pivot(wrist, `${side > 0 ? 'right' : 'left'}-finger-${i + 1}`, x, -.125, 0); base.rotation.z = (i - 1.5) * -.055;
      mesh(wrist, smallSphere, graphite, [.019, .022, .023], x, -.118, 0);
      mesh(base, capsuleGeometry, titanium, [.013, length / 3, .014], 0, -length / 2, 0);
      const tip = pivot(base, 'distal-finger-joint', 0, -length, 0);
      mesh(tip, capsuleGeometry, titanium, [.012, length * .68 / 3, .013], 0, -length * .34, 0);
      fingers.push({ base, tip, side, spread: base.rotation.z, thumb: false });
    }
    const thumb = pivot(wrist, `${side > 0 ? 'right' : 'left'}-thumb`, side * -.077, -.033, 0);
    mesh(thumb, capsuleGeometry, titanium, [.018, .067 / 3, .018], 0, -.0335);
    const thumbTip = pivot(thumb, 'distal-thumb-joint', 0, -.067, 0);
    mesh(thumbTip, capsuleGeometry, titanium, [.016, .050 / 3, .016], 0, -.025);
    fingers.push({ base: thumb, tip: thumbTip, side, spread: side * -.60, thumb: true });
    if (side > 0) {
      panel(wrist, graphite, [.095, .082, .055], [0, -.07, .072], .020, 'wrist-inspection-camera');
      cylinder(wrist, titanium, .027, .017, [0, -.117, .073]); cylinder(wrist, optics, .020, .019, [0, -.123, .073]);
      sensorOrigin = pivot(wrist, 'inspection-sensor-origin', 0, -.135, .073); pivot(sensorOrigin, 'inspection-sensor-aim', 0, -1, 0);
      // A visible handheld inspection head gives the approved gesture a purpose.
      // It illustrates tool use only: this model produces no optical measurement.
      panel(wrist, graphite, [.11, .20, .11], [0, -.15, .025], .025, 'inspection-tool-grip');
      panel(wrist, shell, [.19, .075, .14], [0, -.28, .025], .022, 'inspection-tool-head');
      panel(wrist, optics, [.13, .012, .085], [0, -.324, .025], .004, 'inspection-tool-aperture');
      sensorOrigin.position.set(0, -.335, .025);
    }
  }
  function arm(side) {
    const shoulder = pivot(torso, side > 0 ? 'right-shoulder' : 'left-shoulder', side * .425, .63, 0);
    hinge(shoulder, .118, .19); ellipsoid(shoulder, shell, [.143, .135, .143], [side * .025, .025, .007]);
    panel(shoulder, copper, [.024, .07, .10], [side * .151, .025, .018], .01);
    taperedShell(shoulder, shell, .37, .090, .075, [0, -.25, 0]); panel(shoulder, graphite, [.034, .25, .02], [0, -.25, -.071], .007);
    const elbow = pivot(shoulder, side > 0 ? 'right-elbow' : 'left-elbow', 0, -.48);
    hinge(elbow, .080, .16); taperedShell(elbow, shell, .34, .087, .058, [0, -.235, .004]);
    panel(elbow, graphite, [.055, .22, .021], [0, -.22, -.064], .008); cylinder(elbow, copper, .065, .020, [0, -.383, 0]);
    const wrist = pivot(elbow, side > 0 ? 'right-wrist' : 'left-wrist', 0, -.43); hand(wrist, side); return { shoulder, elbow, wrist };
  }
  const leftArm = arm(-1), rightArm = arm(1);
  // The right hand retains its inspection head. Kit handling uses the free left
  // palm. This frame represents the cartridge HANDLE, not its centre of mass.
  const kitGrip = pivot(leftArm.wrist, 'kit-grip', 0, -.105, .025);
  function leg(side) {
    const hip = pivot(group, side > 0 ? 'right-hip' : 'left-hip', side * .17, hipHeight); hinge(hip, .112, .15);
    taperedShell(hip, shell, .53, .115, .087, [0, -.34, .005]); panel(hip, graphite, [.055, .32, .021], [side * .025, -.36, -.083], .01);
    const knee = pivot(hip, side > 0 ? 'right-knee' : 'left-knee', 0, -upperLeg); hinge(knee, .088, .17);
    panel(knee, shell, [.16, .15, .065], [0, -.007, .084], .032);
    taperedShell(knee, graphite, .50, .078, .054, [0, -.34, -.015]); taperedShell(knee, shell, .43, .083, .058, [0, -.32, .041], .45);
    panel(knee, copper, [.022, .11, .012], [side * .058, -.17, .079], .005);
    const ankle = pivot(knee, side > 0 ? 'right-ankle' : 'left-ankle', 0, -lowerLeg); hinge(ankle, .061, .145);
    panel(ankle, graphite, [.195, .075, .395], [0, -.060, .085], .027, 'segmented-sole');
    panel(ankle, shell, [.18, .075, .24], [0, -.008, .15], .032, 'toe-shell');
    panel(ankle, shell, [.15, .095, .14], [0, .006, -.035], .028, 'heel-shell');
    panel(ankle, graphite, [.185, .018, .014], [0, -.012, .13], .005);
    const contact = mesh(group, contactGeometry, contactMaterial, [.13, .25, 1], side * .17, .002, .085, 'foot-contact');
    contact.rotation.x = -Math.PI / 2; contact.userData.keepMesh = true; return { hip, knee, ankle, contact };
  }
  const leftLeg = leg(-1), rightLeg = leg(1);

  // Batch static siblings by material, preserving every articulated pivot and sensor anchor.
  let authoredPieces = 0; group.traverse(n => { if (n.isMesh) authoredPieces++; });
  const parents = []; group.traverse(n => { if (n.isGroup) parents.push(n); });
  for (const parent of parents) {
    const buckets = new Map();
    for (const m of parent.children) if (m.isMesh && !m.userData.keepMesh) { if (!buckets.has(m.material)) buckets.set(m.material, []); buckets.get(m.material).push(m); }
    for (const [finish, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(m => { m.updateMatrix(); return (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); });
      const count = parts.reduce((n, g) => n + g.attributes.position.count, 0), positions = new Float32Array(count * 3), normals = new Float32Array(count * 3); let offset = 0;
      for (const p of parts) { positions.set(p.attributes.position.array, offset); normals.set(p.attributes.normal.array, offset); offset += p.attributes.position.array.length; p.dispose(); }
      const g = geometry(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(positions, 3)); g.setAttribute('normal', new T.BufferAttribute(normals, 3));
      g.computeBoundingBox(); g.computeBoundingSphere(); meshes.forEach(m => parent.remove(m)); mesh(parent, g, finish, [1, 1, 1], 0, 0, 0, `${parent.name || 'frame'}-batched-shell`);
    }
  }
  function placeLeg(value, forward, lift) {
    const down = hipHeight - ankleHeight - lift, distance = Math.min(upperLeg + lowerLeg - .0001, Math.hypot(down, forward));
    const hip = Math.atan2(-forward, down) - Math.acos(triangleCosine(upperLeg, distance, lowerLeg));
    const knee = Math.PI - Math.acos(triangleCosine(upperLeg, lowerLeg, distance));
    value.hip.rotation.x = hip; value.knee.rotation.x = knee; value.ankle.rotation.x = -hip - knee;
    value.contact.position.z = forward + .085; value.contact.visible = lift < .012;
  }
  const dock = new T.Vector3(-2, groundY, 1), inspection = new T.Vector3(1.65, groundY, -.05), workPoint = inspection.clone(), previousPoint = sensorTarget.clone();
  const from = dock.clone(), target = dock.clone(), localTarget = new T.Vector3(), targetWorld = new T.Vector3(), sensorPosition = new T.Vector3();
  const parentQuaternion = new T.Quaternion(), aimQuaternion = new T.Quaternion(), downward = new T.Vector3(0, -1, 0);
  group.position.copy(dock); group.rotation.y = .18;
  const joints = [torso, neck, leftArm.shoulder, leftArm.elbow, leftArm.wrist, rightArm.shoulder, rightArm.elbow, rightArm.wrist];
  const fromPose = joints.map(j => j.quaternion.clone()), poseQuaternion = joints.map(() => new T.Quaternion());
  let previousPhase = null, previousReviewPose = false, fromYaw = .18, disposed = false;
  const kitDurations = { approach: 3.4, retrieve: 1.3, carry: 4.2, place: 1.4, handoff: 1.0 };
  const kitDefaultSlots = Object.fromEntries([['pmma', -.45], ['kapton', .05], ['silicone', .55]].map(([id, x]) =>
    [id, { point: [x, 0, .25], robotPosition: [x - .25, groundY, .85], robotYaw: Math.PI }]));
  const kitDefaultFixture = { point: [2.05, 0, .25], robotPosition: [1.80, groundY, .85], robotYaw: Math.PI };
  const finite3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  const kitStart = new T.Vector3(), kitSource = new T.Vector3(), kitDestination = new T.Vector3();
  const pickupHandle = new T.Vector3(), fixtureHandle = new T.Vector3(), handleOffset = new T.Vector3();
  const requestedGrip = new T.Vector3(), neutralGrip = new T.Vector3(), carryGrip = new T.Vector3(), kitPoint = new T.Vector3();
  const ikTarget = new T.Vector3(), ikOffset = new T.Vector3(), ikDirection = new T.Vector3(), ikPole = new T.Vector3();
  const ikUpper = new T.Vector3(), ikLower = new T.Vector3(), ikActual = new T.Vector3();
  const kitWorldQ = new T.Quaternion(), kitParentQ = new T.Quaternion(), kitInverseQ = new T.Quaternion();
  const kitDesiredQ = new T.Quaternion(), kitNeutralQ = new T.Quaternion(), kitIdentityQ = new T.Quaternion();
  let kitActive = false, kitPhase = null, kitStartYaw = .18, kitExitElapsed = null;

  function readKitPoint(record, into, offset) {
    const point = record?.point ?? record?.position;
    if (!finite3(point)) return false;
    into.fromArray(point);
    if (finite3(record.handlePosition)) into.fromArray(record.handlePosition);
    else into.add(offset);
    return true;
  }

  function baseKitPose(moving, progress, distance) {
    const envelope = moving ? Math.sin(Math.PI * clamp(progress)) : 0;
    const gait = progress * Math.PI * Math.max(2, distance / .32);
    const stride = Math.sin(gait) * .18 * envelope;
    placeLeg(leftLeg, stride, Math.max(0, Math.sin(gait)) * .06 * envelope);
    placeLeg(rightLeg, -stride, Math.max(0, -Math.sin(gait)) * .06 * envelope);
    torso.rotation.set(0, 0, moving ? stride * .025 : 0); neck.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(.04 + stride * .7, 0, -.07);
    rightArm.shoulder.rotation.set(.04 - stride * .7, 0, .07);
    leftArm.elbow.rotation.set(-.12, 0, 0); rightArm.elbow.rotation.set(-.16, 0, 0);
    leftArm.wrist.rotation.set(0, 0, -.05); rightArm.wrist.rotation.set(0, 0, .05);
    group.updateWorldMatrix(true, true);
    kitGrip.getWorldPosition(neutralGrip); group.parent?.worldToLocal(neutralGrip);
    leftArm.wrist.getWorldQuaternion(kitNeutralQ);
    if (group.parent) {
      group.parent.getWorldQuaternion(kitParentQ); kitInverseQ.copy(kitParentQ).invert();
      kitNeutralQ.premultiply(kitInverseQ);
    }
  }

  // Bounded analytic two-link reach: real shoulder/elbow/wrist joints move to the
  // handle. No detached invisible hand or teleported grip target is used.
  function poseLeftGrip(point, orientation) {
    ikOffset.copy(kitGrip.position).applyQuaternion(orientation);
    ikTarget.copy(point).sub(ikOffset); group.parent?.localToWorld(ikTarget);
    torso.worldToLocal(ikTarget); ikTarget.sub(leftArm.shoulder.position);
    const requestedDistance = ikTarget.length();
    const distance = clamp(requestedDistance, .051, .48 + .43 - .00001);
    ikDirection.copy(ikTarget).normalize();
    if (requestedDistance < .00001) ikDirection.set(0, -1, 0);
    ikPole.set(-1, 0, 0).addScaledVector(ikDirection, ikDirection.x);
    if (ikPole.lengthSq() < .00001) ikPole.set(0, 0, 1).addScaledVector(ikDirection, -ikDirection.z);
    ikPole.normalize();
    const along = (.48 * .48 - .43 * .43 + distance * distance) / (2 * distance);
    const out = Math.sqrt(Math.max(0, .48 * .48 - along * along));
    ikUpper.copy(ikDirection).multiplyScalar(along).addScaledVector(ikPole, out);
    leftArm.shoulder.quaternion.setFromUnitVectors(downward, ikActual.copy(ikUpper).normalize());
    ikLower.copy(ikDirection).multiplyScalar(distance).sub(ikUpper);
    kitInverseQ.copy(leftArm.shoulder.quaternion).invert(); ikLower.applyQuaternion(kitInverseQ).normalize();
    leftArm.elbow.quaternion.setFromUnitVectors(downward, ikLower);
    leftArm.elbow.updateWorldMatrix(true, true);
    leftArm.elbow.getWorldQuaternion(kitInverseQ).invert();
    if (group.parent) group.parent.getWorldQuaternion(kitParentQ); else kitParentQ.identity();
    kitWorldQ.copy(kitParentQ).multiply(orientation);
    leftArm.wrist.quaternion.copy(kitInverseQ).multiply(kitWorldQ);
    group.updateWorldMatrix(true, true);
    kitGrip.getWorldPosition(ikActual); group.parent?.worldToLocal(ikActual);
    group.userData.kitGripError = ikActual.distanceTo(point);
  }

  function updateKit(mission, layout, still) {
    const stage = mission?.phase;
    if (!mission?.approval?.granted || !['approved', 'approach', 'retrieve', 'carry', 'place', 'handoff', 'complete'].includes(stage)) return false;
    const id = mission.plan?.material_id, slot = layout?.slots?.[id] ?? kitDefaultSlots[id];
    const fixture = layout?.fixture ?? kitDefaultFixture;
    if (!slot || !finite3(slot.robotPosition) || !finite3(fixture.robotPosition)) return false;
    handleOffset.fromArray(finite3(layout?.handleLocal) ? layout.handleLocal : [0, .205, 0]);
    if (!readKitPoint(slot, pickupHandle, handleOffset) || !readKitPoint(fixture, fixtureHandle, handleOffset)) return false;
    kitSource.fromArray(slot.robotPosition); kitDestination.fromArray(fixture.robotPosition);
    if (!kitActive) { kitStart.copy(group.position); kitStartYaw = group.rotation.y; }
    kitActive = true; kitExitElapsed = null;
    if (stage === 'approved') {
      group.userData.kitPhase = stage; group.userData.kitApproved = true; group.userData.motionComplete = false;
      group.updateWorldMatrix(true, true); return true;
    }
    const duration = kitDurations[stage] ?? 1;
    const elapsed = Number.isFinite(mission.phase_elapsed) ? mission.phase_elapsed : 0;
    const progress = still ? 1 : clamp(Number.isFinite(mission.phase_progress) ? mission.phase_progress : elapsed / duration);
    const sourceYaw = Number.isFinite(slot.robotYaw) ? slot.robotYaw : Math.PI;
    const destinationYaw = Number.isFinite(fixture.robotYaw) ? fixture.robotYaw : Math.PI;
    let walking = false, walkProgress = 0, walkDistance = 0;
    if (stage === 'approach') {
      walkProgress = ease((progress - .10) / .82); walkDistance = kitStart.distanceTo(kitSource);
      group.position.lerpVectors(kitStart, kitSource, walkProgress);
      const heading = Math.atan2(kitSource.x - kitStart.x, kitSource.z - kitStart.z);
      const turn = angleMix(kitStartYaw, heading, ease(progress / .14));
      group.rotation.y = angleMix(turn, sourceYaw, ease((progress - .76) / .24));
      walking = !still && walkProgress > 0 && walkProgress < 1;
    } else if (stage === 'retrieve') {
      group.position.copy(kitSource); group.rotation.y = sourceYaw;
    } else if (stage === 'carry') {
      walkProgress = ease((progress - .10) / .80); walkDistance = kitSource.distanceTo(kitDestination);
      group.position.lerpVectors(kitSource, kitDestination, walkProgress);
      const heading = Math.atan2(kitDestination.x - kitSource.x, kitDestination.z - kitSource.z);
      const turn = angleMix(sourceYaw, heading, ease(progress / .16));
      group.rotation.y = angleMix(turn, destinationYaw, ease((progress - .75) / .25));
      walking = !still && walkProgress > 0 && walkProgress < 1;
    } else if (stage === 'handoff' || stage === 'complete') {
      // The cartridge has already been released onto the crew fixture. Retract
      // first, then step aside so the completed result remains visible. Pickup,
      // carry and place transforms are deliberately unchanged by this end pose.
      const handoffProgress = stage === 'complete' ? 1 : progress;
      walkProgress = ease((handoffProgress - .30) / .70);
      walkDistance = Math.hypot(.65, .16);
      group.position.copy(kitDestination);
      group.position.x -= .65 * walkProgress; group.position.z += .16 * walkProgress;
      group.rotation.y = angleMix(destinationYaw, .85, ease((handoffProgress - .12) / .88));
      walking = !still && walkProgress > 0 && walkProgress < 1;
    } else {
      group.position.copy(kitDestination); group.rotation.y = destinationYaw;
    }
    baseKitPose(walking, walkProgress, walkDistance);
    let closed = 0;
    if (stage !== 'approach') {
      // Carry close to the left side of the torso; the cartridge remains upright
      // in the room frame as the body turns. Final transfer frames are identical.
      carryGrip.set(-.25, 1.755, .45).applyQuaternion(group.quaternion).add(group.position);
      if (stage === 'retrieve') {
        const blend = ease(progress);
        requestedGrip.lerpVectors(neutralGrip, pickupHandle, blend);
        kitDesiredQ.copy(kitNeutralQ).slerp(kitIdentityQ, blend);
        closed = ease((progress - .55) / .45);
      } else if (stage === 'carry') {
        requestedGrip.lerpVectors(pickupHandle, carryGrip, ease(progress / .18));
        kitDesiredQ.identity(); closed = 1;
      } else if (stage === 'place') {
        requestedGrip.lerpVectors(carryGrip, fixtureHandle, ease(progress));
        kitDesiredQ.identity(); closed = 1;
      } else {
        const blend = stage === 'complete' ? 1 : ease(progress / .38);
        requestedGrip.lerpVectors(fixtureHandle, neutralGrip, blend);
        kitDesiredQ.copy(kitIdentityQ).slerp(kitNeutralQ, blend);
        closed = 1 - ease(progress / .55);
        if (stage === 'complete') closed = 0;
      }
      poseLeftGrip(requestedGrip, kitDesiredQ);
      neck.rotation.x = -.12; neck.rotation.y = -.18;
    }
    for (const finger of fingers) {
      const curl = finger.side < 0 ? .12 + closed * .72 : .82;
      finger.base.rotation.set(finger.thumb ? .16 + closed * .08 : curl, finger.thumb ? finger.side * -.30 : 0, finger.spread);
      finger.tip.rotation.x = finger.thumb ? .30 + closed * .12 : curl * .85;
    }
    group.updateWorldMatrix(true, true); optics.emissiveIntensity = .13;
    group.userData.kitPhase = stage; group.userData.kitApproved = true;
    group.userData.phase = 'kit-staging'; group.userData.presentationMode = 'virtual-kit-staging';
    group.userData.motionComplete = stage === 'complete'; group.userData.hardwareConnected = false;
    kitPhase = stage; return true;
  }

  function update({ phase = 'ready', elapsed = 0, still = false, targetPoint = null, workPosition = null, workYaw = null, kitMission = null, kitLayout = null } = {}) {
    if (disposed) return;
    if (updateKit(kitMission, kitLayout, still)) return;
    if (kitActive) {
      kitActive = false; kitPhase = null; kitExitElapsed = elapsed;
      previousPhase = null; group.userData.kitApproved = false; delete group.userData.kitPhase;
    }
    // Cancellation resets only virtual staging. The unladen robot visibly returns
    // via the existing walking pose instead of inheriting a large elapsed value.
    if (kitExitElapsed !== null && phase === 'ready') elapsed = Math.max(0, elapsed - kitExitElapsed);
    else if (phase !== 'ready') kitExitElapsed = null;
    if (!HUMANOID_PHASES.includes(phase)) throw new TypeError(`Unknown humanoid inspection phase: ${phase}`);
    if (!Number.isFinite(elapsed)) throw new TypeError('Humanoid phase elapsed time must be finite.');
    for(const [name,value] of [['targetPoint',targetPoint],['workPosition',workPosition]])if(value!=null&&(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite)))throw new TypeError(`${name} must be a finite [x,y,z] array.`);
    if(workYaw!=null&&!Number.isFinite(workYaw))throw new TypeError('workYaw must be finite.');
    // Optional targets show evidence records at illustrative components. The review
    // engine does the data work; this motion is presentation, never sensing or progress.
    const reviewPose=targetPoint!=null||workPosition!=null;
    if(targetPoint)sensorTarget.fromArray(targetPoint);else sensorTarget.copy(defaultSensorTarget);
    if(workPosition)workPoint.fromArray(workPosition);else workPoint.copy(inspection);
    const showingWork=phase==='inspect'||reviewPose&&phase==='complete',destination=showingWork?workPoint:dock;
    const age = Math.max(0, elapsed);
    if (phase !== previousPhase || !target.equals(destination) || previousReviewPose!==reviewPose || !previousPoint.equals(sensorTarget)) {
      from.copy(group.position); fromYaw = group.rotation.y; joints.forEach((j, i) => fromPose[i].copy(j.quaternion));
      target.copy(destination); previousPhase = phase; previousReviewPose=reviewPose; previousPoint.copy(sensorTarget);
    }
    const delay = phase === 'return' ? HUMANOID_TIMING.retract : 0;
    const travelAge = Math.max(0, age - delay), duration = showingWork || phase === 'return' ? HUMANOID_TIMING.approach : .9;
    const distance = from.distanceTo(target), progress = still ? 1 : ease(travelAge / duration); group.position.lerpVectors(from, target, progress);
    const moving = distance > .05 && travelAge > 0 && progress < 1 && !still;
    const selectedYaw=workYaw??(reviewPose?Math.atan2(sensorTarget.x-workPoint.x,sensorTarget.z-workPoint.z):2.44);
    const arrivalYaw = showingWork ? selectedYaw : phase === 'observe' || phase === 'evidence' ? 1.20 : phase === 'review' ? .32 : .18;
    const travelYaw = distance > .05 ? Math.atan2(target.x - from.x, target.z - from.z) : fromYaw;
    const routeYaw = angleMix(travelYaw, arrivalYaw, ease((progress - .72) / .28));
    group.rotation.y = still ? arrivalYaw : age < delay ? fromYaw : angleMix(fromYaw, moving ? routeYaw : arrivalYaw, ease(travelAge / .55));
    const gait = progress * Math.PI * 10, envelope = moving ? Math.sin(Math.PI * progress) : 0, stride = Math.sin(gait) * .23 * envelope;
    placeLeg(leftLeg, stride, Math.max(0, Math.sin(gait)) * .075 * envelope); placeLeg(rightLeg, -stride, Math.max(0, -Math.sin(gait)) * .075 * envelope);
    torso.rotation.set(0, moving ? -stride * .12 : 0, moving ? stride * .05 : 0); neck.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(.04 + stride, 0, -.07); rightArm.shoulder.rotation.set(.04 - stride, 0, .07);
    leftArm.elbow.rotation.set(-.12, 0, 0); rightArm.elbow.rotation.set(-.12, 0, 0);
    leftArm.wrist.rotation.set(0, 0, -.05); rightArm.wrist.rotation.set(0, 0, .05);
    const reach = showingWork ? (still || reviewPose&&phase==='complete'&&distance<.05 ? 1 : ease((age - 3.25) / .90)) : 0;
    if (phase === 'review') { leftArm.shoulder.rotation.x = -.28; leftArm.elbow.rotation.x = -1.02; leftArm.wrist.rotation.set(-.10, -.25, -.18); neck.rotation.y = -.15; }
    if (reach) { rightArm.shoulder.rotation.set(.04 - reach * .88, -reach * .12, .07 - reach * .14); rightArm.elbow.rotation.x = -.12 - reach * .76; leftArm.elbow.rotation.x = -.12 - reach * .15; torso.rotation.y = reach * .045; }
    const posed = still ? 1 : ease(age / (phase === 'return' ? HUMANOID_TIMING.retract : .45));
    joints.forEach((j, i) => j.quaternion.slerpQuaternions(fromPose[i], poseQuaternion[i].copy(j.quaternion), posed));
    for (const finger of fingers) {
      const open = phase === 'review' && finger.side < 0, curl = finger.side > 0 ? .82 : open ? .08 : .36;
      finger.base.rotation.set(finger.thumb ? .16 : curl, finger.thumb ? finger.side * -.30 : 0, finger.spread); finger.tip.rotation.x = finger.thumb ? .35 : curl * .85;
    }
    group.updateWorldMatrix(true, true); targetWorld.copy(sensorTarget); group.parent?.localToWorld(targetWorld);
    if (['observe', 'evidence'].includes(phase) || showingWork) {
      localTarget.copy(targetWorld); torso.worldToLocal(localTarget); localTarget.sub(neck.position);
      const scan = phase === 'observe' && !still && !reviewPose ? Math.sin(Math.min(age, 2.2) / 2.2 * Math.PI * 2) * .055 : 0, headBlend = still ? 1 : ease(age / .85);
      neck.rotation.y = angleMix(neck.rotation.y, clamp(Math.atan2(localTarget.x, localTarget.z) + scan, -.95, .95), headBlend);
      neck.rotation.x = angleMix(neck.rotation.x, clamp(-Math.atan2(localTarget.y - .24, Math.hypot(localTarget.x, localTarget.z)), -.45, .45), headBlend);
    }
    if (reach) {
      rightArm.elbow.getWorldQuaternion(parentQuaternion).invert();
      const sweep = still || reviewPose ? 0 : Math.sin(Math.max(0, age - HUMANOID_TIMING.reach) * 1.6) * .34;
      // First align from the wrist, then correct the handheld head's offset twice.
      // This stays bounded and uses no scene-wide solve or per-frame allocation.
      for (let correction = 0; correction < 3; correction++) {
        rightArm.wrist.updateWorldMatrix(true, true); (correction ? sensorOrigin : rightArm.wrist).getWorldPosition(sensorPosition); localTarget.copy(targetWorld);
        localTarget.y += sweep; localTarget.sub(sensorPosition).normalize().applyQuaternion(parentQuaternion);
        aimQuaternion.setFromUnitVectors(downward, localTarget); rightArm.wrist.quaternion.slerp(aimQuaternion, reach);
      }
    }
    group.updateMatrixWorld(true); optics.emissiveIntensity = reach ? .30 : .13;
    group.userData.phase = phase; group.userData.presentationMode=reviewPose?'evidence-record':'inspection-concept';
    group.userData.atInspectionView = showingWork && (still || reach===1);
    group.userData.motionComplete = still || age >= (showingWork ? reviewPose?HUMANOID_TIMING.reach:HUMANOID_TIMING.inspection : phase === 'return' ? HUMANOID_TIMING.return : .9);
  }
  let meshCount = 0, triangles = 0;
  group.traverse(object => { if (object.isMesh) { meshCount++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
  const stats = Object.freeze({ meshCount, triangles, authoredPieces, geometries: geometries.size, materials: materials.size, lights: 0, shadowMaps: 0, externalAssets: 0 });
  update({ phase: 'ready', still: true });
  return { group, update, stats, getKitGrip: () => kitGrip, dispose() {
    if (disposed) return; disposed = true; group.removeFromParent();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); geometries.clear(); materials.clear(); roundedCache.clear();
  } };
}
