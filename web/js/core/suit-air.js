// Suit pressure, cabin pressure and cabin oxygen, from NASA documents listed in web/data/suitair-sources.json.
// Every constant is read from that file; nothing numeric about the physiology is typed here.
// The arithmetic is VESTA's, not NASA's: R = cabin nitrogen pressure / suit pressure, for a crew whose tissue
// nitrogen equals the cabin's and who breathes no extra oxygen beforehand. Cabin gas is treated as oxygen and
// nitrogen only. A cited R is used only at the suit pressure its source pairs it with.
// The oxygen percentage is placed on the FLEX droplet bands (oxygen-limit.js) only inside the oxygen range
// those tests covered, and always with the pressure caveat. Not medical guidance.
import { OXYGEN_LIMIT, bandOf, describe, limitRows } from './oxygen-limit.js';

export const SUIT_AIR = Object.freeze({
  id: 'suit-air/2', step: 0.1,
  ratios: Object.freeze(['r_emu', 'r_orlan']),
  cabins: Object.freeze(['cabin_exploration', 'cabin_staged', 'cabin_sea_level']),
  stated: Object.freeze(['atmosphere', 'atmosphere_min']),
  ranges: Object.freeze(['suit_range_2023', 'suit_range_2006']),
  not_stated: 'not stated for this suit pressure',
  kpa_per_psi: 6.894757,
  scope: 'What these NASA sources state, put side by side: liquid fuel droplets in microgravity, not cabin materials; a physiological input from NASA documents, not medical guidance.'
});

const finite = Number.isFinite;
const one = n => (Math.round(n * 10) / 10).toFixed(1);
const two = n => (Math.round(n * 100) / 100).toFixed(2);
const plain = n => String(Math.round(n * 10) / 10);
const same = (a, b) => Math.abs(a - b) < 1e-9;
/** The ratio as its source writes it: "about" is kept when the quoted sentence says about. */
export const ratioText = entry => `${entry.quote.includes(`about ${entry.value}`) ? 'about ' : ''}${two(entry.value)}`;

/** Named entries of the sources file; throws when one the calculator needs is missing. */
export function constants(file) {
  const byId = new Map((file?.sources ?? []).map(entry => [entry.id, entry]));
  const get = id => { const entry = byId.get(id); if (!entry) throw new Error(`Source entry ${id} is missing.`); return entry; };
  const ranges = SUIT_AIR.ranges.map(get);
  return { get,
    ratios: SUIT_AIR.ratios.map(get), cabins: SUIT_AIR.cabins.map(get), stated: SUIT_AIR.stated.map(get), ranges,
    suit: get('suit_emu').value,
    suitMin: Math.min(...ranges.map(r => r.value[0])), suitMax: Math.max(...ranges.map(r => r.value[1])),
    mmHgPerPsi: get('pressure_units').mmhg / get('pressure_units').psia, water: get('water_vapor').value,
    normoxic: [get('normoxic_150').value, get('normoxic_149').value], check: get('table7_check') };
}

/** R with no prebreathe: cabin nitrogen partial pressure over suit pressure. */
export function ratio(oxygenPercent, cabinPsia, suitPsia) {
  if (![oxygenPercent, cabinPsia, suitPsia].every(finite) || suitPsia <= 0 || cabinPsia <= 0 || oxygenPercent < 0 || oxygenPercent > 100) return null;
  return cabinPsia * (1 - oxygenPercent / 100) / suitPsia;
}
/** Cabin oxygen percentage at which that ratio equals r. Zero or less means the ratio is under r at any mix. */
export function oxygenFor(r, cabinPsia, suitPsia) {
  if (![r, cabinPsia, suitPsia].every(finite) || r <= 0 || suitPsia <= 0 || cabinPsia <= 0) return null;
  return 100 * (1 - r * suitPsia / cabinPsia);
}
/** Inspired oxygen pressure in mmHg: (cabin pressure - water vapour) x oxygen fraction, the report's Eq. 4. */
export function inspired(oxygenPercent, cabinPsia, mmHgPerPsi, water) {
  if (![oxygenPercent, cabinPsia, mmHgPerPsi, water].every(finite)) return null;
  return (cabinPsia * mmHgPerPsi - water) * oxygenPercent / 100;
}

