import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as index from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import * as text from '../../web/js/core/text.js';
import { destinations, cabinSummary, finding, nearestSource, reviewQuestion, build } from '../../web/js/world/welcome.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = index.buildIndex(raw), core = { index, status };
const source = fs.readFileSync(new URL('../../web/js/world/welcome.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../web/css/welcome.css', import.meta.url), 'utf8');

test('the lead sentence is the core tally for every cabin, with nothing added', () => {
  for (const preset of destinations(db)) {
    const q = index.presetPoint(db, preset.id), cells = status.cells(q, db), counts = status.tally(cells);
    const line = finding(cabinSummary(q, db, core));
    assert.equal(line.lead, `${counts.PROVEN} of ${cells.length} questions have nearby NASA evidence`);
    assert.equal(line.rest, `${counts.EXTRAPOLATED} other conditions · ${counts.NEVER_TESTED} no source in this collection`);
    assert.equal(counts.PROVEN + counts.EXTRAPOLATED + counts.NEVER_TESTED, cells.length);
    assert.doesNotMatch(line.lead + line.rest, /safe|proven|validated|certified|experiment|never/i);
  }
  assert.equal(finding(null), null);
  assert.equal(finding({ counts: { PROVEN: 0 } }), null);
});

test('the source row shown is the first row of the core ordering, with its table values', () => {
  let shown = 0, absent = 0, missingPressure = 0;
  for (const preset of destinations(db)) for (const material of Object.keys(db.materials)) for (const concern of status.CONCERNS) {
    const q = index.presetPoint(db, preset.id, concern, material);
    const expected = status.nearestRow(material, concern, q, db), got = nearestSource(q, db, core);
    if (!expected) { assert.equal(got, null); absent++; continue; }
    const row = db.testById[got.id];
    assert.equal(got.id, expected.row.id);
    assert.equal(row.fuel != null && db.rowsByMaterial[material].includes(row), true);
    assert.equal(got.nearby, status.cell(material, concern, q, db).status === 'PROVEN');
    assert.equal(got.name, `${row.investigation} · row ${row.id}`);
    const [o2, p, g] = got.conditions.split(' · ');
    assert.equal(o2, row.o2_percent == null ? 'oxygen not in the table' : text.oxygen(row.o2_percent).replace(' % O2', '% O₂'));
    assert.equal(p, row.pressure_kpa == null ? 'pressure not in the table' : text.pressure(row.pressure_kpa));
    assert.equal(g, row.gravity ?? 'gravity not in the table');
    if (row.pressure_kpa == null) missingPressure++;
    shown++;
  }
  assert.ok(shown > 0 && absent > 0 && missingPressure > 0, 'the collection exercises a row, a missing row and a missing pressure');
});

test('a cabin without a chosen material shows the row for the suggested question, and bad input shows none', () => {
  const q = index.presetPoint(db, 'lunar-base'), choice = reviewQuestion(q, db);
  assert.equal(nearestSource(q, db, core).id, status.nearestRow(choice.material, choice.concern, q, db).row.id);
  for (const bad of [null, {}, { ...q, o2: null }]) assert.equal(nearestSource(bad, db, core), null);
  assert.equal(nearestSource(q, db, {}), null);
  assert.equal(nearestSource(q, null, core), null);
});

// A minimal element stand-in: enough to run build() and read what the panel says, in order.
function fakeDocument() {
  const make = tag => {
    const e = { tag, children: [], dataset: {}, attributes: {}, hidden: false, className: '', listeners: {}, _text: '',
      append(...xs) { e.children.push(...xs); }, replaceChildren(...xs) { e.children = xs; e._text = ''; },
      setAttribute(k, v) { e.attributes[k] = v; }, getAttribute: k => e.attributes[k] ?? e[k],
      addEventListener(type, fn) { e.listeners[type] = fn; }, remove() {},
      querySelectorAll: () => all(e).filter(x => x.dataset?.welcomeStation) };
    Object.defineProperty(e, 'textContent', { get: () => e._text + e.children.map(c => typeof c === 'string' ? c : c.textContent).join(''), set(v) { e._text = v; e.children = []; } });
    return e;
  };
  const all = e => e.children.filter(c => typeof c !== 'string').flatMap(c => [c, ...all(c)]);
  return { createElement: make, querySelector: () => null, head: make('head'), all };
}

test('the built panel leads with the finding, cites one real row and keeps Review as the only button', () => {
  const doc = globalThis.document = fakeDocument();
  try {
    const cites = [];
    let q = index.presetPoint(db, 'lunar-base');
    const world = { db, core, get q() { return q; }, setQ() {}, go() {}, navigate() {},
      cite(label, id) { const b = doc.createElement('button'); b.className = 'world-cite'; b.textContent = label; cites.push({ label, id }); return b; } };
    const panel = build(world), nodes = doc.all(panel.element);
    const visible = nodes.filter(n => !n.hidden && !['option', 'select', 'summary', 'details', 'a', 'span', 'label', 'div', 'section'].includes(n.tag) && n.className !== 'world-cite' && n.textContent);
    for (const preset of destinations(db)) {
      q = index.presetPoint(db, preset.id, 'detection', 'kapton'); cites.length = 0; panel.update(q);
      const line = finding(cabinSummary(q, db, core)), row = nearestSource(q, db, core);
      const title = nodes.find(n => n.tag === 'h2');
      assert.equal(title.textContent, line.lead);
      assert.ok(panel.element.textContent.indexOf(line.lead) < panel.element.textContent.indexOf('Mission cabin'), 'the finding comes before the cabin control');
      assert.ok(panel.element.textContent.includes(line.rest));
      assert.ok(panel.element.textContent.includes(row.conditions));
      assert.deepEqual(cites.filter(c => db.testById[c.id]).map(c => c.id), [row.id], 'exactly one source row is cited');
      assert.ok(cites.some(c => c.id === 'design-coverage' && c.label === line.rest));
    }
    q = index.presetPoint(db, 'lunar-base', 'detection', 'nomex'); cites.length = 0; panel.update(q);
    if (!status.nearestRow('nomex', 'detection', q, db)) {
      assert.ok(panel.element.textContent.includes('No source row for this question in this collection.'));
      assert.equal(cites.filter(c => db.testById[c.id]).length, 0);
    }
    const buttons = nodes.filter(n => n.tag === 'button' && n.className !== 'world-cite');
    assert.deepEqual(buttons.map(b => b.textContent), ['Review this question']);
    assert.equal(buttons[0].disabled, false);
    assert.ok(visible.length > 0);
    panel.update({});
    assert.match(nodes.find(n => n.tag === 'h2').textContent, /unavailable/);
    assert.equal(nodes.find(n => n.className === 'vesta-welcome-coverage').hidden, true, 'a missing tally never renders as a zero');
    panel.dispose();
  } finally { delete globalThis.document; }
});

test('the panel stays short: no collapsed coverage, no filler line, and copy within the column', () => {
  assert.doesNotMatch(source, /Whole-cabin coverage|Read the source\. Compare/);
  assert.doesNotMatch(source, /\bsafe to\b|proven safe|validated|certified/i);
  assert.match(source, /Coverage in this collection, not a safety rating\./);
  assert.doesNotMatch(css, /url\(|@import|@font-face/);
  for (const preset of destinations(db)) {
    const line = finding(cabinSummary(index.presetPoint(db, preset.id), db, core));
    assert.ok(line.lead.length <= 48 && line.rest.length <= 56, 'the finding fits two short lines in a 430 px column');
  }
});
