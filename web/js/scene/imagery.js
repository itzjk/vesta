export const NASA_TEXTURES = Object.freeze({
  candle: { path: 'candle-pair.jpg', id: 'GRC-1998-C-00485', title: 'Candle in normal gravity and microgravity', credit: 'NASA Glenn Research Center' },
  mars: { path: 'mars.jpg', id: 'PIA04304', title: 'The Target', credit: 'NASA/USGS', crop: [164, 145, 968, 968] },
  earth: { path: 'earth.jpg', id: 'GSFC_20171208_Archive_e001386', title: 'Most Amazing High Definition Image of Earth, Blue Marble 2012', credit: 'NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring', crop: [86, 86, 1108, 1108] },
  stars: { path: 'stars.jpg', id: 'PIA12066', title: 'Star Field in the Constellation Cepheus', credit: 'NASA/JPL/MPS/DLR/IDA' }
});

export async function nasaTexture(THREE, name, crop = false) {
  const entry = NASA_TEXTURES[name], url = new URL(`../../assets/nasa/tex/${entry.path}`, import.meta.url).href;
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; texture.userData = { nasa_id: entry.id, credit: entry.credit };
  if (!crop || !entry.crop) return texture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  canvas.getContext('2d').drawImage(texture.image, ...entry.crop, 0, 0, 1024, 1024);
  const projected = new THREE.CanvasTexture(canvas); projected.colorSpace = THREE.SRGBColorSpace; projected.anisotropy = 4; projected.userData = { ...texture.userData, projection: 'cropped orthographic photograph' }; texture.dispose(); return projected;
}

export async function photoPlanet(THREE, name, mode = 'high') {
  const texture = await nasaTexture(THREE, name, true);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 photoPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nphotoPosition=position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 photoPosition;').replace('texture2D( map, vMapUv )', 'texture2D( map, photoPosition.xy*.5+.5 )');
  };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, mode === 'low' ? 40 : 64, 40), material);
  planet.userData.nasa_id = NASA_TEXTURES[name].id;
  return planet;
}

export async function imageEnvironment(THREE, renderer, scene) {
  const [stars, mars, earth] = await Promise.all([nasaTexture(THREE, 'stars'), nasaTexture(THREE, 'mars'), nasaTexture(THREE, 'earth')]);
  stars.wrapS = stars.wrapT = THREE.RepeatWrapping; stars.repeat.set(6, 3);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), new THREE.MeshBasicMaterial({ map: stars, color: 0x656d7b, side: THREE.BackSide, depthWrite: false }));
  sky.name = 'nasa-star-field'; sky.rotation.set(.4, .2, .25); sky.renderOrder = -100; scene.add(sky);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), new THREE.MeshBasicMaterial({ color: 0x080b10, side: THREE.BackSide })));
  const panel = (size, pos, color, map) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color, ...(map ? { map } : {}), side: THREE.DoubleSide })); mesh.position.set(...pos); mesh.lookAt(0, 0, 0); room.add(mesh); };
  panel([12, 12], [-14, 2, -6], 0xffffff, mars); panel([7, 7], [12, 4, -9], 0xaecbff, earth);
  panel([34, 25], [0, 0, -19], 0x29303a, stars);
  panel([16, 1.5], [0, 12, 1], new THREE.Color(2.4, 2.7, 3.1)); panel([3, 5], [-10, 4, 10], new THREE.Color(1.6, 1.45, 1.25));
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(room, .06, .1, 100);
  scene.environment = environment.texture; scene.environmentIntensity = .7;
  pmrem.dispose(); room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); mars.dispose(); earth.dispose();
  return { dispose() { scene.remove(sky); sky.geometry.dispose(); sky.material.dispose(); stars.dispose(); environment.dispose(); if (scene.environment === environment.texture) scene.environment = null; } };
}
