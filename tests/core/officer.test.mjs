// WP2 · core/officer.js and core/clock.js on the synthetic fixture (DESIGN.md 3.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, withoutFindings } from '../../web/js/core/index.js';
import { run, decide, decisionLog, checkFrame, parseFrames, FRAME_FIELDS, TELEMETRY } from '../../web/js/core/officer.js';
import { clock, mmss } from '../../web/js/core/clock.js';

const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const { meta, frames } = db.scenario;
const log = run(frames, db, meta);
const step = id => log.find(e => e.step === id);

test('each step fires once, in playbook order, at the first frame where its predicates and its "after" hold', () => {
  assert.deepEqual(log.map(e => [e.step, e.t]), [['X1', 0], ['X2', 10], ['X3', 20], ['X4', 30], ['X5', 100], ['X6', 120], ['X7', 140], ['X8', 150]]);
});

test('a predicate on a field the frame does not carry never holds', () => {
  assert.equal(step('X9'), undefined);                                 // hatch_open is in no frame
  const pb = { steps: [{ id: 'A', label: 'A', kind: 'rule', after: [], when: [['material_reported', '!=', null]], pillar: 'prevention', rule_ids: [], finding_ids: [], fallback: 'FX-PROT-1', say: 'A' }] };
  assert.equal(run([{ t: 0, o2_percent: 34, pressure_kpa: 56.5 }], { ...db, playbook: pb }, meta).length, 0);                        // field absent
  assert.equal(run([{ t: 0, o2_percent: 34, pressure_kpa: 56.5, material_reported: null }], { ...db, playbook: pb }, meta).length, 0);   // null != null is false
  assert.equal(run([{ t: 0, o2_percent: 34, pressure_kpa: 56.5, material_reported: 'x' }], { ...db, playbook: pb }, meta).length, 1);
});

test('two steps can fire on one frame when the second only waits for the first', () => {
  const s = (id, after) => ({ id, label: id, kind: 'rule', after, when: [['t', '>=', 0]], pillar: 'prevention', rule_ids: [], finding_ids: [], fallback: 'FX-PROT-1', say: id });
  const out = run([{ t: -5 }, { t: 0 }, { t: 10 }], { ...db, playbook: { steps: [s('A', []), s('B', ['A']), s('C', ['B'])] } }, meta);
  assert.deepEqual(out.map(e => [e.step, e.t]), [['A', 0], ['B', 0], ['C', 0]]);
  // listed before the step it waits for: it fires on the next frame
  const late = run([{ t: 0 }, { t: 10 }], { ...db, playbook: { steps: [s('B', ['A']), s('A', [])] } }, meta);
  assert.deepEqual(late.map(e => [e.step, e.t]), [['A', 0], ['B', 10]]);
});

test('SOURCED from a rule: basis follows the best citation; coverage is a separate field', () => {
  const x1 = step('X1');
  assert.equal(x1.state, 'SOURCED'); assert.equal(x1.basis, 'summary'); assert.equal(x1.rule_id, 'FX-R-VENT');
  assert.deepEqual(x1.nasa, [{ finding_id: 'FX-S-VENT', score: 70 }]);                  // the unverified id FX-MISSING is ignored
  assert.equal(x1.action, 'Fixture decision of FX-R-VENT.');
  assert.equal(x1.interpretation, true);
  assert.equal(x1.limits, 'Fixture limits of FX-R-VENT.');
  assert.deepEqual(x1.coverage, { status: 'EXTRAPOLATED', reasons: ['not_an_experiment', 'o2_not_reported', 'pressure_not_reported'] });
  assert.equal(x1.protocol, null); assert.equal(x1.gap, null);
  assert.equal(step('X2').basis, 'operations');
  assert.equal(step('X3').basis, 'experiment');
});

test('Earth column: a verified instinct finding gives its id; an unverified or absent one gives null', () => {
  assert.deepEqual(step('X3').earth, { text: 'Fixture instinct of FX-R-AIM.', finding_id: 'FX-EARTH' });
  assert.deepEqual(step('X4').earth, { text: 'Fixture instinct of FX-R-NOFLAME.', finding_id: null });   // FX-NOT-VERIFIED is not in the base
  assert.deepEqual(step('X1').earth, { text: 'Fixture instinct of FX-R-VENT.', finding_id: null });
});

