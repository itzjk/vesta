import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { questionSummary } from '../../web/js/core/question-summary.js';
import { parseQuestion, answerTyped, TYPED_LABEL } from '../../web/js/core/ask-parse.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw);
const BANNED = /\b(safe|proven|validated|certified)\b/i;

test('the parser reads material, concern and cabin by fixed words', () => {
  assert.deepEqual({ ...parseQuestion('Can Nomex ignite on the Moon?', db) }, { material: 'nomex', concern: 'prevention', cabin: 'lunar-base' });
  assert.deepEqual({ ...parseQuestion('how do I put out burning PMMA on the ISS', db) }, { material: 'pmma', concern: 'suppression', cabin: 'station' });
  assert.deepEqual({ ...parseQuestion('Will a smoke alarm notice Kapton in the pressurized rover on the moon?', db) }, { material: 'kapton', concern: 'detection', cabin: 'rover' });
  assert.deepEqual({ ...parseQuestion('teflon detection, mars', db) }, { material: 'teflon', concern: 'detection', cabin: 'mars-base' });
  assert.deepEqual({ ...parseQuestion('SIBAL in transit', db) }, { material: 'sibal', concern: null, cabin: 'spacecraft' });
});

test('the longest material name wins and partial words do not match', () => {
  assert.equal(parseQuestion('paraffin wax', db).material, 'paraffin-wax');
  assert.equal(parseQuestion('Japan wax candle', db).material, 'japan-wax');
  assert.equal(parseQuestion('PMMA + Nomex', db).material, 'pmma-nomex');
  assert.equal(parseQuestion('silicone rubber', db).material, 'silicone-rubber');
  assert.equal(parseQuestion('waxing the floor', db).material, null);
  assert.equal(parseQuestion('acrylic sheet', db).material, null, 'no synonym the data does not carry');
});

test('every material label in the collection is recognised', () => {
  for (const [id, m] of Object.entries(db.materials)) assert.equal(parseQuestion(`What about ${m.label}?`, db).material, id);
});

test('the answer is the existing summary of the existing cell', () => {
  const r = answerTyped('Can PMMA burn on the station?', db, presetPoint(db, 'lunar-base'));
  const cell = status.cell('pmma', 'prevention', presetPoint(db, 'station'), db);
  assert.equal(r.kind, 'answer');
  assert.deepEqual(r.summary, questionSummary(cell, db, { material: 'PMMA', concern: 'Prevention', cabin: 'Space station' }));
  assert.equal(r.rowId, cell.hit_ids[0]); assert.equal(r.rowIsMatch, true);
  assert.ok(db.testById[r.rowId]);
  assert.deepEqual([...r.assumed], []);
});

test('a missing concern or cabin is assumed and said so', () => {
  const r = answerTyped('Nomex', db, presetPoint(db, 'mars-base'));
  assert.equal(r.concern, 'prevention'); assert.equal(r.concernAssumed, true); assert.equal(r.cabinAssumed, true); assert.equal(r.preset, 'mars-base');
  assert.match(r.assumed[0], /prevention was assumed/); assert.match(r.assumed[1], /current cabin \(Mars surface habitat\)/);
  const custom = answerTyped('Nomex', db, { preset: 'custom', o2: 28, p: 60, gclass: 'partial', g: 'moon' });
  assert.equal(custom.cabin, 'your custom cabin');
});

test('no material: says so and lists the collection; empty text gives nothing', () => {
  const r = answerTyped('Is wood dangerous on Mars?', db, presetPoint(db, 'station'));
  assert.equal(r.kind, 'no_material'); assert.match(r.message, /No material/);
  assert.deepEqual([...r.materials], Object.values(db.materials).map(m => m.label));
  assert.equal(answerTyped('   ', db, null).kind, 'empty');
});

test('every material, concern and cabin answers without a banned word', () => {
  for (const m of Object.values(db.materials)) for (const c of ['prevent', 'detect', 'suppress', '']) for (const p of db.presets) {
    const r = answerTyped(`${m.label} ${c} ${p.label}`, db, null);
    assert.equal(r.kind, 'answer'); assert.equal(r.preset, p.id);
    const text = [r.summary.title, r.summary.answer, ...r.summary.lines, r.summary.next, ...r.assumed, r.cabin].join(' ');
    assert.doesNotMatch(text, /\bsafe\b|proven|validated|certif|undefined|NaN/i);
    if (r.rowId) assert.ok(db.testById[r.rowId], `${r.rowId} is a shipped row`);
  }
});

test('the parser and panel carry the fixed-rules label, no banned word and no request', () => {
  const parse = read('web/js/core/ask-parse.js'), panel = read('web/js/world/ask-data-panel.js');
  assert.equal(TYPED_LABEL, 'Computed from the loaded NASA rows by fixed rules · no language model');
  assert.doesNotMatch(parse, BANNED); assert.doesNotMatch(parse, /fetch\(|https?:\/\/|XMLHttpRequest/);
  assert.match(panel, /TYPED_LABEL/); assert.match(panel, /'Open this question'/);
  assert.match(panel, /db\?\.materials && typeof getQuery === 'function'/, 'the typed box is hidden without db and getQuery');
});
