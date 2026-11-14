import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTelemetry, frameProblem, prepareFrames, thresholds, crewLog, decisionLog, TELEMETRY_SCHEMA } from '../../web/js/views/incident.js';
import * as officer from '../../web/js/core/officer.js';
import * as clock from '../../web/js/core/clock.js';
import { buildIndex } from '../../web/js/core/index.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = buildIndex(read('../fixtures/core.fixture.json'));
const meta = read('../../config/scenarios/transit-avionics-01.meta.json');
const playbook = read('../../config/playbook.json');
const scenario = parseTelemetry(readFileSync(new URL('../../config/scenarios/transit-avionics-01.jsonl', import.meta.url), 'utf8'));
const f = t => ({ schema: TELEMETRY_SCHEMA, t, o2_percent: 34, pressure_kpa: 56.5, simulated: true });

test('every authored scenario frame validates and all scheduled key frames are present', () => {
  assert.equal(scenario.ok, true);
  assert.equal(scenario.frames.length, 70);
  assert.equal(scenario.frames[0].t, -30);
  assert.equal(scenario.frames.at(-1).t, 660);
  for (const fr of scenario.frames) {
    assert.equal(frameProblem(fr), null);
    assert.equal(officer.checkFrame(fr), null);
    assert.equal(fr.simulated, true);
    assert.equal(fr.o2_percent, 34);
    assert.equal(fr.pressure_kpa, 56.5);
  }
  for (const t of [0, 20, 60, 150, 240, 360, 480, 600]) assert.ok(scenario.frames.some(fr => fr.t === t));
  assert.equal(meta.simulated, true);
});

test('JSON Lines and a JSON array produce the same frames, including BOM and blank lines', () => {
  const frames = [f(0), f(20), f(60)];
  const jsonl = '\uFEFF' + frames.map(fr => JSON.stringify(fr)).join('\r\n\r\n') + '\n';
  assert.deepEqual(parseTelemetry(jsonl), { ok: true, frames });
  assert.deepEqual(parseTelemetry(JSON.stringify(frames)), { ok: true, frames });
  assert.equal(frameProblem({ schema: TELEMETRY_SCHEMA, t: 0 }), null);
  assert.equal(frameProblem({ ...f(0), material_reported: null }), null);
});

test('a broken physical line rejects the whole file and identifies the field', () => {
  const result = parseTelemetry(JSON.stringify(f(0)) + '\n\n' + JSON.stringify({ ...f(20), fans_on: 'off' }));
  assert.equal(result.ok, false);
  assert.equal(result.frames, undefined);
  assert.equal(result.line, 3);
  assert.equal(result.field, 'fans_on');
  assert.equal(result.message, 'Line 3 is not vesta.telemetry/1: fans_on.');
  for (const input of ['', '[]', '{bad', '[{bad', 'null']) assert.equal(parseTelemetry(input).ok, false);
});

test('finite numeric fields, typed booleans, schema and timestamp are validated', () => {
  for (const [field, value] of [['schema', 'wrong'], ['t', null], ['co_ppm', '12'], ['temp_c', Infinity], ['airflow_cm_s', NaN], ['zone', 3], ['material_reported', false]]) {
    assert.equal(frameProblem({ ...f(0), [field]: value }).field, field);
  }
  assert.equal(parseTelemetry(JSON.stringify([f(20), f(0)])).field, 't');
  assert.equal(parseTelemetry(JSON.stringify([f(0), f(0)])).ok, true);
});

test('absent atmosphere stays unknown, never inherited from a frame or the scenario', () => {
  const frames = [f(0), { schema: TELEMETRY_SCHEMA, t: 20 }];
  const copy = structuredClone(frames);
  const result = prepareFrames(frames, { o2: 21, p_kpa: 101.3 });
  assert.equal(result.usable, true);
  assert.equal(result.frames[1].o2_percent, undefined);
  assert.equal(result.frames[1].pressure_kpa, undefined);
  assert.deepEqual(frames, copy);
  assert.equal(prepareFrames([f(0), f(20)]).usable, true);
  assert.equal(prepareFrames([]).usable, false);
});

test('thresholds come only from numeric playbook predicates', () => {
  const t = thresholds(playbook);
  assert.deepEqual(t.smoke_pct_alarm, [{ op: '>=', value: 100, step: 'S1' }, { op: '<=', value: 50, step: 'S8' }]);
  assert.equal(t.fans_on, undefined);
  assert.equal(t.t, undefined);
  assert.deepEqual(t.temp_c, [{ op: '>=', value: 60, step: 'S5' }]);
});

test('crew log records actual state changes and the source state of each decision', () => {
  const frames = [f(0), { ...f(20), fans_on: true }, { ...f(60), fans_on: false, material_reported: 'Kapton' }];
  const log = [{ step: 'S1', t: 0, state: 'SOURCED', action: 'Raise the alarm. Gather.' }, { step: 'S2', t: 60, state: 'NO_SOURCE', protocol: { action: 'Keep fans off.' } }];
  const rows = crewLog(frames, log, meta);
  assert.equal(rows.filter(r => r.kind === 'alarm').length, 1);
  assert.equal(rows.filter(r => r.kind === 'comm').length, 1);
  assert.ok(rows.some(r => r.text === 'fans off' && r.t === 60));
  assert.ok(rows.some(r => r.text === 'crew reports burnt material: Kapton'));
  assert.ok(rows.some(r => r.kind === 'nosource' && /ISS procedure/.test(r.text)));
});

test('view export delegates to the officer API envelope and remains deterministic', () => {
  const { frames, meta } = fixture.scenario;
  const input = { frames, meta, db: fixture, core: { officer, clock } };
  assert.deepEqual(decisionLog(input), officer.decisionLog(frames, fixture, meta));
  assert.deepEqual(decisionLog(input), decisionLog(input));
  const user = decisionLog({ ...input, frames: frames.map((fr, i) => ({ ...fr, simulated: i === 0 ? false : undefined })), source: { kind: 'user file', file: 'sample.jsonl' } });
  assert.equal(user.simulated, true);
  assert.equal(user.telemetry.file, 'sample.jsonl');
});
