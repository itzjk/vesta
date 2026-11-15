import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUESTION_SECONDS, QUESTION_STEPS, questionStep, questionTime, questionMotion, questionReveal } from '../../web/js/world/question-timeline.js';
import { buildQuestionModel } from '../../web/js/world/question-model.js';
import { lampProgress, LAMP_STAGGER } from '../../web/js/scene/lamp-sequence.js';
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

test('the explanatory model changes only gravity and names the actual affected questions', () => {
  const model = buildQuestionModel(db);
  for (const key of ['o2', 'p', 'material', 'concern', 'habitat']) assert.equal(model.after[key], model.before[key]);
  assert.equal(model.before.g, '0g'); assert.equal(model.after.g, 'moon');
  assert.deepEqual(model.counts.before, { PROVEN: 3, EXTRAPOLATED: 21, NEVER_TESTED: 21 });
  assert.deepEqual(model.counts.after, { PROVEN: 0, EXTRAPOLATED: 24, NEVER_TESTED: 21 });
  assert.deepEqual(model.changed.map(cell => cell.key), ['pmma:prevention', 'nomex:prevention', 'sibal:prevention']);
  assert.ok(model.changed.every(cell => cell.before === 'PROVEN' && cell.after === 'EXTRAPOLATED'));
  assert.deepEqual(model.notCompared.map(item => item.key), ['airflow', 'geometry', 'thickness', 'ignition', 'suppressant']);
  assert.equal(model.nearestId, 'PSI-25:10');
  assert.equal(model.selected.before.status, 'PROVEN');
  assert.equal(model.selected.after.status, 'EXTRAPOLATED');
  assert.equal(model.nearbyRowIds.before.length, 24);
  assert.deepEqual(model.nearbyRowIds.after, []);
  assert.ok(model.nearbyRowIds.before.every(id => db.testById[id]));
  assert.deepEqual(model.comparison.compared.map(item => item.state), ['different', 'matched', 'matched']);
});

test('lamp sequencing changes display colour in order and freezes with the walkthrough clock', () => {
  assert.equal(lampProgress(0, 0), 0);
  assert.ok(lampProgress(.4, 0) > 0);
  assert.equal(lampProgress(.4, 1), 0);
  assert.equal(lampProgress(LAMP_STAGGER + .55, 1), 1);
  assert.equal(lampProgress(LAMP_STAGGER * 2, 2), 0);
  assert.equal(lampProgress(3, 2), 1);
  assert.equal(lampProgress(0, 2, true), 1);
  const held = questionTime(6.4, 1000, 8000, true) - QUESTION_STEPS[1].at;
  assert.equal(lampProgress(held), lampProgress(questionTime(6.4, 1000, 9000, true) - QUESTION_STEPS[1].at));
});

test('unknowns are revealed only in the final two beats and stay explicit with reduced motion', () => {
  assert.equal(questionReveal(15.499, 5), 0);
  assert.equal(questionReveal(15.5, 5), 1);
  assert.equal(questionReveal(16.301, 5), 2);
  assert.equal(questionReveal(18.701, 5), 5);
  assert.equal(questionReveal(15.5, 5, true), 5);
  assert.equal(questionReveal(QUESTION_SECONDS, 5), 5);
});
