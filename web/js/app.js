import { el, svg, css, clear, fmt, button, still } from './ui/el.js';
import { initStage, fitStage, stageScale } from './ui/stage.js';
import { answer } from './ui/answer.js';
import { panel } from './ui/panel.js';
import { chip, reason, tag, useText, statusWord, levelText, pressureText, statusLine, legend } from './ui/chip.js';
import { cite, citeLabel } from './ui/cite.js';
import { drawer } from './ui/drawer.js';
import { triad } from './ui/triad.js';
import { scorebar } from './ui/scorebar.js';
import { rangebar } from './ui/rangebar.js';
import { spark } from './ui/spark.js';
import { empty } from './ui/empty.js';
import { download, downloadJson, downloadCsv, downloadText } from './ui/download.js';
import { vesta, vestaMark } from './ui/vesta.js';
import { ROUTES, SHARED, GLOBAL, parseHash, buildHash, readQ as readQLocal, patchQ, withSticky, write } from './router.js';
import { createWorld } from './world/world.js?v=2';
import { loadDb, getDb, getCore, setOpener, openSource, closeSource, lookup } from './store.js';

export const ui = { el, svg, css, clear, fmt, button, still, answer, panel, chip, reason, tag, statusLine, legend, cite, citeLabel, drawer, openSource, closeSource, triad, scorebar, rangebar, spark, empty,
                    download, downloadJson, downloadCsv, downloadText, vesta, vestaMark, statusWord, levelText, pressureText, stageScale, lookup };

const PLACEHOLDER = 'This view is not built yet.';
const stage = document.getElementById('stage'), view = document.getElementById('view'), nav = document.getElementById('nav');
const first = parseHash();
const capture = first.params.capture === '1';
const demo = document.body.hasAttribute('data-ui-demo');
if (capture) document.documentElement.setAttribute('data-capture', '');

