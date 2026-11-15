import { createQuestionTour } from './question-tour.js';
import { warmBlanket } from '../scene/ship-blanket.js';
import { cite, configureCitations } from './cite.js';
import { createStationLoader, afterPaint } from './station-loader.js';
import { createStage } from '../scene/engine.js';
import { build as buildVesta } from '../scene/vesta.js';
import { createHolograms } from './holo.js';
import { buildHash } from '../router.js';
import { createGuide } from './guide.js';
import { createVideoCases } from './cases.js';
import { build as buildWelcome } from './welcome.js';
import { createMissionBrief, STATION_AGENTS } from './mission.js';

if (typeof document !== 'undefined' && !document.querySelector('link[data-vesta-welcome]')) {
  const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/welcome.css?v=2', import.meta.url).href; sheet.dataset.vestaWelcome = ''; document.head.append(sheet);
}

export const STATIONS = [
  { id: 'transit', route: 'brief', origin: [0, 0, 0], position: [0, 1.2, 19], target: [0, 0, 0], label: 'Transit' },
  { id: 'flame', route: 'brief', origin: [0, 0, 0], position: [0, .35, 8], target: [0, .1, 0], label: 'Flame' },
  { id: 'evidence', route: 'design', origin: [12, 0, 0], position: [12, 1, 10], target: [12, .1, 0], label: 'Evidence' },
  { id: 'drill', route: 'incident', origin: [25, 0, 0], position: [25, .5, 8.4], target: [25, .1, 0], label: 'Drill' },
  { id: 'trust', route: 'engine', origin: [38, 0, 0], position: [38, 1, 10], target: [38, .3, 0], label: 'Trust' },
  { id: 'robotics', route: 'engine', origin: [52, 0, 0], position: [57, 3, 13], target: [52, -.2, 0], label: 'Robotics' }
];
const FILES = ['act-transit', 'act-flame', 'act-evidence', 'act-drill', 'act-trust', 'act-robotics'];
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => x * x * x * (x * (x * 6 - 15) + 10);
const editable = target => target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]');
export function stationFor(route, params = {}) {
  if (route === 'engine' && params.station === 'robotics') return 5;
  if (route === 'brief') return params.station === 'transit' || params.intro === '1' ? 0 : 1;
  return route === 'design' || route === 'investigations' ? 2 : route === 'incident' ? 3 : 4;
}

