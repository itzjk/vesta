const textures = new Map();

export function surface(THREE, kind = 'metal') {
  if (textures.has(kind)) return textures.get(kind);
  const n = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(n, n);
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + 13.7) * 43758.5453; return v - Math.floor(v); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const noise = hash(x, y), scratch = hash(Math.floor(x / 2), Math.floor(y / 53)) > .974;
    const weave = kind === 'fabric' ? ((x % 4 < 2 ? 1 : -1) + (y % 4 < 2 ? 1 : -1)) * 14 : Math.sin(y * 3.1) * 4;
    const value = Math.max(0, Math.min(255, 172 + noise * 36 + weave - (scratch ? 75 : 0)));
    const i = (y * n + x) * 4; data.data[i] = data.data[i + 1] = data.data[i + 2] = value; data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'fabric' ? 9 : 3, kind === 'fabric' ? 9 : 3); texture.anisotropy = 4;
  textures.set(kind, texture); return texture;
}

export function hardware(THREE, kind = 'metal', props = {}) {
  const cloth = kind === 'fabric', map = surface(THREE, kind);
  const material = new THREE.MeshPhysicalMaterial({ color: cloth ? 0x777b79 : 0x6e7477, metalness: cloth ? 0 : .78, roughness: cloth ? .94 : .46, roughnessMap: map, bumpMap: map, bumpScale: cloth ? .012 : .006, clearcoat: cloth ? 0 : .15, envMapIntensity: .65, ...props });
  return material;
}

export function softShadow(light, size = 1024, extent = 9) {
  light.castShadow = true; light.shadow.mapSize.set(size, size); light.shadow.normalBias = .006; light.shadow.bias = -.00005; light.shadow.radius = 3;
  Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: .2, far: 40 });
  light.shadow.camera.updateProjectionMatrix(); return light;
}

export function tube(THREE, points, radius, material, group) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 6, false), material);
  mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
}

export function balanceWorldLight(world, factor = .3, environmentFactor = factor) {
  const lights = world.root?.parent?.children.filter(o => o.isLight).map(light => [light, light.intensity]) || [];
  let top = world.root;
  while (top?.parent) top = top.parent;
  let active = false, environment, environmentScene;
  const applyEnvironment = () => {
    let scene = world.root;
    while (scene?.parent) scene = scene.parent;
    if (!scene?.isScene) return;
    if (active && !environmentScene) {
      environmentScene = scene; environment = scene.environmentIntensity;
      if (Number.isFinite(environment)) scene.environmentIntensity = environment * environmentFactor;
    }
    if (!active && environmentScene) {
      if (Number.isFinite(environment)) environmentScene.environmentIntensity = environment;
      environmentScene = null;
    }
  };
  top?.addEventListener('added', applyEnvironment);
  return value => {
    active = value;
    for (const [light, intensity] of lights) light.intensity = intensity * (active ? factor : 1);
    applyEnvironment();
  };
}
