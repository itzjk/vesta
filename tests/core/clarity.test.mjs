import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cell, cells, tally } from '../../web/js/core/status.js';
import { run } from '../../web/js/core/officer.js';
import * as text from '../../web/js/core/text.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const station = presetPoint(db, 'station');

test('coverage copy describes nearby material conditions, never a whole-cabin test', () => {
  const sentence = text.cellSentence(cell('fx-alpha', 'prevention', station, db), 'FX Alpha', db);
  assert.match(sentence, /near these atmosphere conditions/);
  assert.match(sentence, /in VESTA's evidence base \(4 PSI investigations\)/);
  assert.match(sentence, /pressure inferred from the facility/);
  assert.doesNotMatch(sentence, /at this cabin|Tested at these conditions/);
  const legend = text.legend(db);
  assert.match(legend.PROVEN, /Flow, sample geometry, thickness, ignition and suppressant configuration are not matched/);
  assert.match(legend.PROVEN_INFERRED, /assumes.*facility.*run/);
});

test('plain status meanings separate source existence from condition coverage', () => {
  assert.match(text.statusMeaning('PROVEN'), /near these atmosphere conditions/);
  assert.match(text.statusMeaning('PROVEN', 'pressure_inferred'), /pressure.*inferred/);
  assert.match(text.statusMeaning('SOURCED'), /has a source/);
  assert.match(text.statusMeaning('EXTRAPOLATED'), /different or incomplete conditions/);
  assert.match(text.statusMeaning('NEVER_TESTED'), /in VESTA's evidence base/);
  assert.match(text.statusMeaning('NO_SOURCE'), /does not guess/);
  assert.equal(text.statusMeaning('unknown'), 'unknown');
});

test('material notes identify related evidence without changing its coverage status', () => {
  const original = db.findingById['FX-A'];
  const f = { ...original, n: { ...original.n, material_ids: ['fx-alpha'] } };
  const q = { ...station, material: 'fx-beta' };
  assert.match(text.materialNote(f, q, db), /^Different material: FX Alpha/);
  assert.equal(text.materialNote(f, { ...q, material: 'fx-alpha' }, db), null);
  assert.equal(text.materialNote(f, { ...q, material: null }, db), null);
  assert.match(text.materialNote({ n: { material_ids: [] } }, q, db), /does not name the selected material/);
});

test('relevance copy states the scale, author and limits', () => {
  assert.equal(text.SCORE_LABEL, "relevance, 0 to 100 · VESTA's weighting, not a probability and not a safety rating");
});

test('reasons scope gaps to the collection and do not call every compared finding nearest', () => {
  assert.match(text.reason('gravity_never_tested', { q: { g_label: '1/6 g' } }), /in this evidence base/);
  for (const code of ['o2_outside', 'pressure_outside']) {
    const s = text.reasonSentence(code, { delta: { o2: 11.8, p: -44.8 } });
    assert.match(s, /compared test/);
    assert.doesNotMatch(s, /nearest/);
  }
  assert.match(text.reasonSentence('different_fuel_class'), /different type of fuel/);
});

test('Simple design answer follows computed counts including an empty evidence set', () => {
  const counts = tally(cells(station, db));
  const s = text.designAnswer(counts, db);
  assert.ok(s.startsWith(`${counts.PROVEN} of ${Object.values(counts).reduce((a, b) => a + b, 0)} material questions`), s);
  assert.ok(s.includes(`${counts.NEVER_TESTED} have no row or finding`), s);
  assert.match(s, /in VESTA's evidence base \(4 PSI investigations\)/);
  assert.equal(text.designAnswer(tally([]), buildIndex({})), "There are no material questions to compare in VESTA's evidence base.");
});

test('Simple incident answer follows fired steps and the sourced maximum-delay clock', () => {
  const meta = db.scenario.meta;
  const log = run(db.scenario.frames, db, meta);
  assert.match(text.incidentAnswer(meta, 0, log, db), /^1 decision made in this scripted drill\. Earth has not heard the alarm yet\./);
  assert.match(text.incidentAnswer(meta, 1200, log, db), /before Earth heard the alarm/);
  const withoutDelay = { ...db, findingById: {} };
  assert.match(text.incidentAnswer(meta, 0, log, withoutDelay), /Earth's hearing time has no verified source/);
});
