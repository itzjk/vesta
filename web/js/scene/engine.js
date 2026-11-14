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
  let disposed = false, module, state = {}, renderer, scene, camera, THREE, raf = 0, serial = 0, visible = true;
  let epoch = performance.now(), frozen = 0, rendered = 0;
  const events = new Map(), listeners = [], f = flags(), capture = opts.capture ?? f.get('capture') === '1';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = opts.mode || (f.get('still') === '1' || reduced.matches ? 'still' : innerWidth < 760 || navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4 ? 'low' : 'high');
  const picture = document.createElement('img');
  picture.className = 'scene-still'; picture.alt = ''; picture.hidden = true;
  host.hidden = false; host.classList.add('scene-host'); host.append(picture);
  const listen = (el, name, fn, options) => { el.addEventListener(name, fn, options); listeners.push(() => el.removeEventListener(name, fn, options)); };
  const emit = (name, hit) => { for (const fn of events.get(name) || []) fn(hit || { id: null, kind: null }); };
  const size = () => ({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
  const time = () => capture ? Number(opts.time ?? flags().get('t') ?? 2) || 0 : (performance.now() - epoch) / 1000;
  function fallback() {
    mode = 'still'; host.dataset.sceneMode = mode; cancelAnimationFrame(raf);
    if (renderer) renderer.domElement.hidden = true;
    const src = module?.still || opts.still;
    if (src) { picture.src = src; picture.hidden = false; }
  }
  function render() {
    if (disposed || !module || !renderer || picture.hidden === false) return;
    const frameStart = performance.now();
    module.update?.(time(), state, camera);
    renderer.render(scene, camera); host.dataset.sceneRenderMs = (performance.now() - frameStart).toFixed(3); host.dataset.sceneFrames = String(++rendered);
  }
  function loop() {
    raf = 0;
    if (disposed || !visible || document.hidden || mode === 'still' || capture) return;
    render(); raf = requestAnimationFrame(loop);
  }
  function resume() { cancelAnimationFrame(raf); if (!disposed && visible && !document.hidden) { render(); if (mode !== 'still' && !capture) raf = requestAnimationFrame(loop); } }
  function resize() {
    if (disposed || !renderer) return;
    const { width, height } = size(), bounds = host.getBoundingClientRect();
    const ratio = Math.min(mode === 'low' ? 1 : 1.5, devicePixelRatio || 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(Math.max(1, Math.round(bounds.width)), Math.max(1, Math.round(bounds.height)), false);
    camera.aspect = width / height; camera.updateProjectionMatrix(); resume();
  }
  const stage = {
    get mode() { return mode; },
    async use(sceneModule, initial = {}) {
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
      if (flags().get('still') === '1' || reduced.matches || !renderer || renderer.getContext().isContextLost()) fallback();
      else if (mode === 'still') { mode = innerWidth < 760 ? 'low' : 'high'; host.dataset.sceneMode = mode; picture.hidden = true; renderer.domElement.hidden = false; resize(); }
      resume();
    },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return () => events.get(name)?.delete(fn); },
    dispose() {
      if (disposed) return; disposed = true; serial++; cancelAnimationFrame(raf);
      observer.disconnect(); intersection.disconnect(); listeners.forEach(fn => fn()); events.clear();
      module?.dispose?.(); release(module?.group); renderer?.dispose(); renderer?.domElement.remove(); picture.remove();
      if (host.id === 'scene-host') host.hidden = true;
      if (active === stage) active = null;
    }
  };
  active = stage;
  const observer = new ResizeObserver(resize), intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; resume(); });
  observer.observe(host); intersection.observe(host);
  listen(document, 'visibilitychange', () => { if (document.hidden) frozen = performance.now(); else if (frozen) { epoch += performance.now() - frozen; frozen = 0; } resume(); });
  listen(reduced, 'change', () => { if (reduced.matches) fallback(); });
  try {
    THREE = await import('../../vendor/three/three.module.js');
    if (disposed) return stage;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: mode === 'high', powerPreference: 'low-power' });
    if (!context) { fallback(); return stage; }
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: mode === 'high' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'scene-canvas'; host.append(canvas);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(36, 1, 0.05, 500); camera.position.set(0, 0, 10);
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
