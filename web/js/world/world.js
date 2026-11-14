import { createStage } from '../scene/engine.js';
import { build as buildVesta } from '../scene/vesta.js';
import { createHolograms } from './holo.js';
import { buildHash } from '../router.js';

export const STATIONS = [
  { id: 'transit', route: 'brief', origin: [0, 0, 0], position: [0, 1.2, 19], target: [0, 0, 0], label: 'Transit' },
  { id: 'flame', route: 'brief', origin: [0, 0, 0], position: [0, .35, 8], target: [0, .1, 0], label: 'Flame' },
  { id: 'evidence', route: 'design', origin: [12, 0, 0], position: [12, 1, 10], target: [12, .1, 0], label: 'Evidence' },
  { id: 'drill', route: 'incident', origin: [25, 0, 0], position: [25, .5, 8.4], target: [25, .1, 0], label: 'Drill' },
  { id: 'trust', route: 'engine', origin: [38, 0, 0], position: [38, 1, 10], target: [38, .3, 0], label: 'Trust' }
];
const FILES = ['act-transit', 'act-flame', 'act-evidence', 'act-drill', 'act-trust'];
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => x * x * x * (x * (x * 6 - 15) + 10);
const editable = target => target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]');
export function stationFor(route, params = {}) {
  if (route === 'brief') return params.station === 'transit' || params.intro === '1' ? 0 : 1;
  return route === 'design' || route === 'investigations' ? 2 : route === 'incident' ? 3 : 4;
}

