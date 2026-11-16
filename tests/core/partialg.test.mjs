import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PARTIALG, partialGravity, sourceEntries, isNasaUrl, cellsOf, marginText, landingSentence } from '../../web/js/core/partialg.js';
import { createPartialGravityPanel } from '../../web/js/world/partialg-panel.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const sources = JSON.parse(read('web/data/partialg-sources.json')), tests = JSON.parse(read('web/data/tests.json')).tests;
const model = partialGravity(sources, { rows: tests });
const clone = () => JSON.parse(JSON.stringify(sources));

test('every source entry has an https NASA URL, a location and a non-empty quote', () => {
  const entries = sourceEntries(sources);
  assert.ok(entries.length >= sources.table.rows.length + sources.table.margins.length + sources.notes.length + sources.documents.length);
  for (const entry of entries) {
    assert.match(entry.url, /^https:\/\/ntrs\.nasa\.gov\//, `${entry.kind} ${entry.id}`);
    assert.ok(isNasaUrl(entry.url));
    assert.ok(typeof entry.quote === 'string' && entry.quote.trim().length > 0, `${entry.kind} ${entry.id} has a quote`);
    assert.ok(typeof entry.location === 'string' && entry.location.trim().length > 0, `${entry.kind} ${entry.id} has a location`);
  }
  for (const doc of [...sources.documents, ...sources.also_read]) {
    assert.match(doc.ntrs_id, /^\d{11}$/);
    assert.ok(doc.title.length > 0);
    assert.ok(doc.url.includes(`/citations/${doc.ntrs_id}/`), 'the fetched URL belongs to that NTRS record');
    assert.equal(doc.record_url, `https://ntrs.nasa.gov/citations/${doc.ntrs_id}`);
  }
  assert.ok(!isNasaUrl('http://ntrs.nasa.gov/x') && !isNasaUrl('https://nasa.gov.example.com/x') && !isNasaUrl('https://example.com/nasa.gov/'));
  assert.equal(sources.table.document, sources.documents[0].id);
  for (const note of sources.notes) assert.equal(note.document, sources.documents[0].id);
});

test('the source file holds no number of its own: every value is a cell of a quoted table row', () => {
  const count = sources.table.materials.length;
  for (const row of [...sources.table.rows, ...sources.table.margins]) {
    assert.deepEqual(Object.keys(row).filter(key => typeof row[key] === 'number'), [], 'no numeric field beside the quote');
    assert.equal(cellsOf(row.quote, count).length, count, row.quote);
  }
  assert.equal(new Set(sources.table.rows.map(r => `${r.gravity}:${r.measure}`)).size, sources.table.rows.length, 'one row per gravity and measure');
  for (const [i, material] of sources.table.materials.entries()) {
    const names = sources.table.header_quote.replace(/®/g, '');
    assert.ok(names.includes(material.label), `${material.label} is named in the quoted table header`);
    if (i) assert.ok(names.indexOf(sources.table.materials[i - 1].label) < names.indexOf(material.label), 'columns in the printed order');
  }
  assert.equal(cellsOf('Lunar ULOI* 15.6 21.0', 3), null);
  assert.equal(cellsOf('Lunar ULOI* 15.6 n/a 21.0', 3), null);
});

test('every displayed number is recomputed from the quotes', () => {
  assert.ok(model.ok);
  const count = sources.table.materials.length, quoteOf = (g, m) => sources.table.rows.find(r => r.gravity === g && r.measure === m).quote;
  const pressure = [...sources.table.pressure_quote.matchAll(/([\d.]+) psia/g)].map(m => Number(m[1]));
  assert.equal(pressure.length, count);
  let values = 0;
  for (const [column, item] of model.items.entries()) {
    assert.equal(item.label, sources.table.materials[column].label);
    assert.equal(item.pressure_psia, pressure[column]);
    assert.deepEqual(item.levels.map(l => l.gravity), PARTIALG.levels.map(l => l.id), 'Earth, Martian, lunar, microgravity');
    const one = m => Number(quoteOf('earth', m).split(/\s+/).at(column - count));
    for (const level of item.levels) {
      for (const measure of ['moc', 'uloi']) {
        const printed = quoteOf(level.gravity, measure).split(/\s+/).at(column - count);
        assert.equal(level[measure].text, printed, 'shown exactly as printed');
        assert.equal(level[measure].value, Number(printed));
        assert.equal(level[measure].quote, quoteOf(level.gravity, measure));
        values++;
      }
      assert.ok(level.moc.value <= level.uloi.value, 'the flame went out at or below the oxygen level where it lasted');
      assert.ok(level.bar.from >= 0 && level.bar.to <= 1 && level.bar.from <= level.bar.to);
      assert.ok(Math.abs(level.bar.from - (level.moc.value - model.axis.min) / (model.axis.max - model.axis.min)) < 1e-12);
      if (level.gravity === 'earth') { assert.equal(level.margin, null); continue; }
      const expected = Math.round(((level.uloi.value + level.moc.value) / 2 - (one('uloi') + one('moc')) / 2) * 100) / 100;
      const stated = Number(sources.table.margins.find(m => m.gravity === level.gravity).quote.split(/\s+/).at(column - count));
      assert.equal(level.margin.computed, expected);
      assert.equal(level.margin.stated, stated);
      assert.ok(level.margin.agrees, `${item.label} ${level.gravity}: equation (1) reproduces the report's own ∆O2 % (${stated})`);
      assert.equal(marginText(level.margin), `${expected > 0 ? '+' : '−'}${Math.abs(expected)}`);
    }
  }
  assert.equal(values, sources.table.rows.length * count);
  assert.equal(model.values, values);
  const all = model.items.flatMap(i => i.levels.flatMap(l => [l.moc.value, l.uloi.value]));
  assert.ok(model.axis.min <= Math.min(...all) && model.axis.max >= Math.max(...all) && model.axis.min % PARTIALG.axis_step === 0 && model.axis.max % PARTIALG.axis_step === 0);
});

test('the lead and scope sentences are built from the counts, the quotes and the existing PSI rows', () => {
  const partial = tests.filter(r => r.n?.gclass === 'partial').length;
  assert.equal(model.counts.collection_rows, tests.length);
  assert.equal(model.counts.partial_rows, partial);
  assert.deepEqual([model.counts.materials, model.counts.lunar, model.counts.martian], [3, 3, 3].map(() => sources.table.materials.length));
  assert.equal(model.lead, `One NASA conference paper tabulates limiting oxygen for ${model.items.length} materials at ${PARTIALG.levels.length} gravity levels: ${model.values} values, shown as printed.`);
  const seconds = sources.notes.find(n => n.id === 'drop-time').quote.match(/([\d.]+) sec-duration/)[1], flow = sources.notes.find(n => n.id === 'microgravity-flow').quote.match(/flow of (\d+) cm\/s/)[1];
  assert.equal(model.scope, `Scope: ${model.items.length} materials (${sources.table.materials.map(m => m.label).join(', ')}); upward (concurrent-flow) flame tests; the Martian-gravity values come from a centrifuge inside a ${seconds} s drop tower, and the report says the table includes earlier lunar and 0g data from its reference 8, 0g with a ${flow} cm/s forced flow. These are report values held outside the PSI row collection (${tests.length.toLocaleString('en-US')} rows, ${partial} at partial gravity) and are not matched against the cabin by VESTA’s coverage rule. They are what this NASA source states, put side by side: not a rating of any material or atmosphere.`);
  assert.ok(sources.notes.some(n => /ref\. 8/.test(n.quote)), 'the reference-8 statement is quoted');
  assert.equal(model.document.record_url, `https://ntrs.nasa.gov/citations/${sources.documents[0].ntrs_id}`);
  assert.ok(landingSentence(model).includes(model.document.title));
});

test('a disagreement, a missing quote or a non-NASA URL is shown or refused, never smoothed over', () => {
  const edited = clone(); edited.table.margins[1].quote = 'Lunar ∆O2 % -5.0 -2.8 -2.35';
  const m = partialGravity(edited).items[0].levels.find(l => l.gravity === 'moon').margin;
  assert.equal(m.agrees, false);
  assert.equal(marginText(m), '−5.75 recomputed; −5 stated');
  const noMargin = clone(); noMargin.table.margins = [];
  assert.match(marginText(partialGravity(noMargin).items[0].levels[1].margin), /not stated/);
  const noQuote = clone(); noQuote.table.rows[4].quote = ' ';
  assert.equal(partialGravity(noQuote).ok, false);
  const elsewhere = clone(); elsewhere.notes[0].url = 'https://example.com/paper.pdf';
  assert.equal(partialGravity(elsewhere).ok, false);
  assert.equal(landingSentence(partialGravity(noQuote)), null);
  assert.equal(partialGravity(null).ok, false);
  assert.equal(partialGravity(sources).counts.collection_rows, null, 'without rows the scope names no count');
  assert.ok(!partialGravity(sources).scope.includes('rows,'));
});

test('VESTA’s own wording makes no safety, medical or operational claim; such words appear only inside NASA quotes', () => {
  const own = [model.heading, model.lead, model.scope, model.margin_note, ...Object.values(model.columns), ...PARTIALG.levels.map(l => l.label), ...model.also_read.map(d => d.why_not_shown), landingSentence(model).replace(model.document.title, '')].join(' ');
  assert.doesNotMatch(own, /\bsafe|\bproven\b|validated|certified|recommend|should|must\b/i);
  const code = read('web/js/core/partialg.js') + read('web/js/world/partialg-panel.js');
  assert.doesNotMatch(code, /\bsafe|\bproven\b|validated|certified|recommend/i);
  assert.doesNotMatch(read('web/js/world/partialg-panel.js').replace(/toFixed\(1\)|\* 100|, 1\)|colSpan = 5|v=1|100\)/g, ''), /[^\w.]\d+\.\d+|[^\w.$#-]\d{2,}/, 'the view types in no measured value');
});

function fakeDocument() {
  const make = tag => {
    const el = { tagName: tag.toUpperCase(), children: [], dataset: {}, style: {}, attributes: {}, listeners: {}, className: '', open: false, _text: '',
      append(...kids) { for (const k of kids) el.children.push(k); },
      replaceChildren(...kids) { el.children = [...kids]; el._text = ''; },
      setAttribute(name, value) { el.attributes[name] = String(value); },
      addEventListener(type, fn) { (el.listeners[type] ||= []).push(fn); },
      removeEventListener(type, fn) { el.listeners[type] = (el.listeners[type] ?? []).filter(f => f !== fn); },
      remove() { el.removed = true; },
      get textContent() { return el._text + el.children.map(c => c.textContent ?? '').join(''); },
      set textContent(value) { el._text = String(value); el.children = []; } };
    return el;
  };
  return { createElement: make, createTextNode: value => ({ textContent: String(value) }), querySelector: () => null, head: make('head') };
}
const walk = (el, out = []) => { out.push(el); for (const c of el.children ?? []) walk(c, out); return out; };

test('panel: a collapsed details that prints only model text, links only NASA and loads the file on first open', async () => {
  const doc = globalThis.document = fakeDocument();
  try {
    const panel = createPartialGravityPanel({ db: { tests }, sources });
    assert.equal(panel.element.tagName, 'DETAILS');
    assert.equal(panel.element.open, false);
    assert.match(doc.head.children[0].href, /css\/partialg\.css/);
    assert.deepEqual(panel.model, model);
    const nodes = walk(panel.element), all = panel.element.textContent;
    assert.equal(nodes.find(n => n.tagName === 'SUMMARY').textContent, 'What NASA measured at lunar and Martian gravity');
    for (const line of [model.lead, model.scope, model.margin_note, model.document.title, model.table.title]) assert.ok(all.includes(line), line);
    for (const note of sources.notes) assert.ok(all.includes(`“${note.quote}” (${note.location})`));
    const links = nodes.filter(n => n.tagName === 'A');
    assert.ok(links.length >= 3);
    for (const a of links) assert.match(a.href, /^https:\/\/ntrs\.nasa\.gov\//);
    assert.ok(links.some(a => a.href === sources.documents[0].url) && links.some(a => a.href === sources.documents[0].record_url));
    const cells = nodes.filter(n => n.tagName === 'TD' && n.className === 'partialg-num').map(n => n.textContent);
    const expected = model.items.flatMap(i => i.levels.flatMap(l => [l.moc.text, l.uloi.text, marginText(l.margin)]));
    assert.deepEqual(cells, expected, 'every numeric cell is a model string');
    assert.equal(nodes.filter(n => n.className === 'partialg-bar').length, model.values / 2);
    assert.equal(nodes.filter(n => n.className === 'next-experiments-limits').length, 1, 'one scope line');

    let loads = 0;
    const lazy = createPartialGravityPanel({ db: { tests }, load: async () => { loads++; return sources; } });
    assert.equal(lazy.model, null);
    assert.equal(loads, 0, 'nothing is fetched while collapsed');
    lazy.element.open = true; lazy.element.listeners.toggle[0](); lazy.element.listeners.toggle[0]();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(loads, 1);
    assert.deepEqual(lazy.model, model);
    const failing = createPartialGravityPanel({ load: async () => { throw new Error('offline'); } });
    failing.element.open = true; failing.element.listeners.toggle[0]();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(failing.element.textContent, /could not be loaded/);
  } finally { delete globalThis.document; }
});

test('the wall mounts the panel with one import, one creation line and one append, just under the next-requests panel', () => {
  const wall = read('web/js/world/coverage.js');
  assert.equal((wall.match(/import \{ createPartialGravityPanel \} from '\.\/partialg-panel\.js';/g) ?? []).length, 1);
  assert.equal((wall.match(/createPartialGravityPanel\(/g) ?? []).length, 1);
  assert.ok(wall.includes('element.append(header, legend, nextRequests.element, partialGravityPanel.element, layout, scope);'));
});
