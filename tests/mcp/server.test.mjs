// The MCP server over its real transport: JSON-RPC lines piped into `node mcp/server.mjs`, answers read from stdout.
// The protocol tests always run. The evidence tests need web/data (written by `node tools/build.mjs`) and the core
// modules; they skip themselves with a message while either is absent and must pass once both exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = path.join(ROOT, 'mcp/server.mjs');
const has = (p) => fs.existsSync(path.join(ROOT, p));
const READY = ['web/data/findings.json', 'web/data/tests.json', 'web/data/presets.json', 'web/js/core/index.js', 'web/js/core/rank.js', 'web/js/core/status.js'].filter((p) => !has(p));
const skip = READY.length ? `waiting for ${READY.join(', ')}` : false;
const SCOPE = 'decision-support prototype, not certified flight software';

// Pipe the lines in, close stdin, return the parsed answers by id (and the raw list).
function pipe(lines, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER, ...extraArgs], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const list = out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
        resolve({ code, list, byId: Object.fromEntries(list.filter((m) => m.id != null).map((m) => [m.id, m])), err });
      } catch (e) { reject(new Error(`stdout is not JSON lines: ${e.message}\n${out.slice(0, 400)}`)); }
    });
    for (const l of lines) child.stdin.write((typeof l === 'string' ? l : JSON.stringify(l)) + '\n');
    child.stdin.end();
  });
}
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const call = (id, name, args) => rpc(id, 'tools/call', { name, arguments: args });
const INIT = rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vesta-test', version: '0' } });
const body = (m) => { assert.equal(m.result.content[0].type, 'text'); return JSON.parse(m.result.content[0].text); };

test('initialize echoes the protocol version and offers tools; tools/list has the four v1 tools', async () => {
  const { code, byId, list } = await pipe([INIT, { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc(2, 'tools/list'), rpc(3, 'ping')]);
  assert.equal(code, 0);
  assert.equal(list.length, 3, 'a notification gets no answer');
  assert.equal(byId[1].result.protocolVersion, '2025-06-18');
  assert.deepEqual(byId[1].result.capabilities, { tools: {} });
  assert.equal(byId[1].result.serverInfo.name, 'vesta');
  const tools = byId[2].result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['search_evidence', 'rank_evidence', 'check_design', 'get_finding']);
  for (const t of tools) { assert.ok(t.description.length > 40, t.name); assert.equal(t.inputSchema.type, 'object'); }
  assert.deepEqual(byId[3].result, {});
});

test('a broken line, an unknown method and an unknown tool each get a JSON-RPC answer, in order', async () => {
  const { list } = await pipe(['{not json', rpc(7, 'resources/list'), call(8, 'launch_rocket', {})]);
  assert.equal(list[0].error.code, -32700);
  assert.equal(list[1].id, 7); assert.equal(list[1].error.code, -32601);
  assert.equal(list[2].id, 8); assert.equal(list[2].result.isError, true);
  assert.equal(body(list[2]).scope, SCOPE);
});

test('rank_evidence: four tools, and a first row with id, total, quote and url', { skip }, async () => {
  const { byId } = await pipe([INIT, rpc(2, 'tools/list'), call(3, 'rank_evidence', { habitat: 'lunar-base', concern: 'prevention' })]);
  assert.equal(byId[2].result.tools.length, 4);
  const r = body(byId[3]);
  assert.equal(r.scope, SCOPE);
  assert.equal(r.query.preset, 'lunar-base'); assert.equal(r.query.o2, 34); assert.equal(r.query.gclass, 'partial'); assert.equal(r.query.g_display, '1/6 g');
  assert.deepEqual(r.weights, { pillar: 30, atmosphere: 25, gravity: 15, level: 15, material: 10, habitat: 5 });
  assert.ok(r.results.length >= 1 && r.results.length <= 10);
  const first = r.results[0];
  assert.equal(first.rank, 1);
  assert.equal(typeof first.id, 'string');
  assert.equal(typeof first.total, 'number');
  assert.ok(typeof first.quote === 'string' ? first.quote.length >= 25 : Array.isArray(first.cells), 'the first row carries its quote, or its table cells when it is a table finding');
  assert.match(first.url, /^https:\/\//);
  assert.ok(['PROVEN', 'EXTRAPOLATED'].includes(first.status));
  assert.equal(first.status, 'EXTRAPOLATED', 'nothing is PROVEN at 1/6 g: the base holds no partial-gravity row');
  assert.ok(first.reasons.includes('gravity_never_tested') || first.reasons.includes('gravity_not_reported'));
  for (let i = 1; i < r.results.length; i++) assert.ok(r.results[i - 1].total >= r.results[i].total, 'sorted by total');
  const quoted = r.results.find((x) => x.quote);
  assert.ok(quoted && quoted.id && typeof quoted.total === 'number' && /^https:\/\//.test(quoted.url), 'a quoted row has id, total, quote and url');
  const sum = Object.values(first.parts).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - first.total) <= 0.5 || Math.abs(sum * 0.85 - first.total) <= 0.5, 'total is the sum of its parts (x 0.85 for partial support)');
});

