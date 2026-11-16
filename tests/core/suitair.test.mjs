// Suit pressure and cabin oxygen: every number on screen is recomputed here from
// web/data/suitair-sources.json and the loaded FLEX rows, with arithmetic written a second time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex } from '../../web/js/core/index.js';
import { limitRows, bandOf, OXYGEN_LIMIT } from '../../web/js/core/oxygen-limit.js';
import { SUIT_AIR, constants, ratio, oxygenFor, inspired, bandCounts, flexRange, ratioText, suitAir } from '../../web/js/core/suit-air.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations', 'tables', 'rules', 'sources', 'meta'].filter(name => fs.existsSync(new URL(`../../web/data/${name}.json`, import.meta.url))).map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw), file = JSON.parse(read('web/data/suitair-sources.json'));
const src = id => file.sources.find(entry => entry.id === id);
const moduleText = read('web/js/core/suit-air.js'), panelText = read('web/js/world/suit-air-panel.js');

// Second, independent count of the FLEX bands.
const counted = OXYGEN_LIMIT.bands.map(band => {
  const rows = limitRows(db.tests).rows.filter(row => row.n.o2 > band.min && row.n.o2 <= band.max);
  return { id: band.id, label: band.label, tests: rows.length, extinction: rows.filter(row => row.outcomes.test_end.value === 'extinction').length };
});
const bandFor = oxygen => counted.find(band => oxygen > OXYGEN_LIMIT.bands.find(b => b.id === band.id).min && oxygen <= OXYGEN_LIMIT.bands.find(b => b.id === band.id).max);
const r1 = n => (Math.round(n * 10) / 10).toFixed(1), r2 = n => (Math.round(n * 100) / 100).toFixed(2);

test('every source entry is a fetched NASA document with a verbatim quote that contains its value', () => {
  assert.equal(file.schema, 'vesta.suitair-sources/1');
  assert.ok(file.sources.length >= 12);
  assert.equal(new Set(file.sources.map(entry => entry.id)).size, file.sources.length);
  for (const entry of file.sources) {
    const url = new URL(entry.url);
    assert.equal(url.protocol, 'https:', entry.id); assert.ok(url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov'), entry.id);
    assert.ok(new URL(entry.record).hostname.endsWith('.nasa.gov'));
    assert.ok(typeof entry.quote === 'string' && entry.quote.trim().length > 20, `${entry.id} quote`);
    for (const key of ['title', 'ntrs_id', 'document', 'page', 'label']) assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `${entry.id} ${key}`);
    assert.match(entry.ntrs_id, /^\d{11}$/); assert.ok(entry.url.includes(entry.ntrs_id)); assert.match(entry.page, /^PDF p\. \d+$/);
    for (const value of entry.value === null ? [] : [].concat(entry.value)) {
      assert.ok(Number.isFinite(value), entry.id);
      assert.ok(new RegExp(`(?<![\\d.])${String(value).replace('.', '\\.')}(?:\\.0)?(?![\\d])`).test(entry.quote), `${entry.id}: ${value} is not in its quote`);
    }
    for (const key of ['cabin_psia', 'oxygen_percent', 'pio2_mmhg', 'paired_suit_psia', 'p1n2', 'tr', 'psia', 'mmhg']) if (key in entry) assert.ok(entry.quote.includes(String(entry[key])), `${entry.id}.${key}`);
  }
  assert.ok(new Set(file.sources.map(entry => entry.ntrs_id)).size >= 3, 'more than one NASA document');
});

test('the band counts are the recorded FLEX counts', () => {
  assert.deepEqual(bandCounts(db.tests), counted);
  assert.deepEqual(counted.map(band => `${band.extinction}/${band.tests}`), ['103/115', '63/91', '20/59', '0/9']);
});

const NOT_STATED = 'not stated for this suit pressure', OUTSIDE = 'outside the oxygen range of the FLEX tests (12% to 34%)';
const flexCell = oxygen => { if (oxygen < 12 || oxygen > 34) return OUTSIDE; const band = bandFor(oxygen); return `${band.label}: ${band.extinction} of ${band.tests} went out`; };

