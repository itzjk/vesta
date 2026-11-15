import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, withoutFindings } from '../../web/js/core/index.js';
import * as officer from '../../web/js/core/officer.js';
import * as clock from '../../web/js/core/clock.js';
import * as text from '../../web/js/core/text.js';
import { createDrillModel, basisKey, evidenceIds } from '../../web/js/world/drill-thread.js';
import { summarize } from '../../web/js/world/debrief.js';

const names = ['tests', 'findings', 'rules', 'protocol', 'playbook', 'scenario', 'presets', 'investigations', 'tables'];
const raw = Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))]));
const db = buildIndex(raw), core = { officer, clock, text }, model = createDrillModel({ db, core });

test('thread follows every actual officer decision, including before the alarm and rewind', () => {
  assert.equal(model.at({ t: -30 }).count, 0);
  assert.equal(model.at({ t: -30 }).current, null);
  const log = officer.run(db.scenario.frames, db, db.scenario.meta);
  assert.equal(model.at({}).t, db.scenario.frames[0].t);
  assert.equal(model.at({ t: null }).count, 0);
  for (const [i, entry] of log.entries()) {
    const state = model.at({ t: entry.t, shot: 'silence' });
    assert.equal(state.count, i + 1);
    assert.equal(state.total, log.length);
    assert.deepEqual(state.current, entry);
    assert.equal(state.silence, true);
  }
  assert.equal(model.at({ t: log[0].t }).count, 1);
  assert.equal(model.at({ t: 'not a time' }).count, 0);
});

test('completion includes the Silence, not only the last decision, and resets on rewind', () => {
  assert.equal(model.at({ t: model.log.at(-1).t }).complete, false);
  assert.equal(model.at({ t: model.end - 0.001 }).complete, false);
  assert.equal(model.at({ t: model.end }).complete, true);
  assert.equal(model.at({ t: db.scenario.frames[0].t }).complete, false);
  assert.equal(model.end, model.first + db.scenario.meta.comm.one_way_min * 60);
  assert.equal(model.at({ t: model.end }).clock.to_reply, 1200);
});

test('recomputes coverage after removing experiment support; never preserves advertised totals', () => {
  const experiment = model.log.find(entry => entry.basis === 'experiment');
  const ids = db.rules.find(rule => rule.id === experiment.rule_id).finding_ids;
  const changed = withoutFindings(db, ids);
  const next = createDrillModel({ db: changed, core });
  const counts = summarize(next, { t: next.end }).counts;
  assert.notDeepEqual(counts, summarize(model, { t: model.end }).counts);
  assert.equal(next.log.find(entry => entry.step === experiment.step).state, 'NO_SOURCE');
  assert.ok(evidenceIds(experiment, changed).every(id => changed.findingById[id]));
});

test('absent delay citations cannot supply a numeric Earth delay; alarm time is the clock origin', () => {
  const changed = withoutFindings(db, [db.scenario.meta.comm.one_way_finding, db.scenario.meta.comm.round_trip_finding]);
  const absent = createDrillModel({ db: changed, core });
  assert.equal(absent.at({ t: absent.end }).clock.heard, null);
  assert.equal(absent.at({ t: absent.end }).clock.reply, null);
  const offset = 100, shifted = { ...db, scenario: { meta: db.scenario.meta, frames: db.scenario.frames.map(frame => ({ ...frame, t: frame.t + offset })) } };
  const later = createDrillModel({ db: shifted, core });
  assert.equal(later.end, later.first + later.at({ t: later.first }).clock.heard);
});

test('export stays the exact officer decisionLog schema, including gaps and vehicle boundaries', () => {
  const log = JSON.parse(JSON.stringify(officer.decisionLog(model.frames, db, model.meta)));
  assert.equal(log.schema, 'vesta.decision-log/1');
  assert.deepEqual(log.steps, model.log);
  assert.equal(log.simulated, true);
  assert.ok(log.steps.filter(entry => entry.protocol).every(entry => entry.protocol.limit.includes('not validated for this vehicle')));
});

test('missing or untriggerable scripts have no invented progress or summary', () => {
  assert.equal(createDrillModel({ db: { ...db, scenario: null }, core }), null);
  assert.equal(createDrillModel({ db: { ...db, playbook: { steps: [] } }, core }), null);
  assert.equal(createDrillModel({ db: { ...db, scenario: { meta: db.scenario.meta, frames: db.scenario.frames.slice(0, 1) } }, core }), null);
  assert.equal(summarize(null, {}), null);
});
