import { buildDeck } from '../scene/deck.js';
import { buildHabitat } from '../scene/habitat.js';
import { hardware, balanceWorldLight } from '../scene/materials.js';
import { NASA_TEXTURES, nasaTexture } from '../scene/imagery.js';
import { build as buildFlame } from '../scene/candle.js';
import { build as buildMars } from '../scene/mars.js';

// 1 = the camera opens up for the dim flame (exposure 3 on Earth, 6 in space) so the cabin and the guide stay readable.
// The owner asked for this on Nov 14 at 11:19 p.m. after seeing the darker look (0) on the live site.
export const EXPOSURE_VARIANT = 1;

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, stage, db, vesta } = world;
  const balanceLight = balanceWorldLight(world, 0, .1);
  const group = new THREE.Group(); group.name = 'flame-cabin'; stage.scene.add(group);
  const habitat = buildHabitat({ THREE, mode: stage.mode }); group.add(habitat.group);
  habitat.group.traverse(object => {
    if (object.isPointLight) object.intensity *= 1.1;
    const p = object.geometry?.parameters;
    if (p && p.height < .03 && (p.width === 1.35 || p.width === .025)) object.visible = false;
    if (object.material?.isMeshPhysicalMaterial && object.material.transparent) { object.material.opacity = .025; object.material.envMapIntensity = .22; object.material.roughness = .12; }
  });
  group.add(buildDeck({ THREE }).group);
  const mars = await buildMars({ THREE, mode: stage.mode, camera: stage.camera }); mars.group.position.set(-.2, 1.5, -8.3); mars.group.scale.setScalar(1.05); group.add(mars.group);
  const flame = await buildFlame({ THREE, mode: stage.mode }); group.add(flame.group);
  const ledgeMaterial = hardware(THREE, 'metal', {color: 0x555b5b, metalness: .72, roughness: .48});
  for (const [size, at] of [[[2.2, .035, .68], [.06, -.218, -1.5]], [[2.2, .065, .025], [.06, -.265, -1.17]], [[.035, .27, .57], [.86, -.37, -1.55]]]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(...size), ledgeMaterial); support.position.set(...at); support.castShadow = support.receiveShadow = true; group.add(support);
  }
  const candleWorld = new THREE.Vector3();
  const key = flame.group.getObjectByName('candle-key');
  key.castShadow = stage.mode === 'high'; key.shadow.mapSize.set(512, 512);
  key.shadow.bias = -.00015; key.shadow.normalBias = .001; key.shadow.radius = 2;
  key.shadow.camera.near = .025; key.shadow.camera.far = 14;
  key.shadow.camera.updateProjectionMatrix();
  const plateTexture = await nasaTexture(THREE, 'candle');
  const plate = new THREE.Group(); plate.name = 'nasa-candle-photograph'; plate.position.set(-.5, -.013, -1.13); plate.scale.setScalar(.95); plate.rotation.set(-.08, .13, -.055); group.add(plate);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(.49, .391, .025), hardware(THREE, 'metal', {color: 0x353c40, roughness: .53}));
  frame.castShadow = frame.receiveShadow = true; plate.add(frame);
  const photograph = new THREE.Mesh(new THREE.PlaneGeometry(.46, .358), new THREE.MeshStandardMaterial({map: plateTexture, emissiveMap: plateTexture, emissive: 0xffffff, emissiveIntensity: .16, roughness: .68, metalness: 0}));
  photograph.position.z = .014; photograph.receiveShadow = true; plate.add(photograph);
  const finding = db.findingById['S-SHAPE-01'];
  const answer = document.createElement('section'); answer.className = 'world-flame-answer'; answer.style.width = 'min(540px, 88vw)'; answer.style.background = 'transparent';
  const quote = document.createElement('blockquote'); quote.style.margin = '0 0 12px';
  if (finding) quote.append(world.cite(finding.quote, finding.id)); else quote.textContent = 'The NASA observation is unavailable.';
  const note = document.createElement('p'); note.className = 'world-flame-limit'; note.style.margin = '0'; note.textContent = 'Illustration of a NASA observation, not a simulation. Low-momentum flames only.';
  answer.append(quote, note);
  const console = document.createElement('section'); console.className = 'world-flame-controls'; console.style.width = 'min(500px, 88vw)';
  const label = document.createElement('label'); label.htmlFor = 'world-flame-morph'; label.textContent = 'Drag to compare Earth and space';
  const slider = document.createElement('input'); slider.id = label.htmlFor; slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1'; slider.value = String(Math.round(clamp(Number(world.params?.space ?? 1)) * 100));
  slider.style.width = '100%'; slider.style.minHeight = '44px'; slider.setAttribute('aria-label', 'Illustrated flame, On Earth to In space');
  const status = document.createElement('output'); status.htmlFor = slider.id; status.style.display = 'block';
  const action = document.createElement('button'); action.type = 'button'; action.className = 'world-primary'; action.style.background = 'var(--rust-deep)'; action.style.color = 'var(--ivory)'; action.textContent = 'Explore the evidence';
  console.append(label, slider, status, action);
  const answerHolo = world.hologram(answer, { at: [-1.7, .5, .15], markerAt: [-1.7, .5, .15], label: 'Read the NASA flame observation', dock: 'left', width: 440 });
  const controlSurface = document.createElement('div'); controlSurface.style.background = 'transparent'; controlSurface.append(console);
  const controlHolo = world.hologram(controlSurface, { at: [2, .65, .1], markerAt: [2, .65, .1], label: 'Compare the flame illustrations', dock: 'right', width: 440 });
  const credits = document.createElement('section'); credits.setAttribute('aria-label', 'NASA image credits');
  const creditTitle = document.createElement('h2'); creditTitle.textContent = 'NASA imagery'; credits.append(creditTitle);
  for (const entry of Object.values(NASA_TEXTURES)) {
    const p = document.createElement('p'), link = document.createElement('a'); link.href = `https://images.nasa.gov/details/${entry.id}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = entry.title; p.append(link, document.createElement('br'), entry.credit); credits.append(p);
  }
  const creditHolo = world.hologram(credits, { at: [0, 1.4, -4.1], label: 'NASA image credits at the porthole', width: 440 });
  const photoPanel = document.createElement('section'); photoPanel.setAttribute('aria-label', 'NASA candle photograph');
  const photoTitle = document.createElement('h2'); photoTitle.textContent = 'NASA photograph'; photoTitle.style.margin = '0 0 4px';
  const photoImage = document.createElement('img'); photoImage.src = plateTexture.image.src; photoImage.alt = 'NASA photographs: candle in normal gravity on the left, microgravity on the right';
  Object.assign(photoImage.style, {width: '100%', height: 'auto', display: 'block', maxHeight: '38vh', objectFit: 'contain'});
  const photoCredit = document.createElement('p'); photoCredit.textContent = 'NASA Glenn Research Center · GRC-1998-C-00485';
  const photoLink = document.createElement('a'); photoLink.href = 'https://images.nasa.gov/details/GRC-1998-C-00485'; photoLink.target = '_blank'; photoLink.rel = 'noopener'; photoLink.textContent = 'Candle in normal gravity and microgravity';
  photoCredit.textContent = ''; photoLink.textContent = 'NASA Glenn Research Center · GRC-1998-C-00485'; photoCredit.append(photoLink); Object.assign(photoCredit.style, {margin: '0 0 6px', fontSize: '18px', lineHeight: '1.2'});
  photoPanel.append(photoTitle, photoCredit, photoImage);
  const photoHolo = world.hologram(photoPanel, { at: [-.5, -.013, -1.13], label: 'Enlarge the NASA candle photograph', dock: 'left', width: 480 });
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let plateDown;
  const hitPlate = e => {
    const box = stage.renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - box.left) / box.width * 2 - 1, 1 - (e.clientY - box.top) / box.height * 2);
    ray.setFromCamera(pointer, stage.camera); return ray.intersectObject(photograph).length > 0;
  };
  const plateStart = e => { if (active && !e.target.closest?.('button,a,input,.world-hologram') && hitPlate(e)) { plateDown = [e.clientX, e.clientY]; e.stopPropagation(); } };
  const plateEnd = e => { if (plateDown && Math.hypot(e.clientX - plateDown[0], e.clientY - plateDown[1]) < 6 && hitPlate(e)) { e.stopPropagation(); photoHolo.toggle(); world.invalidate?.(); } plateDown = null; };
  const answerLine = world.overlay?.querySelector('.world-answer');
  let savedAnswerStyle;
  let parameterSpace = world.params?.space;
  let savedExposure, active = false, started, previous, space = Number(slider.value) / 100, target = space, drag;
  const host = world.host || stage.renderer?.domElement;
  const signal = () => {
    status.textContent = target === 0 ? 'On Earth: yellow teardrop' : target === 1 ? 'In space: rounded low-momentum flame' : 'Between the Earth and space illustrations';
    slider.setAttribute('aria-valuetext', status.textContent);
    world.invalidate?.();
  };
  const change = () => { target = Number(slider.value) / 100; signal(); };
  const down = e => {
    if (!active || e.button !== 0 || e.target.closest?.('button,a,input,[data-cite],.world-cite')) return;
    drag = { x: e.clientX, y: e.clientY, value: target, id: e.pointerId, horizontal: false };
  };
  const move = e => {
    if (!active || !drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.horizontal && Math.abs(dy) > Math.abs(dx) + 8) { drag = null; return; }
    if (Math.abs(dx) > 8) drag.horizontal = true;
    if (!drag.horizontal) return;
    e.preventDefault(); e.stopPropagation(); host.setPointerCapture?.(e.pointerId);
    target = clamp(drag.value + dx / Math.max(180, host.clientWidth * .55)); slider.value = String(Math.round(target * 100)); signal();
  };
  const up = e => { if (drag?.horizontal) e.stopPropagation(); drag = null; };
  const advance = () => world.navigate ? world.navigate('evidence') : world.go('#/design');
  slider.addEventListener('input', change); action.addEventListener('click', advance);
  host?.addEventListener('pointerdown', plateStart, true); host?.addEventListener('pointerup', plateEnd, true); host?.addEventListener('pointerdown', down); host?.addEventListener('pointermove', move, { passive: false }); host?.addEventListener('pointerup', up); host?.addEventListener('pointercancel', up);
  signal();
  return {
    actions: () => [
      { id:'compare',label:'Earth / space',primary:true,expanded:()=>controlHolo.target>0,run:()=>controlHolo.toggle() },
      { id:'source',label:'NASA observation',context:note,expanded:()=>answerHolo.target>0,run:()=>answerHolo.toggle() },
      { id:'evidence',label:'Explore the evidence',run:advance }
    ],
    group, anchor: [0, 0, 0], camera: () => { const aspect = stage.camera.aspect, phone = aspect < .9, distance = phone ? Math.max(4.05, 2.78 / aspect) : 2.8; return { position: [phone ? .15 : .65, .72, distance - 1.5], target: [0, .28, -1.5], fov: 33 }; },
    enter() { balanceLight(true); if (!active) { savedExposure = stage.renderer.toneMappingExposure; savedAnswerStyle = Object.fromEntries(['fontSize','fontFamily','fontWeight','letterSpacing'].map(key => [key, answerLine?.style[key] || ''])); } stage.renderer.toneMappingExposure = .72; active = true; started = previous = undefined; group.visible = true; },
    leave() { balanceLight(false); if (answerLine && savedAnswerStyle) Object.assign(answerLine.style, savedAnswerStyle); stage.renderer.toneMappingExposure = savedExposure ?? .85; delete stage.camera.userData.focusObject; delete stage.camera.userData.focusOffset; delete stage.camera.userData.aperture; active = false; drag = null; answerHolo.close(); controlHolo.close(); creditHolo.close(); photoHolo.close(); group.visible = false; },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (world.params?.space !== parameterSpace) {
        parameterSpace = world.params?.space;
        const value = Number(parameterSpace ?? 1); target = Number.isFinite(value) ? clamp(value) : 1;
        slider.value = String(Math.round(target * 100)); signal();
      }
      if (started === undefined) started = t;
      const capture = state.capture || world.params?.capture === '1';
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const local = state.localTime ?? t - started, time = reduced ? 2 : t;
      const dt = previous === undefined ? 0 : Math.max(0, Math.min(.1, t - previous)); previous = t;
      space = capture || reduced ? target : space + (target - space) * (1 - Math.exp(-dt * 9));
      stage.renderer.toneMappingExposure = EXPOSURE_VARIANT ? .72 + EXPOSURE_VARIANT * ((3 + 3 * space) - .72) : .72;
      world.answer?.(space < .015 ? 'On Earth: yellow teardrop.' : space > .985 ? 'In space: rounded low-momentum flame.' : 'Between the Earth and space illustrations.');
      const phone = (stage.camera || world.camera)?.aspect < .9;
      photoImage.style.maxHeight = phone ? '18vh' : '38vh';
      plate.position.set(phone ? -.36 : -.78, phone ? -.31 : -.013, phone ? -1.11 : -1.13); plate.scale.setScalar(phone ? .88 : .95);
      photoHolo.marker?.set({at: plate.position.toArray()});
      if (answerLine) Object.assign(answerLine.style, phone ? {fontSize: '18px', fontFamily: 'var(--display)', fontWeight: '600', letterSpacing: '-.35px'} : savedAnswerStyle || {});
      const wake = capture || reduced ? 1 : ease(local / 1.5), launch = capture || reduced ? 1 : ease((local - .3) / 1.3);
      flame.group.position.set(.49, .055, -1.5); flame.update(time, { space }); mars.update(time);
      flame.group.updateWorldMatrix(true, false); candleWorld.set(0, .36 - space * .22, 0); flame.group.localToWorld(candleWorld);
      vesta.update(time, { ...vesta.defaults, x: -.35 + (1 - launch) * .3, y: .31 - (1 - launch) * .2, z: -1.465,
        scale: .68, sleep: 1 - wake, yaw: .16 + (state.pointerX || 0) * .08,
        roll: Math.sin(time * .8) * .012, pitch: (state.pointerY || 0) * -.025,
        lookX: (state.pointerX || 0) * .25 + .3, lookY: (state.pointerY || 0) * .2,
        blink: Math.max(0, 1 - Math.abs(time % 5.6 - 4.5) / .14), armR: .38 + wake * .1, armFwdR: .15,
        thrust: .04, fins: .6, beacon: .025, beaconWarm: 1, idle: reduced ? 0 : .3, photographic: 1, candleWorld, candleSpace: space, candleGain: key.intensity / (1.5 * (1 - space) + .15 * space) });
      stage.camera.userData.focusObject = flame.group;
      stage.camera.userData.focusOffset = [0, .28, 0]; stage.camera.userData.aperture = 3.2;
      answerHolo.marker?.set({ at: [-.35, .31, -1.465] });
      controlHolo.marker?.set({ at: [.49, .37, -1.5] });

      answerHolo.set?.({ at: phone ? [0, -1.05, .8] : [-2.25, -1.25, .5] });
      controlHolo.set?.({ at: phone ? [0, -2.7, .8] : [2.55, -1.35, .5] });
    },
    holograms: () => [answerHolo, controlHolo, creditHolo, photoHolo],
    dispose() {
      balanceLight(false); slider.removeEventListener('input', change); action.removeEventListener('click', advance);
      host?.removeEventListener('pointerdown', plateStart, true); host?.removeEventListener('pointerup', plateEnd, true); host?.removeEventListener('pointerdown', down); host?.removeEventListener('pointermove', move); host?.removeEventListener('pointerup', up); host?.removeEventListener('pointercancel', up);
      answerHolo.dispose(); controlHolo.dispose(); creditHolo.dispose(); photoHolo.dispose(); group.removeFromParent();
    }
  };
}