/** Pooled FLEX counts per oxygen band, from the loaded source rows. */
export function bandCounts(tests) {
  const cells = describe(tests).lines[0]?.cells ?? [];
  return OXYGEN_LIMIT.bands.map(band => { const cell = cells.find(c => c.band === band.id); return { id: band.id, label: band.label, extinction: cell?.extinction ?? 0, tests: cell?.tests ?? 0 }; });
}
/** Oxygen percent and total pressure actually covered by the counted FLEX rows, read from the rows. */
export function flexRange(tests) {
  const rows = limitRows(tests).rows, span = values => { const v = values.filter(finite); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
  return { oxygen: span(rows.map(row => row.n?.o2)), kpa: span(rows.map(row => row.n?.p)) };
}
/** Where an oxygen percentage sits on the FLEX bands: a band, or outside what FLEX tested. */
function place(oxygenPercent, bands, range) {
  if (!finite(oxygenPercent) || !range.oxygen) return { band: null, outside: true };
  // The band is read from the percentage as displayed, so the two can never disagree on screen.
  const shown = Number(one(oxygenPercent));
  if (shown < range.oxygen[0] || shown > range.oxygen[1]) return { band: null, outside: true };
  return { band: bands.find(band => band.id === bandOf(shown)) ?? null, outside: false };
}
const outsideText = range => range.oxygen ? `outside the oxygen range of the FLEX tests (${plain(range.oxygen[0])}% to ${plain(range.oxygen[1])}%)` : 'no FLEX tests to compare with';
const bandText = (spot, range) => spot.band ? `${spot.band.label}: ${spot.band.extinction} of ${spot.band.tests} went out` : outsideText(range);

/** Everything the panel prints for one suit pressure and one cabin pressure. */
export function suitAir(file, tests, { suit, cabin } = {}) {
  const c = constants(file), bands = bandCounts(tests), range = flexRange(tests);
  const suitPsia = finite(suit) ? Math.min(c.suitMax, Math.max(c.suitMin, suit)) : c.suit;
  const cabinEntry = c.cabins.find(entry => entry.id === cabin) ?? c.cabins[0], cabinPsia = cabinEntry.cabin_psia;
  const pio2 = (oxygen, pressure) => inspired(oxygen, pressure, c.mmHgPerPsi, c.water);
  const limits = c.ratios.map(entry => {
    const label = `R = ${ratioText(entry)}, stated for the ${entry.paired_suit}`, matches = same(entry.paired_suit_psia, suitPsia);
    const base = { id: entry.id, kind: 'ratio', r: entry.value, r_text: ratioText(entry), paired: entry.paired_suit, matches };
    // A cited R belongs to the suit pressure its source names; it is not carried to any other.
    if (!matches) return { ...base, oxygen: null, band: null, outside: false, pio2: null,
      cells: [label, `${plain(cabinPsia)} psia`, SUIT_AIR.not_stated, SUIT_AIR.not_stated, 'not applicable', 'not applicable'] };
    const oxygen = oxygenFor(entry.value, cabinPsia, suitPsia), any = oxygen <= 0;
    if (any) return { ...base, oxygen: null, band: null, outside: false, pio2: null, any: true,
      cells: [label, `${plain(cabinPsia)} psia`, `any (R is ${two(ratio(0, cabinPsia, suitPsia))} with no oxygen at all)`, ratioText(entry), 'not applicable', 'not applicable'] };
    const shown = Number(one(oxygen)), spot = place(oxygen, bands, range), mmHg = Math.round(pio2(shown, cabinPsia));
    return { ...base, oxygen: shown, band: spot.band, outside: spot.outside, pio2: mmHg, any: false,
      cells: [label, `${plain(cabinPsia)} psia`, `${one(oxygen)}%`, ratioText(entry), `${mmHg} mmHg`, bandText(spot, range)] };
  });
  const stated = c.stated.map(entry => {
    const r = ratio(entry.oxygen_percent, entry.cabin_psia, suitPsia), spot = place(entry.oxygen_percent, bands, range);
    return { id: entry.id, kind: 'stated', r: Number(two(r)), oxygen: entry.oxygen_percent, band: spot.band, outside: spot.outside,
      cells: [`${entry.label}`, `${plain(entry.cabin_psia)} psia`, `${plain(entry.oxygen_percent)}%${entry.id === 'atmosphere_min' ? ' or more' : ''}`, two(r),
        `${Math.round(pio2(entry.oxygen_percent, entry.cabin_psia))} mmHg`, bandText(spot, range)] };
  });
  const first = limits.find(row => row.matches) ?? null, exploration = stated[0], explorationCabin = c.cabins[0];
  const pairs = limits.map(row => `${row.r_text} for the ${row.paired}`).join(' and ');
  const lead = !first
    ? `The sources state R of ${pairs}; R is ${SUIT_AIR.not_stated} (${one(suitPsia)} psia), so no cabin oxygen figure is worked out from it.`
    : first.any
      ? `With the suit at ${one(suitPsia)} psia and the cabin at ${one(cabinPsia)} psia, R stays under ${first.r_text} at any oxygen percentage (VESTA’s arithmetic from the definition in the report), so this ratio gives no oxygen figure to place on the FLEX bands.`
      : `With the suit at ${one(suitPsia)} psia, the cabin at ${one(cabinPsia)} psia and no oxygen prebreathe, R equals ${first.r_text} at ${one(first.oxygen)}% cabin oxygen and is lower at any higher oxygen (VESTA’s arithmetic from the definition in the report); inspired oxygen at that percentage works out to ${first.pio2} mmHg, beside the report’s ${explorationCabin.pio2_mmhg} mmHg for the exploration atmosphere.`;
  const flexLine = !first || first.any ? ''
    : first.band ? `${one(first.oxygen)}% oxygen falls in the recorded FLEX band “${first.band.label}”, where ${first.band.extinction} of ${first.band.tests} droplet tests went out on their own.`
      : `${one(first.oxygen)}% oxygen is ${outsideText(range)}, so no band count is shown for it.`;
  const statedSpot = exploration.band ? `falls in the band “${exploration.band.label}”, where ${exploration.band.extinction} of ${exploration.band.tests} went out` : `is ${outsideText(range)}`;
  const statedLine = `The exploration atmosphere as stated (${plain(exploration.oxygen)}% oxygen at ${plain(c.stated[0].cabin_psia)} psia) gives R = ${two(exploration.r)} at this suit pressure (VESTA’s arithmetic) and ${statedSpot}.`;
  const kpa = range.kpa, cabinKpa = cabinPsia * SUIT_AIR.kpa_per_psi, psi = v => plain(v / SUIT_AIR.kpa_per_psi);
  const pressureLine = !kpa ? 'The FLEX bands are by oxygen percent; the test pressures are not recorded, so placing a cabin on them compares percent, not partial pressure.'
    : `The FLEX bands are by oxygen percent, from tests at about ${Math.round(kpa[0])} to ${Math.round(kpa[1])} kPa (about ${psi(kpa[0])} to ${psi(kpa[1])} psia); ${cabinKpa < kpa[0] || cabinKpa > kpa[1]
      ? `none was at ${plain(cabinPsia)} psia, so placing a cabin at ${plain(cabinPsia)} psia on them compares percent, not partial pressure`
      : `the bands pool all of those pressures, so placing a cabin at ${plain(cabinPsia)} psia on them compares percent, not partial pressure`}.`;
  const check = c.check;
  return { id: SUIT_AIR.id, scope: SUIT_AIR.scope, suit: suitPsia, cabin: cabinEntry.id, cabin_psia: cabinPsia, flex_range: range,
    slider: { min: c.suitMin, max: c.suitMax, step: SUIT_AIR.step, value: suitPsia },
    cabins: c.cabins.map(entry => ({ id: entry.id, label: `${entry.name}, ${plain(entry.cabin_psia)} psia` })),
    range_line: `Suit pressure range: ${c.ranges.map(r => `${one(r.value[0])} to ${one(r.value[1])} psia (${r.document})`).join('; ')}. The EMU operates at ${plain(c.suit)} psia.`,
    formula: 'R = tissue nitrogen pressure ÷ suit pressure. With no oxygen prebreathe and tissue nitrogen equal to cabin nitrogen: cabin oxygen % = 100 × (1 − R × suit pressure ÷ cabin pressure).',
    formula_note: `The arithmetic is VESTA’s, from the definition the report gives; the report does not print these oxygen percentages. It treats cabin gas as oxygen and nitrogen only. The sources state R of ${pairs}; at any other suit pressure the row reads “${SUIT_AIR.not_stated}”.`,
    head: ['Row', 'Cabin pressure', 'Cabin oxygen', 'R at this suit pressure', 'Inspired oxygen', 'FLEX band and droplet tests that went out on their own'],
    rows: [...limits, ...stated], lead, flex_line: flexLine, pressure_line: pressureLine, stated_line: statedLine,
    inspired_line: `Inspired oxygen = (cabin pressure − ${c.water} mmHg) × oxygen fraction. The same report lists ${c.cabins.map(e => `${e.pio2_mmhg} mmHg for ${plain(e.cabin_psia)} psia at ${plain(e.oxygen_percent)}%`).join(', ')}, and gives ${c.normoxic.join(' mmHg and ')} mmHg as normoxic in two passages.`,
    check_line: `Check against the report’s Table 7: P1N2 ${check.p1n2}, ${check.prebreathe_min} minutes of prebreathe, printed ratio ${two(check.tr)}; ${check.p1n2} ÷ ${plain(c.suit)} = ${(check.p1n2 / c.suit).toFixed(3)}.`,
    sources: (file.sources ?? []).map(entry => ({ id: entry.id, label: entry.label, value: entry.value === null ? null : `${[].concat(entry.value).join(', ')} ${entry.unit}`, quote: entry.quote,
      where: `${entry.title} (NTRS ${entry.ntrs_id}), ${entry.page}${entry.section ? `, ${entry.section}` : ''}`, url: entry.url })) };
}
