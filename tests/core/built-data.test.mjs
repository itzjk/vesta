// WP2 · the core modules on the built data (web/data, written by tools/build.mjs): the acceptance numbers of DESIGN.md 3.3, 3.4, 3.6 and 7.2.
// While web/data is absent every test here skips itself with a message; once it exists they must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, withoutFindings, presetPoint } from '../../web/js/core/index.js';
import { cell, cells, tally, axes, findingStatus } from '../../web/js/core/status.js';
import { score, rank, rankInvestigations } from '../../web/js/core/rank.js';
import { run, decisionLog, checkFrame } from '../../web/js/core/officer.js';
import { clock } from '../../web/js/core/clock.js';
import { toCsv, parseCsv } from '../../web/js/core/csv.js';
import * as text from '../../web/js/core/text.js';

const DATA = new URL('../../web/data/', import.meta.url);
const FILES = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets', 'protocol', 'playbook', 'scenario', 'lines', 'tour', 'engine'];   // the list of web/js/store.js
const NEEDED = ['tests', 'findings'];
const present = fs.existsSync(DATA) && NEEDED.every(n => fs.existsSync(new URL(n + '.json', DATA)));
const skip = present ? false : 'web/data is not built yet (run node tools/build.mjs); the same logic is tested on fixtures in the other files';

let db = null, raw = {};
if (present) {
  for (const n of FILES) { const u = new URL(n + '.json', DATA); if (fs.existsSync(u)) raw[n] = JSON.parse(fs.readFileSync(u, 'utf8')); }
  db = buildIndex(raw);
}
// The design points of the acceptance numbers, as the spec states them (3.3 and 3.5).
const Q = {
  station:      { habitat: 'station',    concern: 'prevention', o2: 21, p: 101.4, gclass: 'micro',   g_label: '0 g',   material: null },
  spacecraft:   { habitat: 'spacecraft', concern: 'prevention', o2: 34, p: 56.5,  gclass: 'micro',   g_label: '0 g',   material: null },
  'lunar-base': { habitat: 'lunar-base', concern: 'prevention', o2: 34, p: 56.5,  gclass: 'partial', g_label: '1/6 g', material: null },
  rover:        { habitat: 'rover',      concern: 'prevention', o2: 30, p: 70.3,  gclass: 'partial', g_label: '1/6 g', material: null },
  'mars-base':  { habitat: 'mars-base',  concern: 'prevention', o2: 34, p: 56.5,  gclass: 'partial', g_label: '3/8 g', material: null },
};
const scenarioReady = () => db && db.scenario && db.scenario.frames.length && db.playbook.steps.length;
const noScenario = 'the build holds no scenario or playbook yet (config/playbook.json, config/scenarios/* not in this build)';

test('built data: the index builds, every row and every finding carries n', { skip }, () => {
  assert.equal(db.tests.length, raw.tests.meta.n_tests);
  assert.ok(db.tests.every(r => r.n && typeof r.n.counts === 'boolean' && Array.isArray(r.n.pillars)));
  assert.ok(db.findings.length > 0);
  assert.ok(db.findings.every(f => f.n && Array.isArray(f.n.material_ids) && Array.isArray(f.n.habitats) && typeof f.n.work === 'string'));
  assert.equal(db.investigations.length, 24);
  assert.equal(db.base.partial_rows, 0);                               // PSI holds no partial-gravity row; computed, not typed
});

test('built data: PSI-25:1 is normalised as the spec says', { skip }, () => {
  const r = db.testById['PSI-25:1'];
  assert.equal(r.n.material_id, 'pmma'); assert.equal(r.n.o2, 22.2); assert.equal(r.n.p, null); assert.equal(r.n.p_inferred, 101.3);
  assert.deepEqual(r.n.pillars, ['prevention']); assert.equal(r.n.cabin, true); assert.equal(r.n.gclass, 'micro'); assert.equal(r.n.counts, true);
  assert.ok(db.tests.filter(x => x.o2_basis === 'burner_stream').every(x => x.n.o2 === null));
});

