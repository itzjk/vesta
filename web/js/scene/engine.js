import { createOptics } from './optics.js?v=2';
import { imageEnvironment } from './imagery.js';
import { createFrameBudget } from './frame-budget.js?v=habitat-20261115-1';

let active;
const flags = () => new URLSearchParams(location.hash.split('?')[1] || '');
function release(group) {
  const seen = new Set();
  group?.traverse(o => {
    for (const item of [o.geometry, ...[o.material].flat()]) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      for (const value of Object.values(item)) if (value?.isTexture && !seen.has(value)) { seen.add(value); value.dispose(); }
      item.dispose?.();
    }
  });
}
export async function createStage(host, opts = {}) {
  active?.dispose();
  let disposed = false, module, state = {}, renderer, scene, camera, THREE, raf = 0, serial = 0, visible = true, warming = false;
  let epoch = performance.now(), frozen = 0, rendered = 0, optics, environment;
  const events = new Map(), listeners = [], f = flags(), capture = opts.capture ?? f.get('capture') === '1';
  const qualityFlag = f.get('quality') || new URLSearchParams(location.search).get('quality');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = opts.mode || (f.get('still') === '1' || reduced.matches && !opts.reducedCuts ? 'still' : qualityFlag === 'low' ? 'low' : 'high');
  const frameBudget = createFrameBudget({ explicitQuality: Boolean(opts.mode || qualityFlag), capture, still: mode === 'still' });
  const worldHost = host.closest('.world-host');
  const picture = document.createElement('img');
  picture.className = 'scene-still'; picture.alt = ''; picture.hidden = true;
  host.hidden = false; host.classList.add('scene-host'); host.append(picture);
  const listen = (el, name, fn, options) => { el.addEventListener(name, fn, options); listeners.push(() => el.removeEventListener(name, fn, options)); };
  const emit = (name, hit) => { for (const fn of events.get(name) || []) fn(hit || { id: null, kind: null }); };
  const size = () => ({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
  const time = () => capture ? Number(opts.time ?? flags().get('t') ?? 2) || 0 : (performance.now() - epoch) / 1000;
  function fallback() {
    frameBudget.reset();
    mode = 'still'; host.dataset.sceneMode = mode; cancelAnimationFrame(raf);
    if (renderer) renderer.domElement.hidden = true;
    const src = module?.still || opts.still;
    if (src) { picture.src = src; picture.hidden = false; }
  }
  function render() {
    if (disposed || warming || !module || !renderer || picture.hidden === false) return;
    const frameStart = performance.now();
    module.update?.(time(), state, camera);
    if (optics) optics.render(scene, camera, reduced.matches ? 2 : time(), mode); else renderer.render(scene, camera); const elapsed = performance.now() - frameStart; host.dataset.sceneRenderMs = elapsed.toFixed(3); host.dataset.sceneFrames = String(++rendered);
    emit('frame', { at: frameStart, renderMs: elapsed, mode, canvas: renderer.domElement });
  }
  function setQuality(value, reason = 'manual') {
    if (!['high', 'low'].includes(value)) return;
    if (reason === 'manual') frameBudget.manual();
    if (disposed || !renderer || mode === 'still') return;
    mode = value;
    renderer.shadowMap.enabled = value === 'high';
    host.dataset.sceneMode = value; host.dataset.sceneQualityReason = reason;
    resize(false); emit('quality', { mode: value, reason });
  }
  function loop(now) {
    raf = 0;
    if (disposed || !visible || document.hidden || mode === 'still' || capture || warming) { frameBudget.reset(); return; }
    render();
    // Only regular RAF intervals enter this policy; eager invalidate/resume renders
    // and station preparation never count as evidence of sustained frame pacing.
    const owner = worldHost?.dataset;
    const decision = frameBudget.sample({ at: now, mode, capture, visible,
      hidden: document.hidden || host.hidden || Boolean(worldHost?.hidden), warming,
      loading: owner?.worldLoading === 'true', flying: owner?.flying === 'true' || host.dataset.flying === 'true',
      settled: Boolean(module && renderer) && picture.hidden && (worldHost ? owner.worldSettled === 'true' : true),
      context: worldHost ? owner.station : serial });
    if (decision) {
      host.dataset.sceneBudget = JSON.stringify(decision.stats);
      setQuality(decision.mode, decision.reason);
    }
    raf = requestAnimationFrame(loop);
  }
  function resume() { cancelAnimationFrame(raf); if (!disposed && visible && !document.hidden) { render(); if (mode !== 'still' && !capture) raf = requestAnimationFrame(loop); } }
  function resize(restart = true) {
    if (disposed || !renderer || !camera) return;
    frameBudget.reset();
    const { width, height } = size(), bounds = host.getBoundingClientRect();
    const ratio = Math.min(mode === 'low' ? 1 : 1.5, devicePixelRatio || 1); host.dataset.scenePixelRatio = String(ratio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(Math.max(1, Math.round(bounds.width)), Math.max(1, Math.round(bounds.height)), false);
    optics?.resize();
    camera.aspect = width / height; camera.updateProjectionMatrix(); if (restart) resume();
  }
  const stage = {
    get mode() { return mode; },
    get qualitySelectable() { return mode !== 'still' && Boolean(renderer); },
    get renderer() { return renderer; },
    get frameBudget() { return frameBudget.snapshot(); },
    setQuality,
    hold() { frameBudget.reset(); warming = true; cancelAnimationFrame(raf); },
    async warm(prepare, restore) {
      if (disposed || !renderer || !module) return;
      frameBudget.reset(); warming = true; cancelAnimationFrame(raf);
      const started = performance.now(), previous = renderer.getRenderTarget(), opacity = renderer.domElement.style.opacity;
      renderer.domElement.style.opacity = '0';
      try {
        for (const pass of [0, 1, 0]) {
          if (disposed) return;
          prepare?.(pass); module.update?.(time(), state, camera);
          if (optics) await optics.compile(scene, camera, mode); else await renderer.compileAsync(scene, camera);
          if (disposed) return;
          if (optics) optics.render(scene, camera, time(), mode); else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        host.dataset.sceneWarmMs = (performance.now() - started).toFixed(3);
      } finally {
        renderer.setRenderTarget(previous); restore?.(); warming = false; frameBudget.reset();
        if (!disposed) resume();
        renderer.domElement.style.opacity = opacity;
      }
    },
    async use(sceneModule, initial = {}) {
      frameBudget.reset();
      const id = ++serial;
      if (module) { module.dispose?.(); scene?.remove(module.group); release(module.group); module = null; }
      state = { ...initial }; picture.hidden = true; epoch = performance.now();
      if (disposed) return;
      if (!THREE || !renderer) { module = { still: sceneModule.still || opts.still }; fallback(); return; }
      let built;
      try { built = await sceneModule.build({ THREE, scene, camera, renderer, mode, size }); }
      catch (error) { console.warn('VESTA scene unavailable:', error.message); fallback(); return; }
      if (disposed || id !== serial) { built.dispose?.(); release(built.group); return; }
      module = built; state = { ...built.defaults, ...state }; scene.add(built.group);
      if (mode === 'still' && (built.still || opts.still)) fallback(); else { renderer.domElement.hidden = false; resize(); }
    },
    set(patch) {
      state = { ...state, ...patch };
      if (flags().get('still') === '1' || reduced.matches && !opts.reducedCuts || !renderer || renderer.getContext().isContextLost()) fallback();
      else if (mode === 'still') { mode = qualityFlag === 'low' ? 'low' : 'high'; host.dataset.sceneMode = mode; picture.hidden = true; renderer.domElement.hidden = false; resize(); }
      resume();
    },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return () => events.get(name)?.delete(fn); },
    dispose() {
      if (disposed) return; disposed = true; serial++; cancelAnimationFrame(raf);
      observer.disconnect(); intersection.disconnect(); listeners.forEach(fn => fn()); events.clear();
      module?.dispose?.(); release(module?.group); optics?.dispose(); environment?.dispose(); renderer?.dispose(); renderer?.domElement.remove(); picture.remove();
      if (host.id === 'scene-host') host.hidden = true;
      if (active === stage) active = null;
    }
  };
  active = stage;
  const observer = new ResizeObserver(resize), intersection = new IntersectionObserver(entries => { frameBudget.reset(); visible = entries[0]?.isIntersecting !== false; resume(); });
  observer.observe(host); intersection.observe(host);
  listen(document, 'visibilitychange', () => { frameBudget.reset(); if (document.hidden) frozen = performance.now(); else if (frozen) { epoch += performance.now() - frozen; frozen = 0; } resume(); });
  listen(reduced, 'change', () => { frameBudget.reset(); if (reduced.matches && !opts.reducedCuts) fallback(); else resume(); });
  try {
    THREE = await import('../../vendor/three/three.module.js');
    if (disposed) return stage;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) { fallback(); return stage; }
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMappingExposure = .85;
    renderer.shadowMap.enabled = mode === 'high'; renderer.shadowMap.type = THREE.PCFShadowMap;
    canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'scene-canvas'; host.append(canvas);
    scene = new THREE.Scene();
    try { environment = await imageEnvironment(THREE, renderer, scene); optics = createOptics(THREE, renderer); } catch (error) { console.warn('VESTA photographic finish unavailable:', error.message); }
    if (disposed) { optics?.dispose(); environment?.dispose(); renderer.dispose(); return stage; }
    camera = new THREE.PerspectiveCamera(36, 1, 0.05, 500); camera.position.set(0, 0, 10);
    listen(canvas, 'webglcontextlost', ev => { ev.preventDefault(); fallback(); });
    let down;
    const point = ev => { const b = canvas.getBoundingClientRect(); return { x: (ev.clientX - b.left) / b.width * 2 - 1, y: 1 - (ev.clientY - b.top) / b.height * 2 }; };
    listen(canvas, 'pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
    listen(canvas, 'pointermove', ev => { const p = point(ev); const hit = module?.pick?.(p.x, p.y); emit('hover', hit ? { ...hit, x: ev.clientX, y: ev.clientY } : null); if (capture) queueMicrotask(resume); });
    listen(canvas, 'pointerleave', () => { module?.pick?.(999, 999); emit('hover', null); if (capture) queueMicrotask(resume); });
    listen(host, 'wheel', () => { if (capture) queueMicrotask(resume); }, { passive: true });
    listen(canvas, 'pointerup', ev => { if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return; const p = point(ev), hit = module?.pick?.(p.x, p.y); if (hit) emit('pick', { ...hit, x: ev.clientX, y: ev.clientY }); down = null; });
    resize();
  } catch (error) { console.warn('VESTA WebGL unavailable:', error.message); fallback(); }
  host.dataset.sceneMode = mode;
  return stage;
}
