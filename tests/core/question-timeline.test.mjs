import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUESTION_SECONDS, QUESTION_STEPS, questionStep, questionTime, questionMotion } from '../../web/js/world/question-timeline.js';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cells, tally, cell, nearestRow } from '../../web/js/core/status.js';
import { fieldRows } from '../../web/js/scene/field.js';
import { matchPanel } from '../../web/js/core/matchpanel.js';

const db = buildIndex(Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))])));

test('walk starts with one question, changes the cabin and ends inside thirty seconds', () => {
  assert.ok(QUESTION_SECONDS >= 24 && QUESTION_SECONDS <= 27);
  assert.deepEqual(QUESTION_STEPS.map(s => s.id), ['question', 'cabin', 'comparison', 'gap', 'close']);
  QUESTION_STEPS.forEach((s, i) => {
    assert.equal(questionStep(s.at), i);
    if (i) assert.equal(questionStep(s.at - .001), i - 1);
    assert.ok(s.label.split(' ').length >= 2 && s.label.split(' ').length <= 4);
  });
  assert.equal(questionStep(-1), 0);
  assert.equal(questionStep(NaN), 0);
});

test('virtual clock, pause and skip obey the same bounded timeline', () => {
  assert.equal(questionTime(0, 1000, 16000), 15);
  assert.equal(questionTime(7, 1000, 16000, true), 7);
  assert.equal(questionTime(7, 16000, 17000), 8);
  assert.equal(questionTime(24, 17000, 27000), QUESTION_SECONDS);
  assert.equal(questionTime(0, 1000, 0), 0);
  assert.equal(questionMotion(0), 0);
  assert.equal(questionMotion(.85), 1);
  assert.equal(questionMotion(0, true), 1);
  assert.ok(questionMotion(.4) > 0 && questionMotion(.4) < 1);
});

test('story observations are real core outcomes, including the facility-pressure quote', () => {
  const station = presetPoint(db, 'station', 'prevention', 'pmma');
  const lunar = { ...station, preset: 'custom', g: 'moon', gclass: 'partial', g_label: '1/6 g' };
  assert.equal(lunar.o2, station.o2);
  assert.equal(lunar.p, station.p);
  assert.equal(tally(cells(station, db)).PROVEN, 3);
  assert.equal(cell('pmma', 'prevention', station, db).status, 'PROVEN');
  assert.equal(cell('pmma', 'prevention', lunar, db).status, 'EXTRAPOLATED');
  assert.equal(fieldRows(db).filter(row => row.plane === 'moon').length, 0);
  assert.deepEqual(matchPanel(nearestRow('pmma', 'prevention', station, db).row, station, db).compared.map(x => x.state), ['matched', 'matched', 'matched']);
  assert.equal(tally(cells(lunar, db)).PROVEN, 0);
  assert.equal(cells(lunar, db).length, 45);
  const row = nearestRow('pmma', 'prevention', lunar, db).row;
  assert.equal(row.id, 'PSI-25:10');
  assert.deepEqual(matchPanel(row, lunar, db).compared.map(x => x.state), ['different', 'matched', 'matched']);
  assert.equal(row.n.p_inferred_source.gate.pass, true);
  assert.match(row.n.p_inferred_source.url, /nasa.gov/);
  assert.ok(row.n.p_inferred_source.quote.length);
  assert.equal(cell('kapton', 'prevention', lunar, db).status, 'NEVER_TESTED');
  assert.equal(nearestRow('kapton', 'prevention', lunar, db), null);
});