test('coverage carries different_fuel_class when the evidence is on another fuel class than the step', () => {
  const x4 = step('X4');
  assert.equal(x4.state, 'SOURCED'); assert.equal(x4.basis, 'experiment');
  assert.deepEqual(x4.nasa.map(n => n.finding_id), ['FX-D', 'FX-E']);                   // ranked, at most three
  assert.deepEqual(x4.coverage, { status: 'EXTRAPOLATED', reasons: ['o2_not_reported', 'pressure_not_reported', 'different_fuel_class'] });
});

test('NO SOURCE (a): the rule has no verified finding left; the protocol line stands in', () => {
  const x5 = step('X5');
  assert.equal(x5.state, 'NO_SOURCE'); assert.equal(x5.gap, 'rule_without_verified_finding');
  assert.equal(x5.basis, null); assert.equal(x5.rule_id, null); assert.equal(x5.earth, null);
  assert.deepEqual(x5.nasa, []); assert.equal(x5.interpretation, false); assert.equal(x5.coverage, null); assert.equal(x5.limits, null);
  assert.deepEqual(x5.protocol, { id: 'FX-PROT-1', action: 'Fixture protocol action one.', finding_id: 'FX-PROT-1', limit: 'Fixture limit line.' });
  assert.equal(x5.action, 'Fixture protocol action one.');
});

test('NO SOURCE (c): the reported material has no row and no finding; the protocol line failed the gate too', () => {
  const x6 = step('X6');
  assert.equal(x6.state, 'NO_SOURCE'); assert.equal(x6.gap, 'no_row_no_finding');
  assert.equal(x6.cell.status, 'NEVER_TESTED'); assert.equal(x6.cell.material, 'fx-kappa');
  assert.deepEqual(x6.cell.elsewhere, ['detection']);
  assert.equal(x6.protocol, null);
  assert.equal(x6.action, 'Hand the decision to the crew. No verified protocol line for this step.');
});

test('NO SOURCE (b): the step has no rule and no finding', () => {
  const x7 = step('X7');
  assert.equal(x7.state, 'NO_SOURCE'); assert.equal(x7.gap, 'no_verified_finding_on_topic');
  assert.equal(x7.protocol.id, 'FX-PROT-2');
});

test('a material step with rows is SOURCED from the Design cell at the cabin of the frame', () => {
  const x8 = step('X8');
  assert.equal(x8.state, 'SOURCED'); assert.equal(x8.basis, 'experiment'); assert.equal(x8.rule_id, null); assert.equal(x8.earth, null);
  assert.equal(x8.cell.material, 'fx-alpha');
  assert.deepEqual(x8.coverage, { status: 'EXTRAPOLATED', reasons: ['o2_outside', 'pressure_outside'] });   // 34 % and 56.5 kPa in 0 g
  assert.deepEqual(x8.row_ids, ['FX-PSI-1:2']);
  assert.equal(x8.action, 'Fixture action for a tested material.');
  assert.equal(x8.limits, 'Fixture limits of X8.');
  assert.deepEqual(x8.nasa, []);
});

test('removing the findings of a rule turns its step into NO SOURCE with the fallback protocol line', () => {
  const cut = withoutFindings(db, ['FX-S-VENT']);
  const x1 = run(frames, cut, meta).find(e => e.step === 'X1');
  assert.equal(x1.state, 'NO_SOURCE'); assert.equal(x1.gap, 'rule_without_verified_finding'); assert.equal(x1.protocol.id, 'FX-PROT-1');
  assert.equal(db.findingById['FX-S-VENT'].id, 'FX-S-VENT');                            // the original index is untouched
  assert.equal(step('X1').state, 'SOURCED');
});

test('every result has the StepResult head and one of the two states', () => {
  for (const e of log) {
    for (const k of ['step', 't', 'label', 'question', 'pillar', 'say', 'state', 'nasa', 'action', 'interpretation'])
      assert.notEqual(e[k], undefined, `${e.step}.${k}`);
    assert.ok(['SOURCED', 'NO_SOURCE'].includes(e.state));
    if (e.state === 'SOURCED') { assert.ok(['experiment', 'summary', 'operations'].includes(e.basis)); assert.ok(e.coverage && Array.isArray(e.coverage.reasons)); }
    else { assert.equal(e.basis, null); assert.equal(typeof e.gap, 'string'); }
  }
});

test('the officer is deterministic: two runs are deep-equal, and a single decide() equals the logged step', () => {
  assert.deepEqual(run(frames, db, meta), log);
  assert.equal(JSON.stringify(run(frames, db, meta)), JSON.stringify(log));
  const s = db.playbook.steps.find(x => x.id === 'X3'), fr = frames.find(f => f.t === 20);
  assert.deepEqual(decide(s, fr, db, meta), step('X3'));
});