test('the formula, written a second time, gives every displayed oxygen percentage, ratio and band', () => {
  const mmHgPerPsi = src('pressure_units').mmhg / src('pressure_units').psia, water = src('water_vapor').value;
  const suits = [3.5, 3.7, 4.3, 5.0, 5.8, 6.5, 8.2];
  let outside = 0, banded = 0;
  for (const suit of suits) for (const cabinId of SUIT_AIR.cabins) {
    const view = suitAir(file, db.tests, { suit, cabin: cabinId }), cabin = src(cabinId).cabin_psia;
    assert.equal(view.suit, suit); assert.equal(view.cabin_psia, cabin);
    for (const id of SUIT_AIR.ratios) {
      const row = view.rows.find(item => item.id === id), R = src(id).value, oxygen = 100 * (1 - R * suit / cabin);
      assert.ok(row.cells[0].includes(`R = ${ratioText(src(id))}`) && row.cells[0].includes(src(id).paired_suit));
      if (suit !== src(id).paired_suit_psia) {
        assert.deepEqual(row.cells.slice(2), [NOT_STATED, NOT_STATED, 'not applicable', 'not applicable'], `${id} is not applied at ${suit} psia`);
        assert.equal(row.oxygen, null); assert.equal(row.band, null); continue;
      }
      if (oxygen <= 0) { assert.equal(row.oxygen, null); assert.equal(row.band, null); assert.ok(row.cells[2].startsWith(`any (R is ${r2(cabin / suit)} `)); assert.equal(row.cells[5], 'not applicable'); continue; }
      const shown = Number(r1(oxygen));
      assert.equal(row.cells[2], `${r1(oxygen)}%`); assert.equal(row.oxygen, shown);
      assert.equal(row.cells[5], flexCell(shown));
      if (shown < 12 || shown > 34) { outside++; assert.equal(row.band, null); assert.equal(view.flex_line, `${r1(oxygen)}% oxygen is ${OUTSIDE}, so no band count is shown for it.`); assert.doesNotMatch(view.flex_line + row.cells[5], /went out/); }
      else { banded++; assert.ok(view.flex_line.includes(`${bandFor(shown).extinction} of ${bandFor(shown).tests} droplet tests went out`)); }
      assert.equal(row.cells[4], `${Math.round((cabin * mmHgPerPsi - water) * shown / 100)} mmHg`);
      assert.ok(Math.abs(cabin * (1 - oxygen / 100) / suit - R) < 1e-9, 'the percentage holds R at the cited value');
    }
    for (const id of SUIT_AIR.stated) {
      const row = view.rows.find(item => item.id === id), entry = src(id), R = entry.cabin_psia * (1 - entry.oxygen_percent / 100) / suit;
      assert.equal(row.cells[3], r2(R)); assert.ok(row.cells[2].startsWith(`${entry.oxygen_percent}%`));
      assert.equal(row.cells[5], flexCell(entry.oxygen_percent));
    }
    assert.equal(view.rows.length, SUIT_AIR.ratios.length + SUIT_AIR.stated.length);
  }
  assert.ok(outside >= 1 && banded >= 2, 'both the outside-range and the in-range paths were exercised');
});

test('the FLEX range and the pressure caveat are read from the recorded rows', () => {
  const rows = limitRows(db.tests).rows, o2 = rows.map(row => row.n.o2), kpa = rows.map(row => row.n.p).filter(Number.isFinite);
  const range = flexRange(db.tests);
  assert.deepEqual(range.oxygen, [Math.min(...o2), Math.max(...o2)]); assert.deepEqual(range.oxygen, [12, 34]);
  assert.deepEqual(range.kpa, [Math.min(...kpa), Math.max(...kpa)]);
  const psi = value => String(Math.round(value / 6.894757 * 10) / 10), cabin = src('cabin_exploration').cabin_psia;
  assert.ok(cabin * 6.894757 < range.kpa[0], 'no counted FLEX test was at the exploration cabin pressure');
  assert.equal(suitAir(file, db.tests).pressure_line, `The FLEX bands are by oxygen percent, from tests at about ${Math.round(range.kpa[0])} to ${Math.round(range.kpa[1])} kPa (about ${psi(range.kpa[0])} to ${psi(range.kpa[1])} psia); none was at ${cabin} psia, so placing a cabin at ${cabin} psia on them compares percent, not partial pressure.`);
  for (const cabinId of SUIT_AIR.cabins) for (const suit of [4.3, 5, 5.8]) assert.match(suitAir(file, db.tests, { suit, cabin: cabinId }).pressure_line, /compares percent, not partial pressure\.$/);
  assert.doesNotMatch(suitAir(file, db.tests, { cabin: 'cabin_sea_level' }).pressure_line, /none was at/);
  assert.equal(Math.round(range.kpa[0]), 70);
});

