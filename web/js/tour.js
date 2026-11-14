import { getDb, getCore } from './store.js';
import { readQ } from './router.js';

const TICK_MS = 100;
let run = null;
let pending = null;
let cached = null;
let installed = false;
let navigating = false;
let internalAction = false;

const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');
const wantsTour = () => hashParams().get('tour') === '1';
const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const elapsed = () => run ? Math.min(run.cfg.total, run.offset + (run.paused ? 0 : (performance.now() - run.t0) / 1000)) : 0;

function parse(file) {
  if (!file || !Array.isArray(file.steps)) return null;
  const list = file.steps.filter(s => s && Number.isFinite(s.at) && s.at >= 0 && typeof s.hash === 'string' && s.hash.startsWith('#/'))
    .slice().sort((a, b) => a.at - b.at);
  if (!list.length) return null;
  const total = Number.isFinite(file.total_s) && file.total_s > list.at(-1).at ? file.total_s : list.at(-1).at + 6;
  return { list, total };
}

function style() {
  if (document.getElementById('vesta-tour-style')) return;
  const s = document.createElement('style');
  s.id = 'vesta-tour-style';
  s.textContent = `
body>.tour-bar{position:fixed;inset:auto 0 0;z-index:900;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 28px;padding:14px 24px calc(18px + env(safe-area-inset-bottom,0px));background:var(--bg-0,#12100e);border-top:1px solid var(--line-strong,#8f877b);font-family:var(--font,system-ui,sans-serif);color:var(--ivory,#ede4d4)}
.tour-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;min-width:0}
.tour-stop{font:600 16px/22px var(--font,system-ui,sans-serif);color:var(--ivory,#ede4d4)}
.tour-time{font:400 14px/20px var(--font,system-ui,sans-serif);font-variant-numeric:tabular-nums;color:var(--ivory-dim,#bdb3a3)}
.tour-cap{grid-column:1;min-width:0;overflow-wrap:anywhere;font:400 18px/26px var(--font,system-ui,sans-serif)}
.tour-cap .cite,.tour-cap a{font:inherit;min-height:24px}
.tour-controls{grid-column:2;grid-row:1/3;display:flex;align-items:center;gap:8px}
.tour-controls button{min-width:76px;min-height:44px;padding:9px 14px;border:1px solid var(--line-strong,#8f877b);border-radius:6px;background:var(--surface-1,#28241f);color:var(--ivory,#ede4d4);font:500 16px/24px var(--font,system-ui,sans-serif);cursor:pointer}
.tour-controls button:hover,.tour-controls button[aria-pressed=true]{background:var(--surface-2,#39332b)}
.tour-track{position:absolute;inset:auto 0 0;height:4px;background:rgba(237,228,212,.15)}
.tour-fill{display:block;height:100%;width:0;background:var(--earth,#8fa3b5)}
html[data-tour=running] #view{height:var(--tour-view-height,calc(var(--stage-h) - var(--bar-h) - 172px))!important;overflow-y:auto!important}
@media(max-width:759px){
body>.tour-bar{grid-template-columns:minmax(0,1fr);gap:8px;padding:12px 16px calc(16px + env(safe-area-inset-bottom,0px))}
.tour-meta{justify-content:space-between;gap:4px 12px}
.tour-stop{font-size:16px;line-height:22px}
.tour-time{font-size:13px;line-height:20px}
.tour-cap{font-size:16px;line-height:23px}
.tour-controls{grid-column:1;grid-row:auto;justify-content:flex-end}
.tour-controls button{flex:1;min-width:0}
html[data-tour=running][data-view-mode=simple] #view{height:auto!important}
html[data-tour=running][data-view-mode=simple] #stage{padding-bottom:var(--tour-bar-height,220px)}
}
`;
  document.head.appendChild(s);
}

function layout() {
  if (!run) return;
  const bar = run.ui.bar.getBoundingClientRect();
  document.documentElement.style.setProperty('--tour-bar-height', `${bar.height}px`);
  if (innerWidth < 760) return;
  const view = document.getElementById('view'), stage = document.getElementById('stage');
  if (!view || !stage) return;
  const scale = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
  const top = view.getBoundingClientRect().top;
  const footer = document.getElementById('foot')?.getBoundingClientRect().top ?? bar.top;
  document.documentElement.style.setProperty('--tour-view-height', `${Math.max(0, Math.min(footer, bar.top) - top) / scale}px`);
}

