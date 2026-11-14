import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, Inputs, loadEvidence } from '../../tools/lib/load.mjs';

const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const findings = () => read('web/data/findings.json').findings;

test('suppression advice stays within the BASS jet result', () => {
  const aim = read('seed/rules.seed.json').rules.find(r => r.id === 'R-AIM');
  assert.equal(aim.vesta_decides, 'Do not assume a close jet will extinguish the flame.');
  assert.match(aim.limits, /do not show that flooding works/);
});

test('eight additional rules ship with a verified flight result and honest limits', () => {
  const ids = ['R-COOL-FLEX', 'R-DILUENT', 'R-HELIUM', 'R-SAFFIRE-OXYGEN', 'R-SAFFIRE-DUCT', 'R-SAME-SMOKE', 'R-BASS-UPSTREAM', 'R-BASS-HEAT'];
  const byId = new Map(findings().map(f => [f.id, f]));
  const seed = read('seed/rules.seed.json').rules;
  const shipped = read('web/data/rules.json').rules;
  for (const id of ids) {
    const authored = seed.find(r => r.id === id), rule = shipped.find(r => r.id === id);
    assert.ok(authored, id);
    assert.ok(rule, id);
    assert.equal(rule.finding_ids.length, authored.finding_ids.length, id);
    assert.ok(rule.finding_ids.some(fid => byId.get(fid)?.n.work === 'flight'), id);
    assert.ok(rule.finding_ids.every(fid => byId.get(fid)?.gate.pass === true), id);
    assert.ok(rule.limits.length > 50, id);
    assert.equal(rule.nasa_showed, byId.get(rule.finding_ids[0]).quote, id);
  }
});

test('every finding supplies a human sentence title without replacing its claim', () => {
  for (const f of findings()) {
    assert.equal(typeof f.title, 'string', f.id);
    assert.ok(f.title.split(/\s+/).length >= 4, f.id);
    assert.ok(!f.title.includes('_'), f.id);
    assert.match(f.title, /[.!?]$/, f.id);
  }
});

test('review subtotals expose reporting and unreported families separately', () => {
  const families = loadEvidence(new Inputs(ROOT)).families;
  const coverage = read('web/data/engine.json').verifier.review_coverage;
  assert.ok(coverage);
  assert.deepEqual(coverage.reporting_families, families.filter(f => f.verified && f.verification).map(f => f.family));
  assert.deepEqual(coverage.unreported_families, families.filter(f => f.verified && !f.verification).map(f => f.family));
  assert.deepEqual(coverage.missing_verified_families, families.filter(f => !f.verified).map(f => f.family));
  assert.equal(coverage.total_families, families.length);
});

test('inferred pressure retains a gated facility source and raw pressure stays absent', () => {
  const row = read('web/data/tests.json').tests.find(r => r.id === 'PSI-25:1');
  assert.equal(row.n.p, null);
  assert.equal(row.n.p_inferred, 101.3);
  assert.equal(row.n.p_inferred_source.id, 'researchers-guide');
  assert.equal(row.n.p_inferred_source.gate.pass, true);
  assert.match(row.n.p_inferred_source.quote, /one atmospheric pressure/);
});

test('oxygen aggregates link their actual endpoint rows', () => {
  const inv = read('web/data/investigations.json').investigations.find(i => i.psi_id === 'PSI-25');
  const rows = new Map(read('web/data/tests.json').tests.map(r => [r.id, r]));
  const o2 = inv.conditions.o2;
  assert.ok(o2.min_row_ids.includes('PSI-25:61'));
  for (const id of o2.min_row_ids) assert.equal(rows.get(id).o2_percent, o2.min);
  for (const id of o2.max_row_ids) assert.equal(rows.get(id).o2_percent, o2.max);
});

test('newly verified ACME, droplets and others enter the next build without loader changes', () => {
  const families = loadEvidence(new Inputs(ROOT)).families;
  const shipped = new Set(findings().map(f => f.id));
  const engine = read('web/data/engine.json');
  const exclusions = new Set([...engine.verifier.duplicates, ...engine.verifier.rejected].map(f => f.id));
  for (const name of ['acme', 'droplets', 'others']) {
    const family = families.find(f => f.family === name);
    assert.ok(family?.verification, name);
    assert.ok(family.verified.length > 0, name);
    assert.ok(family.verified.some(f => shipped.has(f.id)), name);
    for (const f of family.verified) assert.ok(shipped.has(f.id) || exclusions.has(f.id), f.id);
  }
});

test('rank API keeps human titles and original claims together', () => {
  const byId = new Map(findings().map(f => [f.id, f]));
  const rank = read('web/api/v1/rank/lunar-base.prevention.json');
  for (const result of rank.results) {
    assert.equal(result.title, byId.get(result.id).title, result.id);
    assert.equal(result.claim, byId.get(result.id).claim, result.id);
  }
});