test('the default view states the sentences this patch reports', () => {
  const view = suitAir(file, db.tests), suit = src('suit_emu').value, cabin = src('cabin_exploration').cabin_psia, R = src('r_emu').value;
  const oxygen = 100 * (1 - R * suit / cabin), band = bandFor(Number(r1(oxygen))), stated = src('atmosphere'), over = bandFor(stated.oxygen_percent);
  const mmHg = Math.round((cabin * src('pressure_units').mmhg / src('pressure_units').psia - src('water_vapor').value) * Number(r1(oxygen)) / 100);
  assert.equal(view.lead, `With the suit at ${r1(suit)} psia, the cabin at ${r1(cabin)} psia and no oxygen prebreathe, R equals ${r2(R)} at ${r1(oxygen)}% cabin oxygen and is lower at any higher oxygen (VESTA’s arithmetic from the definition in the report); inspired oxygen at that percentage works out to ${mmHg} mmHg, beside the report’s ${src('cabin_exploration').pio2_mmhg} mmHg for the exploration atmosphere.`);
  assert.ok(view.lead.includes('R equals 1.65 at 13.5% cabin oxygen and is lower at any higher oxygen (VESTA’s arithmetic from the definition in the report)'));
  assert.ok(view.lead.includes('51 mmHg, beside the report’s 128 mmHg'));
  assert.equal(view.flex_line, `${r1(oxygen)}% oxygen falls in the recorded FLEX band “${band.label}”, where ${band.extinction} of ${band.tests} droplet tests went out on their own.`);
  assert.equal(view.stated_line, `The exploration atmosphere as stated (${stated.oxygen_percent}% oxygen at ${stated.cabin_psia} psia) gives R = ${r2(stated.cabin_psia * (1 - stated.oxygen_percent / 100) / suit)} at this suit pressure (VESTA’s arithmetic) and falls in the band “${over.label}”, where ${over.extinction} of ${over.tests} went out.`);
  assert.equal(r1(oxygen), '13.5'); assert.equal(band.id, 'le18'); assert.equal(over.id, 'gt30');
  assert.equal(view.scope, 'What these NASA sources state, put side by side: liquid fuel droplets in microgravity, not cabin materials; a physiological input from NASA documents, not medical guidance.');
  assert.equal(file.scope, view.scope);
  assert.equal(view.sources.length, file.sources.length);
  for (const item of view.sources) { assert.ok(item.quote && item.url.startsWith('https://ntrs.nasa.gov/')); }
});

test('a cited ratio is used only at the suit pressure its source names, and 1.85 is written as about 1.85', () => {
  assert.equal(ratioText(src('r_orlan')), 'about 1.85'); assert.equal(ratioText(src('r_emu')), '1.65');
  assert.ok(src('r_orlan').quote.includes('about 1.85'));
  const other = suitAir(file, db.tests, { suit: 6.5 });
  assert.equal(other.lead, 'The sources state R of 1.65 for the 4.3 psia EMU and about 1.85 for the 5.8 psia Orlan; R is not stated for this suit pressure (6.5 psia), so no cabin oxygen figure is worked out from it.');
  assert.equal(other.flex_line, '');
  for (const row of other.rows.filter(item => item.kind === 'ratio')) assert.equal(row.cells[2], NOT_STATED);
  const orlan = suitAir(file, db.tests, { suit: 5.8, cabin: 'cabin_sea_level' });
  assert.ok(orlan.lead.includes('R equals about 1.85 at 27.0% cabin oxygen'));
  assert.equal(orlan.rows.find(row => row.id === 'r_orlan').cells[3], 'about 1.85'); assert.equal(orlan.rows.find(row => row.id === 'r_emu').cells[3], NOT_STATED);
  for (const suit of [3.5, 4.3, 5, 5.8, 8.2]) for (const cabin of SUIT_AIR.cabins) {
    const view = suitAir(file, db.tests, { suit, cabin }), copy = [view.lead, view.flex_line, view.stated_line, view.formula_note, ...view.rows.flatMap(row => row.cells)].join(' ');
    assert.doesNotMatch(copy, /(?<!about )1\.85/, 'never 1.85 without about');
    assert.doesNotMatch(copy, /NASA’s (decompression )?(ratio|R|arithmetic)|NASA (says|states|gives) R/);
  }
});

