#!/usr/bin/env node
// The release gate. Reads the site as it would be published (web/) and fails on anything that must not ship.
//
//   node tools/check.mjs            exit 0 when every check passes, 1 otherwise
//   node tools/check.mjs --json     the same report as JSON
//   node tools/check.mjs --root <folder>   check another copy of the repository (used to test this gate)
//
// Checks (numbers follow the test plan):
//   1 fixture ids under web/            2 references that do not resolve        3 findings without a passed gate or a sentence
//   4 banned copy outside quote fields  5 absolute paths to our own files       6 a NO SOURCE step while findings on its topic exist
//   7 API manifest paths and the feed   8 key or token patterns                 9 local paths and e-mail addresses in public files
// Node 20 or newer, no packages.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const ROOT = path.resolve(opt('root', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
const WEB = path.join(ROOT, 'web'), DATA = path.join(WEB, 'data'), API = path.join(WEB, 'api/v1');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(p);
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.jsonl', '.svg', '.md', '.txt', '.csv', '.sh', '.yml', '.yaml', '.py']);

function walk(dir, skip = () => false) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === '.DS_Store' || e.name === 'node_modules' || e.name === '.git' || skip(p)) continue;
    if (e.isDirectory()) out.push(...walk(p, skip)); else if (e.isFile()) out.push(p);
  }
  return out;
}
const textFiles = (dir, skip) => walk(dir, skip).filter((p) => TEXT.has(path.extname(p)) || path.basename(p) === 'LICENSE');
const read = (p) => fs.readFileSync(p, 'utf8');
const parseErrors = [];
const json = (name) => {
  const p = path.join(DATA, name + '.json');
  if (!exists(p)) return null;
  try { return JSON.parse(read(p)); }
  catch (e) { parseErrors.push(`${rel(p)} does not parse: ${e.message}`); return null; }
};
// The build may write a list or an object that wraps one; both read the same here.
const listOf = (x, ...keys) => { if (Array.isArray(x)) return x; if (x && typeof x === 'object') for (const k of keys) if (Array.isArray(x[k])) return x[k]; return []; };
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const show = (s) => JSON.stringify(String(s).length > 90 ? String(s).slice(0, 90) + '...' : String(s));

const checks = [];
const check = (n, name, fn) => checks.push({ n, name, fn });

// ---- shared loads
const webFiles = textFiles(WEB);
const findings = listOf(json('findings'), 'findings');
const findingIds = new Set(findings.map((f) => f.id));
const rules = listOf(json('rules'), 'rules');
const playbook = json('playbook'), steps = listOf(playbook, 'steps');
const protocol = listOf(json('protocol'), 'lines', 'protocol', 'items');
const scenario = json('scenario');
const scenarios = scenario ? (Array.isArray(scenario) ? scenario : scenario.scenarios ? Object.values(scenario.scenarios) : [scenario]) : [];
const presetsFile = json('presets');
const presetRecords = [...listOf(presetsFile, 'presets'), ...listOf(presetsFile?.markers, 'markers'), ...listOf(presetsFile?.bands, 'bands')];
const engine = json('engine');
// Ids the build's own gates removed. A reference to one of these is a known gap (the runtime shows NO SOURCE or hides the preset), not a dangling id.
const removed = new Set();
(function collect(x, key) {
  if (Array.isArray(x)) { for (const v of x) { if (typeof v === 'string' && /reject|drop|removed|failed|unverified/.test(key)) removed.add(v); else collect(v, key); } }
  else if (x && typeof x === 'object') { if (/reject|drop|removed|failed|unverified/.test(key) && typeof x.id === 'string') removed.add(x.id); for (const [k, v] of Object.entries(x)) collect(v, /reject|drop|removed|failed|unverified/.test(key) ? key : k); }
})(engine ?? {}, '');

