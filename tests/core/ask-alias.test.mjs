import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { searchEvidence } from '../../web/js/world/ask.js';

const raw = JSON.parse(fs.readFileSync(new URL('../../web/data/findings.json', import.meta.url), 'utf8'));
const db = { findings: raw.findings ?? raw };
const ids = (query, source = db) => searchEvidence(source, query).map(result => result.finding.id);

test('oxygen formula and word return the same verified findings', () => {
  const expected = ids('oxygen');
  assert.ok(expected.length > 0);
  for (const query of ['O2', 'O₂', 'o2', 'What happens with O₂?']) assert.deepEqual(ids(query), expected);
});

test('formula search retains the requested oxygen concentration', () => {
  const expected = ids('oxygen 34');
  assert.ok(expected.includes('S-EXPL-01'));
  assert.deepEqual(ids('O2 34'), expected);
  assert.deepEqual(ids('O₂ 34'), expected);
  assert.deepEqual(ids('O2 999999'), []);
});

test('carbon dioxide does not become an oxygen match', () => {
  const source = { findings: [{ id: 'carbon-only', claim: 'CO2 detection', quote: 'CO₂ detection', gate: { pass: true }, verified: { quote: true }, n: {} }] };
  assert.deepEqual(ids('O2', source), []);
  assert.deepEqual(ids('oxygen', source), []);
});

test('formula aliases preserve the verified-evidence requirement', () => {
  const findings = [
    { id: 'rejected', claim: 'O2 oxygen 34', gate: { pass: false }, verified: { quote: true }, n: {} },
    { id: 'unverified', claim: 'O₂ oxygen 34', gate: { pass: true }, verified: { quote: false }, n: {} }
  ];
  assert.deepEqual(ids('O2', { findings }), []);
});