test('the slider covers the cited suit range and starts at the cited EMU pressure', () => {
  const view = suitAir(file, db.tests), lows = SUIT_AIR.ranges.map(id => src(id).value[0]), highs = SUIT_AIR.ranges.map(id => src(id).value[1]);
  assert.deepEqual(view.slider, { min: Math.min(...lows), max: Math.max(...highs), step: 0.1, value: src('suit_emu').value });
  assert.equal(suitAir(file, db.tests, { suit: 99 }).suit, Math.max(...highs)); assert.equal(suitAir(file, db.tests, { suit: 0 }).suit, Math.min(...lows));
  for (const id of SUIT_AIR.ranges) assert.ok(view.range_line.includes(`${r1(src(id).value[0])} to ${r1(src(id).value[1])} psia`), 'both cited ranges are shown');
  assert.deepEqual(view.cabins.map(item => item.id), [...SUIT_AIR.cabins]);
});

test('the cited cross-checks hold: Table 8 inspired oxygen and the Table 7 ratio', () => {
  const c = constants(file);
  for (const id of SUIT_AIR.cabins) { const e = src(id); assert.equal(Math.round(inspired(e.oxygen_percent, e.cabin_psia, c.mmHgPerPsi, c.water)), e.pio2_mmhg, id); }
  const check = src('table7_check'); assert.ok(Math.abs(check.p1n2 / src('suit_emu').value - check.tr) < 0.01);
  const view = suitAir(file, db.tests);
  assert.ok(view.check_line.includes(`${check.p1n2} ÷ ${src('suit_emu').value} = ${(check.p1n2 / src('suit_emu').value).toFixed(3)}`));
  assert.ok(view.inspired_line.includes(`${src('normoxic_150').value} mmHg and ${src('normoxic_149').value} mmHg as normoxic`), 'both normoxic figures are shown');
  assert.equal(ratio(34, 8.2, 0), null); assert.equal(oxygenFor(0, 8.2, 4.3), null); assert.equal(inspired(NaN, 1, 1, 1), null);
  assert.throws(() => constants({ sources: [] }), /missing/);
});

test('no cited value is typed into the module or the panel, and the copy makes no claim', () => {
  const cited = new Set(file.sources.flatMap(entry => entry.value === null ? [] : [].concat(entry.value)).filter(value => value !== 0 && value !== 8));
  for (const value of cited) for (const [name, text] of [['module', moduleText], ['panel', panelText]])
    assert.ok(!new RegExp(`(?<![\\d.#_-])${String(value).replace('.', '\\.')}(?![\\d.])`).test(text), `${value} is typed into the ${name}`);
  const view = suitAir(file, db.tests), copy = [view.lead, view.flex_line, view.pressure_line, view.stated_line, view.formula, view.formula_note, view.range_line, view.inspired_line, view.check_line, view.scope, ...view.head, ...view.rows.flatMap(row => row.cells), panelText].join(' ');
  assert.doesNotMatch(copy, /\b(safe|safely|safety|proven|validated|certified|recommend\w*|should|must)\b/i);
  assert.doesNotMatch(panelText, /https?:\/\//); assert.doesNotMatch(panelText, /innerHTML|<img|url\(/);
});

test('the panel is one collapsed details that prints the caveat, and the patch leaves the landing page and the host alone', () => {
  assert.match(panelText, /make\('details', null, 'op-method suit-air'\)/); assert.doesNotMatch(panelText, /\.open = true/);
  assert.ok(panelText.includes("make('summary', 'Spacewalk suit pressure and cabin oxygen: what NASA sources state, put side by side')"));
  assert.match(panelText, /view\.pressure_line/); assert.match(panelText, /view\.flex_line/);
  assert.match(panelText, /data\/suitair-sources\.json/); assert.match(panelText, /type = 'range'/);
  const css = read('web/css/outcome-panel.css');
  for (const cls of ['op-method', 'op-form', 'op-fuels', 'op-note', 'op-limit', 'op-oxygen-lead']) { assert.ok(css.includes(`.${cls}`)); assert.ok(panelText.includes(cls)); }
  assert.ok(!read('web/index.html').includes('lead-suitair'), 'no sentence is added to the landing page');
  assert.ok(!moduleText.includes('landingSentence'));
});
