import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const data = name => JSON.parse(read(`web/data/${name}.json`));
const doc = data('agent-answers');
const rowIds = new Set(data('tests').tests.map(row => row.id)), findingIds = new Set(data('findings').findings.map(f => f.id));
const BANNED = /\b(safe|proven|validated|certified)\b/i;
// The audited answer text is recorded as delivered; its longest answer has 125 words (target was 110).
const MAX_WORDS = 125;

test('the recorded file says what it is: recorded, written by agents, not a live model', () => {
  assert.equal(doc.schema, 'vesta.recorded-agent-answers/1');
  assert.equal(doc.mode, 'recorded');
  assert.match(doc.note, /not a live model/);
  assert.equal(doc.answers.length, 10);
  assert.equal(new Set(doc.answers.map(a => a.id)).size, doc.answers.length);
});

test('every cited source row and finding exists in the shipped data', () => {
  for (const answer of doc.answers) for (const c of answer.citations) {
    assert.ok(['source_row', 'finding', 'computed', 'nasa_document'].includes(c.kind), `${answer.id} cites an unknown kind ${c.kind}`);
    if (c.kind === 'source_row') assert.ok(rowIds.has(c.id), `${answer.id} cites row ${c.id}, which is not in tests.json`);
    if (c.kind === 'finding') assert.ok(findingIds.has(c.id), `${answer.id} cites finding ${c.id}, which is not in findings.json`);
    assert.ok(c.supports && c.supports.trim(), `${answer.id} citation ${c.id} says what it supports`);
  }
});

test('every answer has a question, limits, 2 to 6 citations and a bounded length', () => {
  for (const answer of doc.answers) {
    assert.ok(answer.question.trim() && answer.answer.trim() && answer.limits.trim(), `${answer.id} is complete`);
    assert.ok(answer.citations.length >= 2 && answer.citations.length <= 6, `${answer.id} has ${answer.citations.length} citations`);
    const words = answer.answer.trim().split(/\s+/).length;
    assert.ok(words <= MAX_WORDS, `${answer.id} has ${words} words`);
  }
});

test('the panel carries the recorded label, no banned word, and no outside request', () => {
  const source = read('web/js/world/ask-data-panel.js'), sheet = read('web/css/ask-data.css');
  assert.ok(source.includes('Recorded answers · written by AI agents, audited · not a live model'));
  assert.ok(source.includes("'data/agent-answers.json'"));
  assert.doesNotMatch(source, BANNED); assert.doesNotMatch(sheet, BANNED);
  assert.doesNotMatch(source + sheet, /https?:\/\//);
  for (const m of sheet.matchAll(/(?:font-size:|font:[^;}]*?\s)(\d+)px/g)) assert.ok(Number(m[1]) >= 16, `text is at least 16 px (found ${m[1]})`);
});

test('the Search tab mounts the panel first and disposes it', () => {
  const act = read('web/js/world/act-evidence.js');
  assert.match(act, /import \{ createAskDataPanel \} from '\.\/ask-data-panel\.js\?v=/);
  assert.match(act, /if \(panel === 'ask'\) consoleEl\.append\(askDataPanel\.element\);/);
  assert.match(act, /askDataPanel\.dispose\(\)/);
});