test('rank_evidence at the station preset gives S-VENT-01 the 70 points of section 3.4, and refuses an unknown habitat', { skip }, async () => {
  const { byId } = await pipe([call(1, 'rank_evidence', { habitat: 'station', concern: 'prevention', limit: 100 }), call(2, 'rank_evidence', { habitat: 'venus-base', concern: 'prevention' })]);
  const vent = body(byId[1]).results.find((x) => x.id === 'S-VENT-01');
  assert.ok(vent, 'S-VENT-01 ships'); assert.equal(vent.total, 70);
  assert.equal(byId[2].result.isError, true);
  assert.match(body(byId[2]).error, /habitat must be one of/);
});

test('search_evidence: a nonsense word returns no_source; a real word returns findings with their quotes', { skip }, async () => {
  const { byId } = await pipe([call(1, 'search_evidence', { query: 'zzqxnonsenseword' }), call(2, 'search_evidence', { query: 'ventilation flow', pillar: 'prevention' })]);
  const none = body(byId[1]);
  assert.equal(none.no_source, true);
  assert.equal(none.message, "No verified finding in VESTA's evidence base. VESTA does not answer without a source.");
  assert.equal(none.scope, SCOPE);
  const some = body(byId[2]);
  assert.ok(some.count >= 1 && !some.no_source);
  assert.ok(some.results.length <= 10);
  for (const f of some.results) { assert.equal(f.pillar, 'prevention'); assert.match(`${f.claim} ${f.quote ?? ''}`.toLowerCase(), /ventilation/); assert.ok(f.id && f.work && f.read_in); }
});

test('check_design at the lunar base: gravity and oxygen axes are empty, PMMA is EXTRAPOLATED, Kapton is NEVER_TESTED', { skip }, async () => {
  const { byId } = await pipe([call(1, 'check_design', { o2_percent: 34, pressure_kpa: 56.5, gravity: 'moon', materials: ['pmma', 'kapton'], concern: 'prevention' }),
    call(2, 'check_design', { o2_percent: 21, pressure_kpa: 101.4, gravity: '0g' })]);
  const r = body(byId[1]);
  assert.equal(r.note, 'status = evidence coverage, not a safety certification');
  assert.equal(r.axes.gravity.cabin, 0); assert.equal(r.axes.o2.cabin, 0);
  assert.equal(r.cells.length, 2);
  const [pmma, kapton] = r.cells;
  assert.equal(pmma.status, 'EXTRAPOLATED'); assert.deepEqual(pmma.reasons, ['gravity_never_tested', 'o2_outside', 'pressure_outside']); assert.equal(pmma.nearest.delta.o2, 11.8);
  assert.equal(kapton.status, 'NEVER_TESTED'); assert.deepEqual(kapton.elsewhere, ['detection']);
  assert.deepEqual(Object.keys(r.legend), ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED']);
  const station = body(byId[2]);
  assert.equal(station.cells.length % 3, 0, 'every material x three concerns');
  assert.deepEqual(station.cells.filter((c) => c.status === 'PROVEN').map((c) => `${c.material}:${c.concern}`).sort(), ['nomex:prevention', 'pmma:prevention', 'sibal:prevention']);
});

test('get_finding returns a finding with its sentence context, a test row with its raw cells, and no_source for an unknown id', { skip }, async () => {
  const { byId } = await pipe([call(1, 'get_finding', { id: 'S-VENT-01' }), call(2, 'get_finding', { id: 'PSI-25:1' }), call(3, 'get_finding', { id: 'NOPE-000' })]);
  const f = body(byId[1]);
  assert.equal(f.type, 'finding'); assert.match(f.finding.quote, /ventilation flow strongly enhances flames/); assert.ok(f.finding.n && f.finding.source.url && f.finding.context);
  const r = body(byId[2]);
  assert.equal(r.type, 'test_row'); assert.equal(r.row.psi_id, 'PSI-25'); assert.equal(r.row.n.material_id, 'pmma');
  assert.ok(r.row.raw && Object.keys(r.row.raw).length > 0, 'raw cells travel with the row');
  assert.equal(body(byId[3]).no_source, true);
});

test('invalid requests and notifications do not break subsequent requests', async () => {
  const { list, byId } = await pipe(['null', [], { jsonrpc: '2.0', id: {}, method: 'ping' },
    { jsonrpc: '2.0', method: 'tools/list' }, rpc(11, 'ping')]);
  assert.equal(list.length, 4);
  for (const m of list.slice(0, 3)) assert.equal(m.error.code, -32600);
  assert.deepEqual(byId[11].result, {});
});

test('tool schemas reject invalid inputs before loading evidence', async () => {
  const { byId } = await pipe([call(1, 'rank_evidence', []), call(2, 'search_evidence', { limit: 1.5 }),
    call(3, 'check_design', { o2_percent: 34, pressure_kpa: 56.5, gravity: 'constructor' }),
    call(4, 'check_design', { o2_percent: 34, pressure_kpa: 56.5, gravity: 'moon', materials: [7] }),
    call(5, 'get_finding', {}), call(6, 'search_evidence', { extra: true })]);
  for (const id of [1, 2, 3, 4, 5, 6]) {
    assert.equal(byId[id].result.isError, true);
    assert.equal(body(byId[id]).scope, SCOPE);
  }
});