test('built data: 15 cabin materials from 380 cabin rows, most rows first', { skip }, () => {
  assert.equal(db.cabinRows.length, 380);
  assert.equal(Object.keys(db.materials).length, 15);
  assert.deepEqual(Object.keys(db.materials).slice(0, 2), ['pmma', 'sibal']);
  assert.equal(db.materials.pmma.rows, 90); assert.equal(db.materials.sibal.rows, 44); assert.equal(db.materials.kapton.rows, 30);
  assert.equal(db.materials.pmma.label, 'PMMA'); assert.equal(db.materials.pmma.fuel_class, 'solid');
});

test('built data: station — pmma, sibal and nomex x prevention are PROVEN with pressure inferred, 16, 6 and 2 hits', { skip }, () => {
  for (const [m, hits] of [['pmma', 16], ['sibal', 6], ['nomex', 2]]) {
    const c = cell(m, 'prevention', Q.station, db);
    assert.equal(c.status, 'PROVEN', m); assert.equal(c.qualifier, 'pressure_inferred', m); assert.equal(c.hit_ids.length, hits, m);
    assert.deepEqual(c.reasons, []); assert.ok(c.observed.length > 0, m);
    assert.ok(c.hit_ids.every(id => id.startsWith('PSI-25:')), m);
  }
});

test('built data: lunar base — pmma x prevention is EXTRAPOLATED; the nearest test is +11.8 points away', { skip }, () => {
  const c = cell('pmma', 'prevention', Q['lunar-base'], db);
  assert.equal(c.status, 'EXTRAPOLATED');
  assert.deepEqual(c.reasons, ['gravity_never_tested', 'o2_outside', 'pressure_outside']);
  assert.equal(c.nearest.delta.o2, 11.8);
  assert.equal(c.nearest.delta.p, -44.8);
  assert.match(c.nearest.id, /^PSI-25:/);
  assert.deepEqual(c.nearest.note, ['pressure_inferred']);
  assert.equal(text.delta(c.nearest.delta), '+11.8 points O2, -44.8 kPa from your cabin');
});

test('built data: kapton x prevention is NEVER_TESTED everywhere and appears only in detection', { skip }, () => {
  for (const q of Object.values(Q)) {
    const c = cell('kapton', 'prevention', q, db);
    assert.equal(c.status, 'NEVER_TESTED'); assert.deepEqual(c.elsewhere, ['detection']); assert.deepEqual(c.reasons, ['no_row_no_finding']);
  }
  for (const m of ['kapton', 'teflon', 'pyrell', 'lampwick']) for (const k of ['prevention', 'suppression'])
    assert.equal(cell(m, k, Q.station, db).status, 'NEVER_TESTED', `${m} x ${k}`);
});

test('built data: axes — lunar base has no cabin row at its gravity or oxygen; rover has 8 model rows in the box', { skip }, () => {
  const l = axes(Q['lunar-base'], db);
  assert.equal(l.gravity.cabin, 0); assert.equal(l.gravity.all, 0); assert.equal(l.o2.cabin, 0); assert.equal(l.pressure.cabin, 0);
  assert.equal(l.o2.cabin_max, 22.2); assert.equal(l.o2.cabin_min, 13.6);
  const r = axes(Q.rover, db);
  assert.equal(r.joint.model, 8); assert.equal(r.joint.cabin, 0); assert.equal(r.o2.cabin, 0); assert.equal(r.pressure.cabin, 0);
  const s = axes(Q.station, db);
  assert.equal(s.gravity.cabin, 380); assert.equal(s.o2.cabin, 33);
  assert.deepEqual(text.gaps(s, Q.station, db), []);
  assert.deepEqual(text.gaps(l, Q['lunar-base'], db).map(g => g.axis), ['gravity', 'o2', 'pressure']);
  assert.deepEqual(text.gaps(axes(Q.spacecraft, db), Q.spacecraft, db).map(g => g.axis), ['o2', 'pressure']);
});

