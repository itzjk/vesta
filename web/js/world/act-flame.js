import { buildDeck } from '../scene/deck.js';
import { buildHabitat } from '../scene/habitat.js';
import { hardware, balanceWorldLight } from '../scene/materials.js';
import { NASA_TEXTURES } from '../scene/imagery.js';
import { build as buildFlame } from '../scene/flame.js';
import { build as buildMars } from '../scene/mars.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, stage, db, vesta } = world;
  const balanceLight = balanceWorldLight(world, .08);
  const group = new THREE.Group(); group.name = 'flame-cabin'; stage.scene.add(group);
  const habitat = buildHabitat({ THREE, mode: stage.mode }); group.add(habitat.group);
  habitat.group.traverse(object => {
    const p = object.geometry?.parameters;
    if (p && p.height < .03 && (p.width === 1.35 || p.width === .025)) object.visible = false;
    if (object.material?.isMeshPhysicalMaterial && object.material.transparent) { object.material.opacity = .07; object.material.envMapIntensity = 1.2; object.material.roughness = .1; }
  });
  group.add(buildDeck({ THREE }).group);
  const rib = hardware(THREE, 'metal', { color: 0x6e7578, roughness: .54 });
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(.19, .22, .14, 24), rib); mount.castShadow = mount.receiveShadow = true; group.add(mount);
  const mars = await buildMars({ THREE, mode: stage.mode, camera: stage.camera }); mars.group.position.set(-.2, 1.5, -8.3); mars.group.scale.setScalar(2.5); group.add(mars.group);
  const flame = await buildFlame({ THREE, mode: stage.mode }); group.add(flame.group);
  const rim = new THREE.DirectionalLight(0xb6cce1, .25); rim.position.set(4, 2, -2);
  group.add(rim, new THREE.HemisphereLight(0xede4d4, 0x12100e, .12));
  const dustGeometry = new THREE.BufferGeometry(), dustPositions = new Float32Array((stage.mode === 'low' ? 24 : 64) * 3);
  for (let i = 0; i < dustPositions.length; i++) dustPositions[i] = Math.sin(i * 127.1 + .3) * (i % 3 === 2 ? 3 : 5);
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xb9ae9d, size: .016, transparent: true, opacity: .3, depthWrite: false })); group.add(dust);
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
  const disclosure = document.createElement('p'); disclosure.className = 'flame-disclosure'; disclosure.dataset.stationUi = '';
  disclosure.textContent = 'Illustration, not a simulation. Low-momentum flames only.';
  Object.assign(disclosure.style, { position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 80px)', margin: '0', textAlign: 'center', fontSize: '14px', lineHeight: '1.4', color: '#c6c9c7', pointerEvents: 'none', textShadow: '0 1px 4px #000', zIndex: '2', display: 'none' });
  world.overlay?.append(disclosure);
  let phoneLayout, active = false, started, previous, space = Number(slider.value) / 100, target = space, drag;
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
  host?.addEventListener('pointerdown', down); host?.addEventListener('pointermove', move, { passive: false }); host?.addEventListener('pointerup', up); host?.addEventListener('pointercancel', up);
  signal();
  return {
    group, anchor: [0, 0, 0], camera: () => ({ position: [0, stage.camera.aspect < .9 ? .45 : .3, stage.camera.aspect < .9 ? 7.8 : 8.7], target: [0, stage.camera.aspect < .9 ? .45 : .15, 0], fov: stage.camera.aspect < .9 ? 44 : 38 }),
    enter() { balanceLight(true); active = true; started = previous = undefined; group.visible = true; disclosure.style.display = ''; },
    leave() { balanceLight(false); active = false; drag = null; disclosure.style.display = 'none'; answerHolo.close(); controlHolo.close(); creditHolo.close(); group.visible = false; },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (started === undefined) started = t;
      const capture = state.capture || world.params?.capture === '1';
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const local = state.localTime ?? t - started, time = reduced ? 2 : t;
      const dt = previous === undefined ? 0 : Math.max(0, Math.min(.1, t - previous)); previous = t;
      space = capture || reduced ? target : space + (target - space) * (1 - Math.exp(-dt * 9));
      world.answer?.(space < .015 ? 'Earth: yellow teardrop.' : space > .985 ? 'Space: rounded low-momentum flame.' : 'Earth and space blend.');
      const phone = (stage.camera || world.camera)?.aspect < .9;
      const inspecting = [answerHolo, controlHolo, creditHolo].some(h => h.target > 0) || world.host?.dataset.hologramOpen === 'true';
      phoneLayout = phone;
      disclosure.style.bottom = phone ? '63px' : '100px';
      const wake = capture || reduced ? 1 : ease(local / 1.5), launch = capture || reduced ? 1 : ease((local - .3) / 1.3);
      const reaction = Math.abs(space - target);
      vesta.update(time, { ...vesta.defaults, x: (phone ? -.85 : -1.7) + (1 - launch) * 1.5, y: (phone ? inspecting ? 1.1 : .85 : .5) - (1 - launch) * .8 + Math.sin(time * .9) * .06, z: .15 - (1 - launch) * 1.8,
        scale: phone ? inspecting ? 1.85 : 2.1 : 1.85, sleep: 1 - wake, yaw: -.6 * (1 - wake) + .12 + (state.pointerX || 0) * .2,
        roll: Math.sin(time * .8) * .035 + Math.sin(launch * Math.PI) * .22, pitch: (state.pointerY || 0) * -.07,
        lookX: (state.pointerX || 0) * .7 + .2, lookY: (state.pointerY || 0) * .5,
        blink: Math.max(0, 1 - Math.abs(time % 5.6 - 4.5) / .14), armR: .35 + wake * .25 + reaction, armFwdR: .35 + reaction * .5,
        thrust: .45 + Math.sin(launch * Math.PI) * .8, fins: .6, beacon: .35 + wake * .5, beaconWarm: 1, idle: reduced ? 0 : 1 });
      flame.group.position.set(phone ? .9 : 2, phone ? .85 : .65, .1);
      const breath = (1 + Math.sin(time * 1.7) * .018) * (.88 + space * .12);
      flame.group.scale.setScalar((phone ? .72 : .85) * breath); flame.update(time, { space }); mars.update(time);
      mount.position.set(phone ? .9 : 2, (phone ? .85 : .65) - (phone ? .72 : .85) * breath * 1.03, .1);
      answerHolo.marker?.set({ at: [phone ? -.85 : -1.7, phone ? inspecting ? 1.1 : .85 : .5, .15] });
      controlHolo.marker?.set({ at: [phone ? .9 : 2, phone ? .85 : .65, .1] });
      dust.rotation.y = Math.sin(time * .07) * .12; dust.position.y = Math.sin(time * .17) * .08;

      answerHolo.set?.({ at: phone ? [0, -1.05, .8] : [-2.25, -1.25, .5] });
      controlHolo.set?.({ at: phone ? [0, -2.7, .8] : [2.55, -1.35, .5] });
    },
    holograms: () => [answerHolo, controlHolo, creditHolo],
    dispose() {
      balanceLight(false); slider.removeEventListener('input', change); action.removeEventListener('click', advance);
      host?.removeEventListener('pointerdown', down); host?.removeEventListener('pointermove', move); host?.removeEventListener('pointerup', up); host?.removeEventListener('pointercancel', up);
      answerHolo.dispose(); controlHolo.dispose(); creditHolo.dispose(); disclosure.remove(); group.removeFromParent();
    }
  };
}
