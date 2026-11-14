export function buildHabitat({ THREE: T, mode = 'high' }) {
  const group = new T.Group(); group.name = 'fabricated-cabin';
  const geometries = new Map(), fasteners = [];
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 73.17) * 43758.5453; return n - Math.floor(n); };
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d'), pixels = c.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const grain = hash(x, y), thread = kind === 'cloth' ? (x % 4 < 2 ? 6 : -6) + (y % 4 < 2 ? 6 : -6) : 0;
      const brushed = kind === 'metal' ? (hash(0, y) - .5) * 30 : 0;
      const crease = kind === 'cloth' ? Math.pow(Math.abs(Math.sin((x + y) * Math.PI / 128)), 24) * 32 : 0;
      const value = 177 + grain * 33 + thread + brushed - crease, i = (y * 256 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    c.putImageData(pixels, 0, 0);
    const map = new T.CanvasTexture(canvas); map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(3, 3); map.anisotropy = 4;
    return map;
  }
  const metalMap = texture('metal'), clothMap = texture('cloth'), compositeMap = texture('composite');
  const material = (color, metalness, roughness, map = compositeMap, bumpScale = .003) => new T.MeshStandardMaterial({
    color, metalness, roughness, roughnessMap: map, bumpMap: map, bumpScale, envMapIntensity: .45
  });
  const paint = material(0xb8b9b0, .12, .79), coolPaint = material(0x939e9e, .18, .68);
  const metal = material(0x929b9d, .88, .43, metalMap), darkMetal = material(0x363d40, .72, .63, metalMap);
  const rubber = material(0x14191b, .02, .97), cloth = material(0x9b998a, 0, .96, clothMap, .008);
  const floorMat = material(0x485054, .55, .85, metalMap), black = material(0x090e12, .05, .8);
  const cableMat = material(0x292e2d, .02, .85), cablePale = material(0xa09e8c, .03, .9);
  const mesh = (geo, mat, at, parent = group) => {
    const m = new T.Mesh(geo, mat); m.position.set(...at); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  function box(size, at, mat = paint, parent = group) {
    const key = size.join(':');
    if (!geometries.has(key)) geometries.set(key, new T.BoxGeometry(...size));
    return mesh(geometries.get(key), mat, at, parent);
  }
  function plate(w, h, depth, at, mat = paint) {
    const key = `p:${w}:${h}:${depth}`;
    if (!geometries.has(key)) {
      const s = new T.Shape(), r = .025;
      s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .012, bevelThickness: .012, curveSegments: 3 });
      g.translate(0, 0, -depth / 2); geometries.set(key, g);
    }
    const p = mesh(geometries.get(key), mat, at);
    const tone = .9 + hash(at[0] * 11, at[1] * 7) * .1;
    p.userData.surfaceTint = new T.Color().setRGB(tone, tone * .993, tone * .978);
    for (const x of [-1, 1]) for (const y of [-1, 1]) fasteners.push([at[0] + x * (w / 2 - .09), at[1] + y * (h / 2 - .09), at[2] + depth / 2 + .016]);
    return p;
  }
  function cable(points, radius, mat = cableMat, parent = group) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    return mesh(new T.TubeGeometry(curve, mode === 'low' ? 16 : 28, radius, 6, false), mat, [0, 0, 0], parent);
  }

  const aperture = new T.Shape(); aperture.moveTo(-9, -3.3); aperture.lineTo(9, -3.3); aperture.lineTo(9, 5.4); aperture.lineTo(-9, 5.4); aperture.closePath();
  const hole = new T.Path(); hole.absarc(0, 1.4, 1.8, 0, Math.PI * 2, true); aperture.holes.push(hole);
  const rear = new T.ExtrudeGeometry(aperture, { depth: .18, bevelEnabled: false, curveSegments: 48 });
  mesh(rear, rubber, [0, 0, -4.72]);
  const bulkhead = new T.Shape(); bulkhead.moveTo(-2.4, -.57); bulkhead.lineTo(2.4, -.57); bulkhead.lineTo(2.4, 3.8); bulkhead.lineTo(-2.4, 3.8); bulkhead.closePath();
  const opening = new T.Path(); opening.absarc(0, 1.4, 1.82, 0, Math.PI * 2, true); bulkhead.holes.push(opening);
  mesh(new T.ExtrudeGeometry(bulkhead, { depth: .07, bevelEnabled: true, bevelSegments: 1, bevelThickness: .012, bevelSize: .012, curveSegments: 48 }), coolPaint, [0, 0, -4.47]);
  for (const x of [-2.27, 2.27]) for (const y of [-.43, .9, 2.25, 3.65]) fasteners.push([x, y, -4.375]);
  box([18, .2, 17], [0, -3.2, -4], floorMat);
  box([18, .16, 17], [0, 5.3, -4], paint);
  for (const side of [-1, 1]) {
    box([.18, 8.5, 17], [side * 8, 1.05, -4], coolPaint);
    for (const z of [-4, -1.8, .4, 2.6]) {
      box([.26, 8.25, .12], [side * 7.86, 1, z], metal);
      box([15.7, .13, .15], [0, 5.11, z], darkMetal);
    }
    for (const x of [2.5, 5.1, 7.25]) box([.16, 8.22, .26], [side * x, 1, -4.34], metal);
    plate(2.08, 1.32, .08, [side * 1.12, -2.28, -4.38], cloth);
    plate(2.15, .72, .1, [side * 1.12, -.99, -4.39], coolPaint);
    plate(2.15, 1.2, .08, [side * 1.12, 4.52, -4.39], paint);
    for (let row = 0; row < 3; row++) plate(1.9, 2.45, .09, [side * 6.18, -1.9 + row * 2.65, -4.4], row % 2 ? coolPaint : paint);
    const rackX = side * 3.8;
    box([2.42, 7.65, .3], [rackX, .8, -4.3], darkMetal);
    for (let row = 0; row < 5; row++) {
      const y = -2.3 + row * 1.5;
      box([2.2, 1.36, .32], [rackX, y, -4.05], rubber);
      plate(2.12, 1.26, .1, [rackX, y, -3.83], row === 1 ? darkMetal : paint);
      if (row === 1 || row === 3) {
        box([1.6, .63, .045], [rackX, y - .08, -3.76], black);
        for (let j = 0; j < 8; j++) box([1.55, .026, .065], [rackX, y - .35 + j * .075, -3.705], darkMetal);
      } else {
        cable([[rackX - .64, y + .13, -3.74], [rackX - .64, y + .13, -3.59], [rackX + .64, y + .13, -3.59], [rackX + .64, y + .13, -3.74]], .024, metal);
        box([.19, .14, .03], [rackX + .72, y - .3, -3.75], darkMetal);
        box([.065, .065, .035], [rackX + .72, y - .3, -3.725], coolPaint);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = side * (2.64 + i * .055);
      cable([[x, -2.9, -4.05], [x, .5, -4.0], [x + side * .12, 2.9, -3.99], [side * (3.1 + i * .055), 3.75, -4.0], [side * 5.1, 3.91 + i * .05, -4.05]], .019, i % 3 ? cableMat : cablePale);
    }
    for (const y of [-2.1, -.6, 1, 2.5]) box([.35, .07, .12], [side * 2.76, y, -3.965], metal);
    cable([[side * 2.2, -.4, -4.2], [side * 2.2, -.25, -3.95], [side * 2.2, 1, -3.95], [side * 2.2, 1.15, -4.2]], .038, metal);
  }
  for (let x = -7; x <= 7; x += 1.4) for (const z of [-2.6, -.3, 2]) {
    box([1.35, .018, 2.2], [x, -3.084, z], x % 2 ? darkMetal : floorMat);
    for (let j = 0; j < 4; j++) box([.025, .022, 1.96], [x - .48 + j * .32, -3.071, z], metal);
  }

  const stowage = new T.Group(); stowage.name = 'secured-stowage';
  stowage.position.set(-2.8, -.95, -3.33); stowage.rotation.z = -.075; group.add(stowage);
  const bagMaterial = material(0x8c8c79, 0, .96, clothMap, .012);
  const bagGeometry = new T.BoxGeometry(1.28, 1.05, .64, 10, 8, 6);
  const bagPositions = bagGeometry.attributes.position, rounded = new T.Vector3(), corner = new T.Vector3();
  for (let i = 0; i < bagPositions.count; i++) {
    rounded.fromBufferAttribute(bagPositions, i);
    corner.set(Math.max(-.51, Math.min(.51, rounded.x)), Math.max(-.395, Math.min(.395, rounded.y)), Math.max(-.19, Math.min(.19, rounded.z)));
    rounded.sub(corner).normalize().multiplyScalar(.13).add(corner);
    const crease = Math.sin(rounded.x * 42 + rounded.y * 8) * Math.sin(rounded.y * 19 + .4);
    rounded.z += crease * .012 * Math.max(0, rounded.z / .32);
    bagPositions.setXYZ(i, rounded.x, rounded.y, rounded.z);
  }
  bagGeometry.computeVertexNormals();
  mesh(bagGeometry, bagMaterial, [0, 0, 0], stowage);
  for (const x of [-.33, .34]) {
    box([.105, .91, .021], [x, 0, .326], rubber, stowage);
    box([.105, .023, .46], [x, .526, .02], rubber, stowage);
    box([.105, .023, .46], [x, -.526, .02], rubber, stowage);
    for (const y of [-.04, .08]) box([.16, .025, .027], [x, y, .348], metal, stowage);
    for (const dx of [-.067, .067]) box([.026, .12, .027], [x + dx, .02, .348], metal, stowage);
    box([.085, .23, .018], [x + .008, -.195, .352], rubber, stowage).rotation.z = .06;
  }
  for (const y of [-.405, .405]) cable([[-.48, y, .265], [-.25, y + .018, .317], [.27, y - .01, .317], [.49, y, .265]], .006, cablePale, stowage);
  cable([[-.21, .49, .03], [-.17, .65, .08], [.16, .65, .08], [.22, .49, .03]], .029, rubber, stowage);

  for (let i = 0; i < 3; i++) {
    const offset = i * .048;
    cable([[2.72 + offset, 2.65, -3.94], [2.9 + offset, 1.84, -3.66], [3.75 + offset, 1.52, -3.52], [4.65 + offset, 1.65, -3.73], [4.93 + offset, 1.14, -3.95]], .018, i === 1 ? cablePale : cableMat);
  }
  for (const at of [[2.79, 2.56, -3.88], [4.98, 1.15, -3.85]]) box([.23, .085, .08], at, rubber);

  const tool = new T.Group(); tool.name = 'tethered-hand-tool'; tool.position.set(2.88, -.75, -3.49); tool.rotation.z = .3; group.add(tool);
  mesh(new T.CylinderGeometry(.045, .055, .44, 12), rubber, [0, -.13, 0], tool);
  mesh(new T.CylinderGeometry(.019, .019, .27, 10), metal, [0, .22, 0], tool);
  box([.11, .11, .08], [0, .405, 0], darkMetal, tool);
  box([.105, .025, .095], [0, .46, 0], metal, tool);
  const gripRib = new T.TorusGeometry(.049, .004, 4, 12);
  for (let i = 0; i < 5; i++) mesh(gripRib, darkMetal, [0, -.29 + i * .07, 0], tool).rotation.x = Math.PI / 2;
  const tetherPoints = [[2.72, -.3, -3.96], [2.46, -.9, -3.56], [2.64, -1.47, -3.35], [3.1, -1.4, -3.34], [2.98, -1.08, -3.49]];
  cable(tetherPoints, .009, cablePale);

  const wearCanvas = document.createElement('canvas'); wearCanvas.width = 256; wearCanvas.height = 96;
  const wearContext = wearCanvas.getContext('2d'), wearPixels = wearContext.createImageData(256, 96);
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(40 + hash(i, 8) * 175), y = Math.floor(18 + hash(i, 19) * 60), length = 2 + Math.floor(hash(i, 27) * 20);
    for (let j = 0; j < length; j++) {
      const px = x + j, py = y + Math.floor(j * (hash(i, 43) - .5) * .38);
      if (px >= 256 || py < 0 || py >= 96) continue;
      const pixel = (py * 256 + px) * 4, exposed = i % 5 === 0;
      wearPixels.data[pixel] = exposed ? 165 : 55; wearPixels.data[pixel + 1] = exposed ? 169 : 56; wearPixels.data[pixel + 2] = exposed ? 162 : 49;
      wearPixels.data[pixel + 3] = Math.round((exposed ? 75 : 34) * Math.sin(Math.PI * j / length));
    }
  }
  wearContext.putImageData(wearPixels, 0, 0);
  const wearMap = new T.CanvasTexture(wearCanvas); wearMap.colorSpace = T.SRGBColorSpace;
  const wearMaterial = new T.MeshStandardMaterial({ map: wearMap, transparent: true, depthWrite: false, roughness: .9, metalness: .05 });
  const wearGeometry = new T.PlaneGeometry(1.72, .43);
  for (const [x, y] of [[-3.8, -2.17], [-3.8, .83], [3.8, 3.83]]) {
    const scuff = mesh(wearGeometry, wearMaterial, [x, y, -3.751]); scuff.renderOrder = 1; scuff.castShadow = false;
  }

  const window = new T.Group(); window.position.set(0, 1.4, -4.27); group.add(window);
  for (const [inner, outer, depth, z, mat] of [[1.81, 2.1, .14, 0, metal], [1.75, 1.84, .055, .07, rubber], [1.7, 1.75, .08, .025, darkMetal]]) {
    const shape = new T.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const cut = new T.Path(); cut.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(cut);
    mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelThickness: .008, bevelSize: .008, curveSegments: 48 }), mat, [0, 0, z - depth / 2], window);
  }
  for (let i = 0; i < 20; i++) fasteners.push([Math.cos(i * Math.PI / 10) * 1.97, 1.4 + Math.sin(i * Math.PI / 10) * 1.97, -4.17]);
  const glass = new T.MeshPhysicalMaterial({ color: 0xc3d4d9, roughness: .085, metalness: .06, transparent: true, opacity: .035, clearcoat: 1, clearcoatRoughness: .05, side: T.DoubleSide, depthWrite: false, envMapIntensity: .7 });
  for (const z of [-.05, -.26]) mesh(new T.CircleGeometry(1.71, 64), glass, [0, 0, z], window).renderOrder = 2;
  const sleeve = mesh(new T.CylinderGeometry(1.72, 1.72, .3, 64, 1, true), darkMetal, [0, 0, -.16], window); sleeve.rotation.x = Math.PI / 2;

  const luminous = new T.MeshStandardMaterial({ color: 0xd5d9cf, emissive: 0xbfcddd, emissiveIntensity: .6, roughness: .7 });
  for (const side of [-1, 1]) {
    box([2.2, .24, .28], [side * 4.1, 4.44, -4.04], darkMetal);
    const fixture = box([1.95, .09, .04], [side * 4.1, 4.43, -3.88], luminous); fixture.layers.enable(1);
    const fill = new T.PointLight(0xd9e5ec, 3, 6, 2); fill.position.set(side * 4.1, 4.2, -3.35); group.add(fill);
  }
  const screws = new T.InstancedMesh(new T.CylinderGeometry(.027, .027, .018, 8), metal, fasteners.length);
  const cuts = new T.InstancedMesh(new T.BoxGeometry(.028, .006, .003), rubber, fasteners.length);
  const transform = new T.Object3D();
  for (let i = 0; i < fasteners.length; i++) {
    transform.position.set(...fasteners[i]); transform.rotation.set(Math.PI / 2, 0, 0); transform.updateMatrix(); screws.setMatrixAt(i, transform.matrix);
    transform.position.z += .01; transform.rotation.set(0, 0, hash(i, 1) * Math.PI); transform.updateMatrix(); cuts.setMatrixAt(i, transform.matrix);
  }
  screws.castShadow = screws.receiveShadow = true; group.add(screws, cuts);
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh) return;
    const key = `${object.geometry.uuid}:${object.material.uuid}:${object.renderOrder}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const first = objects[0], batch = new T.InstancedMesh(first.geometry, first.material, objects.length);
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow; batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
    const tinted = objects.some(object => object.userData.surfaceTint);
    for (let i = 0; i < objects.length; i++) {
      batch.setMatrixAt(i, objects[i].matrixWorld);
      if (tinted) batch.setColorAt(i, objects[i].userData.surfaceTint || new T.Color(1, 1, 1));
      objects[i].removeFromParent();
    }
    batch.computeBoundingSphere(); group.add(batch);
  }
  group.userData.surfaceDescription = 'Illustrative fabricated hardware; not a reconstruction of a NASA vehicle.';
  return { group };
}
