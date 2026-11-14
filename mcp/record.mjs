#!/usr/bin/env node
// Records one real exchange with the MCP server and stores it where the site and the README can show it:
// a judge cannot start a stdio server from a URL, so the Open data screen prints this recording instead.
//
//   node mcp/record.mjs           pipe initialize, tools/list and one rank_evidence call into mcp/server.mjs,
//                                 write mcp/recorded.json and refresh the recorded block of mcp/README.md
//   node mcp/record.mjs --check   exit 1 when the stored recording differs from what the server answers now
//
// Run it after every `node tools/build.mjs`. Nothing here is typed: the answer is whatever the server returned.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'mcp/recorded.json'), README = path.join(ROOT, 'mcp/README.md');
const VIEW = path.join(ROOT, 'web/js/views/open.js');
const CALL = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'rank_evidence', arguments: { habitat: 'lunar-base', concern: 'prevention', limit: 3 } } };
const LINES = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vesta-recorder', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  CALL,
];

function exchange() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'mcp/server.mjs')], { cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', () => { try { resolve(Object.fromEntries(out.split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((m) => [m.id, m]))); } catch (e) { reject(e); } });
    for (const l of LINES) child.stdin.write(JSON.stringify(l) + '\n');
    child.stdin.end();
  });
}

const byId = await exchange();
const answer = byId[3]?.result;
if (!answer || answer.isError) { console.error('mcp/record: the server did not answer the call: ' + (answer?.content?.[0]?.text ?? 'no answer') + '\n  (run node tools/build.mjs first)'); process.exit(1); }
const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'web/data/meta.json'), 'utf8')); } catch { return {}; } })();
const rec = {
  schema: 'vesta.mcp-recording/1',
  note: 'One real exchange with mcp/server.mjs over stdio, recorded by mcp/record.mjs against the evidence files of this build. The answer text is JSON; it is shown parsed here.',
  evidence_generated_at: meta.generated_at ?? null,
  command: 'node mcp/server.mjs',
  server: byId[1].result.serverInfo,
  protocol_version: byId[1].result.protocolVersion,
  tools: byId[2].result.tools.map((t) => ({ name: t.name, description: t.description, input: Object.keys(t.inputSchema.properties || {}), required: t.inputSchema.required || [] })),
  request: CALL,
  response: byId[3],
};
const text = JSON.stringify(rec, null, 1) + '\n';
const literal = JSON.stringify(rec);
const view = fs.readFileSync(VIEW, 'utf8');
const embedded = view.match(/^const RECORDING = (.*);$/m)?.[1];

if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (have !== text || embedded !== literal) { console.error('mcp/record: mcp/recorded.json is ' + (have == null ? 'missing' : 'stale') + ' (run node mcp/record.mjs)'); process.exit(1); }
  console.log('mcp/record: the stored recording equals what the server answers now'); process.exit(0);
}

if (embedded == null) throw new Error('Open data recording slot is missing');
fs.writeFileSync(VIEW, view.replace(/^const RECORDING = .*;$/m, () => 'const RECORDING = ' + literal + ';'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT + '.tmp', text); fs.renameSync(OUT + '.tmp', OUT);
if (fs.existsSync(README)) {
  const md = fs.readFileSync(README, 'utf8'), a = '<!-- recorded:start -->', b = '<!-- recorded:end -->';
  if (md.includes(a) && md.includes(b)) {
    const block = `${a}\nRequest (one line on stdin):\n\n\`\`\`json\n${JSON.stringify(CALL)}\n\`\`\`\n\nAnswer (the \`text\` of \`result.content[0]\`, parsed and indented):\n\n\`\`\`json\n${JSON.stringify(JSON.parse(rec.response.result.content[0].text), null, 1)}\n\`\`\`\n${b}`;
    fs.writeFileSync(README, md.slice(0, md.indexOf(a)) + block + md.slice(md.indexOf(b) + b.length));
  }
}
const first = JSON.parse(rec.response.result.content[0].text).results?.[0];
console.log(`mcp/record: wrote mcp/recorded.json  ${rec.tools.length} tools  first row ${first ? `${first.id} total ${first.total} ${first.status}` : 'none (no_source)'}`);
