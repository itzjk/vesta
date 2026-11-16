// What one NASA report states about limiting oxygen at Earth, Martian, lunar and micro gravity, put side by side.
// Pure: the caller passes web/data/partialg-sources.json and, optionally, the PSI source rows for the scope count.
// Every number is parsed from a verbatim quote in that file; nothing here is typed in as a constant, and nothing
// here touches matching, ranking or statuses. Report values, not VESTA evidence rows and not a cabin prediction.

export const PARTIALG = Object.freeze({
  id: 'partialg/1',
  heading: 'What NASA measured at lunar and Martian gravity',
  // Display order and labels; the report's own row labels stay in the quotes.
  levels: Object.freeze([
    Object.freeze({ id: 'earth', label: 'Earth gravity (1g)' }),
    Object.freeze({ id: 'mars', label: 'Martian gravity' }),
    Object.freeze({ id: 'moon', label: 'Lunar gravity' }),
    Object.freeze({ id: 'micro', label: 'Microgravity with forced flow (0g*)' })
  ]),
  measures: Object.freeze({ moc: 'MOC', uloi: 'ULOI' }),
  axis_step: 5
});

const finite = Number.isFinite;
const round2 = value => Math.round(value * 100) / 100;
const NASA_URL = /^https:\/\/(?:[a-z0-9-]+\.)*nasa\.gov\//;

/** The last `count` numbers printed in a table-row quote, in column order. Null when the row does not hold them. */
export function cellsOf(quote, count) {
  const tokens = String(quote ?? '').trim().split(/\s+/).slice(-count);
  if (tokens.length !== count || !tokens.every(token => /^-?\d+(?:\.\d+)?$/.test(token))) return null;
  return tokens.map(Number);
}
/** A value as the report printed it, so 20.0 stays 20.0. */
const printed = (quote, count, column) => String(quote).trim().split(/\s+/).slice(-count)[column];
const pressures = (quote, count) => {
  const found = [...String(quote ?? '').matchAll(/(\d+(?:\.\d+)?)\s*psia/g)].map(match => Number(match[1]));
  return found.length === count ? found : null;
};

/** Every entry that must carry a NASA https URL and a verbatim quote. */
export function sourceEntries(sources) {
  const table = sources?.table, out = [];
  for (const doc of sources?.documents ?? []) out.push({ kind: 'document', id: doc.id, url: doc.url, quote: doc.quote, location: doc.location });
  if (table) {
    out.push({ kind: 'table', id: 'title', url: table.url, quote: table.quote, location: table.location });
    out.push({ kind: 'table', id: 'header', url: table.url, quote: table.header_quote, location: table.location });
    out.push({ kind: 'table', id: 'pressure', url: table.url, quote: table.pressure_quote, location: table.location });
    for (const row of table.rows ?? []) out.push({ kind: 'value', id: `${row.gravity}:${row.measure}`, url: table.url, quote: row.quote, location: table.location });
    for (const row of table.margins ?? []) out.push({ kind: 'margin', id: row.gravity, url: table.url, quote: row.quote, location: table.location });
  }
  for (const note of sources?.notes ?? []) out.push({ kind: 'note', id: note.id, url: note.url, quote: note.quote, location: note.location });
  for (const doc of sources?.also_read ?? []) out.push({ kind: 'also_read', id: doc.id, url: doc.url, quote: doc.quote, location: doc.location });
  return out;
}
export const isNasaUrl = url => typeof url === 'string' && NASA_URL.test(url);

/**
 * The side-by-side model. `rows` is the PSI source-row list (web/data/tests.json), used only to state how many
 * rows the collection holds and how many of them are at partial gravity.
 */