function makeBar(cfg) {
  style();
  const mk = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  const bar = mk('section', 'tour-bar');
  bar.setAttribute('data-tour-bar', '');
  bar.setAttribute('aria-label', '60-second guided tour');
  const meta = mk('div', 'tour-meta'), stop = mk('span', 'tour-stop'), time = mk('span', 'tour-time');
  const cap = mk('p', 'tour-cap'), controls = mk('div', 'tour-controls'), track = mk('div', 'tour-track'), fill = mk('span', 'tour-fill');
  cap.setAttribute('data-tour-caption', '');
  cap.setAttribute('role', 'status');
  cap.setAttribute('aria-live', 'polite');
  cap.setAttribute('aria-atomic', 'true');
  time.setAttribute('aria-live', 'off');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Tour controls');
  const buttons = {};
  for (const [action, label] of [['pause', 'Pause'], ['next', 'Next'], ['close', 'Close']]) {
    const button = mk('button', 'tour-control');
    button.type = 'button'; button.textContent = label; button.dataset.tourControl = action;
    button.addEventListener('click', () => action === 'pause' ? pause() : action === 'next' ? next() : stopTour());
    controls.append(button); buttons[action] = button;
  }
  buttons.pause.setAttribute('aria-pressed', 'false');
  track.setAttribute('aria-hidden', 'true');
  track.append(fill); meta.append(stop, time); bar.append(meta, cap, controls, track);
  document.body.append(bar);
  return { bar, stop, cap, time, fill, buttons };
}

function setState(state, stopId) {
  const d = document.documentElement.dataset;
  d.tour = state;
  if (stopId) d.tourStop = stopId; else delete d.tourStop;
}

function navigate(hash) {
  if (location.hash === hash) return;
  const oldURL = location.href;
  history.replaceState(null, '', hash);
  navigating = true;
  try { dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href })); }
  finally { navigating = false; }
}

function drill(action) {
  const button = document.querySelector(`.inc-simple-actions [data-action="${action}"]`);
  if (!button) return false;
  internalAction = true;
  try { button.click(); } finally { internalAction = false; }
  return true;
}

function settle(step, session, attempt = 0) {
  if (run !== session || run.step !== step) return;
  const view = document.getElementById('view');
  const target = view?.querySelector(step.focus || 'h1');
  const loading = [...document.querySelectorAll('link[rel=stylesheet]')].some(link => !link.sheet) || document.fonts?.status === 'loading';
  if (loading && attempt < 120) { requestAnimationFrame(() => settle(step, session, attempt + 1)); return; }
  if (!target || view.dataset.view !== step.hash.slice(2).split('?')[0]) {
    if (attempt < 120) requestAnimationFrame(() => settle(step, session, attempt + 1));
    return;
  }
  if (session.paused && drill('pause')) session.resumeDrill = true;
  layout();
  if (innerWidth < 760) {
    const top = step.focus ? target.getBoundingClientRect().top + scrollY - 16 : 0;
    window.scrollTo({ top, behavior: 'instant' });
  } else view.scrollTop = 0;
}

function apply(step) {
  run.step = step;
  run.resumeDrill = false;
  run.ui.stop.textContent = step.label || step.stop || '';
  const db = run.api.db || getDb(), core = getCore();
  const q = db ? readQ(Object.fromEntries(new URLSearchParams(step.hash.split('?')[1] || '')), db) : null;
  const material = db && q && core.status ? core.status.cell(q.material, q.concern, q, db) : null;
  const values = db ? {
    investigations: db.engine.extractor.psi_kept,
    rows: db.engine.extractor.test_rows.toLocaleString('en-US'),
    station_rows: material?.hit_ids?.length ?? 0,
    partial_rows: db.base.partial_rows,
    quotes: db.engine.verifier.quotes_verified.toLocaleString('en-US')
  } : {};
  run.ui.cap.textContent = (step.caption || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? 'not reported');
  delete run.ui.cap.dataset.claim;
  const citeId = step.source === 'material' ? material?.hit_ids?.[0] : step.source;
  const ui = run.api.ui || window.vesta?.ui;
  if (citeId && ui) {
    run.ui.cap.dataset.claim = citeId;
    if (citeId.includes('/')) {
      const a = document.createElement('a'); a.href = citeId; a.textContent = 'source'; a.dataset.cite = citeId; a.target = '_blank'; a.rel = 'noopener'; run.ui.cap.append(' ', a);
    } else run.ui.cap.append(' ', ui.cite(citeId, { label: 'source' }));
  }
  setState('running', step.stop || '');
  let hash = step.hash + (step.hash.includes('?') ? '&' : '?') + 'view=simple';
  if (run.capture && !/[?&]capture=/.test(hash)) hash += '&capture=1';
  navigate(hash);
  requestAnimationFrame(() => { if (run) settle(step, run); });
}

