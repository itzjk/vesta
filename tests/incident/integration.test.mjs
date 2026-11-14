import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildIndex, withoutFindings } from '../../web/js/core/index.js';
import * as officer from '../../web/js/core/officer.js';
import * as clock from '../../web/js/core/clock.js';
import { parseTelemetry, decisionLog } from '../../web/js/views/incident.js';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const built = existsSync(new URL('web/data/scenario.json', root));
const skip = built ? false : 'web/data is absent; waiting for WP1 real-data build';
const raw = {};
if (built) for (const key of ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'engine']) raw[key] = read(`web/data/${key}.json`);
const db = built ? buildIndex(raw) : null;

test('real build ships all nine protocol lines with verified quotes', { skip }, () => {
  assert.equal(db.protocol.length, 9);
  for (const p of db.protocol) {
    assert.ok(db.findingById[p.finding_id]?.gate.pass, p.id);
    assert.ok(db.findingById[p.finding_id].quote.length >= 25);
    assert.match(p.limit, /not validated for this vehicle/);
  }
});

test('real scenario fires eight decisions at the specified times and repeats byte for byte', { skip }, () => {
  const { frames, meta } = db.scenario;
  const log = officer.run(frames, db, meta);
  assert.deepEqual(log.map(e => [e.step, e.t]), [['S1', 0], ['S2', 20], ['S3', 60], ['S4', 150], ['S5', 240], ['S6', 360], ['S7', 480], ['S8', 600]]);
  assert.deepEqual(officer.run(frames, db, meta), log);
  for (const e of log) {
    if (e.state === 'SOURCED') {
      assert.ok(e.coverage);
      assert.ok(e.nasa.length || e.row_ids?.length);
      for (const cite of e.nasa) assert.ok(db.findingById[cite.finding_id].gate.pass);
    } else {
      assert.ok(e.gap);
      assert.equal(e.interpretation, false);
      assert.ok(e.protocol);
      assert.ok(db.findingById[e.protocol.finding_id].quote);
    }
  }
  assert.ok(log.find(e => e.step === 'S6').coverage.reasons.includes('different_fuel_class'));
});

test('source removal produces NO SOURCE with the verified conservative fallback', { skip }, () => {
  const cut = withoutFindings(db, ['S-VENT-01', 'S-FLOW-01']);
  const step = officer.run(db.scenario.frames, cut, db.scenario.meta).find(e => e.step === 'S2');
  assert.equal(step.state, 'NO_SOURCE');
  assert.equal(step.protocol.id, 'PROT-03');
  const noProtocol = withoutFindings(cut, ['PROT-03']);
  const missing = officer.run(db.scenario.frames, noProtocol, db.scenario.meta).find(e => e.step === 'S2');
  assert.equal(missing.protocol, null);
  assert.match(missing.action, /Hand the decision to the crew/);
});

test('three-line user telemetry loads and runs the same officer', { skip }, () => {
  const frames = db.scenario.frames.filter(fr => [0, 20, 60].includes(fr.t));
  const parsed = parseTelemetry(frames.map(fr => JSON.stringify(fr)).join('\n'));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.frames.length, 3);
  assert.deepEqual(officer.run(parsed.frames, db, db.scenario.meta).map(e => e.step), ['S1', 'S2', 'S3']);
});

test('real scenario export equals the static API StepResult array and envelope', { skip }, () => {
  const { frames, meta } = db.scenario;
  const output = decisionLog({ db, frames, meta, core: { officer, clock } });
  const api = read('web/api/v1/officer/transit-avionics-01.json');
  assert.deepEqual(output.steps, api.steps);
  assert.deepEqual(output, api);
});

test('delay findings control each clock independently and basis counts sum to all steps', { skip }, () => {
  const { frames, meta } = db.scenario;
  const log = officer.run(frames, db, meta);
  const c = clock.clock(meta, 1200, log, db);
  assert.equal(c.heard, 1200);
  assert.equal(c.reply, 2400);
  assert.equal(c.progress, 1);
  assert.equal(c.decided.steps, 8);
  assert.equal(c.decided.experiment + c.decided.summary + c.decided.operations + c.decided.no_source, 8);
  assert.equal(clock.clock(meta, 250, log, withoutFindings(db, [meta.comm.one_way_finding])).progress, null);
  assert.equal(clock.clock(meta, 250, log, withoutFindings(db, [meta.comm.round_trip_finding])).to_reply, null);
});


test('optional atmosphere stays unknown while known smoke still triggers the officer', { skip }, () => {
  const parsed = parseTelemetry('{"schema":"vesta.telemetry/1","t":0,"smoke_pct_alarm":105}');
  assert.equal(parsed.ok, true);
  const log = officer.run(parsed.frames, db, db.scenario.meta);
  assert.equal(log[0].step, 'S1');
  assert.equal(log[0].coverage.status, 'EXTRAPOLATED');
  assert.ok(log[0].coverage.reasons.includes('o2_not_reported'));
  assert.ok(log[0].coverage.reasons.includes('pressure_not_reported'));
});
