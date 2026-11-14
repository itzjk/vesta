import { getDb, getCore } from './store.js';
import { readQ } from './router.js';

const TICK_MS = 100;
let run = null;
let pending = null;
let cached = null;
let installed = false;

const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');
const wantsTour  = () => hashParams().get('tour') === '1';

function parse(file) {
  if (!file || !Array.isArray(file.steps)) return null;
  const list = file.steps.filter(s => s && typeof s.at === 'number' && typeof s.hash === 'string' && s.hash.startsWith('#/'))
    .slice().sort((a, b) => a.at - b.at);
  if (!list.length) return null;
  return { list, total: typeof file.total_s === 'number' ? file.total_s : list[list.length - 1].at + 6 };
}

function stageOf(api) {
  return (api && api.stage) || document.querySelector('[data-stage]') || document.getElementById('stage') || document.querySelector('.stage') || document.body;
}

function style() {
  if (document.getElementById('vesta-tour-style')) return;
  const s = document.createElement('style');
  s.id = 'vesta-tour-style';
  s.textContent = `
.tour-bar{position:absolute;left:0;right:0;bottom:var(--foot-h,72px);z-index:900;min-height:100px;box-sizing:border-box;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:24px;
  padding:14px 32px 18px;background:var(--bg-0);border-top:1px solid var(--line-strong,rgba(237,228,212,.9));
  font-family:var(--font,system-ui,sans-serif);color:var(--ivory,#ede4d4)}
.tour-bar .tour-stop{font:600 18px/22px var(--font,system-ui,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--ivory,#8fa3b5);
  border:1px solid var(--line,rgba(237,228,212,.45));border-radius:999px;padding:6px 14px;white-space:normal;max-width:340px;justify-self:start}
.tour-bar .tour-cap{min-width:0;overflow-wrap:break-word;font:400 22px/28px var(--font,system-ui,sans-serif);color:var(--ivory,#ede4d4)}
.tour-bar .tour-esc{font:600 18px/22px var(--font,system-ui,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--ivory-dim,rgba(237,228,212,.62));white-space:nowrap}
.tour-bar .tour-sources{grid-column:2;display:flex;gap:10px;font-size:18px;line-height:22px}
.tour-bar .tour-sources .cite{font-size:18px;line-height:22px;padding:2px 8px}
.tour-bar .tour-track{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(237,228,212,.15)}
.tour-bar .tour-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--earth,#8fa3b5);}
.tour-bar .tour-mark{position:absolute;top:-3px;width:2px;height:10px;background:var(--ivory,#8fa3b5);opacity:.7}
`;
  document.head.appendChild(s);
}

function makeBar(cfg, api) {
  style();
  const mk = (cls) => { const e = document.createElement('span'); e.className = cls; return e; };
  const bar = document.createElement('div');
  bar.className = 'tour-bar';
  bar.setAttribute('data-tour-bar', '');
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  const stop = mk('tour-stop'), cap = mk('tour-cap'), esc = mk('tour-esc'), sources = mk('tour-sources'), track = mk('tour-track'), fill = mk('tour-fill');
  cap.setAttribute('data-tour-caption', '');
  esc.textContent = 'Esc or click: take over';
  track.appendChild(fill);
  const seen = new Set();
  for (const s of cfg.list) {
    const first = !seen.has(s.stop); seen.add(s.stop);
    if (!first || s.at <= 0) continue;
    const m = mk('tour-mark'); m.style.left = (100 * s.at / cfg.total) + '%'; track.appendChild(m);
  }
  bar.append(stop, cap, esc, sources, track);
  const host = stageOf(api);
  if (host === document.body) bar.style.position = 'fixed';
  host.appendChild(bar);
  return { bar, stop, cap, fill, sources };
}

function setState(state, stopId) {
  const d = document.documentElement.dataset;
  d.tour = state;
  if (stopId) d.tourStop = stopId; else delete d.tourStop;
}

function apply(step) {
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
  run.ui.sources.replaceChildren();
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
  if (run.capture && !/[?&]capture=/.test(hash)) hash += (hash.includes('?') ? '&' : '?') + 'capture=1';
  if (location.hash !== hash) location.hash = hash;
}

function tick() {
  if (!run) return;
  const t = (performance.now() - run.t0) / 1000;
  while (run && run.next < run.cfg.list.length && run.cfg.list[run.next].at <= t) apply(run.cfg.list[run.next++]);
  if (!run) return;
  run.ui.fill.style.width = Math.min(100, 100 * t / run.cfg.total) + '%';
  document.documentElement.dataset.tourT = String(Math.floor(t));
  if (t >= run.cfg.total) end('done');
}

function end(state) {
  pending = null;
  if (!run) return;
  const api = run.api;
  clearInterval(run.timer);
  run.ui.bar.remove();
  run = null;
  setState(state);
  try { if (api && typeof api.onStop === 'function') api.onStop(state); } catch (e) { console.warn('[tour] onStop: ' + e.message); }
}

function begin(cfg, api) {
  pending = null;
  if (run) return;
  const capture = !!(api && api.capture) || hashParams().get('capture') === '1';
  run = { cfg, api, capture, t0: performance.now(), next: 0, timer: 0, ui: makeBar(cfg, api) };
  run.timer = setInterval(tick, TICK_MS);
  tick();
}


export function start(api) {
  api = api && typeof api === 'object' ? api : {};
  api = { db: getDb(), ui: window.vesta?.ui, ...api };
  if (run) { if (!run.api.onStop && api.onStop) run.api = { ...run.api, ...api }; return stop; }
  if (pending) { pending = { ...pending, ...api }; return stop; }
  const cfg = cached || (cached = parse(api.stops) || parse(api.db && api.db.tour));
  if (cfg) { begin(cfg, api); return stop; }
  pending = api;
  fetch('data/tour.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('data/tour.json answered ' + r.status); return r.json(); })
    .then(file => { cached = parse(file); if (!cached) throw new Error('data/tour.json has no steps'); if (pending) begin(cached, pending); })
    .catch(e => { pending = null; setState('unavailable'); console.warn('[tour] not started: ' + e.message); });
  return stop;
}

export function stop() { if (run) end('stopped'); else if (pending) { pending = null; setState('stopped'); } }
export const isRunning = () => !!run;
export { start as startTour };
export default start;


export function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (ev) => {
    const onButton = ev.target && ev.target.closest && ev.target.closest('[data-action="tour"]');
    if (onButton) { if (!run && !pending) start(); return; }
    if (run || pending) stop();
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (run || pending)) stop(); }, true);
  window.addEventListener('hashchange', () => { if (!run && !pending && wantsTour()) start(); });
  if (wantsTour()) start();
}

install();
