#!/usr/bin/env node
// VESTA MCP server: lets any SI assistant query the same evidence the dashboard shows.
// stdio transport, newline-delimited JSON-RPC 2.0, Node 20 or newer, no packages.
//
//   node mcp/server.mjs                      reads web/data/*.json from this repository
//   node mcp/server.mjs --base <site url>    reads data/*.json from a deployed copy of the site
//   node mcp/server.mjs --data <folder>      reads the evidence files from another folder
//
// The ranking, the statuses and the words come from web/js/core/*.js, the same modules the
// browser loads, so the server and the screen cannot disagree. Nothing is generated here:
// every answer is a lookup or a computation over verified findings and PSI test rows.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CORE = path.join(ROOT, 'web/js/core');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const BASE = opt('base', null);
const DATA = path.resolve(opt('data', path.join(ROOT, 'web/data')));

export const SERVER = { name: 'vesta', version: '1.0.0' };
export const SCOPE = 'decision-support prototype, not certified flight software';
export const NO_SOURCE = "No verified finding in VESTA's evidence base. VESTA does not answer without a source.";
const NOTE = 'status = evidence coverage, not a safety certification';
// The files store.js loads, in the same order; buildIndex(raw) gets them under the same names.
const FILES = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'tour', 'engine'];
const GRAVITY = { '0g': { gclass: 'micro', label: '0 g' }, moon: { gclass: 'partial', label: '1/6 g' }, mars: { gclass: 'partial', label: '3/8 g' }, '1g': { gclass: 'normal', label: '1 g' } };
const CONCERNS = ['prevention', 'detection', 'suppression'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- loading
async function readFile(name) {
  if (BASE) {
    const url = new URL(`data/${name}.json`, BASE.endsWith('/') ? BASE : BASE + '/');
    const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'vesta-mcp/1' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8'));
}
const core = async (name) => import(pathToFileURL(path.join(CORE, name + '.js')).href);

let state = null;                                   // { db, rank, status, text } once loaded
async function load() {
  if (state) return state;
  const raw = {};
  for (const name of FILES) {
    try { raw[name] = await readFile(name); }
    catch (e) {                                       // the message names the file, never a local path
      if (['findings', 'tests', 'presets'].includes(name)) throw new Error(`Evidence files did not load (${name}.json: ${e.code === 'ENOENT' ? 'not found' : e.code || 'unreadable'}). Nothing is answered without its source.`);
      raw[name] = null;
    }
  }
  const [index, rank, status, text] = await Promise.all([core('index'), core('rank'), core('status'), core('text').catch(() => null)]);
  state = { db: index.buildIndex(raw), rank, status, text };
  return state;
}
let rawCells = null;                                // row id -> raw cells, read on first use (it is the heavy file)
async function rawOf(id) {
  if (!rawCells) { try { rawCells = await readFile('tests-raw'); } catch { rawCells = {}; } }
  const t = rawCells.rows || rawCells.tests || rawCells;
  return t[id] ?? null;
}

// ---------------------------------------------------------------- helpers
class BadInput extends Error {}
const need = (cond, msg) => { if (!cond) throw new BadInput(msg); };
const num = (v, name) => { need(typeof v === 'number' && Number.isFinite(v), `${name} must be a number`); return v; };
const limitOf = (v, d) => (v == null ? d : Math.max(1, Math.min(100, Math.floor(num(v, 'limit')))));
const kindOf = (f) => f.kind ?? (f.source?.kind === 'psi-table' || f.cells ? 'table' : 'quote');
const noSource = (extra = {}) => ({ no_source: true, message: NO_SOURCE, ...extra });
const presetsOf = (db) => (Array.isArray(db.presets) ? db.presets : Object.values(db.presetById || {})).filter((p) => (p.kind ?? 'preset') === 'preset');

function brief(f) {
  const o = { id: f.id, kind: kindOf(f), investigation: f.investigation ?? null, pillar: f.pillar, topic: f.topic, claim: f.claim };
  if (f.quote) o.quote = f.quote;
  if (f.cells) o.cells = f.cells;
  return { ...o, work: f.n?.work ?? null, read_in: f.n?.read_in ?? null, url: f.source?.url ?? null };
}
function ranked(x, i, q, s) {
  const st = s.status.findingStatus(x.f, q, s.db, { fuel_class: q.material ? s.db.materials?.[q.material]?.fuel_class : undefined });
  const o = { rank: i + 1, id: x.f.id, total: x.total, parts: x.parts, status: st.status, reasons: st.reasons, work: x.f.n?.work ?? null, read_in: x.f.n?.read_in ?? null, claim: x.f.claim };
  if (x.f.quote) o.quote = x.f.quote;
  if (x.f.cells) o.cells = x.f.cells;
  return { ...o, url: x.f.source?.url ?? null };
}
function legend(s) {
  let L = null; try { L = s.text?.legend?.(s.db); } catch { /* fall through */ }
  const say = (id) => (L && typeof L[id] === 'string' ? L[id] : s.text?.status?.(id) ?? id.replace('_', ' '));
  return { PROVEN: say('PROVEN'), EXTRAPOLATED: say('EXTRAPOLATED'), NEVER_TESTED: say('NEVER_TESTED') };
}

// ---------------------------------------------------------------- tools
export const TOOLS = [
  { name: 'search_evidence',
    description: "Search VESTA's verified findings (verbatim NASA quotes and PSI table findings) on spacecraft fire safety. Every word of `query` must appear in the claim or the quote. Returns no_source when nothing matches; VESTA never answers without a source.",
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      query: { type: 'string', description: 'Words that must all appear in the claim or the quote.' },
      pillar: { type: 'string', enum: ['prevention', 'detection', 'suppression', 'design', 'response'] },
      topic: { type: 'string', description: 'Exact topic id, for example ventilation_flow.' },
      investigation: { type: 'string', description: 'Investigation name or PSI id, for example BASS-II or PSI-25.' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 } } },
    async run(a, s) {
      const words = String(a.query ?? '').toLowerCase().split(/\s+/).filter(Boolean), inv = a.investigation ? String(a.investigation).toLowerCase() : null;
      const hits = s.db.findings.filter((f) => {
        if (a.pillar && f.pillar !== a.pillar) return false;
        if (a.topic && f.topic !== a.topic) return false;
        if (inv && String(f.investigation ?? '').toLowerCase() !== inv && String(f.n?.psi_id ?? '').toLowerCase() !== inv) return false;
        const hay = `${f.claim ?? ''} ${f.quote ?? ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      if (!hits.length) return noSource({ count: 0, results: [] });
      return { count: hits.length, results: hits.slice(0, limitOf(a.limit, 10)).map(brief) };
    } },
  { name: 'rank_evidence',
    description: 'Rank the verified findings for a cabin and a concern with the published VESTA score (pillar 30, atmosphere 25, gravity 15, level 15, material 10, habitat 5). Each result carries its score parts, its coverage status at that cabin (PROVEN or EXTRAPOLATED) and the reasons. Oxygen, pressure and gravity default to the preset of the habitat.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['habitat', 'concern'], properties: {
      habitat: { type: 'string', description: 'A preset id: station, spacecraft, lunar-base, rover or mars-base.' },
      concern: { type: 'string', enum: CONCERNS },
      o2_percent: { type: 'number', description: 'Cabin oxygen, percent by volume.' },
      pressure_kpa: { type: 'number', description: 'Cabin pressure in kPa (1 psi = 6.89476 kPa).' },
      gravity: { type: 'string', enum: Object.keys(GRAVITY), description: '0g, moon (1/6 g), mars (3/8 g) or 1g.' },
      material: { type: 'string', description: 'A material id as PSI names it, for example pmma, sibal, nomex, kapton.' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 } } },
    async run(a, s) {
      const presets = presetsOf(s.db), p = presets.find((x) => x.id === a.habitat || x.habitat === a.habitat);
      need(p, `habitat must be one of: ${presets.map((x) => x.id).join(', ')}`);
      need(CONCERNS.includes(a.concern), `concern must be one of: ${CONCERNS.join(', ')}`);
      if (a.gravity != null) need(GRAVITY[a.gravity], 'gravity must be one of: 0g, moon, mars, 1g');
      const g = a.gravity ? GRAVITY[a.gravity] : { gclass: p.gclass, label: p.g_display };
      const q = { habitat: p.habitat ?? p.id, concern: a.concern, o2: a.o2_percent == null ? p.o2 : num(a.o2_percent, 'o2_percent'),
        p: a.pressure_kpa == null ? p.p_kpa : num(a.pressure_kpa, 'pressure_kpa'), gclass: g.gclass, g_label: g.label, material: a.material ? slug(a.material) : null };
      const rows = s.rank.rank(s.db.findings, q, s.db).slice(0, limitOf(a.limit, 10)).map((x, i) => ranked(x, i, q, s));
      const query = { preset: a.o2_percent == null && a.pressure_kpa == null && a.gravity == null ? p.id : 'custom', habitat: q.habitat, concern: q.concern,
        o2: q.o2, p_kpa: q.p, gclass: q.gclass, g_display: q.g_label, material: q.material };
      if (!rows.length) return noSource({ query, weights: s.rank.W, results: [] });
      return { query, weights: s.rank.W, results: rows };
    } },
  { name: 'check_design',
    description: "Place a cabin (oxygen, pressure, gravity) on the map of what is in VESTA's evidence base (24 PSI investigations). Returns, per axis, how many cabin-material test rows sit at that value, and one cell per material and concern marked PROVEN (tested at these conditions), EXTRAPOLATED (evidence exists, a condition differs) or NEVER_TESTED, with reasons and the nearest test. Status is evidence coverage, not a safety certification.",
    inputSchema: { type: 'object', additionalProperties: false, required: ['o2_percent', 'pressure_kpa', 'gravity'], properties: {
      o2_percent: { type: 'number' }, pressure_kpa: { type: 'number' },
      gravity: { type: 'string', enum: Object.keys(GRAVITY) },
      materials: { type: 'array', items: { type: 'string' }, description: 'Material ids; default: every material of the cabin tables.' },
      concern: { type: 'string', enum: CONCERNS, description: 'Default: all three.' } } },
    async run(a, s) {
      need(GRAVITY[a.gravity], 'gravity must be one of: 0g, moon, mars, 1g');
      if (a.concern != null) need(CONCERNS.includes(a.concern), `concern must be one of: ${CONCERNS.join(', ')}`);
      if (a.materials != null) need(Array.isArray(a.materials), 'materials must be a list of material ids');
      const g = GRAVITY[a.gravity], known = Object.keys(s.db.materials || {});
      const q = { habitat: null, concern: a.concern ?? 'prevention', o2: num(a.o2_percent, 'o2_percent'), p: num(a.pressure_kpa, 'pressure_kpa'), gclass: g.gclass, g_label: g.label, material: null };
      const mats = a.materials?.length ? a.materials.map(slug) : known, concerns = a.concern ? [a.concern] : CONCERNS, cells = [];
      for (const m of mats) for (const c of concerns) cells.push(s.status.cell(m, c, { ...q, concern: c, material: m }, s.db));
      const out = { query: { o2: q.o2, p_kpa: q.p, gclass: q.gclass, g_display: q.g_label, materials: mats, concerns },
        axes: s.status.axes(q, s.db), cells, legend: legend(s), note: NOTE };
      const unknown = mats.filter((m) => !known.includes(m));
      if (unknown.length) out.unknown_materials = { ids: unknown, message: 'No cabin test table in the evidence base names these materials.', known };
      return out;
    } },
  { name: 'get_finding',
    description: 'Fetch one record by id: a finding (for example S-VENT-01) with its verbatim quote, the rest of its sentence, its gated conditions and its source link; or a PSI test row (for example PSI-25:1) with its normalised fields and its raw table cells.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', description: 'A finding id or a test row id.' } } },
    async run(a, s) {
      need(typeof a.id === 'string' && a.id, 'id must be a string');
      const f = s.db.findingById?.[a.id] ?? s.db.findings.find((x) => x.id === a.id);
      if (f) return { type: 'finding', finding: f };
      const row = s.db.tests.find((r) => r.id === a.id);
      if (row) return { type: 'test_row', row: { ...row, raw: row.raw ?? await rawOf(row.id) } };
      return noSource({ id: a.id });
    } },
];

function validateInput(value, schema, label = 'arguments') {
  need(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  for (const key of schema.required ?? []) need(Object.hasOwn(value, key), `${key} is required`);
  for (const [key, v] of Object.entries(value)) {
    const spec = schema.properties[key];
    need(spec, `unknown argument: ${key}`);
    if (spec.type === 'array') {
      need(Array.isArray(v) && v.every(x => typeof x === spec.items.type), `${key} must be a list of ${spec.items.type} values`);
    } else if (spec.type === 'integer') need(Number.isInteger(v), `${key} must be an integer`);
    else need(typeof v === spec.type && (spec.type !== 'number' || Number.isFinite(v)), `${key} must be a ${spec.type}`);
    if (spec.enum) need(spec.enum.includes(v), `${key} must be one of: ${spec.enum.join(', ')}`);
    if (spec.minimum != null) need(v >= spec.minimum, `${key} must be at least ${spec.minimum}`);
    if (spec.maximum != null) need(v <= spec.maximum, `${key} must be at most ${spec.maximum}`);
  }
}

export async function callTool(name, a = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { isError: true, body: { error: `unknown tool: ${name}`, tools: TOOLS.map((t) => t.name) } };
  try {
    validateInput(a, tool.inputSchema);
    return { body: await tool.run(a, await load()) };
  } catch (e) { return { isError: true, body: { error: e instanceof BadInput ? e.message : String(e.message || e) } }; }
}

// ---------------------------------------------------------------- JSON-RPC over stdio
export async function handle(msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg?.id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code, message } });
  if (!msg || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(-32600, 'Invalid Request');
  if (msg.id !== undefined && msg.id !== null && typeof msg.id !== 'string' && !(typeof msg.id === 'number' && Number.isFinite(msg.id))) return fail(-32600, 'Invalid Request');
  const note = msg.id === undefined;                 // a notification gets no answer
  if (note) return null;
  switch (msg.method) {
    case 'initialize': return reply({ protocolVersion: msg.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER,
      instructions: `VESTA answers from verified NASA quotes and PSI test rows only. ${NOTE}. Scope: ${SCOPE}.` });
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const { isError, body } = await callTool(msg.params?.name, msg.params?.arguments);
      const out = { content: [{ type: 'text', text: JSON.stringify({ ...body, scope: SCOPE }) }] };
      if (isError) out.isError = true;
      return note ? null : reply(out);
    }
    default: return note || msg.method.startsWith('notifications/') ? null : fail(-32601, `Method not found: ${msg.method}`);
  }
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let chain = Promise.resolve();                     // answers leave in the order the requests arrived
  rl.on('line', (line) => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      let msg, out;
      try { msg = JSON.parse(line); } catch { out = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
      if (!out) { try { out = await handle(msg); } catch (e) { out = { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32603, message: String(e.message || e) } }; } }
      if (out) await new Promise(resolve => process.stdout.write(JSON.stringify(out) + '\n', resolve));
    });
  });
  rl.on('close', () => chain.catch(() => { process.exitCode = 1; }));
  process.stderr.write(`vesta-mcp: ready (${BASE ? 'evidence from ' + BASE : 'evidence from ' + path.relative(process.cwd(), DATA)})\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
