// Hash routes. All state is in the hash: #/<route>?key=value&...   (DESIGN.md section 2). Relative URLs only.
export const ROUTES = [
  { id: 'brief',          label: 'Brief',                 n: null, file: 'brief.js' },
  { id: 'investigations', label: 'Summarize',             n: 1,    file: 'investigations.js' },
  { id: 'design',         label: 'Rank · Design',        n: 2,    file: 'design.js' },
  { id: 'incident',       label: 'Interpret · Incident', n: 3,    file: 'incident.js' },
  { id: 'engine',         label: 'Engine',                n: null, file: 'engine.js' },
  { id: 'open',           label: 'Open data',             n: null, file: 'open.js' },
];
export const DEFAULT_ROUTE = 'brief';
export const SHARED = ['preset', 'o2', 'p', 'g', 'hab', 'concern', 'mat'];      // the design point, kept across routes
export const GLOBAL = ['src', 'tour', 'capture'];                              // read by the shell, never by a view
export const STICKY = [...SHARED, 'capture', 'view'];                                  // carried along by go()
export const Q_DEFAULT = { preset: 'lunar-base', concern: 'prevention', mat: 'pmma' };
export const CONCERNS = ['prevention', 'detection', 'suppression'];
export const GRAVITY = {                                                       // printed as the sources print it; no decimals
  '0g':   { gclass: 'micro',   g_label: '0 g' },
  'moon': { gclass: 'partial', g_label: '1/6 g' },
  'mars': { gclass: 'partial', g_label: '3/8 g' },
  '1g':   { gclass: 'normal',  g_label: '1 g' },
};

const dec = s => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };
const enc = s => encodeURIComponent(String(s)).replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%2F/gi, '/');

export function parseHash(hash = location.hash) {
  const h = String(hash || '').replace(/^#\/?/, '');
  const i = h.indexOf('?');
  const name = (i < 0 ? h : h.slice(0, i)).replace(/\/+$/, '');
  const params = {};
  if (i >= 0) for (const pair of h.slice(i + 1).split('&')) {
    if (!pair) continue;
    const j = pair.indexOf('=');
    params[dec(j < 0 ? pair : pair.slice(0, j))] = j < 0 ? '' : dec(pair.slice(j + 1));
  }
  const known = ROUTES.some(r => r.id === name);
  return { route: known ? name : DEFAULT_ROUTE, known: known || name === '', params };
}

export function buildHash(route, params = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'mat' && v === '') parts.push('mat=');                             // an empty material is a choice, not a default
    else if (v != null && v !== '' && v !== false) parts.push(enc(k) + '=' + enc(v === true ? 1 : v));
  }
  return '#/' + route + (parts.length ? '?' + parts.join('&') : '');
}

const num = s => { if (s == null || s === '') return null; const x = Number(s); return isFinite(x) ? x : null; };

/** The shared design point q of section 3.1, read from the hash and the shipped presets. */
export function readQ(params, db) {
  const presets = (db && db.presetById) || {};
  const id = params.preset || Q_DEFAULT.preset;
  const preset = presets[id] && (presets[id].kind == null || presets[id].kind === 'preset') ? presets[id] : null;
  const custom = id === 'custom';
  const gKey = (custom || !preset ? params.g : null) || (preset && preset.g) || params.g || null;
  const g = GRAVITY[gKey] || null;
  const o2 = (custom || !preset ? num(params.o2) : null) ?? (preset ? preset.o2 : null) ?? num(params.o2);
  const p  = (custom || !preset ? num(params.p)  : null) ?? (preset ? preset.p_kpa : null) ?? num(params.p);
  const concern = CONCERNS.includes(params.concern) ? params.concern : Q_DEFAULT.concern;
  const mat = params.mat === undefined ? Q_DEFAULT.mat : params.mat;
  return {
    habitat: custom ? (params.hab || null) : preset ? (preset.habitat ?? preset.id) : null,
    concern, o2, p,
    gclass: g ? g.gclass : (preset && preset.gclass) || null,
    g_label: g ? g.g_label : (preset && preset.g_display) || null,
    material: mat || null,
    preset: id, g: gKey, preset_ok: custom || !!preset,
  };
}

/** The hash keys that a setQ patch produces from the current ones. */
export function patchQ(params, patch, cur) {
  const next = { ...params };
  const p = { ...patch };
  if ('material' in p) { p.mat = p.material; delete p.material; }
  if ('habitat' in p) { p.hab = p.habitat; delete p.habitat; }
  if ('g_label' in p || 'gclass' in p) { delete p.g_label; delete p.gclass; }
  const moved = ['o2', 'p', 'g'].some(k => k in p && p[k] != null && p[k] !== '');
  if ('preset' in p && p.preset && p.preset !== 'custom') { for (const k of ['o2', 'p', 'g', 'hab']) if (!(k in p)) delete next[k]; }
  else if (moved || p.preset === 'custom') {
    if (cur.preset !== 'custom') { next.o2 = cur.o2; next.p = cur.p; next.g = cur.g; next.hab = cur.habitat; }
    p.preset = 'custom';
  }
  for (const [k, v] of Object.entries(p)) { if (v == null || v === '') { if (k === 'mat') next.mat = ''; else delete next[k]; } else next[k] = v; }
  if (next.preset == null) next.preset = cur.preset;
  if (next.concern == null) next.concern = cur.concern;
  return next;
}

/** Merge a target hash with the keys that travel between routes. */
export function withSticky(target, current) {
  const t = parseHash(target), out = {};
  for (const k of STICKY) if (current[k] != null && (current[k] !== '' || k === 'mat')) out[k] = current[k];
  return buildHash(t.route, { ...out, ...t.params });
}

export function write(hash, { replace = false } = {}) {
  if (hash === location.hash) return false;
  if (replace) history.replaceState(null, '', hash); else location.hash = hash;
  return true;
}
