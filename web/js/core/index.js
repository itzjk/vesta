export const CONCERNS = ['prevention', 'detection', 'suppression'];

export const G = {
  '0g':   { gclass: 'micro',   label: '0 g' },
  'moon': { gclass: 'partial', label: '1/6 g' },
  'mars': { gclass: 'partial', label: '3/8 g' },
  '1g':   { gclass: 'normal',  label: '1 g' },
};

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const list = (x, ...keys) => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') for (const k of keys) if (Array.isArray(x[k])) return x[k];
  return [];
};
const byKey = (arr, key) => { const o = Object.create(null); for (const x of arr) if (x && x[key] != null) o[x[key]] = x; return o; };
const group = (arr, keyOf) => { const o = Object.create(null); for (const x of arr) { const k = keyOf(x); if (k != null) (o[k] ||= []).push(x); } return o; };

export function buildIndex(raw = {}) {
  const tests = list(raw.tests, 'tests', 'rows');
  const findings = list(raw.findings, 'findings');
  for (const r of tests) if (!r || !r.n) throw new Error(`core/index: test row ${r && r.id} has no "n" (run tools/build.mjs; the normaliser adds it)`);
  for (const f of findings) if (!f || !f.n) throw new Error(`core/index: finding ${f && f.id} has no "n" (run tools/build.mjs; the normaliser adds it)`);

  const investigations = list(raw.investigations, 'investigations');
  const tables = list(raw.tables, 'tables');
  const summaries = list(raw.summaries, 'summaries').length ? list(raw.summaries, 'summaries')
                  : list(raw.tests && raw.tests.summaries).length ? raw.tests.summaries
                  : list(raw.tables && raw.tables.summaries);
  const rules = list(raw.rules, 'rules');
  const sources = list(raw.sources, 'sources');

  const pr = raw.presets ?? {};
  const allP = Array.isArray(pr) ? pr : [...list(pr.presets), ...list(pr.markers), ...list(pr.bands)];
  const kindOf = (x, fallback) => x.kind ?? fallback;
  const presets = Array.isArray(pr) ? pr.filter(x => kindOf(x, 'preset') === 'preset') : list(pr.presets).filter(x => kindOf(x, 'preset') === 'preset');
  const markers = Array.isArray(pr) ? pr.filter(x => x.kind === 'marker') : [...list(pr.markers), ...list(pr.presets).filter(x => x.kind === 'marker')];
  const bands   = Array.isArray(pr) ? pr.filter(x => x.kind === 'band')   : [...list(pr.bands),   ...list(pr.presets).filter(x => x.kind === 'band')];

  const protocol = list(raw.protocol, 'protocol', 'lines', 'steps');
  const pb = raw.playbook;
  const playbook = Array.isArray(pb) ? { steps: pb } : { ...(pb ?? {}), steps: list(pb, 'steps') };

  const sc = raw.scenario ?? null;
  let scenario = null;
  if (sc && 'meta' in sc) scenario = sc.meta ? { ...sc, meta: sc.meta, frames: list(sc.frames) } : null;
  else if (sc) { const { frames, ...meta } = sc; scenario = { meta: Array.isArray(frames) ? meta : sc, frames: list(frames) }; }

  const counting = tests.filter(r => r.n.counts);
  const rowsByPsi = group(tests, r => r.psi_id);
  const rowsByMaterial = group(counting, r => r.n.material_id);
  const cabinRows = counting.filter(r => r.n.cabin);
  const modelRows = counting.filter(r => !r.n.cabin && r.n.o2 != null);

  const mat = Object.create(null);
  for (const r of cabinRows) {
    const id = r.n.material_id; if (id == null) continue;
    const m = (mat[id] ||= { rows: 0, labels: Object.create(null), classes: Object.create(null) });
    m.rows++; const label = r.fuel ?? id; m.labels[label] = (m.labels[label] || 0) + 1;
    if (r.n.fuel_class != null) m.classes[r.n.fuel_class] = (m.classes[r.n.fuel_class] || 0) + 1;
  }
  const most = o => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const materials = {};
  for (const id of Object.keys(mat).sort((a, b) => mat[b].rows - mat[a].rows || a.localeCompare(b))) {
    const classes = most(mat[id].classes);
    materials[id] = { label: most(mat[id].labels)[0][0], fuel_class: classes.length ? classes[0][0] : null, rows: mat[id].rows, fuel_classes: classes.map(c => c[0]) };
  }

  const pillarsByMaterial = Object.create(null);
  for (const id of Object.keys(rowsByMaterial)) {
    const seen = new Set(); for (const r of rowsByMaterial[id]) for (const p of r.n.pillars ?? []) seen.add(p);
    pillarsByMaterial[id] = [...CONCERNS.filter(c => seen.has(c)), ...[...seen].filter(p => !CONCERNS.includes(p)).sort()];
  }

  return {
    meta: raw.meta ?? null,
    investigations, invById: byKey(investigations, 'psi_id'),
    excluded: list(raw.investigations && raw.investigations.excluded), related: list(raw.investigations && raw.investigations.related),
    tests, testById: byKey(tests, 'id'), tables, summariesByPsi: byKey(summaries, 'psi_id'),
    findings, findingById: byKey(findings, 'id'),
    rules, ruleById: byKey(rules, 'id'),
    sources, sourceByKey: byKey(sources, 'key'),
    presets, presetById: byKey(presets, 'id'), markers, bands, presetsAll: allP,
    protocol, protocolById: byKey(protocol, 'id'),
    playbook, scenario, lines: raw.lines ?? {}, tour: raw.tour ?? null, engine: raw.engine ?? null,
    rowsByPsi, rowsByMaterial, cabinRows, modelRows, materials, pillarsByMaterial,
    base: { partial_rows: tests.filter(r => r.n.gclass === 'partial').length },
  };
}