test('built data: the matrix — station 3 PROVEN, 20 EXTRAPOLATED, 22 NEVER TESTED; the other presets 0, 23, 22', { skip }, () => {
  // These counts hold while no verified finding names a cabin material for a concern its tables do not cover;
  // a research delivery that does so turns a NEVER TESTED cell into EXTRAPOLATED (finding_without_rows) on its own.
  const named = db.findings.filter(f => f.n.material_ids.some(m => db.materials[m]));
  const t = tally(cells(Q.station, db));
  assert.equal(t.PROVEN, 3);
  assert.equal(t.PROVEN + t.EXTRAPOLATED + t.NEVER_TESTED, 45);
  for (const id of ['spacecraft', 'lunar-base', 'rover', 'mars-base']) assert.equal(tally(cells(Q[id], db)).PROVEN, 0, id);
  if (!named.length) {
    assert.deepEqual(t, { PROVEN: 3, EXTRAPOLATED: 20, NEVER_TESTED: 22 });
    for (const id of ['spacecraft', 'lunar-base', 'rover', 'mars-base']) assert.deepEqual(tally(cells(Q[id], db)), { PROVEN: 0, EXTRAPOLATED: 23, NEVER_TESTED: 22 }, id);
  }
});

test('built data: the shipped presets carry the numbers the acceptance uses', { skip: skip || (db && !db.presets.length ? 'no preset in this build yet (config/presets.json)' : false) }, () => {
  for (const [id, q] of Object.entries(Q)) {
    const p = presetPoint(db, id);
    assert.ok(p, `preset ${id} did not ship`);
    assert.equal(p.o2, q.o2, id); assert.equal(p.p, q.p, id); assert.equal(p.gclass, q.gclass, id); assert.equal(p.g_label, q.g_label, id); assert.equal(p.habitat, q.habitat, id);
  }
});

test('built data: S-VENT-01 scores 70 at the station and 61 at the lunar base', { skip }, () => {
  const f = db.findingById['S-VENT-01'];
  assert.ok(f, 'S-VENT-01 is not in web/data/findings.json');
  assert.equal(score(f, Q.station, db).total, 70);
  assert.deepEqual(score(f, Q.station, db).parts, { pillar: 30, atmosphere: 7.5, gravity: 15, level: 7.5, material: 5, habitat: 5 });
  assert.equal(score(f, Q['lunar-base'], db).total, 61);
  assert.deepEqual(findingStatus(f, Q['lunar-base'], db).reasons, ['not_an_experiment', 'gravity_never_tested', 'o2_not_reported', 'pressure_not_reported']);
});

test('built data: rank is total-ordered, complete and stable; no finding is PROVEN at partial gravity', { skip }, () => {
  for (const q of Object.values(Q)) for (const concern of ['prevention', 'detection', 'suppression']) {
    const qq = { ...q, concern }, r = rank(db.findings, qq, db);
    assert.equal(r.length, db.findings.length);
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].total >= r[i].total);
    assert.ok(r.every(x => Number.isInteger(x.total) && x.total >= 0 && x.total <= 100), 'a total is not an integer from 0 to 100 (an unmapped n.work?)');
    assert.deepEqual(rank(db.findings, qq, db).map(x => x.f.id), r.map(x => x.f.id));
    if (q.gclass === 'partial') assert.ok(db.findings.every(f => findingStatus(f, qq, db).status === 'EXTRAPOLATED'));
    for (const x of r.slice(0, 25)) for (const row of text.terms(x, qq)) assert.equal(typeof row.sentence, 'string');
  }
  const inv = rankInvestigations(db, Q['lunar-base']);
  assert.equal(inv.length, 24);
  assert.ok(inv.every(i => i.score === null || (i.score > 0 && i.findings > 0)));
  assert.equal(inv.find(i => i.psi_id === 'PSI-25').rows, 129);
  assert.equal(rankInvestigations(db, Q.station).find(i => i.psi_id === 'PSI-25').rows_at_cabin > 0, true);
});

