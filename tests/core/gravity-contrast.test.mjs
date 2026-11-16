import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GRAVITY_CONTRAST, gravityContrast, readLength, readSize, compare, landingSentence, summaryText } from '../../web/js/core/gravity-contrast.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const data = name => JSON.parse(read(`web/data/${name}.json`));
const tests = data('tests').tests, investigations = data('investigations').investigations, tables = data('tables').tables;
const rows = tests.filter(row => row.psi_id === 'PSI-99');
const view = gravityContrast({ tests, investigations, tables });
const byId = Object.fromEntries(view.samples.map(sample => [sample.id, sample]));

test('every PSI-99 row is one sample, in table order, citable by row id and PSI address', () => {
  assert.equal(rows.length, 9);
  assert.deepEqual(view.samples.map(s => s.id), rows.map(r => r.id));
  const inv = investigations.find(i => i.psi_id === 'PSI-99');
  assert.match(inv.psi_url, /^https:\/\/psi\.nasa\.gov\/.*PSI-99$/);
  for (const s of view.samples) assert.equal(s.source_url, inv.psi_url);
  assert.equal(view.name, inv.name);
});

test('recorded values pass through untouched: value, raw string, approximate flag and note', () => {
  for (const row of rows) {
    const s = byId[row.id];
    for (const [side, key] of [['micro', GRAVITY_CONTRAST.micro], ['normal', GRAVITY_CONTRAST.normal]]) {
      const cell = row.outcomes[key];
      assert.equal(s[side].raw, cell.raw, `${row.id} ${side} raw`);
      assert.equal(s[side].value, cell.value, `${row.id} ${side} value`);
      assert.equal(s[side].approx, cell.approx === true, `${row.id} ${side} approx`);
      if (cell.note) assert.equal(s[side].note, cell.note);
    }
    assert.equal(s.size.raw, row.fuel_size);
    assert.ok(row.fuel_size.includes(`thickness ${s.size.thickness_raw};`) && row.fuel_size.includes(`length ${s.size.length_raw};`));
    assert.equal(s.material, row.fuel);
  }
});

// An independent recount, written without the module's helpers.
function recount() {
  const out = { further_normal: 0, further_micro: 0, same: 0, not_comparable: 0, numbers: 0, numbers_differ: 0 }, per = {};
  for (const row of rows) {
    const m = row.outcomes.microgravity_burn_length_cm, n = row.outcomes.normal_gravity_burn_length_cm;
    const length = /; length (\d+(?:\.\d+)?) cm;/.exec(`; ${row.fuel_size};`)?.[1];
    const reach = cell => cell.raw === 'Complete' ? (length ? Number(length) : NaN) : typeof cell.value === 'number' ? cell.value : NaN;
    const a = reach(m), b = reach(n);
    const verdict = Number.isNaN(a) || Number.isNaN(b) ? 'not_comparable' : a === b ? 'same' : b > a ? 'further_normal' : 'further_micro';
    out[verdict]++; per[row.id] = verdict;
    if (typeof m.value === 'number' && typeof n.value === 'number') { out.numbers++; if (m.value !== n.value) out.numbers_differ++; }
  }
  return { out, per };
}

test('every summary count is recomputed from the rows', () => {
  const { out, per } = recount(), s = view.summary;
  for (const sample of view.samples) assert.equal(sample.comparison.id, per[sample.id], sample.id);
  assert.equal(s.samples, rows.length);
  assert.equal(s.further_normal, out.further_normal);
  assert.equal(s.further_micro, out.further_micro);
  assert.equal(s.same, out.same);
  assert.equal(s.not_comparable, out.not_comparable);
  assert.equal(s.differ, out.further_normal + out.further_micro);
  assert.equal(s.comparable, rows.length - out.not_comparable);
  assert.equal(s.differ + s.same + s.not_comparable, s.samples);
  assert.equal(s.numbers_only.comparable, out.numbers);
  assert.equal(s.numbers_only.differ, out.numbers_differ);
  assert.equal(s.numbers_only.same, out.numbers - out.numbers_differ);
  assert.ok(s.comparable > 0 && s.not_comparable > 0, 'the shipped table has both kinds');
});

test('a compound, ranged, qualified or missing entry is never compared and never given a number', () => {
  const s = byId['PSI-99:7'];
  assert.equal(s.micro.raw, '5 cm & 0 (note 2)'); assert.equal(s.micro.kind, 'compound'); assert.equal(s.micro.value, null); assert.equal(s.micro.fraction, null);
  assert.equal(s.normal.kind, 'text'); assert.equal(s.normal.value, null);
  assert.equal(s.comparison.id, 'not_comparable'); assert.match(s.comparison.reason, /compound or range/);
  assert.equal(s.size.length_cm, null); assert.equal(s.size.length_raw, '5 and 24 cm');
  assert.match(s.micro.note_text, /^Note 2 /);
  assert.ok(tables.find(t => t.psi_id === 'PSI-99').notes.some(n => n.text === s.micro.note_text), 'note text is the stored table note');
  const number = v => readLength({ value: v, raw: `${v} cm`, unit: 'cm' });
  for (const cell of [null, { value: null, raw: 'n/a' }, { value: null, raw: '' }, { value: 5, raw: '5 to 7 cm' }, { value: 5, raw: '5-7 cm' }, { value: 5, raw: '5 cm & 0' }, { value: null, raw: '~ 0 (Nomex)' }])
    assert.equal(compare(readLength(cell), number(3), 29).id, 'not_comparable', JSON.stringify(cell));
  assert.equal(compare(readLength({ value: null, raw: 'Complete' }), number(3), null).id, 'not_comparable', 'no sample length, no reading of Complete');
  assert.equal(compare(readLength({ value: null, raw: 'Complete' }), number(40), 29).id, 'not_comparable');
});

