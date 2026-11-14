import { build as buildFlame } from '../scene/flame.js';
import { build as buildMars } from '../scene/mars.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function build(world) {
  const { THREE, stage, db, vesta } = world;
  const group = new THREE.Group(); group.name = 'flame-cabin'; stage.scene.add(group);
  const wall = new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: .76, metalness: .3, side: THREE.DoubleSide });
  const rib = new THREE.MeshStandardMaterial({ color: 0x5a534b, roughness: .48, metalness: .72 });
  const inset = new THREE.MeshStandardMaterial({ color: 0x322d27, roughness: .7, metalness: .4 });
  function box(size, at, material = wall) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...at); group.add(mesh); return mesh;
  }
  box([20, .18, 17], [0, -3.1, -4]); box([20, .18, 17], [0, 5.2, -4]);
  box([.18, 8.3, 17], [-8, 1, -4]); box([.18, 8.3, 17], [8, 1, -4]);
  const aperture = new THREE.Shape(); aperture.moveTo(-10, -4); aperture.lineTo(10, -4); aperture.lineTo(10, 6); aperture.lineTo(-10, 6); aperture.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 1.4, 1.8, 0, Math.PI * 2, true); aperture.holes.push(hole);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(aperture), wall); back.position.z = -4.5; group.add(back);
  for (const z of [-4.35, -.4, 3.5]) {
    box([.1, 8.2, .16], [-6.5, 1, z], rib); box([.1, 8.2, .16], [6.5, 1, z], rib);
    box([13, .1, .16], [0, 4.8, z], rib);
    box([.14, 7.8, .18], [-4.8, .8, z], rib); box([.14, 7.8, .18], [4.8, .8, z], rib);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(5.1, .085, 8, 48), rib); arch.position.set(0, .8, z); group.add(arch);
  }
  for (let i = 0; i < 4; i++) box([2.8, .025, .08], [4.8, -.8 + i * 1.25, -4.35], inset);
  const window = new THREE.Group(); window.position.set(0, 1.4, -4.4);
  for (const [r, tube] of [[1.86, .14], [1.72, .035]]) window.add(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 64), rib));
  for (let i = 0; i < 12; i++) {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), inset);
    bolt.position.set(Math.cos(i * Math.PI / 6) * 1.86, Math.sin(i * Math.PI / 6) * 1.86, .13); window.add(bolt);
  }
  group.add(window);
  const mars = await buildMars({ THREE, mode: stage.mode }); mars.group.position.set(-.2, 1.5, -8.3); mars.group.scale.setScalar(2.5); group.add(mars.group);
  const flame = await buildFlame({ THREE, mode: stage.mode }); group.add(flame.group);
  const light = new THREE.DirectionalLight(0xffdfb8, 1.2); light.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight(0x8fa3b5, 1); rim.position.set(4, 2, -2);
  group.add(light, rim, new THREE.HemisphereLight(0xede4d4, 0x12100e, .4));
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
  const answerHolo = world.hologram(answer, { at: [-2.4, -.55, .4], width: 540, keepPosition: true });
  const controlSurface = document.createElement('div'); controlSurface.style.background = 'transparent'; controlSurface.append(console);
  const controlHolo = world.hologram(controlSurface, { at: [2.5, -1.6, .7], width: 500, keepPosition: true });
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
    group, anchor: [0, 0, 0], camera: { position: [0, .3, 8.7], target: [0, .15, 0], fov: 38 },
    enter() { active = true; started = previous = undefined; group.visible = true; answerHolo.open(); controlHolo.open(); },
    leave() { active = false; drag = null; answerHolo.close(); controlHolo.close(); group.visible = false; },
    update(t, state = {}) {
      if (!active && !state.active) return;
      if (started === undefined) started = t;
      const capture = state.capture || world.params?.capture === '1';
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const local = state.localTime ?? t - started, time = reduced ? 2 : t;
      const dt = previous === undefined ? 0 : Math.max(0, Math.min(.1, t - previous)); previous = t;
      space = capture || reduced ? target : space + (target - space) * (1 - Math.exp(-dt * 9));
      const phone = (stage.camera || world.camera)?.aspect < .9;
      if (phone !== phoneLayout) {
        phoneLayout = phone;
        if (phone) { answer.append(console); console.style.marginTop = '12px'; console.style.width = '100%'; controlHolo.close(); }
        else { controlSurface.append(console); console.style.marginTop = ''; console.style.width = '100%'; if (active) controlHolo.open(); }
      }
      const wake = capture || reduced ? 1 : ease(local / 1.5), launch = capture || reduced ? 1 : ease((local - .3) / 1.3);
      const reaction = Math.abs(space - target);
      vesta.update(time, { ...vesta.defaults, x: (phone ? -.72 : -1.7) + (1 - launch) * 1.5, y: (phone ? 1.55 : .5) - (1 - launch) * .8 + Math.sin(time * .9) * .06, z: .15 - (1 - launch) * 1.8,
        scale: phone ? 1.7 : 2.3, sleep: 1 - wake, yaw: -.6 * (1 - wake) + .12 + (state.pointerX || 0) * .2,
        roll: Math.sin(time * .8) * .035 + Math.sin(launch * Math.PI) * .22, pitch: (state.pointerY || 0) * -.07,
        lookX: (state.pointerX || 0) * .7 + .2, lookY: (state.pointerY || 0) * .5,
        blink: Math.max(0, 1 - Math.abs(time % 5.6 - 4.5) / .14), armR: .35 + wake * .25 + reaction, armFwdR: .35 + reaction * .5,
        thrust: .45 + Math.sin(launch * Math.PI) * .8, fins: .6, beacon: .35 + wake * .5, beaconWarm: 1, idle: reduced ? 0 : 1 });
      flame.group.position.set(phone ? .9 : 2, phone ? 1.55 : .65, .1);
      const breath = 1 + Math.sin(time * 1.7) * .018;
      flame.group.scale.setScalar((phone ? .62 : .85) * breath); flame.update(time, { space }); mars.update(time);
      dust.rotation.y = Math.sin(time * .07) * .12; dust.position.y = Math.sin(time * .17) * .08;
      if (phone) controlHolo.close();
      answerHolo.set?.({ at: phone ? [0, -1.05, .8] : [-2.25, -1.25, .5] });
      controlHolo.set?.({ at: phone ? [0, -2.7, .8] : [2.55, -1.35, .5] });
    },
    holograms: () => phoneLayout ? [answerHolo] : [answerHolo, controlHolo],
    dispose() {
      slider.removeEventListener('input', change); action.removeEventListener('click', advance);
      host?.removeEventListener('pointerdown', down); host?.removeEventListener('pointermove', move); host?.removeEventListener('pointerup', up); host?.removeEventListener('pointercancel', up);
      answerHolo.dispose(); controlHolo.dispose(); group.removeFromParent();
    }
  };
}
