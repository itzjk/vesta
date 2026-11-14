import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { match } from '../../web/js/core/match.js';
import { findingStatus } from '../../web/js/core/status.js';
import { score } from '../../web/js/core/rank.js';
import { decide } from '../../web/js/core/officer.js';
import * as text from '../../web/js/core/text.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const station = presetPoint(db, 'station');
const finding = db.findingById['FX-A'];

test('unknown cabin atmosphere cannot produce PROVEN or NaN deltas', () => {
  for (const unknown of [undefined, null, NaN, Infinity]) {
    const q = { ...station, o2: unknown, p: unknown };
    const result = match(finding.n, q, db.base);
    assert.deepEqual(result.fail, ['o2_not_reported', 'pressure_not_reported']);
    assert.deepEqual(result.delta, {});
    assert.equal(findingStatus(finding, q, db).status, 'EXTRAPOLATED');
    assert.ok(Number.isFinite(score(finding, q, db).total));
  }
});

test('unknown atmosphere in a valid sparse frame remains EXTRAPOLATED', () => {
  const step = { id: 'FX-SPARSE', kind: 'rule', pillar: 'prevention', rule_ids: ['FX-SPARSE-RULE'], finding_ids: [] };
  const rule = { id: 'FX-SPARSE-RULE', finding_ids: ['FX-A'], vesta_decides: 'Fixture sourced action.' };
  const result = decide(step, { schema: 'vesta.telemetry/1', t: 0 }, { ...db, ruleById: { ...db.ruleById, [rule.id]: rule } }, db.scenario.meta);
  assert.equal(result.state, 'SOURCED');
  assert.deepEqual(result.coverage, { status: 'EXTRAPOLATED', reasons: ['o2_not_reported', 'pressure_not_reported'] });
  assert.ok(result.nasa.every(cite => Number.isFinite(cite.score)));
});

test('non-finite source conditions cannot produce PROVEN', () => {
  for (const unknown of [NaN, Infinity, [NaN, 22], [20, Infinity]]) {
    const result = match({ ...finding.n, o2: unknown, p: unknown }, station, db.base);
    assert.deepEqual(result.fail, ['o2_not_reported', 'pressure_not_reported']);
    assert.deepEqual(result.delta, {});
  }
});

test('unknown numbers render as missing rather than zero or non-finite copy', () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(text.pressure(value), 'not stated');
    assert.equal(text.oxygen(value), 'not stated');
    assert.equal(text.psia(value), null);
    assert.equal(text.signed(value), null);
  }
  assert.equal(text.oxygen(0), '0 % O2');
});

test('score explanations and delta copy do not invent a missing cabin oxygen value', () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    const q = { ...station, o2: value, p: value };
    const entry = { f: finding, ...score(finding, q, db) };
    const sentence = text.term('atmosphere', entry, q);
    assert.ok(sentence.includes('your cabin is not stated'), sentence);
    assert.doesNotMatch(sentence, /NaN|Infinity/);
    assert.equal(text.delta({ o2: value, p: value }), 'no oxygen or pressure value to compare');
  }
});