test('the four plain comparisons, and the basis of each', () => {
  const number = v => readLength({ value: v, raw: `${v} cm` }), complete = readLength({ value: null, raw: 'Complete' });
  assert.deepEqual([compare(number(0), number(7.6), 29).id, compare(number(9), number(2), 29).id, compare(number(4), number(4), 29).id], ['further_normal', 'further_micro', 'same']);
  assert.equal(compare(number(0), number(7.6), null).basis, 'numbers', 'two numbers need no sample length');
  assert.deepEqual([compare(number(10), complete, 29).id, compare(complete, number(10), 29).id, compare(number(29), complete, 29).id, compare(complete, complete, 29).id], ['further_normal', 'further_micro', 'same', 'same']);
  assert.equal(compare(number(10), complete, 29).basis, 'complete_word');
  for (const s of view.samples) { assert.equal(s.comparison.label, GRAVITY_CONTRAST.comparisons[s.comparison.id]); assert.equal(s.comparison.basis === null, s.comparison.id === 'not_comparable'); }
});

test('a suspicious raw value is shown as recorded and flagged, never repaired', () => {
  const odd = rows.filter(r => r.fuel_size.includes('thickness 037 mm'));
  assert.ok(odd.length > 0);
  for (const row of odd) { const s = byId[row.id]; assert.equal(s.size.thickness_raw, '037 mm'); assert.ok(s.flags.some(f => f.id === 'thickness_suspicious' && f.text.includes('“037 mm”')));
    assert.doesNotMatch(JSON.stringify(s), /0\.37|"thickness_mm"/, 'no corrected thickness appears'); }
  assert.ok(readSize('thickness See Fig. 5; length 29 cm; width 5 cm').flags.some(f => f.id === 'thickness_not_single'));
  assert.deepEqual(readSize('thickness 0.27 mm; length 29 cm; width 5 cm').flags, []);
  for (const row of rows.filter(r => r.fuel === null)) assert.ok(byId[row.id].flags.some(f => f.id === 'material_missing'), `${row.id} keeps its empty material`);
  assert.equal(view.summary.flagged, view.samples.filter(s => s.flags.length).length);
});

test('bars are drawn only from recorded lengths against the recorded sample length', () => {
  for (const s of view.samples) for (const side of [s.micro, s.normal]) {
    if (side.kind === 'number' && s.size.length_cm) assert.equal(side.fraction, side.value / s.size.length_cm);
    else if (side.kind === 'complete') assert.equal(side.fraction, 1);
    else assert.equal(side.fraction, null);
    if (side.fraction !== null) assert.ok(side.fraction >= 0 && side.fraction <= 1);
  }
});

test('the wording keeps to two gravity levels and makes no promise', () => {
  const panel = read('web/js/world/gravity-contrast-panel.js'), module = read('web/js/core/gravity-contrast.js'), css = read('web/css/gravity-contrast.css'), host = read('web/js/world/act-evidence.js');
  const said = [view.scope, view.limits, summaryText(view.summary), landingSentence(view.summary), ...Object.values(GRAVITY_CONTRAST.comparisons), ...view.samples.flatMap(s => s.flags.map(f => f.text))].join(' ');
  assert.doesNotMatch(said + panel, /\bsafe\b|\bproven\b|validated|certified|trend|predict|interpolat|lunar gravity|1\/6|0\.38/i);
  assert.match(view.scope, /the Moon and Mars lie between and no row in this collection tests them/);
  assert.match(view.limits, /not independent experiments/); assert.match(view.limits, /no general law/);
  assert.ok(panel.includes('What NASA’s Saffire-II rows say about gravity'));
  assert.doesNotMatch(panel, /https?:\/\//, 'the address comes from investigations.json');
  assert.doesNotMatch(css, /url\(|@import/);
  for (const n of new Set(Object.values(view.summary).filter(v => typeof v === 'number' && v > 1))) for (const [name, source] of [['panel', panel], ['module', module]])
    assert.ok(!new RegExp(`\\b${n} of \\d`).test(source), `count ${n} is typed into the ${name}`);
  const key = panel.match(/gravity-contrast\.js\?v=([\w-]+)/)[1];
  assert.ok(panel.includes(`gravity-contrast.css?v=${key}`)); assert.ok(host.includes(`./gravity-contrast-panel.js?v=${key}`));
  assert.match(host, /if \(panel === 'prediction'\) consoleEl\.append\(gravityPanel\.element, outcomePanel\.element\);/);
  for (const cls of ['gravity-contrast', 'gc-track', 'gc-fill', 'gc-fill-word', 'gc-track-empty', 'gc-source', 'gc-limit']) assert.ok(css.includes(`.${cls}`) && (cls === 'gravity-contrast' || panel.includes(cls)), cls);
});

test('other investigations and empty input give no sample and no count', () => {
  const none = gravityContrast({ tests: tests.filter(r => r.psi_id !== 'PSI-99'), investigations, tables });
  assert.equal(none.samples.length, 0); assert.equal(none.summary.comparable, 0);
  assert.equal(gravityContrast().samples.length, 0);
});
