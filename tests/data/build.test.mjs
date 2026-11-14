import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { ROOT, Inputs, loadEvidence } from '../../tools/lib/load.mjs';
import { conditionsGate, gateSentences, sentenceContext, startsWithQualifier, rowGate, runQuoteGate, checkReferences, norm } from '../../tools/lib/gate.mjs';
import { findingN, reviewed, materialsIn, resolveTableNotes } from '../../tools/lib/normalize.mjs';
import { parseCsv } from '../../web/js/core/csv.js';

const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const available = fs.existsSync(path.join(ROOT, 'web/data/meta.json'));
const real = { skip: available ? false : 'Run node tools/build.mjs to test real data' };
const cachedSources = fs.existsSync(path.join(ROOT, 'research/raw/nasa/researchers-guide-combustion.txt'));
const rebuild = { skip: available && cachedSources ? false : 'Build verification requires web/data and cached NASA texts on the Mac' };
const inputs = read('data/tests.json');
const treeHash = () => {
  const walk = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  return Object.fromEntries(['web/data', 'web/api/v1'].flatMap(walk).sort().map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')]));
};

test('real: 24 combustion investigations and the two excluded records', real, () => {
  const d = read('web/data/investigations.json');
  assert.equal(d.investigations.length, 24);
  assert.deepEqual(d.excluded.map(x => x.psi_id).sort(), ['PSI-108', 'PSI-181']);
  assert.equal(d.families.reduce((n, f) => n + f.psi_ids.length, 0), d.investigations.length);
});

test('real: row count, raw preservation, BASS-II pressure inference and burner streams', real, () => {
  const d = read('web/data/tests.json'), raw = read('web/data/tests-raw.json');
  assert.equal(d.tests.length, d.meta.n_tests);
  assert.equal(d.tests.length, inputs.tests.length);
  assert.ok(d.tests.every(r => r.n && !('raw' in r)));
  for (const r of inputs.tests) assert.deepEqual(raw[r.id], r.raw);
  const n = d.tests.find(r => r.id === 'PSI-25:1').n;
  assert.equal(n.material_id, 'pmma'); assert.equal(n.o2, 22.2); assert.equal(n.p, null); assert.equal(n.p_inferred, 101.3);
  assert.deepEqual(n.pillars, ['prevention']);
  assert.ok(d.tests.filter(r => r.o2_basis === 'burner_stream').every(r => r.n.o2 === null));
});

test('real: every seed ships with sentence context except challenge-page and table findings', real, () => {
  const fsById = new Map(read('web/data/findings.json').findings.map(f => [f.id, f]));
  for (const s of read('seed/evidence.seed.json').findings) {
    const f = fsById.get(s.id); assert.ok(f, s.id); assert.ok(f.n); assert.equal(f.gate.pass, true);
    if (s.quote && s.source.kind !== 'challenge-page') assert.ok(f.context, s.id);
    else assert.equal(f.context, null);
  }
});

test('real: reviewed findings or documented gate/duplicate exclusions only; review totals match delivery', real, () => {
  const research = loadEvidence(new Inputs(ROOT)), findings = read('web/data/findings.json').findings;
  const engine = read('web/data/engine.json'), shipped = new Map(findings.map(f => [f.id, f]));
  const exclusions = new Set([...engine.verifier.rejected, ...engine.verifier.duplicates].map(f => f.id));
  const sums = { input: 0, kept_unchanged: 0, kept_with_changes: 0, rejected: 0, pending: 0 };
  for (const f of research.families) {
    const eligible = f.verified && (!['acme', 'droplets', 'others'].includes(f.family) || f.verification);
    if (!eligible) { for (const c of f.candidates) assert.ok(!shipped.has(c.id), c.id); continue; }
    for (const c of f.verified.filter(reviewed)) { assert.ok(shipped.has(c.id) || exclusions.has(c.id), c.id); if (shipped.has(c.id)) assert.ok(shipped.get(c.id).n); }
    const v = f.verification; if (!v) continue;
    sums.input += v.input ?? v.input_findings ?? 0; sums.kept_unchanged += v.kept_unchanged ?? 0;
    sums.kept_with_changes += v.kept_with_changes ?? v.kept_changed ?? 0; sums.rejected += v.rejected ?? 0; sums.pending += v.pending ?? v.pending_not_reviewed ?? 0;
  }
  assert.deepEqual(engine.verifier.review, sums);
});

test('fixture: a quote cut before however fails the sentence rule, a complete sentence passes', () => {
  const quote = 'The tested detector detected most particles';
  const texts = { get: () => ({ plain: `${quote}, however it missed smaller particles. Next sentence.`, marked: `${quote}, however it missed smaller particles. Next sentence.` }) };
  const c = sentenceContext(texts, 'fixture', quote);
  assert.equal(c.found, true); assert.equal(startsWithQualifier(c.after), true);
  const rows = [{ id: 'FX-QUALIFIER', quote, source: { text_file: 'fixture' } }], gates = new Map([['FX-QUALIFIER', { pass: true }]]);
  const result = gateSentences(rows, gates, texts);
  assert.equal(gates.get('FX-QUALIFIER').pass, false);
  assert.equal(result.rejected[0].why, 'cut_before_qualifier');
  assert.equal(startsWithQualifier(sentenceContext(texts, 'fixture', `${quote}, however it missed smaller particles.`).after), false);
  assert.equal(startsWithQualifier(' butterfly effect'), false);
});

test('fixture: unsupported oxygen range becomes null and is listed as dropped', () => {
  const f = { id: 'FX-OXYGEN', conditions: { o2_percent: '17-21' } };
  const g = conditionsGate(f, 'The test reports flame spread in microgravity.', { work: 'summary', psi_gclass: null });
  const n = findingN(f, g, { work: 'summary', materials: {}, material_ids: [], tableClassByPsi: new Map() }, () => {});
  assert.equal(n.o2, null); assert.ok(n.dropped.includes('o2'));
  const supported = conditionsGate(f, 'Oxygen ranged from 17 to 21 percent in microgravity.', { work: 'summary' });
  assert.deepEqual(supported.o2, [17, 21]);
});

test('fixture: wrong table cell rejects; matching trimmed cell passes', () => {
  const map = new Map([['FX-ROW', { raw: { fuel: 'PMMA ' } }]]);
  assert.equal(rowGate({ cells: [{ row_id: 'FX-ROW', column: 'fuel', raw: 'Nomex' }] }, map).pass, false);
  assert.equal(rowGate({ cells: [{ row_id: 'FX-ROW', column: 'fuel', raw: 'PMMA' }] }, map).pass, true);
});

test('fixture: numbers need units and oxygen; material matching has boundaries', () => {
  const ctx = { work: 'summary' };
  assert.equal(conditionsGate({ conditions: { pressure: '8.2 psi', o2_percent: 34 } }, '8.2/34 environment in orbit', ctx).p, null);
  assert.equal(conditionsGate({ conditions: { o2_percent: 34 } }, '34 percent of samples burned.', ctx).o2, null);
  assert.equal(conditionsGate({ conditions: { pressure: '8.2 psi' } }, 'At 8.2 psi in microgravity.', ctx).p, 56.5);
  assert.deepEqual(materialsIn('PMMA and subnomex', { pmma: { label: 'PMMA' }, nomex: { label: 'Nomex' } }), ['pmma']);
  assert.deepEqual(materialsIn('subpmma', { pmma: { label: 'PMMA' } }), []);
});

test('fixture: reference rejection is distinguishable from an unknown authored id', () => {
  const refs = [{ id: 'FX-REJECTED', space: 'finding' }, { id: 'FX-UNKNOWN', space: 'finding' }];
  const r = checkReferences(refs, { finding: new Set(['FX-REJECTED']) }, { finding: new Set() });
  assert.equal(r.warnings.length, 1); assert.equal(r.dangling.length, 1); assert.equal(r.dangling[0].id, 'FX-UNKNOWN');
});

test('real: manifest paths, rank/coverage/CSV counts, CSV round trip and original CSV bytes', real, () => {
  const manifest = read('web/api/v1/index.json'), files = manifest.files.map(f => f.path);
  for (const p of files) assert.ok(fs.existsSync(path.join(ROOT, 'web/api/v1', p)), p);
  assert.equal(files.filter(p => p.startsWith('rank/')).length, 15);
  assert.equal(files.filter(p => p.startsWith('coverage/')).length, 5);
  assert.equal(files.filter(p => p.startsWith('tests/')).length, 20);
  const flex = parseCsv(fs.readFileSync(path.join(ROOT, 'web/api/v1/tests/PSI-69.csv'), 'utf8'));
  assert.equal(flex.rows.length, 274);
  const fc = parseCsv(fs.readFileSync(path.join(ROOT, 'web/api/v1/findings.csv'), 'utf8'));
  assert.equal(fc.rows.length, read('web/data/findings.json').findings.length);
  assert.ok(fs.readFileSync(path.join(ROOT, 'web/api/v1/tests.csv')).equals(fs.readFileSync(path.join(ROOT, 'data/tests.csv'))));
});

test('real: identical bytes on rerun and simultaneous processes', rebuild, async () => {
  execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
  const before = treeHash();
  execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
  assert.deepEqual(treeHash(), before);
  const run = () => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; p.stderr.on('data', b => { stderr += b; }); p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)));
  });
  await Promise.all([run(), run(), run()]);
  assert.deepEqual(treeHash(), before);
  assert.ok(Object.keys(treeHash()).every(p => !p.endsWith('.tmp')));
});


