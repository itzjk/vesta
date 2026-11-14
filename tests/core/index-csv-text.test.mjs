// WP2 · core/index.js, core/csv.js, core/text.js on the synthetic fixture, and the purity of all eight modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as index from '../../web/js/core/index.js';
import * as csv from '../../web/js/core/csv.js';
import * as text from '../../web/js/core/text.js';
import * as rankMod from '../../web/js/core/rank.js';
import * as statusMod from '../../web/js/core/status.js';

const { buildIndex, presetPoint, designPoint, slug, withoutFindings, G } = index;
const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/core.fixture.json', import.meta.url), 'utf8'));
const db = buildIndex(raw);
const CORE = new URL('../../web/js/core/', import.meta.url);
const MODULES = ['match', 'status', 'rank', 'officer', 'clock', 'index', 'csv', 'text'];

// ---- the eight modules -------------------------------------------------------------------------------------------------
test('the eight modules exist, import in Node and export the signatures of DESIGN.md 7.1', async () => {
  const want = { match: ['match', 'gap', 'TOL'], status: ['cell', 'observed', 'axes', 'findingStatus'], rank: ['score', 'rank', 'rankInvestigations', 'W', 'LEVEL', 'SPAN'],
    officer: ['run', 'decide'], clock: ['clock'], index: ['buildIndex'], csv: ['toCsv'], text: ['reason', 'status', 'level', 'pressure'] };
  for (const name of MODULES) {
    const m = await import(new URL(name + '.js', CORE));
    for (const k of want[name]) assert.notEqual(m[k], undefined, `${name}.${k}`);
  }
});

