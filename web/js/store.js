export const FILES = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'tour', 'engine'];
export const CORE = ['match', 'status', 'rank', 'officer', 'clock', 'text', 'csv', 'index'];

let db = null, core = {}, opener = null, rawCells = null;

async function getJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  try { return await res.json(); } catch (e) { throw new Error(`${path}: not JSON`); }
}


export async function loadCore() {
  const mods = await Promise.all(CORE.map(name => import(`./core/${name}.js`).then(m => [name, m], () => [name, undefined])));
  core = Object.fromEntries(mods);
  const missing = CORE.filter(n => !core[n]);
  if (missing.length) console.warn('VESTA: core modules not loaded: ' + missing.join(', '));
  return core;
}
export const getCore = () => core;

export async function loadDb() {
  db = null;
  rawCells = null;
  const [values] = await Promise.all([Promise.all(FILES.map(name => getJson(`data/${name}.json`))), loadCore()]);
  const raw = Object.fromEntries(FILES.map((name, i) => [name, values[i]]));
  if (!core.index || typeof core.index.buildIndex !== 'function') throw new Error('js/core/index.js: buildIndex is not available');
  db = core.index.buildIndex(raw);
  if (!db || typeof db !== 'object') throw new Error('buildIndex returned nothing');
  return db;
}
export const getDb = () => db;


export function loadRawCells() {
  if (!rawCells) rawCells = getJson('data/tests-raw.json').catch(e => { rawCells = null; throw e; });
  return rawCells;
}


export function setOpener(fn) { opener = fn; }

export function openSource(id) { if (opener && id != null) opener(String(id)); }
export function closeSource() { if (opener) opener(null); }


export function lookup(id, d = db) {
  if (!d || id == null) return null;
  const f = d.findingById && d.findingById[id];
  if (f) return { kind: 'finding', finding: f };
  const config = (d.presetsAll || [...(d.presets || []), ...(d.markers || []), ...(d.bands || [])]).find(record => record.id === id);
  if (config) return { kind: 'config', record: config };
  let row = (d.rowById && d.rowById[id]) || (d.testById && d.testById[id]) || null;
  if (!row && Array.isArray(d.tests)) {
    if (!d.__rowById) { const m = new Map(); for (const r of d.tests) m.set(r.id, r); Object.defineProperty(d, '__rowById', { value: m, enumerable: false }); }
    row = d.__rowById.get(id) || null;
  }
  return row ? { kind: 'row', row } : null;
}
