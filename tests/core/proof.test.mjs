import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, withoutFindings } from '../../web/js/core/index.js';
import { validateCases, evaluateCase, runCases } from '../../web/js/world/proof.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const file = read('../../config/proof-cases.json');
const names = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'engine'];
const db = buildIndex(Object.fromEntries(names.map(name => [name, read(`../../web/data/${name}.json`)])));

test('the judge-readable file contains ten unique complete cases and deliberate refusals', () => {
  const cases = validateCases(file);
  assert.equal(cases.length, 10);
  assert.equal(cases.filter(c => c.expected.status === 'NO_SOURCE').length, 3);
  assert.ok(cases.some(c => c.expected.status === 'NEVER_TESTED'));
  assert.ok(cases.every(c => db.presetById[c.cabin.preset]));
  assert.throws(() => validateCases({ ...file, cases: file.cases.slice(1) }));
  assert.throws(() => validateCases({ ...file, cases: file.cases.map(() => file.cases[0]) }));
});

for (const c of file.cases) test(`reviewed proof: ${c.id}, ${c.expected.status}`, () => {
  const result = evaluateCase(c, db);
  assert.equal(result.pass, true, JSON.stringify(result.actual));
  assert.deepEqual(result.mismatches, []);
  for (const id of result.refs) assert.ok(db.findingById[id] || db.testById[id], id);
  if (c.expected.status === 'NO_SOURCE') {
    assert.match(result.answer, /^NO SOURCE\./);
    assert.equal(result.result.nasa.length, 0);
    assert.equal(result.result.rule_id, null);
    assert.ok(result.limits?.includes('not validated for this vehicle'));
  }
});

test('the live runner is deterministic and never mutates the evidence base', () => {
  const before = JSON.stringify(db);
  assert.deepEqual(runCases(file, db), runCases(file, db));
  assert.equal(JSON.stringify(db), before);
  assert.ok(db.findingById['S-VENT-01']);
});

test('a wrong expected refusal is reported as FAIL rather than painted PASS', () => {
  const c = file.cases.find(c => c.id === 'restart-refusal');
  const result = evaluateCase({ ...c, expected: { status: 'SOURCED' } }, db);
  assert.equal(result.pass, false);
  assert.deepEqual(result.mismatches, ['status']);
});

test('removing real rule support changes a sourced answer into NO SOURCE', () => {
  const c = file.cases.find(c => c.id === 'airflow-sourced');
  const removed = file.cases.find(c => c.id === 'removed-airflow-sources').without_findings;
  assert.equal(evaluateCase(c, db).actual.status, 'SOURCED');
  const result = evaluateCase(c, withoutFindings(db, removed));
  assert.equal(result.actual.status, 'NO_SOURCE');
  assert.equal(result.pass, false);
  assert.equal(result.actual.gap, 'rule_without_verified_finding');
});

test('unavailable cabins, findings and questions cannot silently use a default', () => {
  const material = file.cases[0];
  assert.throws(() => evaluateCase({ ...material, cabin: { ...material.cabin, preset: 'missing' } }, db));
  assert.throws(() => evaluateCase({ ...material, cabin: { ...material.cabin, mat: 'missing' } }, db));
  assert.throws(() => evaluateCase({ ...file.cases.at(-1), finding: 'missing' }, db));
  const officer = file.cases.find(c => c.kind === 'officer');
  assert.throws(() => evaluateCase({ ...officer, question: 'Changed question' }, db));
});

test('the published cases are byte-identical to the reviewed file', () => {
  const published = new URL('../../web/data/proof-cases.json', import.meta.url);
  assert.ok(fs.existsSync(published), 'Packaging must copy config/proof-cases.json to web/data/proof-cases.json');
  assert.equal(fs.readFileSync(published, 'utf8'), fs.readFileSync(new URL('../../config/proof-cases.json', import.meta.url), 'utf8'));
});