let db = null, core = {};
let worldHandle = null, worldPending = null, worldContext = null, worldSerial = 0, worldAbort;
let mounted = { route: null, sig: null, handle: null, ctx: null, token: 0 };
function buildChrome() {
  document.getElementById('brand-mark').append(vestaMark(40));
  for (const r of ROUTES) nav.append(el('a', { href: '#/' + r.id, data: { view: r.id } }, r.n ? el('span.n', String(r.n)) : null, el('span', r.label)));
  if (!demo) document.getElementById('bar-actions').append(modeSwitch());
  if (!demo) document.getElementById('bar-actions').append(button('Play the film', { action: 'tour', icon: '▶', title: 'A guided path through the five stops' }));
}
function modeSwitch() {
  return el('div.view-switch', { role: 'group', 'aria-label': 'Information level' }, ...['simple', 'details'].map(mode =>
    el('button', { type: 'button', data: { viewMode: mode }, onclick: () => setParams({ view: mode }) }, mode === 'simple' ? 'World' : 'Instrument')));
}
function paintChrome(route, params) {
  const mode = demo || params.view === 'details' ? 'details' : 'simple';
  document.documentElement.dataset.viewMode = mode;
  stage.dataset.viewMode = mode;
  for (const b of document.querySelectorAll('[data-view-mode] button, button[data-view-mode]')) {
    if (b.dataset.viewMode) b.setAttribute('aria-pressed', String(b.dataset.viewMode === mode));
  }
  fitStage(stage);
  const sticky = {}; for (const k of [...SHARED, 'capture', 'view']) if (params[k] != null && (params[k] !== '' || k === 'mat')) sticky[k] = params[k];
  for (const a of document.querySelectorAll('#bar [data-view]')) {
    const id = a.dataset.view;
    a.setAttribute('href', (demo ? 'index.html' : '') + buildHash(id, sticky));
    if (a.closest('#nav')) { if (id === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }
  const r = ROUTES.find(x => x.id === route);
  document.title = `VESTA · ${r ? r.label : 'Brief'}`;
  if (document.documentElement.dataset.phone === 'true' && stage.dataset.route !== route) {
    document.getElementById('viewport').scrollTop = 0;
    const active = nav.querySelector('[aria-current="page"]');
    if (active) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }
  stage.dataset.route = route;
}
function paintBuilt() {
  const at = db && ((db.meta && db.meta.generated_at) || (db.engine && db.engine.generated_at));
  const text = at ? fmt.est(at) : '';
  document.getElementById('built').textContent = text ? `built ${text}` : '';
}
function readQ(params) {
  const q = core.index && typeof core.index.designPoint === 'function' ? core.index.designPoint(params, db) : readQLocal(params, db);
  const wanted = params.preset || 'lunar-base';
  return { ...q, preset_ok: wanted === 'custom' || !!(db && db.presetById && db.presetById[wanted]) };
}
function current() { return parseHash(location.hash); }
function commit(route, params, opts = {}) {
  const hash = buildHash(route, params);
  write(hash, { replace: opts.replace || opts.render === false });
  if (opts.render === false) {
    const split = splitParams(params);
    if (worldHandle && worldContext) { worldContext = { ...worldContext, q: readQ(params), params, route }; worldHandle.update(worldContext); }
    if (mounted.ctx && mounted.route === route) { mounted.ctx.q = readQ(params); mounted.ctx.params = split.own; mounted.sig = split.sig; }
    paintChrome(route, params);
  } else render();
}
function splitParams(params) {
  const own = {}, shared = {};
  for (const [k, v] of Object.entries(params)) { if (SHARED.includes(k)) shared[k] = v; else if (!GLOBAL.includes(k)) own[k] = v; }
  return { own, shared, sig: JSON.stringify([Object.entries(shared).sort(), Object.entries(own).sort()]) };
}
const setQ = (patch, opts) => { const c = current(); commit(c.route, patchQ(c.params, patch || {}, readQ(c.params)), opts); };
const setParams = (patch, opts) => {
  const c = current(), next = { ...c.params };
  for (const [k, v] of Object.entries(patch || {})) { if (v == null || v === '' || v === false) delete next[k]; else next[k] = v === true ? '1' : String(v); }
  commit(c.route, next, opts);
};
const go = (target, opts = {}) => { const hash = withSticky(String(target), current().params); write(hash, opts); render(); };
function unmount() {
  const h = mounted.handle;
  mounted.handle = null; mounted.ctx = null;
  try { if (typeof h === 'function') h(); else if (h && typeof h.unmount === 'function') h.unmount(); }
  catch (e) { console.error('VESTA: unmount failed', e); }
  clear(view); view.removeAttribute('style'); view.className = ''; view.scrollTop = 0;
}
function placeholder(text = PLACEHOLDER) { clear(view); view.append(el('div.view-placeholder', empty('placeholder', text))); }

async function mount(route, ctx, token) {
  view.dataset.view = route;
  const file = ROUTES.find(r => r.id === route).file;
  let mod = null;
  try { mod = await import(`./views/${file}?v=11`); }
  catch (e) { console.warn(`VESTA: views/${file} did not load: ${e && e.message}`); }
  if (token !== mounted.token) return;
  if (!mod || typeof mod.mount !== 'function') { placeholder(); return; }
  try {
    mounted.handle = mod.mount(view, ctx) || null;
    if (view.childNodes.length === 1 && view.firstChild.nodeType === 3 && view.textContent === PLACEHOLDER) placeholder();
  } catch (e) {
    console.error(`VESTA: views/${file} failed in mount`, e);
    placeholder('This view stopped with an error. Nothing is shown without its source.');
  }
}

function render() {
  if (!db) return;
  const { route, params } = current();
  const split = splitParams(params);
  const q = readQ(params);
  paintChrome(route, params);
  if (demo) {
    if (!mounted.ctx || mounted.sig !== split.sig) {
      mounted.ctx = { db, q };
      mounted.sig = split.sig;
      paintDemo(q);
    }
    if (params.src) drawer.show(params.src); else drawer.hide();
    return;
  }
  const wantsWorld = params.view !== 'details' && params.still !== '1';
  if (wantsWorld) {
    worldContext = { db, q, params, route, setQ, setParams, go, openSource, closeSource, ui, core, capture };
    if (worldHandle) worldHandle.update(worldContext);
    else if (!worldPending) {
      unmount();
      const serial = ++worldSerial;
      worldAbort = new AbortController();
      worldPending = createWorld(view, { ...worldContext, signal: worldAbort.signal }).then(handle => {
        if (serial !== worldSerial) { handle?.unmount(); return; }
        worldHandle = handle; worldPending = null;
        if (worldHandle && worldContext) worldHandle.update(worldContext);
      }).catch(error => { worldAbort?.abort(); worldPending = null; console.warn('VESTA world unavailable:', error.message); setParams({ view: 'details' }, { replace: true }); });
    }
    if (params.src) drawer.show(params.src); else drawer.hide();
    return;
  }
  if (worldHandle || worldPending) {
    worldSerial++; worldAbort?.abort(); worldHandle?.unmount(); worldHandle = null; worldPending = null;
    delete document.documentElement.dataset.world;
    worldContext = null; mounted.route = null; mounted.sig = null;
    unmount();
  }
  if (mounted.route !== route || mounted.sig !== split.sig) {
    const h = mounted.handle, same = mounted.route === route && mounted.ctx && mounted.ctx.view === (params.view === 'details' ? 'details' : 'simple');
    if (same && h && typeof h === 'object' && typeof h.update === 'function') {
      Object.assign(mounted.ctx, { q, params: split.own, view: params.view === 'details' ? 'details' : 'simple' }); mounted.sig = split.sig;
      try { h.update(mounted.ctx); } catch (e) { console.error('VESTA: update failed', e); }
    } else {
      unmount();
      const token = ++mounted.token;
      const ctx = { db, q, view: params.view === 'details' ? 'details' : 'simple', params: split.own, route, setQ, setParams, go, openSource, closeSource, ui, core, capture, sceneHost: document.getElementById('scene-host') };
      mounted = { route, sig: split.sig, handle: null, ctx, token };
      mount(route, ctx, token);
    }
  }
  if (params.src) drawer.show(params.src); else drawer.hide();
}
setOpener(id => {
  const c = current(), next = { ...c.params };
  if (id == null) delete next.src; else next.src = id;
  write(buildHash(c.route, next));
  render();
});
async function loadTour() {
  let mod = null;
  try { mod = await import('./tour.js'); } catch (e) { console.warn('VESTA: tour.js did not load: ' + (e && e.message)); return; }
  const begin = mod.start || mod.default;
  if (typeof begin !== 'function') { console.warn('VESTA: tour.js has no start()'); return; }
  const api = { db, go, stops: db.tour, capture, stage, ui, get world() { return worldHandle; } };
  const btn = document.querySelector('#bar-actions [data-action="tour"]');
  if (btn && typeof mod.install !== 'function') btn.addEventListener('click', () => begin(api));
  if (typeof mod.install !== 'function' && current().params.tour === '1') begin(api);
}
async function fontsReady() {
  const link = document.getElementById('display-font');
  if (link) {
    const enable = () => { link.media = 'all'; link.dataset.loaded = '1'; };
    link.addEventListener('load', enable, { once: true });
    link.addEventListener('error', () => { link.dataset.loaded = '0'; }, { once: true });
    if (link.sheet) enable();
  }
  const linkDone = !link || link.dataset.loaded != null ? Promise.resolve() : new Promise(res => { link.addEventListener('load', res, { once: true }); link.addEventListener('error', res, { once: true }); });
  const cap = ms => new Promise(res => setTimeout(res, ms));
  await Promise.race([linkDone, cap(1500)]);
  if (document.fonts && document.fonts.load) {
    const want = ['400 18px "Source Sans 3"', '600 18px "Source Sans 3"', '600 26px "Barlow Condensed"', '700 28px "Barlow Condensed"', '400 15px "IBM Plex Mono"'];
    await Promise.race([Promise.all(want.map(f => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready), cap(2500)]);
  }
}
function showFailure(err) {
  console.warn('VESTA: evidence files did not load: ' + (err && err.message));
  stage.dataset.state = 'failed';
  drawer.hide();
  unmount();
  mounted.route = null;
  mounted.sig = null;
  const old = document.getElementById('fail'); if (old) old.remove();
  stage.append(el('div#fail', panel(null, empty('load', 'Evidence files did not load. Nothing is shown without its source.', { label: 'Retry', action: 'retry', onClick: () => start() }), { strong: true, class: 'fail-panel' })));
}

function paintDemo(q) {
  clear(view);
  view.dataset.view = 'ui-demo';
  view.className = 'ui-demo';
  const stack = (...children) => el('div.demo-stack', children);
  const row = (...children) => el('div.demo-row', children);
  const f = db.findingById['S-VENT-01'] || db.findings[0];
  const rule = db.rules.find(r => r.finding_ids.some(id => db.findingById[id]));
  const test = db.tests.find(r => r.o2_percent != null && r.o2_raw != null);
  const telemetry = db.scenario?.frames || [];
  const last = telemetry[telemetry.length - 1];
  const score = f && core.rank?.score(f, q, db);
  const explanations = score && core.text?.terms ? Object.fromEntries(core.text.terms({ f, ...score }, q).map(term => [term.key, term.sentence])) : {};
  view.append(
    el('header.demo-heading', el('h1.t-display-2', 'The VESTA component system'), tag('Component specimens'), el('p.t-small.t-dim', 'Evidence examples read the same files as the six views.')),
    panel('Coverage and basis', stack(
      row(chip('PROVEN'), chip('PROVEN', { qualifier: 'pressure_inferred' })),
      row(chip('EXTRAPOLATED'), chip('NEVER_TESTED')),
      row(chip('SOURCED'), chip('NO_SOURCE'), chip('SIMULATED')),
      row(chip('INTERPRETATION'), chip('SI'), tag('NASA PSI')),
      reason('o2_not_reported'), statusLine(db)), { class: 'demo-status' }),
    panel('VESTA, three poses', row(...['alert', 'point', 'nosource'].map(pose => stack(vesta(pose, { size: 114 }), tag(pose)))), { class: 'demo-poses' }),
    panel('Sources and actions', stack(
      f ? row(cite(f.id), button('Open source', { onClick: () => openSource(f.id) })) : empty('none', 'No verified finding yet.'),
      row(button('Primary action', { primary: true, small: true, onClick: () => openSource(f?.id) }), button('Disabled', { disabled: true, small: true })),
      row(button('Export evidence JSON', { action: 'export-json', small: true, disabled: !f, onClick: () => downloadJson('vesta-finding.json', f) }),
        button('Export text', { small: true, disabled: !f, onClick: () => downloadText('vesta-quote.txt', f.quote || '') })),
      tag('VESTA · interpretation')), { class: 'demo-actions' }),
    panel('Earth instinct / NASA showed / VESTA decides', rule ? triad(rule, db, { strikeAfter: 0, compact: true, limits: true }) : empty('none', 'No verified rule yet. Rules appear when their quotes pass the gate.'), { strong: true, class: 'demo-triad' }),
    panel('Six score terms', score ? stack(cite(f.id), scorebar(score, { sentences: explanations }), el('p.t-small.t-dim', core.text?.CHOICES || ''), row(...Object.keys(score.parts).map(k => tag(k)))) : empty('none', 'No verified finding yet.')),
    panel('Range and raw value', test ? stack(cite(test.id), el('p.t-small', { title: test.o2_raw }, `Oxygen: ${fmt.pct(test.o2_percent)} · raw: ${test.o2_raw}`), rangebar(test.o2_percent, test.o2_percent, 0, 100, { unit: '%' }), rangebar(null, null, 0, 100), tag('Missing values stay explicit')) : empty('none', 'No test row with an oxygen value.')),
    panel('Telemetry and empty state', stack(chip('SIMULATED'), telemetry.length ? spark(telemetry.map(fr => [fr.t, fr.smoke_pct_alarm]), last.t, { width: 490, height: 46, label: 'Scripted smoke telemetry, percent of alarm' }) : null, empty('feed', 'Feed unavailable. The evidence base is unaffected.')))
  );
}
async function start() {
  stage.dataset.state = 'loading';
  const old = document.getElementById('fail'); if (old) old.remove();
  try { db = await loadDb(); } catch (e) { db = null; showFailure(e); return; }
  core = getCore();
  useText(core.text);
  stage.dataset.state = 'ready';
  paintBuilt();
  render();
  if (capture && worldPending) await worldPending;
  if (!demo && !start.tourLoaded) { start.tourLoaded = true; loadTour(); }
}

buildChrome();
paintChrome(first.route, first.params);
initStage(stage);
drawer.mount(stage);
addEventListener('hashchange', render);
window.vesta = { ui, go, setQ, setParams, get db() { return getDb(); }, get core() { return getCore(); }, get ctx() { return worldContext || mounted.ctx; }, get world() { return worldHandle; } };

const ready = () => document.documentElement.setAttribute('data-ready', '');
if (capture) Promise.all([start(), fontsReady()]).then(ready, ready);
else { ready(); start(); fontsReady(); }