test('real: Python quotecheck agrees with JS normalisation on Unicode and whitespace', rebuild, () => {
  const input = "\u00a0‘NASA’\t\u2003flame\u00ad test—next\nline\u0085end";
  const python = execFileSync('python3', ['-c', 'import runpy,sys; print(runpy.run_path(sys.argv[1])["norm"](sys.argv[2]))', path.join(ROOT, 'research/tools/quotecheck.py'), input], { encoding: 'utf8' }).trim();
  assert.equal(norm(input), python);
  const seed = read('seed/evidence.seed.json').findings.find(f => f.id === 'S-VENT-01');
  assert.equal(runQuoteGate([seed], ROOT).get(seed.id).pass, true);
  assert.equal(runQuoteGate([{ ...seed, quote: 'This is an invented claim absent from the cached source text.' }], ROOT).get(seed.id).pass, false);
});

test('fixture: missing authored/core files produce complete empty shapes; dangling and unreadable files fail before output', rebuild, async () => {
  const { build } = await import('../../tools/build.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-wp1-inputs-'));
  fs.mkdirSync(path.join(dir, 'config'));
  for (const name of ['data', 'research', 'seed']) fs.symlinkSync(path.join(ROOT, name), path.join(dir, name));
  for (const name of ['table-notes', 'facility', 'families']) fs.copyFileSync(path.join(ROOT, `config/${name}.json`), path.join(dir, `config/${name}.json`));
  try {
    const raw = await build(dir);
    assert.deepEqual(raw.presets, { presets: [], markers: [], bands: [] });
    assert.deepEqual(raw.protocol.lines, []); assert.deepEqual(raw.playbook.steps, []);
    assert.deepEqual(raw.scenario, { meta: null, frames: [] });
    assert.ok(fs.existsSync(path.join(dir, 'web/data/engine.json')));
    const previous = fs.readFileSync(path.join(dir, 'web/data/meta.json'));
    fs.writeFileSync(path.join(dir, 'config/playbook.json'), JSON.stringify({ steps: [{ id: 'FX-STEP', rule_ids: ['FX-UNKNOWN'], fallback: null }] }));
    await assert.rejects(build(dir), /Dangling authored references.*FX-UNKNOWN/);
    assert.ok(fs.readFileSync(path.join(dir, 'web/data/meta.json')).equals(previous));
    fs.writeFileSync(path.join(dir, 'config/playbook.json'), '{');
    await assert.rejects(build(dir), /Unreadable inputs/);
    assert.ok(fs.readFileSync(path.join(dir, 'web/data/meta.json')).equals(previous));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real: shipped rules complete the triad from their verified findings', real, () => {
  const byId = new Map(read('web/data/findings.json').findings.map(f => [f.id, f]));
  for (const r of read('web/data/rules.json').rules) {
    assert.equal(r.nasa_showed, byId.get(r.finding_ids[0]).quote ?? byId.get(r.finding_ids[0]).claim, r.id);
    assert.ok(r.finding_ids.map(id => byId.get(id).n.work).includes(r.confidence), r.id);
  }
});

test('fixture: each side of sentence context is at most 300 characters', () => {
  const quote = 'NASA reported a measured flame response';
  const sentence = `${'x'.repeat(500)}${quote}${'y'.repeat(500)}.`;
  const context = sentenceContext({ get: () => ({ plain: sentence, marked: sentence }) }, 'fixture', quote);
  assert.ok(context.before.length <= 300, `before: ${context.before.length}`);
  assert.ok(context.after.length <= 300, `after: ${context.after.length}`);
});
