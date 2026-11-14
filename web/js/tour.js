import { getDb, getCore } from './store.js';

const STOPS = ['transit', 'flame', 'evidence', 'drill', 'trust'];
const TIMES = [0, 8, 20, 34, 48];
let run = null, pending = null, installed = false, navigating = false;
const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
const seconds = () => run ? Math.min(run.total, run.offset + (run.paused ? 0 : (performance.now() - run.epoch) / 1000)) : 0;
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const worldOf = api => api.world?.navigate ? api.world : window.vesta?.world;

function itinerary(db, input) {
  const cfg = input?.schema === 'vesta.tour/2' ? input : db?.tour;
  const valid = cfg?.schema === 'vesta.tour/2' && cfg.total_s === 60 && cfg.steps?.length === 5 && cfg.steps.every((s, i) => s.stop === STOPS[i] && s.at === TIMES[i]);
  return { total: 60, list: valid ? cfg.steps : STOPS.map((stop, i) => ({ stop, at: TIMES[i], label: stop, caption: '' })) };
}

function caption(step, db, core) {
  const comm = db?.findingById?.[db.scenario?.meta?.comm?.one_way_finding];
  const delay = comm?.gate?.pass ? db?.scenario?.meta?.comm?.one_way_min : null;
  const values = {
    delay,
    investigations: db?.investigations?.length,
    rows: db?.engine?.extractor?.test_rows?.toLocaleString('en-US'),
    decisions: db?.engine?.officer?.[db?.scenario?.meta?.id]?.steps,
    quotes: db?.engine?.verifier?.quotes_verified?.toLocaleString('en-US')
  };
  if (step.stop === 'flame' && !db?.findingById?.['S-SHAPE-01']?.gate?.pass) return 'Flame observation unavailable.';
  if (step.caption && !/\{(\w+)\}/g.test(step.caption.replace(/\{(\w+)\}/g, (_, key) => values[key] == null ? `{${key}}` : String(values[key])))) return step.caption.replace(/\{(\w+)\}/g, (_, key) => values[key]);
  if (step.stop === 'transit') return comm?.gate?.pass ? comm.quote : 'Communication evidence unavailable.';
  if (step.stop === 'flame') return db?.findingById?.['S-SHAPE-01'] ? 'Low-momentum flames: illustration of a NASA observation, not a simulation.' : 'Flame observation unavailable.';
  if (step.stop === 'evidence') return `${values.investigations ?? 0} investigations. ${values.rows ?? 0} source-table rows.`;
  if (step.stop === 'drill') return db?.scenario ? 'Scripted telemetry. Not a physics model.' : 'Scripted drill unavailable.';
  return values.quotes == null ? 'Quote verification unavailable.' : `${values.quotes} quote matches. Matching words does not validate a decision.`;
}

function style() {
  if (document.getElementById('vesta-tour-style')) return;
  const el = document.createElement('style'); el.id = 'vesta-tour-style';
  el.textContent = `
body>.tour-bar{position:fixed;inset:auto 0 0;z-index:950;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px 24px;padding:18px 28px calc(20px + env(safe-area-inset-bottom,0px));background:linear-gradient(0deg,rgba(9,10,12,.98),rgba(9,10,12,.92));color:#ede4d4;font-family:var(--font-body,system-ui,sans-serif)}
.tour-cap{margin:0;font:400 20px/1.35 var(--font-body,system-ui,sans-serif);max-width:72ch;overflow-wrap:anywhere}
.tour-controls{display:flex;align-items:center;gap:8px}.tour-controls button{min-width:64px;min-height:44px;padding:9px 12px;border:1px solid #8f877b;border-radius:0;background:#191715;color:#ede4d4;font:500 16px/24px var(--font-body,system-ui,sans-serif);cursor:pointer}.tour-controls button:focus-visible{outline:2px solid #ede4d4;outline-offset:3px}.tour-time{font:400 14px/20px var(--font-body,system-ui,sans-serif);font-variant-numeric:tabular-nums;min-width:72px;text-align:center;color:#bdb3a3}
.tour-track{position:absolute;inset:auto 0 0;height:3px;background:#35302b}.tour-fill{display:block;height:100%;width:0;background:#c8553d}
html[data-tour=running] .world-answer,html[data-tour=running] .world-holograms,html[data-tour=running] .world-markers,html[data-tour=running] .world-stations,html[data-tour=running] .world-skip,html[data-tour=running] .evidence-tools,html[data-tour=running] .field-labels,html[data-tour=running] .drill-hud,html[data-tour=running] [data-world-answer],html[data-tour=running] [data-world-marker]{visibility:hidden!important;pointer-events:none!important}
html[data-cinema=true] body>.tour-bar,html[data-cinema=true]>.tour-bar{visibility:hidden}
@media(max-width:759px){body>.tour-bar{grid-template-columns:1fr;padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));gap:12px}.tour-cap{font-size:18px;line-height:24px}.tour-controls{justify-content:space-between}.tour-controls button{flex:1;min-width:0}.tour-time{min-width:74px}.tour-cap{max-height:96px;overflow-y:auto}}
`;
  document.head.append(el);
}