export async function createWorld(host, context) {
  let ctx = context, disposed = false, index = -1, flight, entered = 0, lastTime, sceneCtx, holo, officer, carrier;
  let engine, inUpdate = false, citationCleanup, desiredPose, renderedPose, updateOfficer;
  let pointerX = 0, pointerY = 0, introTimer, wheel = 0, wheelAt = 0, gesture, cameraOverride;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const capture = ctx.capture || ctx.params?.capture === '1';
  const listeners = [], acts = [], roots = [], worlds = [];
  const canvasHost = document.createElement('div'); canvasHost.className = 'world-canvas'; host.append(canvasHost);
  const overlay = document.createElement('div'); overlay.className = 'world-overlay'; host.append(overlay);
  host.classList.add('world-host');
  document.documentElement.dataset.world = 'true';
  const nav = document.createElement('nav'); nav.className = 'world-stations'; nav.setAttribute('aria-label', 'World stations');
  const live = document.createElement('span'); live.className = 'world-live'; live.setAttribute('aria-live', 'polite');
  const skip = document.createElement('button'); skip.className = 'world-skip'; skip.textContent = 'Enter the cabin'; skip.hidden = true;
  const instrument = document.createElement('button'); instrument.className = 'world-instrument'; instrument.textContent = 'Instrument view';
  instrument.onclick = () => ctx.setParams({ view: 'details' });
  overlay.append(nav, live, skip, instrument);
  const buttons = STATIONS.map((s, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', s.label); b.title = s.label; b.dataset.station = s.id; b.innerHTML = `<span aria-hidden="true"></span><span class="world-station-name">${s.label}</span>`; b.onclick = () => navigate(i); nav.append(b); return b; });
  const listen = (node, name, fn, options) => { node.addEventListener(name, fn, options); listeners.push(() => node.removeEventListener(name, fn, options)); };
  const invalidate = () => { if (!disposed && !inUpdate) engine?.set({ world: performance.now() }); };
  function fallback(reason) {
    if (disposed) return;
    host.dataset.worldFallback = reason;
    ctx.setParams({ view: 'details' }, { replace: true });
  }
  function navigate(value, options = {}) {
    const next = typeof value === 'string' ? STATIONS.findIndex(s => s.id === value) : value;
    if (next < 0 || next >= STATIONS.length || disposed) return;
    if (!options.fromHash) {
      const params = { ...ctx.params, station: next === 0 ? 'transit' : null, intro: null };
      if (next === 1) params.station = 'flame';
      ctx.go(buildHash(STATIONS[next].route, params));
    }
    activate(next, options.cut);
  }
  function handles(i) { return acts[i]?.holograms?.() || []; }
  function activate(next, cut = false) {
    if (!sceneCtx || next === index) return;
    clearTimeout(introTimer); cameraOverride = null;
    const prior = index, s = STATIONS[next], t = performance.now() / 1000;
    if (prior >= 0) { acts[prior]?.leave?.(s.id); handles(prior).forEach(h => h.close?.()); }
    index = next; entered = t;
    const framing = typeof acts[next]?.camera === 'function' ? acts[next].camera(0) : acts[next]?.camera;
    const target = new sceneCtx.THREE.Vector3(...(framing?.target || s.target));
    const destination = new sceneCtx.THREE.Vector3(...(framing?.position || s.position));
    if (framing) { target.add(roots[next].position); destination.add(roots[next].position); }
    if (sceneCtx.camera.aspect < .9 && typeof acts[next]?.camera !== 'function') destination.z += next === 0 ? 4 : 2;
    const startTarget = flight?.look?.clone() || target.clone();
    const targetFov = framing?.fov || 36;
    flight = { start: t, from: sceneCtx.camera.position.clone(), to: destination, fromFov: sceneCtx.camera.fov, toFov: targetFov, fromLook: startTarget, toLook: target, look: startTarget.clone(), cut: cut || reduced.matches || capture, fromPose: { ...renderedPose }, fromCarrier: carrier.position.clone(), toCarrier: new sceneCtx.THREE.Vector3(...s.origin) };
    flight.prior = prior; flight.revealed = flight.cut;
    if (prior === 0 && next === 1 && !flight.cut) {
      flight.path = new sceneCtx.THREE.CatmullRomCurve3([flight.from.clone(), new sceneCtx.THREE.Vector3(-.8, .35, 11.1), new sceneCtx.THREE.Vector3(-.8, .3, 8.45), flight.to.clone()], false, 'centripetal');
    }
    buttons.forEach((b, i) => { b.setAttribute('aria-current', i === next ? 'location' : 'false'); });
    overlay.querySelectorAll('.world-picked-source').forEach(node => node.remove());
    host.dataset.station = s.id; live.textContent = s.label; skip.hidden = next !== 0;
    acts[next]?.enter?.(prior < 0 ? null : STATIONS[prior].id);
    handles(next).forEach(h => flight.cut ? h.open?.() : h.close?.());
    if (next === 0 && !capture) introTimer = setTimeout(() => navigate(1), 4000);
    invalidate();
  }
  skip.onclick = () => navigate(1);
  listen(host, 'wheel', ev => {
    if (ev.ctrlKey || editable(ev.target) || ev.target.closest('.world-hologram')) return;
    if (Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
    ev.preventDefault();
    const now = performance.now(); if (now - wheelAt > 200) wheel = 0;
    wheelAt = now; wheel += ev.deltaY;
    if (Math.abs(wheel) > 65 && (!flight || now / 1000 - flight.start > 1.25)) { navigate(index + Math.sign(wheel)); wheel = 0; }
  }, { passive: false });
  listen(window, 'keydown', ev => {
    if ((editable(ev.target) && !ev.target.closest('.world-stations')) || document.querySelector('[role="dialog"]:not([hidden]),dialog[open]')) return;
    const step = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(ev.key) ? 1 : ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(ev.key) ? -1 : 0;
    if (step) { ev.preventDefault(); navigate(index + step); }
    if (ev.key === 'Home') { ev.preventDefault(); navigate(0); }
    if (ev.key === 'End') { ev.preventDefault(); navigate(4); }
  });
  listen(host, 'pointerdown', ev => { if (!editable(ev.target) && !ev.target.closest('.world-hologram')) gesture = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  listen(host, 'pointermove', ev => { const b = host.getBoundingClientRect(); pointerX = (ev.clientX - b.left) / b.width * 2 - 1; pointerY = 1 - (ev.clientY - b.top) / b.height * 2; });
  listen(window, 'pointerup', ev => { if (!gesture || gesture.id !== ev.pointerId) return; const dx = ev.clientX - gesture.x, dy = ev.clientY - gesture.y; gesture = null; if (Math.abs(dy) > 65 && Math.abs(dy) > Math.abs(dx) * 1.3) navigate(index + (dy < 0 ? 1 : -1)); });
  listen(host, 'pointercancel', () => { gesture = null; });
  listen(reduced, 'change', () => { if (reduced.matches) fallback('Reduced motion'); else { if (flight) flight.cut = true; invalidate(); } });
  function disposeWorld() {
    if (disposed) return;
    disposed = true; clearTimeout(introTimer); citationCleanup?.(); listeners.forEach(fn => fn()); engine?.dispose(); holo?.dispose(); acts.forEach(a => a?.dispose?.()); canvasHost.remove(); overlay.remove(); host.classList.remove('world-host'); delete document.documentElement.dataset.world;
  }
  if (ctx.signal) listen(ctx.signal, 'abort', disposeWorld, { once: true });
  let citeModule;
  try { citeModule = await import('./cite.js'); } catch { citeModule = null; }
  if (disposed) return { unmount: disposeWorld };
  engine = await createStage(canvasHost, { capture, mode: ctx.params?.still === '1' ? 'still' : undefined });
  const api = {
    update(next) { const priorRoute = ctx.route; ctx = next; if (sceneCtx && !(index === 0 && ctx.route === 'brief' && priorRoute === 'brief' && !ctx.params.station && !ctx.params.intro)) { const nextIndex = stationFor(ctx.route, ctx.params); if (priorRoute !== ctx.route && nextIndex === index) acts[index]?.enter?.(STATIONS[index].id); else activate(nextIndex); } invalidate(); },
    navigate, invalidate, get station() { return STATIONS[index]?.id; },
    get stage() { return engine; }, get camera() { return sceneCtx?.camera; }, get vesta() { return officer; },
    unmount: disposeWorld,
    dispose() { api.unmount(); }
  };
  if (disposed) { engine.dispose(); return api; }
  if (engine.mode === 'still') { api.unmount(); ctx.setParams({ view: 'details' }, { replace: true }); return api; }
  await engine.use({ async build(stage) {
    sceneCtx = stage;
    const { THREE, camera } = stage, group = new THREE.Group();
    officer = await buildVesta(stage); officer.group.name = 'world-officer';
    updateOfficer = officer.update; officer.update = (t, pose) => { desiredPose = { ...officer.defaults, ...pose }; };
    carrier = new THREE.Group(); carrier.add(officer.group); group.add(carrier);
    group.add(new THREE.HemisphereLight(0xede4d4, 0x191715, 1.1));
    const key = new THREE.DirectionalLight(0xffddb8, 3); key.position.set(-4, 6, 8); group.add(key);
    const rim = new THREE.DirectionalLight(0x8fa3b5, 2); rim.position.set(4, 2, -2); group.add(rim);
    holo = createHolograms({ ...stage, host, scene: group, reduced: reduced.matches, capture, projector(out) { carrier.updateMatrixWorld(true); return officer.locate('beacon', renderedPose || officer.defaults, reduced.matches ? 2 : lastTime || 0, out); } });
    for (let i = 0; i < STATIONS.length; i++) {
      const root = new THREE.Group(); root.position.fromArray(STATIONS[i].origin); group.add(root); roots.push(root);
      const world = {
        THREE, stage: { ...stage, scene: root, set: patch => { Object.assign(world.state, patch); invalidate(); }, on: (...args) => engine.on(...args) },
        root, citationPanels(trigger) { return handles(index).filter(h => h.target > 0 && !h.element?.contains(trigger)); }, origin: STATIONS[i].origin, station: STATIONS[i].id, camera, host, overlay, vesta: officer, vestaPose: {}, state: {},
        get db() { return ctx.db; }, get core() { return ctx.core; }, get q() { return ctx.q; }, get params() { return ctx.params; }, get route() { return ctx.route; }, get capture() { return capture; },
        ui: ctx.ui, setQ: (...a) => ctx.setQ(...a), setParams: (...a) => ctx.setParams(...a), go: (...a) => ctx.go(...a), openSource: (...a) => ctx.openSource(...a), closeSource: ctx.closeSource,
        navigate, invalidate, setCamera(patch) { cameraOverride = patch; invalidate(); },
        hologram(el, options = {}) {
          const translate = at => at.map((n, k) => n + STATIONS[i].origin[k]);
          const h = holo.hologram(el, { ...options, at: translate(options.at || [0, .3, 0]) });
          const set = h.set; h.set = patch => set({ ...patch, ...(patch.at ? { at: translate(patch.at) } : {}) });
          return h;
        }
      };
      world.cite = (text, id) => {
        if (citeModule?.cite) return citeModule.cite(text, id, world);
        const b = document.createElement('button'); b.className = 'world-cite'; b.textContent = text; b.onclick = () => ctx.openSource(id); return b;
      };
      world.stage.context = world.stage;
      worlds.push(world);
      try {
        const mod = await import(`./${FILES[i]}.js`); const act = await mod.build(world); acts[i] = act;
        if (act.group && act.group.parent !== root) root.add(act.group);
        handles(i).forEach(h => h.close?.());
      } catch (error) {
        host.dataset[`${STATIONS[i].id}Unavailable`] = 'true';
        console.warn(`VESTA ${STATIONS[i].id} unavailable: ${error.message}`);
      }
    }
    citationCleanup = citeModule?.configureCitations?.({ ...worlds[0], stage, hologram: holo.hologram });
    listen(window, 'vesta:cite', event => { if (!event.detail.open) invalidate(); });
    engine.on('pick', hit => {
      if (!hit?.id) return;
      const trigger = worlds[index].cite('Read the selected test row', hit.id);
      trigger.classList.add('world-picked-source'); overlay.append(trigger); trigger.click();
    });
    const initial = stationFor(ctx.route, ctx.params);
    activate(ctx.route === 'brief' && !ctx.params.station && !ctx.params.src && !capture ? 0 : initial, true);
    let lastFrame, totalFrame = 0, frameCount = 0;
    return { group, pick(x, y) { return acts[index]?.pick?.(x, y); }, update(t) {
      inUpdate = true;
      const frameStarted = performance.now();
      const now = capture ? 0 : performance.now() / 1000;
      const dt = lastTime == null ? 1 / 60 : Math.min(.1, Math.max(0, t - lastTime)); lastTime = t;
      if (flight) {
        const p = flight.cut ? 1 : clamp((now - flight.start) / 1.2), k = ease(p);
        if (flight.path) camera.position.copy(flight.path.getPointAt(k));
        else camera.position.lerpVectors(flight.from, flight.to, k);
        camera.position.y += Math.sin(Math.PI * k) * (flight.path ? .08 : .45);
        flight.look.lerpVectors(flight.fromLook, flight.toLook, k);
        if (flight.path) flight.look.lerp(new sceneCtx.THREE.Vector3(-.8, .3, 3), Math.sin(Math.PI * k) * .85);
        if (flight.path && acts[0]?.group) acts[0].group.visible = p < .7;
        if (!flight.revealed && p > .78) { flight.revealed = true; handles(index).forEach(h => h.open?.()); }
        carrier.position.lerpVectors(flight.fromCarrier, flight.toCarrier, ease(clamp(p * 1.12)));
        carrier.position.y += Math.sin(Math.PI * p) * .6;
        camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * k;
        camera.lookAt(flight.look);
        camera.rotateZ(Math.sin(Math.PI * p) * (flight.to.x - flight.from.x) * -.0014);
        host.dataset.flying = String(p < 1);
        sceneCtx.renderer.domElement.parentElement.dataset.flying = host.dataset.flying;
      }
      if (camera.aspect < .9) camera.fov = Math.max(44, camera.fov);
      camera.updateProjectionMatrix();
      const motionT = reduced.matches ? 2 : t;
      officer.group.visible = index !== 0;
      officer.update(motionT, { ...officer.defaults, x: -1.7, idle: 1, thrust: .65, beacon: .3, beaconWarm: 1, yaw: .15 + pointerX * .1, lookX: pointerX * .6, lookY: pointerY * .5, blink: Math.max(0, 1 - Math.abs((motionT % 5.8) - 4.7) / .14), ...worlds[index]?.vestaPose });
      acts.forEach((act, i) => {
        const active = i === index;
        roots[i].visible = active || (host.dataset.flying === 'true' && Math.abs(i - index) <= 1);
        if (active) {
          const state = { ...worlds[i].state, ...ctx.params, q: ctx.q, active, station: STATIONS[i].id, localTime: capture ? Number(ctx.params.t || 2) : now - entered, capture, pointerX, pointerY };
          act.update?.(motionT, state);
        }
      });
      renderedPose = { ...desiredPose };
      if (flight && host.dataset.flying === 'true') {
        const p = ease(clamp((now - flight.start) / 1.2));
        for (const key of ['x', 'y', 'z', 'scale', 'yaw', 'pitch', 'roll']) {
          const from = flight.fromPose[key] ?? desiredPose[key];
          renderedPose[key] = from + (desiredPose[key] - from) * p;
        }
        renderedPose.roll += Math.sin(Math.PI * p) * .16;
        renderedPose.thrust = Math.max(renderedPose.thrust, .65 + Math.sin(Math.PI * p) * .6);
      }
      updateOfficer(motionT, renderedPose);
      if (typeof acts[index]?.camera === 'function' && host.dataset.flying !== 'true') cameraOverride = acts[index].camera(motionT);
      if (cameraOverride && host.dataset.flying !== 'true') {
        if (cameraOverride.position) camera.position.fromArray(cameraOverride.position).add(roots[index].position);
        if (cameraOverride.target) camera.lookAt(new THREE.Vector3(...cameraOverride.target).add(roots[index].position));
        if (cameraOverride.fov) { camera.fov = cameraOverride.fov; camera.updateProjectionMatrix(); }
      }
      if (flight && !flight.revealed) handles(index).forEach(h => h.close?.());
      holo.update(motionT, dt);
      if (!capture && lastFrame != null) { totalFrame += frameStarted - lastFrame; frameCount++; host.dataset.worldFrameMs = (totalFrame / frameCount).toFixed(2); }
      lastFrame = frameStarted;
      inUpdate = false;
      if (engine.mode === 'still') fallback('WebGL unavailable');
    }, dispose() { holo?.dispose(); } };
  } });
  if (engine.mode === 'still') fallback('WebGL unavailable');
  listen(canvasHost, 'webglcontextlost', () => fallback('WebGL context lost'), true);
  return api;
}
export const mount = createWorld;