test('built data: the officer on the scenario — 8 steps at the scripted times, bases as the spec lists them, two NO SOURCE', { skip: skip || (scenarioReady() ? false : noScenario) }, () => {
  const { meta, frames } = db.scenario, log = run(frames, db, meta);
  for (const fr of frames) assert.equal(checkFrame(fr), null);
  assert.deepEqual(log.map(e => e.step), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
  assert.deepEqual(log.map(e => e.t), [0, 20, 60, 150, 240, 360, 480, 600]);
  assert.deepEqual(log.map(e => e.basis), ['summary', 'summary', 'summary', 'operations', 'experiment', 'experiment', null, null]);
  assert.deepEqual(log.map(e => e.state), ['SOURCED', 'SOURCED', 'SOURCED', 'SOURCED', 'SOURCED', 'SOURCED', 'NO_SOURCE', 'NO_SOURCE']);
  assert.deepEqual(log.slice(0, 6).map(e => e.rule_id), ['R-ALARM', 'R-VENT', 'R-SHAPE', 'R-POWER', 'R-AIM', 'R-NOFLAME']);
  assert.equal(log[4].earth.finding_id, 'S-AIM-00');                   // EARTH PRACTICE, with its own cite
  assert.equal(log[5].coverage.status, 'EXTRAPOLATED');
  assert.ok(log[5].coverage.reasons.includes('different_fuel_class')); // cool flames on droplets; this fire is solid
  assert.equal(log[6].gap, 'no_row_no_finding'); assert.equal(log[6].cell.material, 'kapton'); assert.equal(log[6].protocol.id, 'PROT-09');
  assert.equal(log[7].gap, 'no_verified_finding_on_topic'); assert.equal(log[7].protocol.id, 'PROT-03');
  for (const e of log.slice(0, 6)) { assert.ok(e.nasa.length >= 1 && e.nasa.length <= 3); assert.ok(e.nasa.every(n => db.findingById[n.finding_id])); assert.equal(e.coverage.status, 'EXTRAPOLATED'); }
  for (const e of log.slice(6)) { assert.equal(e.action, e.protocol.action); assert.ok(db.findingById[e.protocol.finding_id]); assert.match(e.protocol.limit, /not validated for this vehicle/); }
});

test('built data: removing S-VENT-01 and S-FLOW-01 turns S2 into NO SOURCE with protocol PROT-03', { skip: skip || (scenarioReady() ? false : noScenario) }, () => {
  const { meta, frames } = db.scenario, cut = withoutFindings(db, ['S-VENT-01', 'S-FLOW-01']);
  const log = run(frames, cut, meta), s2 = log.find(e => e.step === 'S2');
  assert.equal(s2.state, 'NO_SOURCE'); assert.equal(s2.gap, 'rule_without_verified_finding'); assert.equal(s2.protocol.id, 'PROT-03'); assert.equal(s2.t, 20);
  assert.deepEqual(log.map(e => e.step), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);   // the drill still runs to the end
  assert.equal(run(frames, db, meta).find(e => e.step === 'S2').state, 'SOURCED');
});

test('built data: two runs are deep-equal; the clock reads the sourced maxima', { skip: skip || (scenarioReady() ? false : noScenario) }, () => {
  const { meta, frames } = db.scenario, a = run(frames, db, meta), b = run(frames, db, meta);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(decisionLog(frames, db, meta)), JSON.stringify(decisionLog(frames, db, meta)));
  const c = clock(meta, 600, a, db);
  assert.equal(c.heard, 1200); assert.equal(c.reply, 2400); assert.equal(c.progress, 0.5); assert.equal(c.to_reply, 1800);
  assert.deepEqual(c.decided, { steps: 8, experiment: 2, summary: 3, operations: 1, no_source: 2 });
  assert.equal(clock(meta, 250, a, db).decided.steps, 5);              // the film frame: ?t=250 shows five rows in the step list
});

test('built data: a CSV of every row parses back to the same count', { skip }, () => {
  const out = toCsv(db.tests, ['id', 'psi_id', 'fuel', 'fuel_raw', 'o2_percent', 'o2_raw', 'pressure_kpa', { key: 'outcomes_json', get: r => r.outcomes }]);
  const back = parseCsv(out);
  assert.equal(back.rows.length, db.tests.length);
  assert.deepEqual(back.objects.map(o => o.id), db.tests.map(r => r.id));
  assert.equal(back.objects.find(o => o.id === 'PSI-25:1').o2_percent, '22.2');
});