export function withoutFindings(db, ids) {
  const drop = new Set(ids), findings = db.findings.filter(f => !drop.has(f.id));
  return { ...db, findings, findingById: byKey(findings, 'id') };
}

export function presetPoint(db, presetId, concern = 'prevention', material = null) {
  const p = db.presetById[presetId];
  if (!p) return null;
  return { preset: p.id, habitat: p.habitat ?? null, concern, o2: p.o2, p: p.p_kpa, g: p.g ?? null,
           gclass: p.gclass ?? G[p.g]?.gclass ?? null, g_label: p.g_display ?? G[p.g]?.label ?? null, material: material || null };
}

export const DEFAULTS = { preset: 'lunar-base', concern: 'prevention', mat: 'pmma' };
export function designPoint(params = {}, db) {
  const concern  = CONCERNS.includes(params.concern) ? params.concern : DEFAULTS.concern;
  const material = params.mat === undefined ? DEFAULTS.mat : (params.mat ? slug(params.mat) : null);
  const wanted   = params.preset || DEFAULTS.preset;
  const named    = wanted !== 'custom' ? presetPoint(db, wanted, concern, material) : null;
  if (named) return { ...named, preset_wanted: wanted };
  const base = presetPoint(db, DEFAULTS.preset, concern, material) ?? (db.presets[0] ? presetPoint(db, db.presets[0].id, concern, material) : null);
  if (wanted !== 'custom' && base) return { ...base, preset_wanted: wanted };
  const num = v => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const g = G[params.g] ? params.g : base?.g ?? null;
  return { preset: wanted, habitat: params.hab ?? params.habitat ?? null, concern, o2: num(params.o2) ?? base?.o2 ?? null, p: num(params.p) ?? base?.p ?? null,
           g, gclass: G[g]?.gclass ?? base?.gclass ?? null, g_label: G[g]?.label ?? base?.g_label ?? null, material, preset_wanted: wanted };
}