test('pure: no DOM, no fetch, no Node built-in, and only sibling imports', () => {
  for (const name of MODULES) {
    const src = fs.readFileSync(new URL(name + '.js', CORE), 'utf8');
    for (const banned of [/\bdocument\./, /\bwindow\./, /\bfetch\s*\(/, /\blocalStorage\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bDate\.now\b/, /\bnew Date\b/, /\bMath\.random\b/, /\bprocess\./, /from\s+['"]node:/])
      assert.equal(banned.test(src), false, `${name}.js matches ${banned}`);
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) assert.match(m[1], /^\.\/[a-z]+\.js$/, `${name}.js imports ${m[1]}`);
  }
});

test('copy rules: none of the banned phrases of DESIGN.md 8.1 and no fixture id in the core', () => {
  const banned = ['NASA never tested', 'nobody has tested', '22 min', '44 min', '0.166', '0.38 g', '26 investigations', 'live feed', 'proven safe', 'safe to use', 'FX-', 'FIXTURE-'];
  for (const name of MODULES) {
    const src = fs.readFileSync(new URL(name + '.js', CORE), 'utf8');
    for (const b of banned) assert.equal(src.toLowerCase().includes(b.toLowerCase()), false, `${name}.js holds "${b}"`);
  }
});

// ---- index -------------------------------------------------------------------------------------------------------------
test('buildIndex: every key of DESIGN.md 3.1 is there', () => {
  for (const k of ['investigations', 'invById', 'tests', 'tables', 'summariesByPsi', 'findings', 'findingById', 'rules', 'ruleById', 'presets', 'presetById', 'markers', 'bands',
    'protocol', 'protocolById', 'playbook', 'scenario', 'lines', 'engine', 'rowsByPsi', 'rowsByMaterial', 'cabinRows', 'modelRows', 'materials', 'pillarsByMaterial', 'base'])
    assert.notEqual(db[k], undefined, k);
  assert.equal(db.investigations.length, 4); assert.equal(db.invById['FX-PSI-1'].name, 'FX solid duct');
  assert.equal(db.tests.length, 16); assert.equal(db.findings.length, 12); assert.equal(db.rules.length, 5);
  assert.equal(db.findingById['FX-A'], db.findings[0]);                                  // the same objects, not copies
  assert.equal(db.summariesByPsi['FX-PSI-1'].n_tests, 10);
  assert.equal(db.protocol.length, 3); assert.equal(db.protocolById['FX-PROT-9'].gate.pass, false);
  assert.equal(db.playbook.steps.length, 9); assert.equal(db.scenario.meta.id, 'FX-SCEN-1'); assert.equal(db.scenario.frames.length, 10);
  assert.deepEqual(db.presets.map(p => p.id), ['station', 'spacecraft', 'lunar-base', 'rover', 'mars-base']);
  assert.deepEqual(db.markers.map(p => p.id), ['FX-MARK']); assert.deepEqual(db.bands.map(p => p.id), ['FX-BAND']);
  assert.equal(db.presetById['FX-MARK'], undefined);                                     // markers are not selectable presets
  assert.deepEqual(db.base, { partial_rows: 0 });
});

test('buildIndex: the derived lists', () => {
  assert.equal(db.rowsByPsi['FX-PSI-1'].length, 10);                                     // every row, also the test_day row
  assert.equal(db.cabinRows.length, 11);                                                 // counting rows of cabin tables
  assert.deepEqual(db.modelRows.map(r => r.id), ['FX-PSI-3:1', 'FX-PSI-3:2', 'FX-PSI-3:3', 'FX-PSI-3:4']);
  assert.deepEqual(Object.keys(db.rowsByMaterial).sort(), ['fx-alpha', 'fx-beta', 'fx-delta', 'fx-epsilon', 'fx-fuel', 'fx-kappa']);   // no key for a null material, none for fx-gamma
  assert.deepEqual(Object.keys(db.materials), ['fx-alpha', 'fx-beta', 'fx-kappa', 'fx-delta', 'fx-epsilon']);                          // cabin materials, most rows first
  assert.deepEqual(db.materials['fx-alpha'], { label: 'FX Alpha', fuel_class: 'solid', rows: 4, fuel_classes: ['solid'] });
  assert.deepEqual(db.pillarsByMaterial['fx-kappa'], ['detection']);
  assert.deepEqual(db.pillarsByMaterial['fx-fuel'], ['suppression']);
});

test('buildIndex: accepts bare arrays, a flat preset list and missing files', () => {
  const flat = buildIndex({ tests: raw.tests.tests, findings: raw.findings.findings, rules: raw.rules.rules, investigations: raw.investigations.investigations,
    presets: [...raw.presets.presets, ...raw.presets.markers, ...raw.presets.bands], protocol: raw.protocol.lines, playbook: raw.playbook.steps,
    scenario: { ...raw.scenario.meta, frames: raw.scenario.frames } });
  assert.equal(flat.tests.length, 16); assert.equal(flat.presets.length, 5); assert.equal(flat.markers.length, 1); assert.equal(flat.bands.length, 1);
  assert.equal(flat.protocolById['FX-PROT-1'].action, 'Fixture protocol action one.'); assert.equal(flat.playbook.steps.length, 9);
  assert.equal(flat.scenario.meta.id, 'FX-SCEN-1'); assert.equal(flat.scenario.frames.length, 10);
  const empty = buildIndex({});
  assert.deepEqual(empty.tests, []); assert.deepEqual(empty.findings, []); assert.deepEqual(empty.playbook, { steps: [] }); assert.equal(empty.scenario, null);
  assert.deepEqual(empty.materials, {}); assert.deepEqual(empty.base, { partial_rows: 0 });
  // the shapes a first build writes when the authored files are missing (build/notes-WP1.md)
  const first = buildIndex({ presets: { presets: [], markers: [], bands: [] }, playbook: { steps: [] }, protocol: { lines: [] }, scenario: { meta: null, frames: [] }, lines: {} });
  assert.equal(first.scenario, null); assert.deepEqual(first.presets, []); assert.deepEqual(first.protocol, []);
});

test('buildIndex refuses a row or a finding without n', () => {
  assert.throws(() => buildIndex({ tests: [{ id: 'FX-ROW' }] }), /FX-ROW has no "n"/);
  assert.throws(() => buildIndex({ findings: [{ id: 'FX-Z' }] }), /FX-Z has no "n"/);
});

test('buildIndex counts partial-gravity rows from the rows themselves', () => {
  const rows = raw.tests.tests.map((r, i) => i < 2 ? { ...r, n: { ...r.n, gclass: 'partial' } } : r);
  assert.deepEqual(buildIndex({ tests: rows }).base, { partial_rows: 2 });
});

test('slug', () => {
  assert.equal(slug('PMMA'), 'pmma'); assert.equal(slug('PMMA + Nomex'), 'pmma-nomex'); assert.equal(slug('  Japan wax '), 'japan-wax'); assert.equal(slug('Kapton'), 'kapton');
});

test('presetPoint and designPoint: the shared design point of the hash', () => {
  assert.deepEqual(presetPoint(db, 'lunar-base', 'prevention', 'pmma'),
    { preset: 'lunar-base', habitat: 'lunar-base', concern: 'prevention', o2: 34, p: 56.5, g: 'moon', gclass: 'partial', g_label: '1/6 g', material: 'pmma' });
  assert.equal(presetPoint(db, 'no-such-preset'), null);
  assert.deepEqual(designPoint({}, db), { ...presetPoint(db, 'lunar-base', 'prevention', 'pmma'), preset_wanted: 'lunar-base' });   // the default hash
  assert.deepEqual(designPoint({ preset: 'station', concern: 'detection', mat: '', o2: '50' }, db), { ...presetPoint(db, 'station', 'detection', null), preset_wanted: 'station' });
  assert.deepEqual(designPoint({ preset: 'custom', o2: '30', p: '70.5', g: 'mars', hab: 'rover', mat: 'sibal' }, db),
    { preset: 'custom', habitat: 'rover', concern: 'prevention', o2: 30, p: 70.5, g: 'mars', gclass: 'partial', g_label: '3/8 g', material: 'sibal', preset_wanted: 'custom' });
  const c = designPoint({ preset: 'custom', o2: '', p: 'abc' }, db);                                                // falls back, key by key, to the default preset
  assert.equal(c.o2, 34); assert.equal(c.p, 56.5); assert.equal(c.g, 'moon'); assert.equal(c.gclass, 'partial'); assert.equal(c.habitat, null);
  const gone = designPoint({ preset: 'gone', o2: '50' }, db);                                                       // a preset that did not ship: the default preset, under its own id
  assert.equal(gone.preset, 'lunar-base'); assert.equal(gone.preset_wanted, 'gone'); assert.equal(gone.o2, 34);
  const none = designPoint({}, buildIndex({}));                                                                     // no preset shipped: no number is typed
  assert.equal(none.o2, null); assert.equal(none.p, null); assert.equal(none.preset, 'lunar-base');
  assert.deepEqual(Object.keys(G), ['0g', 'moon', 'mars', '1g']);
  assert.deepEqual(Object.values(G).map(g => g.label), ['0 g', '1/6 g', '3/8 g', '1 g']);
});

test('withoutFindings returns a new index and leaves the first one alone', () => {
  const cut = withoutFindings(db, ['FX-A', 'FX-B']);
  assert.equal(cut.findings.length, 10); assert.equal(cut.findingById['FX-A'], undefined); assert.equal(db.findings.length, 12);
  assert.equal(cut.tests, db.tests);
});

// ---- csv ---------------------------------------------------------------------------------------------------------------
test('toCsv: header first, RFC 4180 quoting, a missing value is empty and never 0', () => {
  const rows = [{ id: 'a', note: 'plain', n: 1.5, ok: true, o: { k: [1, 2] } }, { id: 'b', note: 'has, comma', n: null, ok: false }, { id: 'c', note: 'says "hi"\nline 2', n: 0 }];
  const out = csv.toCsv(rows, ['id', 'note', 'n', 'ok', 'o']);
  assert.equal(out, 'id,note,n,ok,o\na,plain,1.5,true,"{""k"":[1,2]}"\nb,"has, comma",,false,\nc,"says ""hi""\nline 2",0,,\n');
  assert.equal(csv.toCsv([], ['id', 'x']), 'id,x\n');
  assert.equal(csv.toCsv(rows.slice(0, 1), ['id'], { eol: '\r\n' }), 'id\r\na\r\n');
  assert.equal(csv.toCsv([{ a: 1, 'raw.Flame Type': 'Normal' }]), 'a,raw.Flame Type\n1,Normal\n');                // a key is looked up as it stands
  assert.equal(csv.toCsv([{ a: { b: 2 } }], [{ key: 'b', label: 'B (cm/s)', get: r => r.a.b }]), 'B (cm/s)\n2\n');
});

test('parseCsv reads back what toCsv wrote, and CRLF files', () => {
  const rows = [{ id: 'PSI-1:1', quote: 'a "quoted" word, a comma\nand a line break', v: '34', lead: ' padded ' }, { id: 'PSI-1:2', quote: '', v: '', lead: 'µm ≤ 1' }];
  const cols = ['id', 'quote', 'v', 'lead'];
  for (const eol of ['\n', '\r\n']) {
    const back = csv.parseCsv(csv.toCsv(rows, cols, { eol }));
    assert.deepEqual(back.header, cols); assert.equal(back.rows.length, 2); assert.deepEqual(back.objects, rows);
  }
  assert.deepEqual(csv.parseCsv('﻿a,b\r\n1,2').objects, [{ a: '1', b: '2' }]);
  assert.deepEqual(csv.parseCsv(csv.toCsv([{ a: null }, { a: 'x' }], ['a'])).rows, [[''], ['x']]);               // an empty one-column value survives
  assert.deepEqual(csv.parseCsv(''), { header: [], rows: [], objects: [] });
});

test('toCsv over the fixture rows gives one data line per row', () => {
  const out = csv.toCsv(db.tests, ['id', 'psi_id', 'fuel', 'o2_percent', 'o2_basis', 'pressure_kpa', { key: 'material_id', get: r => r.n.material_id }, { key: 'outcomes_json', get: r => r.outcomes }]);
  const back = csv.parseCsv(out);
  assert.equal(back.rows.length, db.tests.length);
  assert.equal(back.objects[0].material_id, 'fx-alpha'); assert.equal(back.objects[7].fuel, ''); assert.equal(back.objects[10].o2_percent, '');
  assert.deepEqual(JSON.parse(back.objects[0].outcomes_json), db.tests[0].outcomes);
});

// ---- text --------------------------------------------------------------------------------------------------------------
test('pressure prints psia first and kPa second', () => {
  assert.equal(text.pressure(56.5), '8.2 psia (56.5 kPa)');
  assert.equal(text.pressure(101.4), '14.7 psia (101.4 kPa)');
  assert.equal(text.pressure(70.3), '10.2 psia (70.3 kPa)');
  assert.equal(text.pressure(null), 'not stated'); assert.equal(text.pressure(null, text.NOT_IN_TABLE), 'not in the table');
  assert.equal(text.pressure([56.5, 101.4]), '8.2 to 14.7 psia (56.5 to 101.4 kPa)');
  assert.equal(text.psia(56.5), 8.2);
});

test('status words and the fixed line', () => {
  assert.equal(text.status('PROVEN'), 'PROVEN'); assert.equal(text.status('NEVER_TESTED'), 'NEVER TESTED'); assert.equal(text.status('NO_SOURCE'), 'NO SOURCE');
  assert.equal(text.status('PROVEN', 'pressure_inferred'), 'PROVEN · pressure inferred'); assert.equal(text.status('EXTRAPOLATED'), 'EXTRAPOLATED');
  assert.equal(text.STATUS_LINE, 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION');
  const l = text.legend(24);
  assert.match(l.PROVEN, /within 1 point and pressure within 5 kPa/); assert.match(l.PROVEN, /does not mean safe/);
  assert.match(l.NEVER_TESTED, /in VESTA's evidence base \(24 PSI investigations\)\.$/);
});

test('the evidence-base phrase takes its count from the index, never from a typed number', () => {
  assert.equal(text.base(24), "in VESTA's evidence base (24 PSI investigations)");
  assert.equal(text.base(db), "in VESTA's evidence base (4 PSI investigations)");
  assert.equal(text.base(), "in VESTA's evidence base");
});

test('level: the kind of work and where it was read', () => {
  assert.equal(text.level(db.findingById['FX-A']), 'flight experiment · read in a 2015 NASA review');
  assert.equal(text.level({ work: 'summary', read_in: 'nasa_page' }), 'NASA summary · read in a NASA page');
  assert.equal(text.level({ work: 'operations', read_in: 'nasa_report' }, 2023), 'ISS operations · read in a 2023 NASA report');
  assert.equal(text.level({ work: 'flight', read_in: 'psi_table' }), 'flight experiment · read in a PSI table');
  assert.equal(text.level({ work: 'summary', read_in: 'challenge_page' }, 2026), 'NASA summary · read in the Space Apps challenge page');
  assert.equal(text.level({ work: 'model', read_in: 'nasa_page' }), 'model or analysis · read in a NASA page');
});

test('reason: a chip for every code the logic can produce, with the numbers', () => {
  assert.equal(text.reason('o2_outside', { delta: { o2: 11.8 } }), 'oxygen +11.8 points');
  assert.equal(text.reason('pressure_outside', { delta: { p: -44.8 } }), 'pressure -44.8 kPa');
  assert.equal(text.reason('gravity_never_tested', { q: { g_label: '1/6 g' } }), 'no 1/6 g test row in this evidence base');
  assert.equal(text.reason('o2_outside'), 'oxygen outside');
  assert.equal(text.reason('some_new_code'), 'some new code');                           // an unknown code never throws
  const codes = ['gravity_never_tested', 'gravity_differs', 'gravity_not_reported', 'o2_outside', 'o2_not_reported', 'pressure_outside', 'pressure_not_reported',
    'not_an_experiment', 'different_fuel_class', 'finding_without_rows', 'no_row_no_finding', 'pressure_inferred', 'rule_without_verified_finding', 'no_verified_finding_on_topic'];
  assert.deepEqual([...text.REASON_CODES].sort(), [...codes].sort());
  const table = text.reasons(24);
  for (const c of codes) { assert.ok(text.reason(c).length > 3, c); assert.match(table[c], /\.$/, c); }
  assert.match(text.reasonSentence('o2_outside', { delta: { o2: 11.8 } }), /11\.8 points of oxygen above/);
  assert.match(text.reasonSentence('pressure_outside', { delta: { p: -44.8 } }), /44\.8 kPa below/);
  assert.match(text.reasonSentence('no_row_no_finding', { n: 24 }), /in VESTA's evidence base \(24 PSI investigations\)\.$/);
});

test('delta, gravity, concern, basis', () => {
  assert.equal(text.delta({ o2: 11.8, p: -44.8 }), '+11.8 points O2, -44.8 kPa from your cabin');
  assert.equal(text.delta({ p: 0.1 }), '+0.1 kPa from your cabin');
  assert.equal(text.gravity('moon'), '1/6 g'); assert.equal(text.gravity('mars'), '3/8 g'); assert.equal(text.gravity('0g'), '0 g'); assert.equal(text.gravity('1g'), '1 g');
  assert.equal(text.gravity('micro'), 'microgravity'); assert.equal(text.gravity(null), 'not stated');
  assert.equal(text.concern('prevention'), 'Prevention'); assert.equal(text.basis('operations'), 'from ISS operations'); assert.equal(text.basis(null), 'no source');
});

test('the six score terms: one sentence each, with this finding\'s values', () => {
  const lunar = presetPoint(db, 'lunar-base'), entry = rankMod.rank([db.findingById['FX-S-VENT']], lunar, db)[0];
  const rows = text.terms(entry, lunar);
  assert.deepEqual(rows.map(r => r.key), ['pillar', 'atmosphere', 'gravity', 'level', 'material', 'habitat']);
  assert.deepEqual(rows.map(r => r.value), [30, 7.5, 6, 7.5, 5, 5]);
  assert.deepEqual(rows.map(r => r.max), [30, 25, 15, 15, 10, 5]);
  assert.equal(rows[0].sentence, 'Answers your concern (prevention).');
  assert.match(rows[1].sentence, /^Oxygen not stated in the source: counts 30 %\. Pressure not stated in the source: counts 30 %\./);
  assert.match(rows[1].sentence, /closeness reaches zero 15 points or 50 kPa away\.$/);
  assert.equal(rows[2].sentence, "Tested in microgravity; your cabin is at 1/6 g: counts 40 %. The challenge page says such results 'could bound' intermediate gravity; that is not demonstrated.");
  assert.match(rows[3].sentence, /Flight experiment 15 · ground low-gravity 12 · normal-gravity test 9 · NASA summary or ISS operations 7\.5 · model 6\.$/);
  assert.equal(rows[4].sentence, 'No material picked: neutral.');
  assert.equal(rows[5].sentence, 'Tagged for lunar bases by the Extractor (an SI-assigned tag).');
  const partial = text.terms(rankMod.rank([db.findingById['FX-B']], lunar, db)[0], lunar);
  assert.equal(partial.at(-1).key, 'support'); assert.match(partial.at(-1).sentence, /only in part/);
  const a = text.term('atmosphere', rankMod.rank([db.findingById['FX-C']], lunar, db)[0], lunar);
  assert.match(a, /^Source states 30 to 36 % O2 and 8\.2 psia \(56\.5 kPa\); your cabin is 34 % O2 and 8\.2 psia \(56\.5 kPa\)\./);
});

test('gaps: one entry per axis with zero cabin rows; the sentence ends with the evidence-base phrase', () => {
  const rover = presetPoint(db, 'rover'), g = text.gaps(statusMod.axes(rover, db), rover, 24);
  assert.deepEqual(g.map(x => x.axis), ['gravity', 'o2', 'pressure']);
  for (const x of g) { assert.equal(x.count, 0); assert.match(x.sentence, /in VESTA's evidence base \(24 PSI investigations\)\.$/); }
  assert.equal(g[0].label, 'Gravity 1/6 g');
  assert.match(g[1].extra, /2 rows on model fuels \(liquid droplets, gas burners\): a different fuel class/);
  const station = presetPoint(db, 'station');
  assert.deepEqual(text.gaps(statusMod.axes(station, db), station, 24), []);
});

test('cell sentences', () => {
  const station = presetPoint(db, 'station');
  assert.equal(text.cellSentence(statusMod.cell('fx-kappa', 'prevention', station, db), 'FX Kappa', 24),
    "No test row and no verified finding for FX Kappa and prevention in VESTA's evidence base (24 PSI investigations).");
  assert.match(text.cellSentence(statusMod.cell('fx-alpha', 'prevention', station, db), 'FX Alpha', 24), /^2 PSI test rows .* near these atmosphere conditions .* pressure inferred from the facility\.$/);
  assert.equal(text.elsewhere(statusMod.cell('fx-kappa', 'prevention', station, db)), 'this material also appears in: detection');
  assert.equal(text.elsewhere(statusMod.cell('fx-nothing', 'prevention', station, db)), null);
});