export async function createWorld(host, context) {
  let ctx = context, disposed = false, index = -1, flight, entered = 0, lastTime, sceneCtx, holo, officer, carrier;
  let loader, requested, initialShown = false, baseLights = [];
  let engine, inUpdate = false, citationCleanup, desiredPose, renderedPose, updateOfficer, questionTour;
  let pointerX = 0, pointerY = 0, introTimer, wheel = 0, wheelAt = 0, gesture, cameraOverride, filmActive = false, navigationCut = false, filmPausedAt = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const capture = ctx.capture || ctx.params?.capture === '1';
  const listeners = [], acts = [], roots = [], worlds = [];
  const canvasHost = document.createElement('div'); canvasHost.className = 'world-canvas'; host.append(canvasHost);
  const overlay = document.createElement('div'); overlay.className = 'world-overlay'; host.append(overlay);
  host.classList.add('world-host');
  host.dataset.cinema = 'false'; host.dataset.film = 'false'; host.dataset.hologramOpen = 'false';
  document.documentElement.dataset.world = 'true';
  host.dataset.worldAllBuilt = 'false'; host.dataset.worldLoading = 'true';
  const loadingSheet = document.createElement('link'); loadingSheet.rel = 'stylesheet'; loadingSheet.href = new URL('../../css/world-loading.css', import.meta.url).href;
  if (!document.querySelector('link[data-vesta-world-loading]')) { loadingSheet.dataset.vestaWorldLoading = ''; document.head.append(loadingSheet); }
  const loading = document.createElement('p'); loading.className = 'world-loading'; loading.setAttribute('role', 'status'); loading.setAttribute('aria-live', 'polite'); overlay.append(loading);
  const entryStation = () => ctx.route === 'brief' && !ctx.params.station && !ctx.params.src && !capture ? 0 : stationFor(ctx.route, ctx.params);
  requested = entryStation();
  function showLoading(next) {
    requested = next; loader?.request(next);
    const unavailable = loader?.states[next] === 'unavailable';
    loading.hidden = false; host.dataset.worldLoading = 'true'; host.dataset.worldRequested = STATIONS[next].id;
    loading.textContent = unavailable ? `${STATIONS[next].label} is unavailable. Choose another station or Instrument view.` : `Loading ${STATIONS[next].label} cabin… You can choose your cabin or another station.`;
    welcomeHost.hidden = next !== 0;
  }
  const nav = document.createElement('nav'); nav.className = 'world-stations'; nav.setAttribute('aria-label', 'World stations');
  const live = document.createElement('span'); live.className = 'world-live'; live.setAttribute('aria-live', 'polite');
  const skip = document.createElement('button'); skip.className = 'world-skip'; skip.textContent = 'Enter the cabin'; skip.hidden = true;
  const instrument = document.createElement('button'); instrument.className = 'world-instrument'; instrument.setAttribute('aria-label', 'Instrument view'); instrument.title = 'Instrument view'; instrument.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3zM3 10h18M9 10v10"/></svg>';
  instrument.onclick = () => ctx.setParams({ view: 'details' });
  const answer = document.createElement('p'); answer.className = 'world-answer'; answer.setAttribute('aria-live', 'polite');
  const cinema = document.createElement('button'); cinema.className = 'world-cinema'; cinema.type = 'button'; cinema.setAttribute('aria-label', 'Cinema mode (H)'); cinema.setAttribute('aria-pressed', 'false'); cinema.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  let cinematic = false;
  const setCinema = value => { if (value && ctx.params?.src) ctx.closeSource?.(); if (value) document.querySelector('.wc-source:not([hidden]) .wc-dismiss')?.click(); cinematic = value; host.dataset.cinema = String(value); document.documentElement.dataset.cinema = String(value); cinema.setAttribute('aria-pressed', String(value)); holo?.setCinema(value); invalidate(); };
  cinema.onclick = () => setCinema(!cinematic);
  const film = document.createElement('button'); film.className = 'world-film'; film.type = 'button'; film.dataset.action = 'tour'; film.setAttribute('aria-label', 'Play the film'); film.title = 'Play the film'; film.textContent = '▶'; 
  const sheet = document.createElement('button'); sheet.className = 'world-sheet-toggle'; sheet.type = 'button'; sheet.setAttribute('aria-label', 'Open station controls'); sheet.innerHTML = '<span aria-hidden="true"></span>'; sheet.onclick = () => { if (sheetPulled) { sheetPulled = false; return; } holo?.openStation(); invalidate(); };
  let sheetY, sheetPulled = false; sheet.onpointerdown = ev => { sheetY = ev.clientY; sheet.setPointerCapture(ev.pointerId); }; sheet.onpointerup = ev => { if (sheetY - ev.clientY > 30) { sheetPulled = true; holo?.openStation(); invalidate(); } sheetY = null; };
  overlay.append(nav, live, skip, instrument, answer, cinema, film, sheet);
  const guide = createGuide(overlay);
  const welcomeHost = document.createElement('div'); welcomeHost.className = 'world-welcome'; welcomeHost.dataset.stationUi = 'transit'; welcomeHost.hidden = true; overlay.append(welcomeHost);
  let welcome, welcomeKey = '';
  function syncWelcome() { const key = JSON.stringify(ctx.q); if (welcome && key !== welcomeKey) { welcomeKey = key; welcome.update(ctx.q); } }
  showLoading(requested);
  const cases = createVideoCases({ onEvidence(query) { navigate(2); acts[2]?.search?.(query); }, onDrill() { navigate(3); } });
  const caseButton = document.createElement('button'); caseButton.type = 'button'; caseButton.className = 'world-case-toggle'; caseButton.textContent = 'Video cases'; caseButton.onclick = () => { holo?.closeAll(); cases.open(caseButton); }; overlay.append(caseButton);
  const mission = createMissionBrief({ navigate, run(station,id) { const i=STATIONS.findIndex(s=>s.id===station); const action=acts[i]?.actions?.().find(action=>action.id===id); if(action && !action.expanded?.()) action.run(); } });
  const missionButton=document.createElement('button');missionButton.type='button';missionButton.className='world-mission-toggle';missionButton.textContent='Mission';missionButton.setAttribute('aria-label','Why VESTA: problem, method, agents and robotics');missionButton.onclick=()=>mission.open('problem',missionButton);
  const agentButton=document.createElement('button');agentButton.type='button';agentButton.className='world-agent-toggle';agentButton.onclick=()=>mission.open('agents',agentButton);
  overlay.append(missionButton,agentButton);
  film.textContent = '▶ 60s tour';
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
    cases.close(); mission.close(); holo?.closeAll(); navigationCut = Boolean(options.cut);
    if (!options.fromHash) {
      const params = { ...ctx.params, station: next === 0 ? 'transit' : null, intro: null };
      if (next === 1) params.station = 'flame';
      if (STATIONS[next].id === 'robotics') params.station = 'robotics';
      ctx.go(buildHash(STATIONS[next].route, params));
    }
    activate(next, options.cut);
  }
  function handles(i) { return acts[i]?.holograms?.() || []; }
  function activate(next, cut = false) {
    if (disposed) return;
    if (!sceneCtx || loader?.states[next] !== 'ready') { showLoading(next); return; }
    requested = next; host.dataset.worldRequested = STATIONS[next].id;
    if (next === index) { loading.hidden = true; host.dataset.worldLoading = 'false'; welcomeHost.hidden = next !== 0; return; }
    loading.hidden = true; host.dataset.worldLoading = 'false';
    if (!initialShown) { cut = true; initialShown = true; host.dataset.worldEntry = STATIONS[next].id; }

    clearTimeout(introTimer); cameraOverride = null;
    const prior = index, s = STATIONS[next], t = performance.now() / 1000;
    if (prior >= 0) { acts[prior]?.leave?.(s.id); handles(prior).forEach(h => h.close?.()); }
    baseLights.forEach(([light, intensity]) => { light.intensity = intensity; });
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
    answer.textContent = '';
    host.dataset.station = s.id; live.textContent = s.label; skip.hidden = true;
    agentButton.textContent=`VESTA · ${STATION_AGENTS[s.id]}`;
    agentButton.setAttribute('aria-label',`Meet the agents: ${STATION_AGENTS[s.id]}`);
    welcomeHost.hidden = next !== 0;
    holo.setStation(s.id);
    holo.lock(true);
    acts[next]?.enter?.(prior < 0 ? null : STATIONS[prior].id);
    holo.lock(false);
    handles(next).forEach(h => h.close?.());
    const actions = acts[next]?.actions?.() || (next === 0 ? [
      { id: 'enter-cabin', label: 'Enter the cabin', primary: true, run: () => navigate(1) }
    ] : next === 4 ? [{ id: 'inspect-trust', label: 'Open the data console', primary: true, run: () => holo.openStation() }] : []);
    guide.set(s, actions);
    if (!capture && !filmActive) acts[next]?.ready?.();
    invalidate();
  }
  skip.onclick = () => navigate(1);
  listen(host, 'wheel', ev => {
    if (filmActive || cinematic || ev.ctrlKey || editable(ev.target) || ev.target.closest('.world-hologram,.world-welcome,.vesta-drill-thread')) return;
    if (Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
    ev.preventDefault();
    const now = performance.now(); if (now - wheelAt > 200) wheel = 0;
    wheelAt = now; wheel += ev.deltaY;
    if (Math.abs(wheel) > 65 && (!flight || now / 1000 - flight.start > 1.25)) { navigate(index + Math.sign(wheel)); wheel = 0; }
  }, { passive: false });
  listen(window, 'keydown', ev => {
    if (ev.key.toLowerCase() === 'h' && !document.querySelector('.world-cases[open]') && !ev.target.closest?.('input,textarea,select,[contenteditable]')) { ev.preventDefault(); ev.stopImmediatePropagation(); setCinema(!cinematic); }
  }, true);
  listen(window, 'keydown', ev => {
    if (ev.key === 'Escape') { holo?.closeAll(); invalidate(); return; }
    if ((editable(ev.target) && !ev.target.closest('.world-stations')) || document.querySelector('[role="dialog"]:not([hidden]),dialog[open]')) return;
    if (filmActive || cinematic) return;
    const step = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(ev.key) ? 1 : ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(ev.key) ? -1 : 0;
    if (step) { ev.preventDefault(); navigate(index + step); }
    if (ev.key === 'Home') { ev.preventDefault(); navigate(0); }
    if (ev.key === 'End') { ev.preventDefault(); navigate(STATIONS.length-1); }
  });
  listen(host, 'pointerdown', ev => { if (cinematic) { setCinema(false); return; } if (!ev.target.closest('.world-hologram,.world-marker,[data-world-marker],.drill-marker,.evidence-tool,.world-stations,.world-sheet-toggle,.world-guide,.world-welcome,.vesta-drill-thread,[data-action]')) { document.querySelector('.wc-source:not([hidden]) .wc-dismiss')?.click(); holo?.closeAll(); } if (!editable(ev.target) && !ev.target.closest('.world-hologram')) gesture = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  listen(host, 'pointermove', ev => { const b = canvasHost.getBoundingClientRect(); pointerX = (ev.clientX - b.left) / b.width * 2 - 1; pointerY = 1 - (ev.clientY - b.top) / b.height * 2; });
  listen(window, 'pointerup', ev => { if (!gesture || gesture.id !== ev.pointerId) return; const dx = ev.clientX - gesture.x, dy = ev.clientY - gesture.y; gesture = null; if (!filmActive && !cinematic && !ev.target.closest?.('.world-hologram,.world-marker,[data-world-marker],.drill-marker,.evidence-tool,.world-stations,.world-sheet-toggle,.world-guide,.world-welcome,.vesta-drill-thread,[data-action]') && Math.abs(dy) > 65 && Math.abs(dy) > Math.abs(dx) * 1.3) navigate(index + (dy < 0 ? 1 : -1)); });
  listen(host, 'pointercancel', () => { gesture = null; });
  listen(reduced, 'change', () => { if (flight) flight.cut = true; invalidate(); });
  function disposeWorld() {
    if (disposed) return;
    disposed = true; questionTour?.dispose(); clearTimeout(introTimer); citationCleanup?.(); listeners.forEach(fn => fn()); engine?.dispose(); holo?.dispose(); acts.forEach(a => a?.dispose?.()); welcome?.dispose(); cases.dispose(); mission.dispose(); guide.dispose(); canvasHost.remove(); overlay.remove(); host.classList.remove('world-host'); delete document.documentElement.dataset.world; delete document.documentElement.dataset.cinema;
    for (const key of ['worldAllBuilt', 'worldLoading', 'worldRequested', 'worldEntry', 'worldSettled', 'cinema', 'film', 'filmPaused', 'hologramOpen', 'dockSide', 'flying']) delete host.dataset[key];
    STATIONS.forEach(station => { delete host.dataset[`${station.id}Ready`]; delete host.dataset[`${station.id}Unavailable`]; });
    host.style.removeProperty('--world-dock-width');
  }
  if (ctx.signal) listen(ctx.signal, 'abort', disposeWorld, { once: true });
  const api = {
    update(next) { const priorRoute = ctx.route; ctx = next; syncWelcome(); if (!(index === 0 && ctx.route === 'brief' && priorRoute === 'brief' && !ctx.params.station && !ctx.params.intro)) { const nextIndex = initialShown ? stationFor(ctx.route, ctx.params) : entryStation(); if (priorRoute !== ctx.route && nextIndex === index) acts[index]?.enter?.(STATIONS[index].id); else activate(nextIndex, navigationCut); navigationCut = false; } invalidate(); },
    navigate, invalidate, setCinema, setFilm(value, options = {}) {
      const now = performance.now() / 1000, paused = value && options.paused;
      if (paused && filmPausedAt == null) filmPausedAt = now;
      if (!paused && filmPausedAt != null) { if (flight) flight.start += now - Math.max(filmPausedAt, flight.start); filmPausedAt = null; }
      filmActive = value; host.dataset.film = String(value); host.dataset.filmPaused = String(Boolean(paused));
      if (value) { clearTimeout(introTimer); cases.close(); mission.close(); holo?.closeAll(); } invalidate();
    }, get station() { return STATIONS[index]?.id; },
    get stage() { return engine; }, get camera() { return sceneCtx?.camera; }, get vesta() { return officer; },
    unmount: disposeWorld,
    dispose() { api.unmount(); }
  };
  questionTour = createQuestionTour({ host, overlay, api, context: () => ctx, world: () => worlds[index], actions: () => acts[index]?.actions?.(), invalidate });
  async function start() {
  if (disposed) return;
  const welcomeWorld = {
    get db() { return ctx.db; }, get core() { return ctx.core; }, get q() { return ctx.q; },
    setQ: (...args) => ctx.setQ(...args), go: (...args) => ctx.go(...args), navigate,
    cite(text, id) {
      return cite(text, id, welcomeWorld);
    }, invalidate
  };
  welcome = buildWelcome(welcomeWorld); welcomeKey = JSON.stringify(ctx.q); welcomeHost.append(welcome.element); welcomeHost.hidden = requested !== 0;
  warmBlanket(innerWidth < 760 || navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4);
  await afterPaint();
  if (disposed) return;
  engine = await createStage(canvasHost, { capture, reducedCuts: true, mode: ctx.params?.still === '1' ? 'still' : undefined });
  if (disposed) { engine.dispose(); return; }
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
    holo = createHolograms({ ...stage, host, size: () => ({ width: host.clientWidth, height: host.clientHeight }), viewSize: () => ({ ...stage.size(), left: canvasHost.offsetLeft, top: canvasHost.offsetTop }), onChange: invalidate, scene: group, reduced: reduced.matches, capture, projector(out) { carrier.updateMatrixWorld(true); return officer.locate('beacon', renderedPose || officer.defaults, reduced.matches ? 2 : lastTime || 0, out); } });
    for (let i = 0; i < STATIONS.length; i++) {
      const root = new THREE.Group(); root.position.fromArray(STATIONS[i].origin); group.add(root); roots.push(root); root.visible = false;
      const world = {
        THREE, stage: { ...stage, scene: root, set: patch => { Object.assign(world.state, patch); invalidate(); }, on: (...args) => engine.on(...args) },
        root, citationPanels(trigger) { return holo.handles.filter(h => h.target > 0 && !h.options.source && h.options.station === STATIONS[index]?.id); }, origin: STATIONS[i].origin, station: STATIONS[i].id, camera, host, overlay, vesta: officer, vestaPose: {}, state: {},
        get db() { return ctx.db; }, get core() { return ctx.core; }, get q() { return ctx.q; }, get params() { return ctx.params; }, get route() { return ctx.route; }, get capture() { return capture; }, get filmActive() { return filmActive; },
        ui: ctx.ui, setQ: (...a) => ctx.setQ(...a), setParams: (...a) => ctx.setParams(...a), go: (...a) => ctx.go(...a), openSource: (...a) => ctx.openSource(...a), closeSource: ctx.closeSource,
        navigate, invalidate, answer(value) { world.answerValue = value; if (i === index) answer.textContent = String(value || ''); },
        marker(handle, options = {}) {
          if (handle && !handle.element) { options = handle; handle = options.hologram; }
          const translate = at => Array.isArray(at) ? at.map((n, k) => n + STATIONS[i].origin[k]) : at;
          const marker = holo.marker(handle, { ...options, station: STATIONS[i].id, at: translate(options.at) });
          const set = marker.set; marker.set = patch => set({ ...patch, ...('at' in patch ? { at: translate(patch.at) } : {}) });
          return marker;
        },
        setCamera(patch) { cameraOverride = patch; invalidate(); },
        hologram(el, options = {}) {
          if (options.answer) {
            world.answerElement = el; el.classList.add('world-answer-content');
            return { element: el, target: 0, open() { return this; }, close() { return this; }, set() { return this; }, dispose() { el.remove(); } };
          }
          const translate = at => at.map((n, k) => n + STATIONS[i].origin[k]);
          const h = holo.hologram(el, { onDemand: !options.source, station: STATIONS[i].id, ...options, at: translate(options.at || [0, .3, 0]) });
          if (!options.source && !options.manual && options.marker !== false) world.marker(h, { at: options.markerAt || options.at || [0, .3, 0], label: options.label || el.getAttribute('aria-label') || el.querySelector('h1,h2')?.textContent || 'Open hologram' });
          const set = h.set; h.set = patch => set({ ...patch, ...(patch.at ? { at: translate(patch.at) } : {}) });
          return h;
        }
      };
      world.cite = (text, id) => {
        return cite(text, id, world);
      };
      world.stage.context = world.stage;
      worlds.push(world);
    }
    baseLights = group.children.filter(item => item.isLight).map(light => [light, light.intensity]);
    loader = createStationLoader({
      count: STATIONS.length, stopped: () => disposed, yieldTurn: afterPaint,
      async build(i) {
        const [mod] = await Promise.all([import(`./${FILES[i]}.js`), i === 0 || i === 3 ? warmBlanket(stage.mode === 'low') : null]);
        if (disposed) return;
        const priorLights = baseLights.map(([light]) => light.intensity);
        let built;
        try { baseLights.forEach(([light, intensity]) => { light.intensity = intensity; }); built = mod.build(worlds[i]); }
        finally { baseLights.forEach(([light], j) => { light.intensity = priorLights[j]; }); }
        const act = await built;
        if (disposed) { act?.dispose?.(); return; }
        acts[i] = act;
        if (act.group && act.group.parent !== roots[i]) roots[i].add(act.group);
        handles(i).forEach(h => h.close?.());
      },
      changed(i, state, error) {
        host.dataset[`${STATIONS[i].id}Ready`] = String(state === 'ready');
        host.dataset.worldAllBuilt = String(loader.complete);
        host.dataset.worldSettled = String(loader.settled);
        if (state === 'unavailable') {
          roots[i].visible = false; host.dataset[`${STATIONS[i].id}Unavailable`] = 'true';
          console.warn(`VESTA ${STATIONS[i].id} unavailable: ${error.message}`);
          if (i === requested) showLoading(i);
        }
        if (state === 'ready' && i === requested && !capture) activate(i, true);
      }
    });
    Object.setPrototypeOf(welcomeWorld, worlds[0]);
    citationCleanup = configureCitations({ ...worlds[0], stage, hologram: holo.hologram });
    await loader.ensure(requested);
    if (capture) { await loader.prepare(); activate(requested, true); }
    else if (loader.states[requested] === 'ready') activate(requested, true);
    listen(window, 'vesta:cite', event => { if (!event.detail.open) invalidate(); });
    engine.on('pick', hit => {
      if (!hit) return;
      if (acts[index]?.select?.(hit) === true || !hit.id) return;
      const trigger = worlds[index].cite('Read the selected test row', hit.id);
      trigger.classList.add('world-picked-source'); overlay.append(trigger); trigger.click();
    });
    let lastFrame, totalFrame = 0, frameCount = 0;
    return { group, pick(x, y) { return acts[index]?.pick?.(x, y); }, update(t) {
      inUpdate = true;
      const frameStarted = performance.now();
      const now = capture ? 0 : performance.now() / 1000;
      const flightNow = filmPausedAt ?? now;
      const dt = lastTime == null ? 1 / 60 : Math.min(.1, Math.max(0, t - lastTime)); lastTime = t;
      if (flight) {
        const p = flight.cut ? 1 : clamp((flightNow - flight.start) / 1.2), k = ease(p);
        if (flight.path) camera.position.copy(flight.path.getPointAt(k));
        else camera.position.lerpVectors(flight.from, flight.to, k);
        camera.position.y += Math.sin(Math.PI * k) * (flight.path ? .08 : .45);
        flight.look.lerpVectors(flight.fromLook, flight.toLook, k);
        if (flight.path) flight.look.lerp(new sceneCtx.THREE.Vector3(-.8, .3, 3), Math.sin(Math.PI * k) * .85);
        if (flight.path && acts[0]?.group) acts[0].group.visible = p < .7;
        if (!flight.revealed && p > .78) flight.revealed = true;
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
      officer.group.visible = index > 0;
      officer.update(motionT, { ...officer.defaults, x: -1.7, idle: 1, thrust: .65, beacon: .3, beaconWarm: 1, yaw: .15 + pointerX * .1, lookX: pointerX * .6, lookY: pointerY * .5, blink: Math.max(0, 1 - Math.abs((motionT % 5.8) - 4.7) / .14), ...worlds[index]?.vestaPose });
      acts.forEach((act, i) => {
        const active = i === index;
        roots[i].visible = active || (host.dataset.flying === 'true' && Math.abs(i - index) <= 1);
        if (active) {
          const state = { ...worlds[i].state, ...ctx.params, q: ctx.q, active, station: STATIONS[i].id, reduced: reduced.matches, localTime: capture ? Number(ctx.params.t || 2) : now - entered, capture, pointerX, pointerY };
          holo.lock(true);
          act.update?.(motionT, state);
          holo.lock(false);
        }
      });
      renderedPose = questionTour?.pose({ ...desiredPose }) || { ...desiredPose };
      if (flight && host.dataset.flying === 'true') {
        const p = ease(clamp((flightNow - flight.start) / 1.2));
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
      const currentWorld = worlds[index];
      if (index === 0 && welcome) answer.textContent = welcome.headline(ctx.q);
      else if (currentWorld?.answerElement) { if (answer.firstChild !== currentWorld.answerElement) answer.replaceChildren(currentWorld.answerElement); }
      else if (currentWorld?.answerValue != null) { const text = String(currentWorld.answerValue); if (answer.textContent !== text) answer.textContent = text; }
      else {
        const candidates = handles(index).flatMap(h => [...h.element.querySelectorAll('[data-world-answer],[data-answer],.evidence-answer-sentence,[data-trust=counts],p,output')]);
        const value = candidates.map(n => n.textContent.trim()).find(text => text && text.split(/\s+/).length <= 12);
        answer.textContent = value || '';
      }
      holo.update(motionT, dt);
      guide.update();
      if (index === 0) syncWelcome();
      if (!capture && lastFrame != null) { totalFrame += frameStarted - lastFrame; frameCount++; host.dataset.worldFrameMs = (totalFrame / frameCount).toFixed(2); }
      lastFrame = frameStarted;
      inUpdate = false;
      if (engine.mode === 'still') fallback('WebGL unavailable');
    }, dispose() { holo?.dispose(); } };
  } });
  if (engine.mode === 'still') fallback('WebGL unavailable');
  listen(canvasHost, 'webglcontextlost', () => fallback('WebGL context lost'), true);
  if (!disposed && !capture) { await afterPaint(); if (!disposed) loader?.prepare(); }
  }
  const started = start().catch(error => { console.warn('VESTA world unavailable:', error.message); fallback('World unavailable'); });
  if (capture) await started;
  return api;
}
export const mount = createWorld;