function tick() {
  if (!run) return;
  const t = elapsed();
  while (run && run.next < run.cfg.list.length && run.cfg.list[run.next].at <= t) apply(run.cfg.list[run.next++]);
  if (!run) return;
  run.ui.fill.style.width = Math.min(100, 100 * t / run.cfg.total) + '%';
  run.ui.time.textContent = `${run.paused ? 'Paused · ' : ''}${run.next} / ${run.cfg.list.length} · ${clock(t)} / ${clock(run.cfg.total)}`;
  document.documentElement.dataset.tourT = String(Math.floor(t));
  if (t >= run.cfg.total) end('done');
}

function pause() {
  if (!run) return;
  if (run.paused) {
    run.paused = false;
    run.t0 = performance.now();
    if (run.resumeDrill) drill('play');
    run.resumeDrill = false;
  } else {
    run.offset = elapsed();
    run.paused = true;
    run.resumeDrill = drill('pause');
  }
  run.ui.buttons.pause.textContent = run.paused ? 'Resume' : 'Pause';
  run.ui.buttons.pause.setAttribute('aria-pressed', String(run.paused));
  tick();
  layout();
}

function next() {
  if (!run) return;
  if (run.next >= run.cfg.list.length) { end('done'); return; }
  run.offset = run.cfg.list[run.next].at;
  run.t0 = performance.now();
  tick();
}

function end(state) {
  pending = null;
  if (!run) return;
  const { api, ui, trigger, observer, timer, resumeDrill } = run;
  clearInterval(timer);
  observer.disconnect();
  if (resumeDrill) drill('play');
  ui.bar.remove();
  const restoreFocus = document.activeElement === document.body || ui.bar.contains(document.activeElement);
  run = null;
  setState(state);
  document.documentElement.style.removeProperty('--tour-bar-height');
  document.documentElement.style.removeProperty('--tour-view-height');
  if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  try { if (typeof api.onStop === 'function') api.onStop(state); } catch (e) { console.warn('[tour] onStop: ' + e.message); }
}

function begin(cfg, api) {
  pending = null;
  if (run) return;
  const capture = !!api.capture || hashParams().get('capture') === '1';
  const trigger = document.activeElement;
  if (wantsTour()) {
    const params = hashParams(); params.delete('tour');
    history.replaceState(null, '', location.hash.split('?')[0] + (params.size ? '?' + params : ''));
  }
  history.pushState(null, '', location.href);
  run = { cfg, api, capture, trigger, offset: 0, paused: false, resumeDrill: false, t0: performance.now(), next: 0, timer: 0, ui: makeBar(cfg) };
  run.observer = new ResizeObserver(layout);
  run.observer.observe(run.ui.bar);
  run.timer = setInterval(tick, TICK_MS);
  tick();
  layout();
}

export function start(api) {
  api = api && typeof api === 'object' ? api : {};
  api = { db: getDb(), ui: window.vesta?.ui, ...api };
  if (run) { run.api = { ...run.api, ...api }; return stopTour; }
  if (pending) { pending.api = { ...pending.api, ...api }; return stopTour; }
  const cfg = cached || (cached = parse(api.stops) || parse(api.db?.tour));
  if (cfg) { begin(cfg, api); return stopTour; }
  const request = { api };
  pending = request;
  fetch('data/tour.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('data/tour.json answered ' + r.status); return r.json(); })
    .then(file => { cached = parse(file); if (!cached) throw new Error('data/tour.json has no steps'); if (pending === request) begin(cached, request.api); })
    .catch(e => { if (pending !== request) return; pending = null; setState('unavailable'); console.warn('[tour] not started: ' + e.message); });
  return stopTour;
}

function stopTour() { if (run) end('stopped'); else if (pending) { pending = null; setState('stopped'); } }
export { stopTour as stop };
export const isRunning = () => !!run;
export { start as startTour };
export default start;

export function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', ev => {
    if (internalAction) return;
    const onButton = ev.target?.closest?.('[data-action="tour"]');
    if (onButton) { if (!run && !pending) start(); return; }
    if (ev.target?.closest?.('[data-tour-control]')) return;
    if (run || pending) stopTour();
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && (run || pending)) { ev.preventDefault(); stopTour(); } }, true);
  window.addEventListener('popstate', () => { if (run || pending) stopTour(); });
  window.addEventListener('hashchange', () => {
    if (navigating) return;
    if (run || pending) { stopTour(); return; }
    if (wantsTour()) start();
  });
  window.addEventListener('resize', layout);
  if (wantsTour()) start();
}

install();
