import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gate = path.join(ROOT, 'tools/check.mjs');
let baselineRecording;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (name, value) => {
    const p = path.join(root, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const finding = { id: 'S-CHECK', topic: 'test_topic', quote: 'Synthetic text used only in an isolated gate test.', source: { url: 'https://example.org/source' }, gate: { pass: true }, n: {}, context: { before: '', after: '' } };
  for (const n of ['meta', 'investigations', 'tests', 'tests-raw', 'tables', 'rules', 'sources', 'presets', 'lines', 'tour', 'engine']) put(`web/data/${n}.json`, {});
  put('web/index.html', '<!doctype html><title>Gate test</title>');
  put('web/data/findings.json', [finding]);
  put('web/data/protocol.json', [{ id: 'P-1', finding_id: 'S-CHECK' }]);
  put('web/data/playbook.json', { steps: [{ id: 'S1', kind: 'rule', topic: 'missing_topic', rule_ids: [], finding_ids: [], after: [], fallback: 'P-1' }] });
  put('web/data/scenario.json', { meta: { id: 'scenario' } });
  put('web/api/v1/findings.json', [finding]);
  put('web/api/v1/officer/scenario.json', { log: [{ step: 'S1', state: 'NO_SOURCE', gap: 'no_verified_finding_on_topic' }] });
  put('web/api/v1/index.json', { paths: ['findings.json', 'officer/scenario.json'] });
  put('web/feed/ntrs.json', { schema: 'vesta.ntrs-feed/1', fetched_at: '2026-11-14T12:00:00-05:00', origin: 'ntrs-index', terms: [], items: [] });
  put('web/js/views/open.js', 'const RECORDING = {};');
  put('mcp/server.mjs', `import readline from 'node:readline';
const answers = {
  1: {serverInfo:{name:'gate-test',version:'1'},protocolVersion:'2025-06-18'},
  2: {tools:[]},
  3: {content:[{type:'text',text:JSON.stringify({results:[]})}]}
};
for await (const line of readline.createInterface({input:process.stdin})) {
  const msg=JSON.parse(line);
  if(msg.id) process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:answers[msg.id]})+'\\n');
}`);
  if (!baselineRecording) {
    const recorded = spawnSync(process.execPath, [path.join(ROOT, 'mcp/record.mjs'), '--root', root], { encoding: 'utf8', timeout: 45000 });
    assert.equal(recorded.status, 0, recorded.stderr);
    baselineRecording = {
      file: fs.readFileSync(path.join(root, 'mcp/recorded.json'), 'utf8'),
      view: fs.readFileSync(path.join(root, 'web/js/views/open.js'), 'utf8'),
    };
  } else {
    put('mcp/recorded.json', baselineRecording.file);
    put('web/js/views/open.js', baselineRecording.view);
  }
  return { put, finding, root, run() {
    const r = spawnSync(process.execPath, [gate, '--root', root, '--json'], { encoding: 'utf8', timeout: 60000 });
    assert.ok(r.status === 0 || r.status === 1, r.stderr);
    return { status: r.status, ...JSON.parse(r.stdout) };
  } };
}
test('release gate accepts an isolated fixture baseline and preserves raw numeric cells', t => {
  const f = fixture(t);
  f.put('web/data/tests-raw.json', { row: { fraction: '0.166' } });
  const result = f.run();
  assert.equal(result.status, 0, JSON.stringify(result.checks.filter(x => !x.ok)));
});
const cases = [
  [0, f => f.put('web/data/findings.json', '{broken json')],
  [1, f => f.put('web/leak.json', { id: 'FX-LEAK' })],
  [2, f => f.put('web/data/rules.json', [{ id: 'R-1', finding_ids: ['S-MISSING'] }])],
  [3, f => f.put('web/data/findings.json', [{ ...f.finding, gate: { pass: false } }])],
  [4, f => f.put('web/copy.js', 'const copy = "NASA never tested this";')],
  [5, f => f.put('web/path.js', 'fetch("/data/findings.json")')],
  [6, f => f.put('web/data/findings.json', [{ ...f.finding, topic: 'missing_topic' }])],
  [7, f => f.put('web/api/v1/index.json', { paths: ['missing.json'] })],
  [7, f => f.put('web/feed/ntrs.json', { schema: 'invalid', items: [] })],
  [8, f => f.put('mcp/leak.txt', ['sk', '-', 'a'.repeat(30)].join(''))],
];
for (const [i, [n, mutate]] of cases.entries()) test(`release gate rejects violation ${n}, case ${i + 1}`, t => {
  const f = fixture(t); mutate(f);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(result.checks.find(x => x.n === n).ok, false);
});

for (const file of ['mcp/recorded.json', 'web/js/views/open.js']) test(`release gate rejects a stale recording in ${file}`, t => {
  const f = fixture(t);
  const target = path.join(f.root, file);
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('gate-test', 'old-server'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(result.checks.find(x => x.n === 10).ok, false);
});
test('release gate rejects a recording after the server answer changes', t => {
  const f = fixture(t);
  const server = path.join(f.root, 'mcp/server.mjs');
  fs.writeFileSync(server, fs.readFileSync(server, 'utf8').replace('results:[]', 'results:[{id:"changed"}]'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(result.checks.find(x => x.n === 10).ok, false);
});