check(0, 'the site and its evidence files are there', () => {
  const fails = [...parseErrors];
  if (!exists(path.join(WEB, 'index.html'))) fails.push('web/index.html is missing');
  for (const f of ['meta', 'investigations', 'tests', 'tests-raw', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'tour', 'engine'])
    if (!exists(path.join(DATA, f + '.json'))) fails.push(`web/data/${f}.json is missing (run node tools/build.mjs)`);
  for (const p of walk(DATA).concat(walk(API)).filter((p) => p.endsWith('.json'))) { try { JSON.parse(read(p)); } catch (e) { fails.push(`${rel(p)} does not parse: ${e.message}`); } }
  if (exists(path.join(DATA, 'findings.json')) && !findings.length) fails.push('web/data/findings.json holds no finding');
  return { fails };
});

check(1, 'no fixture id under web/', () => {
  const fails = [], re = /\b(?:FX|FIXTURE)-[A-Za-z0-9]+/g;
  for (const p of webFiles) { const t = read(p); for (const m of t.matchAll(re)) fails.push(`${rel(p)}:${lineOf(t, m.index)} ${m[0]}`); }
  return { fails };
});

check(2, 'every reference resolves inside web/data', () => {
  const fails = [], warns = [];
  const ruleIds = new Set(rules.map((r) => r.id)), protIds = new Set(protocol.map((p) => p.id)), stepIds = new Set(steps.map((s) => s.id));
  const ref = (from, id, set, what) => {
    if (id == null || set.has(id)) return;
    (removed.has(id) ? warns : fails).push(`${from} names ${what} ${id}, which ${removed.has(id) ? 'the gate removed (shown as NO SOURCE or hidden)' : 'is not in web/data'}`);
  };
  for (const r of rules) {
    if (!(r.finding_ids || []).length) fails.push(`rule ${r.id} shipped with no finding`);
    for (const id of r.finding_ids || []) ref(`rule ${r.id}`, id, findingIds, 'finding');
    ref(`rule ${r.id} (earth instinct)`, r.earth_instinct_finding_id, findingIds, 'finding');
  }
  for (const s of steps) {
    for (const id of s.rule_ids || []) ref(`step ${s.id}`, id, ruleIds, 'rule');
    for (const id of s.finding_ids || []) ref(`step ${s.id}`, id, findingIds, 'finding');
    for (const id of s.after || []) ref(`step ${s.id} (after)`, id, stepIds, 'step');
    if (!s.fallback) fails.push(`step ${s.id} has no fallback protocol line`); else ref(`step ${s.id} (fallback)`, s.fallback, protIds, 'protocol line');
  }
  for (const p of protocol) ref(`protocol ${p.id}`, p.finding_id, findingIds, 'finding');
  for (const sc of scenarios) {
    const meta = sc.meta ?? sc, c = meta.comm || {};
    ref(`scenario ${meta.id} (one way)`, c.one_way_finding, findingIds, 'finding');
    ref(`scenario ${meta.id} (round trip)`, c.round_trip_finding, findingIds, 'finding');
    if (meta.preset && !presetRecords.some((p) => p.id === meta.preset)) (removed.has(meta.preset) ? warns : fails).push(`scenario ${meta.id} names preset ${meta.preset}, which is not in web/data/presets.json`);
  }
  for (const p of presetRecords) {
    if (!(p.sources || []).length) { fails.push(`preset ${p.id} has no source`); continue; }
    p.sources.forEach((s, i) => { if (!s.quote || !/^https:\/\//.test(s.url || '')) fails.push(`preset ${p.id} source ${i + 1} lacks a quote or an https link`); });
  }
  for (const inv of listOf(json('investigations'), 'investigations')) for (const id of inv.finding_ids || []) ref(`investigation ${inv.psi_id}`, id, findingIds, 'finding');
  for (const s of listOf(json('sources'), 'sources')) for (const id of s.finding_ids || []) ref(`source ${s.key ?? s.id}`, id, findingIds, 'finding');
  return { fails, warns };
});

check(3, 'every shipped finding passed the gate and shows its sentence', () => {
  const fails = [];
  for (const f of findings) {
    if (f.gate?.pass !== true) fails.push(`${f.id} shipped without gate.pass === true`);
    const challenge = f.n?.read_in === 'challenge_page' || f.source?.kind === 'challenge-page';
    if (f.quote && !challenge && !(f.context && typeof f.context.before === 'string' && typeof f.context.after === 'string')) fails.push(`${f.id} has a quote and no context {before, after}`);
    if (!f.quote && !(f.cells || []).length) fails.push(`${f.id} has neither a quote nor table cells`);
    if (!f.n) fails.push(`${f.id} has no n (normalised fields)`);
  }
  return { fails };
});

// Copy rules of section 1. NASA's own words (quotes, sentence context, PSI record text, titles, raw table cells) are not VESTA's copy.
const BANNED = ['NASA never tested', 'nobody has tested', '22 min', '44 min', '0.166', '0.38 g', '26 investigations', 'live feed', 'proven safe', 'safe to use'];
const BANNED_RE = new RegExp('(?<![\\d.])(?:' + BANNED.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
const NASA_TEXT = /^(quote|conditions_quote|context|before|after|raw|cells|objectives?|approach|hypothesis|psi_measurement_sentences|fact|title|full_name|publications|abstract|test_label|sentence|columns?|column_map|description)$|_raw$/;
check(4, 'no banned copy outside quote fields', () => {
  const fails = [];
  const scanText = (p, t) => { for (const m of t.matchAll(BANNED_RE)) fails.push(`${rel(p)}:${lineOf(t, m.index)} ${show(m[0])}`); };
  const scanJson = (p, x, trail) => {
    if (typeof x === 'string') { for (const m of x.matchAll(BANNED_RE)) fails.push(`${rel(p)} ${trail} ${show(m[0])} in ${show(x)}`); }
    else if (Array.isArray(x)) x.forEach((v, i) => scanJson(p, v, `${trail}[${i}]`));
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!NASA_TEXT.test(k) && !(k === 'gravity' && /(?:^|\.)conditions$/.test(trail)) && !(k === 'value' && /conditions_dropped\[\d+\]$/.test(trail))) scanJson(p, v, trail ? `${trail}.${k}` : k);
  };
  for (const p of webFiles) {
    const ext = path.extname(p);
    if (ext === '.csv' || path.basename(p) === 'tests-raw.json' || path.basename(p) === 'OFL.txt') continue;            // CSV exports are NASA rows and quotes; the same text is checked in the JSON
    if (ext === '.json') { try { scanJson(p, JSON.parse(read(p)), ''); } catch { /* reported by check 0 */ } } else scanText(p, read(p));
  }
  return { fails };
});

check(5, 'no absolute path to our own files', () => {
  const fails = [], res = [/(?:src|href|action|poster)\s*=\s*["']\/(?!\/)/g, /fetch\(\s*["'`]\/(?!\/)/g, /import\s*\(?\s*["'`]\/(?!\/)/g, /\bfrom\s+["']\/(?!\/)/g, /url\(\s*["']?\/(?!\/)/g, /new URL\(\s*["'`]\/(?!\/)/g];
  for (const p of webFiles.filter((p) => ['.html', '.js', '.mjs', '.css', '.svg'].includes(path.extname(p)))) {
    const t = read(p);
    for (const re of res) for (const m of t.matchAll(re)) fails.push(`${rel(p)}:${lineOf(t, m.index)} ${show(t.slice(m.index, m.index + 60).split('\n')[0])}`);
  }
  return { fails };
});

check(6, 'no staged gap: a NO SOURCE rule step has no verified finding on its topic', async () => {
  const fails = [], warns = [], notes = [];
  if (!steps.length || !scenarios.length) return { fails: ['no playbook or scenario in web/data: the gap audit cannot run'] };
  let db = null, officer = null;
  try {
    const core = (n) => import(pathToFileURL(path.join(WEB, 'js/core', n + '.js')).href);
    const raw = {};
    for (const n of ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'tour', 'engine']) raw[n] = json(n);
    db = (await core('index')).buildIndex(raw); officer = await core('officer');
  } catch (e) { notes.push(`core modules not usable here (${String(e.message || e).split('\n')[0]}); auditing the published log only`); }
  for (const sc of scenarios) {
    const meta = sc.meta ?? sc, file = path.join(API, 'officer', `${meta.id}.json`);
    const shipped = exists(file) ? JSON.parse(read(file)) : null, shippedLog = shipped ? listOf(shipped, 'log', 'steps', 'decisions', 'results') : null;
    let log = shippedLog;
    if (db && officer && Array.isArray(sc.frames)) {
      log = officer.run(sc.frames, db, meta);
      if (!shippedLog) fails.push(`${rel(file)} is missing`);
      else if (JSON.stringify(log) !== JSON.stringify(shippedLog)) fails.push(`${rel(file)} differs from what core/officer.js computes on web/data (rebuild)`);
    }
    if (!log) { fails.push(`no decision log for ${meta.id}: the gap audit cannot run`); continue; }
    const none = log.filter((e) => e.state === 'NO_SOURCE');
    for (const e of none) {
      const s = steps.find((x) => x.id === e.step);
      if (!s) { fails.push(`the log names step ${e.step}, which is not in the playbook`); continue; }
      if (s.kind !== 'rule') continue;
      const on = findings.filter((f) => f.topic === s.topic).map((f) => f.id);
      if (on.length) fails.push(`${s.id} is NO SOURCE but the base holds findings on its topic (${s.topic}: ${on.slice(0, 6).join(', ')})`);
    }
    notes.push(`${meta.id}: ${log.length} steps, ${none.length} NO SOURCE (${none.map((e) => `${e.step} ${e.gap}`).join(', ') || 'none'})`);
  }
  return { fails, warns, notes };
});

check(7, 'every path in api/v1/index.json exists, and the feed parses', async () => {
  const fails = [], notes = [];
  const idx = path.join(API, 'index.json');
  if (!exists(idx)) fails.push('web/api/v1/index.json is missing');
  else {
    const seen = new Set();
    (function visit(x) {
      if (typeof x === 'string') { if (/^[\w./-]+\.(json|csv|jsonl)$/.test(x) && !/^https?:/.test(x)) seen.add(x); }
      else if (Array.isArray(x)) x.forEach(visit);
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (/^[\w./-]+\.(json|csv|jsonl)$/.test(k)) seen.add(k); visit(v); }
    })(JSON.parse(read(idx)));
    for (const p of seen) if (![path.join(API, p), path.join(WEB, p), path.join(WEB, 'api', p)].some(exists)) fails.push(`index.json lists ${p}, which does not exist`);
    notes.push(`${seen.size} paths listed`);
    if (!seen.size) fails.push('index.json lists no path');
  }
  const feed = path.join(WEB, 'feed/ntrs.json');
  if (!exists(feed)) fails.push('web/feed/ntrs.json is missing (node tools/ntrs-feed.mjs --offline)');
  else {
    try {
      const { validate } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ntrs-feed.mjs')).href);
      const f = JSON.parse(read(feed));
      for (const b of validate(f)) fails.push(`web/feed/ntrs.json: ${b}`);
      notes.push(`feed: ${f.items?.length ?? 0} items, origin ${f.origin}, snapshot of ${f.fetched_at}`);
    } catch (e) { fails.push(`web/feed/ntrs.json does not parse: ${e.message}`); }
  }
  return { fails, notes };
});

// The patterns are assembled from pieces so that this file never matches itself.
const SECRETS = [['sk-', '[A-Za-z0-9_-]{20,}'], ['gh[pousr]_', '[A-Za-z0-9]{30,}'], ['github_pat_', '[A-Za-z0-9_]{20,}'], ['AKIA', '[0-9A-Z]{16}'], ['AIza', '[0-9A-Za-z_-]{35}'],
  ['xox[baprs]-', '[A-Za-z0-9-]{10,}'], ['BEGIN [A-Z ]*PRIVATE', ' KEY'], ['Bearer ', '[A-Za-z0-9._~+/-]{24,}'], ['(?:api[_-]?key|secret|token|password)["\']?\\s*[:=]\\s*["\']', '[A-Za-z0-9_\\-]{20,}["\']']]
  .map(([a, b]) => new RegExp(a + b, 'g'));
const internal = (p) => rel(p) === 'tools/internal';                           // working tools: ignored by git, never published
check(8, 'no key or token pattern in web/, mcp/ or tools/', () => {
  const fails = [], notes = [];
  for (const p of [...webFiles, ...textFiles(path.join(ROOT, 'mcp')), ...textFiles(path.join(ROOT, 'tools'), internal)]) {
    const t = read(p);
    for (const re of SECRETS) for (const m of t.matchAll(re)) fails.push(`${rel(p)}:${lineOf(t, m.index)} looks like a key or token (${m[0].slice(0, 8)}...)`);
  }
  const script = path.join(ROOT, 'tools/internal/prepublish-check.sh');
  let commits = false; try { execFileSync('git', ['-C', ROOT, 'rev-parse', '--verify', 'HEAD'], { stdio: 'pipe' }); commits = true; } catch { /* no commit yet */ }
  if (!exists(script)) notes.push('tools/internal/prepublish-check.sh is not in this copy; skipped');
  else if (!commits) notes.push('no commit yet: prepublish-check.sh runs once there is one');
  else {
    let out = ''; try { out = execFileSync('bash', [script], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
    if (/^clean/m.test(out)) notes.push('prepublish-check.sh: ' + out.trim().split('\n').pop()); else fails.push('prepublish-check.sh did not print clean: ' + show(out.trim().replace(/\s+/g, ' ')));
  }
  return { fails, notes };
});

const LOCAL = new RegExp('(?:^|[^A-Za-z0-9.:/_-])/(?:' + 'Users' + '|' + 'home' + ')/[A-Za-z0-9_.-]+/', 'gm');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
check(9, 'no local path in public files, no e-mail address in the documents', () => {
  const fails = [];
  const pub = [...webFiles, ...['mcp', 'tools', 'tests', 'docs', 'config', 'seed', '.github'].flatMap((d) => textFiles(path.join(ROOT, d), internal)), ...['README.md', 'LICENSE'].map((f) => path.join(ROOT, f)).filter(exists)];
  for (const p of pub) { const t = read(p); for (const m of t.matchAll(LOCAL)) fails.push(`${rel(p)}:${lineOf(t, m.index)} local path ${show(m[0].trim())}`); }
  const docs = [...textFiles(path.join(ROOT, 'docs')), ...['README.md', 'LICENSE', 'mcp/README.md'].map((f) => path.join(ROOT, f)).filter(exists),
    ...webFiles.filter((p) => ['.html', '.js', '.css'].includes(path.extname(p)))];
  for (const p of docs) { const t = read(p); for (const m of t.matchAll(EMAIL)) fails.push(`${rel(p)}:${lineOf(t, m.index)} e-mail address ${show(m[0])}`); }
  return { fails };
});

// ---- run
const report = [];
for (const c of checks) {
  let r; try { r = await c.fn(); } catch (e) { r = { fails: [`the check itself failed: ${e.stack || e}`] }; }
  report.push({ n: c.n, name: c.name, ok: !(r.fails || []).length, fails: r.fails || [], warns: r.warns || [], notes: r.notes || [] });
}
const bad = report.filter((r) => !r.ok);
if (args.includes('--json')) console.log(JSON.stringify({ ok: !bad.length, root: '.', checks: report }, null, 1));
else {
  for (const r of report) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.n} ${r.name}${r.ok ? '' : `  (${r.fails.length})`}`);
    for (const f of r.fails.slice(0, 40)) console.log(`       ${f}`);
    if (r.fails.length > 40) console.log(`       ... and ${r.fails.length - 40} more`);
    for (const w of r.warns) console.log(`     warning: ${w}`);
    for (const n of r.notes) console.log(`     ${n}`);
  }
  console.log(bad.length ? `check: FAILED (${bad.map((r) => r.n).join(', ')})` : `check: ok, ${report.length} checks, ${webFiles.length} files under web/`);
}
process.exit(bad.length ? 1 : 0);