test('clock: the sourced maxima, progress to "Earth hears", and the counts by basis', () => {
  const c = clock(meta, 30, log, db);
  assert.equal(c.sent, 0); assert.equal(c.heard, 1200); assert.equal(c.reply, 2400);
  assert.equal(c.progress, 30 / 1200); assert.equal(c.to_reply, 2370);
  assert.deepEqual(c.decided, { steps: 4, experiment: 2, summary: 1, operations: 1, no_source: 0 });
  assert.deepEqual(clock(meta, 160, log, db).decided, { steps: 8, experiment: 3, summary: 1, operations: 1, no_source: 3 });
  assert.deepEqual(clock(meta, -5, log, db).decided, { steps: 0, experiment: 0, summary: 0, operations: 0, no_source: 0 });
  assert.equal(clock(meta, -5, log, db).progress, 0);
  assert.equal(clock(meta, 5000, log, db).progress, 1); assert.equal(clock(meta, 5000, log, db).to_reply, 0);
});

test('clock: a delay whose finding is missing has no number', () => {
  const c = clock(meta, 30, log, withoutFindings(db, ['FX-COMM-1']));
  assert.equal(c.heard, null); assert.equal(c.progress, null); assert.equal(c.reply, 2400);
  const d = clock(meta, 30, log, withoutFindings(db, ['FX-COMM-2']));
  assert.equal(d.reply, null); assert.equal(d.to_reply, null); assert.equal(d.heard, 1200);
});

test('mmss prints mission time', () => {
  assert.equal(mmss(240), 'T+04:00'); assert.equal(mmss(0), 'T+00:00'); assert.equal(mmss(-30), 'T-00:30');
  assert.equal(mmss(1200), 'T+20:00'); assert.equal(mmss(2160, true), '36:00'); assert.equal(mmss(7200), 'T+120:00');
});

test('decisionLog wraps the same array with the scenario, the cabin and the clock at the last step', () => {
  const d = decisionLog(frames, db, meta);
  assert.equal(d.schema, 'vesta.decision-log/1'); assert.equal(d.scenario, 'FX-SCEN-1'); assert.equal(d.simulated, true);
  assert.deepEqual(d.steps, log);
  assert.deepEqual(d.cabin, { preset: 'spacecraft', habitat: 'spacecraft', gclass: 'micro', zone: 'fx-bay', o2_percent: 34, pressure_kpa: 56.5 });
  assert.deepEqual(d.clock, clock(meta, 150, log, db));
  assert.deepEqual(decisionLog(frames, db, meta), d);
});

test('checkFrame and parseFrames: vesta.telemetry/1, JSON Lines or an array, the first bad line stops everything', () => {
  assert.equal(TELEMETRY, 'vesta.telemetry/1');
  assert.deepEqual(Object.keys(FRAME_FIELDS).slice(0, 2), ['schema', 't']);
  for (const fr of frames) assert.equal(checkFrame(fr), null);
  assert.equal(checkFrame({ schema: TELEMETRY, t: 3 }), null);                           // only schema and t are required
  assert.match(checkFrame({ schema: 'other/1', t: 3 }), /^schema/);
  assert.match(checkFrame({ schema: TELEMETRY }), /^t /);
  assert.match(checkFrame({ schema: TELEMETRY, t: 0, fans_on: 'yes' }), /^fans_on/);
  assert.match(checkFrame({ schema: TELEMETRY, t: 0, material_reported: 4 }), /^material_reported/);
  assert.equal(checkFrame({ schema: TELEMETRY, t: 0, material_reported: null, extra_field: [1] }), null);
  const jsonl = frames.map(f => JSON.stringify(f)).join('\n') + '\n';
  assert.deepEqual(parseFrames(jsonl), { frames, error: null });
  assert.deepEqual(parseFrames(JSON.stringify(frames)).frames, frames);
  const bad = parseFrames(JSON.stringify(frames[0]) + '\n\n' + JSON.stringify({ ...frames[1], co_ppm: 'high' }) + '\n');
  assert.deepEqual(bad.frames, []);
  assert.equal(bad.error.line, 3); assert.equal(bad.error.message, 'Line 3 is not vesta.telemetry/1: co_ppm (expected a number).');
  assert.equal(parseFrames('{not json').error.line, 1);
  assert.equal(parseFrames('').error.line, 1);
  assert.deepEqual(run(parseFrames(jsonl).frames, db, meta), log);                       // a loaded file runs the same officer
});