export function partialGravity(sources, { rows = null } = {}) {
  const table = sources?.table, materials = table?.materials ?? [], count = materials.length;
  const doc = (sources?.documents ?? []).find(d => d.id === table?.document) ?? null;
  const bad = sourceEntries(sources).filter(entry => !isNasaUrl(entry.url) || !String(entry.quote ?? '').trim());
  if (!table || !doc || !count || bad.length) return { ok: false, heading: PARTIALG.heading, reason: 'The source file is missing a NASA URL or a quote, so nothing is shown.' };

  const value = (gravity, measure, column) => {
    const row = (table.rows ?? []).find(r => r.gravity === gravity && r.measure === measure), cells = row && cellsOf(row.quote, count);
    return cells ? { value: cells[column], text: printed(row.quote, count, column), quote: row.quote } : null;
  };
  const psia = pressures(table.pressure_quote, count);
  const all = [];
  const items = materials.map((material, column) => {
    const earth = { moc: value('earth', 'moc', column), uloi: value('earth', 'uloi', column) };
    const levels = PARTIALG.levels.map(level => {
      const moc = value(level.id, 'moc', column), uloi = value(level.id, 'uloi', column);
      if (!moc || !uloi) return null;
      all.push(moc.value, uloi.value);
      const stated = (table.margins ?? []).find(m => m.gravity === level.id), statedCells = stated && cellsOf(stated.quote, count);
      // Equation (1) of the report: mean of the two reduced-gravity limits minus the mean of the two 1g limits.
      const computed = level.id !== 'earth' && earth.moc && earth.uloi ? round2((uloi.value + moc.value) / 2 - (earth.uloi.value + earth.moc.value) / 2) : null;
      const margin = computed === null ? null : { computed, stated: statedCells ? statedCells[column] : null, stated_quote: stated?.quote ?? null };
      if (margin) margin.agrees = margin.stated !== null && Math.abs(margin.stated - margin.computed) < 1e-9;
      return { gravity: level.id, label: level.label, moc, uloi, margin };
    }).filter(Boolean);
    return { id: material.id, label: material.label, pressure_psia: psia ? psia[column] : null, levels };
  });
  if (!all.length || !all.every(finite)) return { ok: false, heading: PARTIALG.heading, reason: 'No readable value in the source file.' };

  const step = PARTIALG.axis_step, axis = { min: Math.floor(Math.min(...all) / step) * step, max: Math.ceil(Math.max(...all) / step) * step };
  const share = v => (v - axis.min) / (axis.max - axis.min);
  for (const item of items) for (const level of item.levels) level.bar = { from: share(Math.min(level.moc.value, level.uloi.value)), to: share(Math.max(level.moc.value, level.uloi.value)) };

  const lunar = items.filter(item => item.levels.some(level => level.gravity === 'moon')), martian = items.filter(item => item.levels.some(level => level.gravity === 'mars'));
  const gravities = PARTIALG.levels.filter(level => items.some(item => item.levels.some(l => l.gravity === level.id)));
  const values = items.reduce((sum, item) => sum + item.levels.length * 2, 0);
  const note = id => (sources.notes ?? []).find(n => n.id === id) ?? null;
  const dropSeconds = note('drop-time')?.quote.match(/(\d+(?:\.\d+)?) sec-duration/)?.[1] ?? null;
  const flow = note('microgravity-flow')?.quote.match(/concurrent flow of (\d+(?:\.\d+)?) cm\/s/)?.[1] ?? null;
  const list = Array.isArray(rows) ? rows : null, partialRows = list ? list.filter(row => row?.n?.gclass === 'partial').length : null;
  const en = n => n.toLocaleString('en-US');
  const collection = list ? ` (${en(list.length)} rows, ${partialRows} at partial gravity)` : '';
  const names = items.map(item => item.label).join(', ');
  const method = `upward (concurrent-flow) flame tests; the Martian-gravity values come from a centrifuge inside a ${dropSeconds ?? 'short'} s drop tower, and the report says the table includes earlier lunar and 0g data from its reference 8${flow ? `, 0g with a ${flow} cm/s forced flow` : ''}`;
  const scope = `Scope: ${count} materials (${names}); ${method}. These are report values held outside the PSI row collection${collection} and are not matched against the cabin by VESTA’s coverage rule. They are what this NASA source states, put side by side: not a rating of any material or atmosphere.`;

  return {
    ok: true, id: PARTIALG.id, heading: PARTIALG.heading,
    document: { id: doc.id, title: doc.title, year: doc.year, authors: doc.authors, url: doc.url, record_url: doc.record_url },
    table: { location: table.location, title: table.quote, unit: table.unit },
    lead: `One NASA conference paper tabulates limiting oxygen for ${count} materials at ${gravities.length} gravity levels: ${values} values, shown as printed.`,
    columns: { level: 'Gravity', moc: `${PARTIALG.measures.moc}, % O2`, uloi: `${PARTIALG.measures.uloi}, % O2`, bar: `${PARTIALG.measures.moc} to ${PARTIALG.measures.uloi} on a ${axis.min}–${axis.max}% O2 scale`, margin: 'Mean limit vs 1g, % O2' },
    axis, items, values,
    counts: { materials: count, gravities: gravities.length, lunar: lunar.length, martian: martian.length, collection_rows: list ? list.length : null, partial_rows: partialRows },
    margin_note: 'Mean limit vs 1g is recomputed with the report’s equation (1): the mean of ULOI* and MOC* minus the mean of the 1g ULOI and MOC. A negative number means the reduced-gravity limits sit at a lower oxygen concentration than the 1g limits.',
    notes: (sources.notes ?? []).map(n => ({ id: n.id, label: n.label, quote: n.quote, location: n.location, url: n.url })),
    also_read: (sources.also_read ?? []).map(d => ({ id: d.id, title: d.title, url: d.record_url ?? d.url, why_not_shown: d.why_not_shown })),
    scope
  };
}

/** Text of one margin cell: the recomputed value, plus the report's own when the two differ. */
export function marginText(margin) {
  if (!margin) return '—';
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  if (margin.stated === null) return `${sign(margin.computed)} (recomputed; not stated)`;
  return margin.agrees ? sign(margin.computed) : `${sign(margin.computed)} recomputed; ${sign(margin.stated)} stated`;
}

/** The one landing sentence, only when at least one material has both lunar values and both 1g values. */
export function landingSentence(model) {
  if (!model?.ok || !model.counts.lunar) return null;
  const item = model.items.find(i => i.levels.some(l => l.gravity === 'moon') && i.levels.some(l => l.gravity === 'earth'));
  if (!item) return null;
  const moon = item.levels.find(l => l.gravity === 'moon'), earth = item.levels.find(l => l.gravity === 'earth');
  return `<b>At lunar gravity:</b> NASA’s <a href="${model.document.record_url}" rel="noopener">${model.document.title}</a> tabulates a ${item.label} upward limiting oxygen index of ${moon.uloi.text}% at lunar gravity against ${earth.uloi.text}% at Earth gravity, under different limit criteria, outside the PSI tables.`;
}