function makeBar() {
  style();
  const bar = document.createElement('section'); bar.className = 'tour-bar'; bar.dataset.tourBar = ''; bar.setAttribute('aria-label', 'Film controls');
  const cap = document.createElement('p'); cap.className = 'tour-cap'; cap.dataset.tourCaption = ''; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite'); cap.setAttribute('aria-atomic', 'true');
  const controls = document.createElement('div'); controls.className = 'tour-controls';
  const time = document.createElement('span'); time.className = 'tour-time'; time.setAttribute('aria-live', 'off');
  const buttons = {};
  for (const [action, label, fn] of [['pause', 'Pause', pause], ['next', 'Skip', next], ['close', 'Close', stop]]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.tourControl = action; button.onclick = fn;
    if (action === 'next') button.setAttribute('aria-label', 'Skip to the next station');
    controls.append(button); buttons[action] = button;
  }
  buttons.pause.setAttribute('aria-pressed', 'false'); controls.prepend(time);
  const track = document.createElement('div'); track.className = 'tour-track'; track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span'); fill.className = 'tour-fill'; track.append(fill); bar.append(cap, controls, track); document.body.append(bar);
  return { bar, cap, time, fill, buttons };
}

function apply(index) {
  const session = run, step = session.list[index]; session.index = index;
  session.ui.cap.textContent = caption(step, session.api.db || getDb(), getCore());
  document.documentElement.dataset.tourStop = step.stop;
  navigating = true;
  try { session.world.navigate(step.stop, { cut: session.paused || session.capture || matchMedia('(prefers-reduced-motion: reduce)').matches }); }
  finally { navigating = false; }
  session.expectedHash = location.hash;
}

function tick() {
  if (!run) return;
  if (worldOf(run.api) !== run.world || !document.querySelector('.world-host')) { finish('unavailable'); return; }
  const t = seconds();
  const index = run.list.findLastIndex(step => step.at <= t);
  if (index !== run.index) apply(index);
  run.ui.time.textContent = `${clock(t)} / ${clock(run.total)}`;
  run.ui.fill.style.width = `${t / run.total * 100}%`;
  document.documentElement.dataset.tourT = String(Math.floor(t));
  if (t >= run.total) finish('done');
}

export function pause() {
  if (!run) return;
  run.offset = seconds(); run.paused = !run.paused; run.epoch = performance.now();
  run.ui.buttons.pause.textContent = run.paused ? 'Resume' : 'Pause'; run.ui.buttons.pause.setAttribute('aria-pressed', String(run.paused));
  run.world.setFilm?.(true, { paused: run.paused }); tick();
}

export function next() {
  if (!run) return;
  const step = run.list[run.index + 1];
  if (!step) { finish('done'); return; }
  run.offset = step.at; run.epoch = performance.now(); tick();
}

function finish(state) {
  if (pending) { clearTimeout(pending.timer); pending = null; }
  if (!run) return;
  const session = run; run = null; clearInterval(session.timer);
  const focused = session.ui.bar.contains(document.activeElement);
  session.ui.bar.remove();
  document.documentElement.dataset.tour = state;
  delete document.documentElement.dataset.tourStop; delete document.documentElement.dataset.tourT;
  document.documentElement.style.removeProperty('--film-height');
  session.observer.disconnect(); session.world.setFilm?.(false);
  if (focused && session.trigger?.isConnected) session.trigger.focus({ preventScroll: true });
  session.api.onStop?.(state);
}

function begin(api, world) {
  const db = api.db || getDb(), cfg = itinerary(db, api.stops), p = params();
  const capture = api.capture || p.get('capture') === '1';
  const offset = capture ? Math.max(0, Math.min(59.999, Number(p.get('film_t')) || 0)) : 0;
  pending = null;
  if (p.has('tour')) { p.delete('tour'); history.replaceState(null, '', location.hash.split('?')[0] + (p.size ? '?' + p : '')); }
  run = { api, world, ...cfg, capture, offset, paused: !!capture, epoch: performance.now(), index: -1, trigger: document.activeElement, ui: makeBar() };
  document.documentElement.dataset.tour = 'running'; world.setFilm?.(true, { paused: !!capture });
  run.observer = new ResizeObserver(() => { if (run) document.documentElement.style.setProperty('--film-height', `${run.ui.bar.offsetHeight}px`); }); run.observer.observe(run.ui.bar);
  run.ui.buttons.pause.textContent = capture ? 'Resume' : 'Pause'; run.ui.buttons.pause.setAttribute('aria-pressed', String(!!capture));
  run.timer = setInterval(tick, 100); tick();
}

export function start(api = {}) {
  if (run || pending) return stop;
  const world = worldOf(api);
  if (world?.navigate && document.querySelector('.world-host')) { begin(api, world); return stop; }
  const request = { api, deadline: performance.now() + 15000 }; pending = request;
  const wait = () => {
    if (pending !== request) return;
    const world = worldOf(api);
    if (world?.navigate && document.querySelector('.world-host')) { begin(api, world); return; }
    if (performance.now() > request.deadline || params().get('view') === 'details' || params().get('still') === '1') { pending = null; document.documentElement.dataset.tour = 'unavailable'; return; }
    request.timer = setTimeout(wait, 100);
  };
  wait(); return stop;
}

export function stop() { finish('stopped'); }
export const isRunning = () => !!run;
export { start as startTour };
export default start;

export function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', ev => {
    if (ev.target.closest?.('[data-action="tour"]')) { start(); return; }
    if (ev.target.closest?.('[data-tour-control],.world-cinema')) return;
    if (run && ev.target.closest?.('button,a,input,select,[data-world-marker]')) stop();
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && (run || pending)) { ev.preventDefault(); stop(); } }, true);
  window.addEventListener('hashchange', () => {
    if (navigating) return;
    if (run && location.hash !== run.expectedHash) { stop(); return; }
    if (!run && params().get('tour') === '1') start();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.paused) pause(); });
  if (params().get('tour') === '1') start();
}

install();
