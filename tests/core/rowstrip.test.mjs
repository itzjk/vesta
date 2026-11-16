import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as index from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { match } from '../../web/js/core/match.js';
import { destinations, questionRows, reviewQuestion, nearestSource, build } from '../../web/js/world/welcome.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = index.buildIndex(raw), core = { index, status };
const css = fs.readFileSync(new URL('../../web/css/welcome.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../../web/js/world/welcome.js', import.meta.url), 'utf8');
const worldSource = fs.readFileSync(new URL('../../web/js/world/world.js', import.meta.url), 'utf8');
// Independent of the strip: the rows of a question straight from the indexed table, and "nearby" straight from the matcher.
const tableRows = (material, concern) => db.tests.filter(r => (db.rowsByMaterial[material] || []).includes(r) && r.n.pillars.includes(concern)).map(r => r.id);
const nearbyIds = (material, concern, q) => tableRows(material, concern).filter(id => match(db.testById[id].n, q, db.base).fail.length === 0);

test('the strip holds every source-table row of the question, once, and lights exactly the rows the matcher accepts', () => {
  let strips = 0, empty = 0, lit = 0;
  for (const preset of destinations(db)) for (const material of Object.keys(db.materials)) for (const concern of status.CONCERNS) {
    const q = index.presetPoint(db, preset.id, concern, material), got = questionRows(q, db, core);
    const ids = tableRows(material, concern), cell = status.cell(material, concern, q, db);
    if (!ids.length) { assert.equal(got, null, 'a question without rows draws no strip'); empty++; continue; }
    assert.deepEqual(got.marks.map(m => m.id).sort(), [...ids].sort());
    assert.equal(new Set(got.marks.map(m => m.id)).size, got.total);
    assert.equal(got.total, cell.rows);
    const near = nearbyIds(material, concern, q);
    assert.deepEqual(got.marks.filter(m => m.nearby).map(m => m.id).sort(), [...near].sort());
    assert.deepEqual([...near].sort(), [...(cell.hit_ids || [])].sort());
    assert.equal(got.nearby, near.length);
    assert.equal(got.nearby > 0, cell.status === 'PROVEN', 'lit marks exist exactly when the coverage answer is nearby evidence');
    assert.equal(got.caption, `${ids.length} NASA table ${ids.length === 1 ? 'row' : 'rows'} for this question: ${near.length} nearby for this cabin`);
    assert.ok(got.caption.length <= 64, 'the caption stays on one line');
    assert.doesNotMatch(got.caption, /safe|proven|validated|certified|experiment|never/i);
    strips++; lit += near.length;
  }
  assert.ok(strips > 0 && empty > 0 && lit > 0, 'the collection exercises a strip, a missing strip and lit marks');
});

test('the default question follows the table: the suggested PMMA prevention rows, lit only where a cabin has nearby rows', () => {
  const byCabin = {};
  for (const preset of destinations(db)) {
    const q = index.presetPoint(db, preset.id), choice = reviewQuestion(q, db), got = questionRows(q, db, core);
    assert.deepEqual(choice, { material: 'pmma', concern: 'prevention' });
    assert.equal(got.total, tableRows('pmma', 'prevention').length);
    assert.equal(got.nearby, nearbyIds('pmma', 'prevention', q).length);
    assert.equal(nearestSource(q, db, core).nearby, got.nearby > 0, 'the strip and the nearest-row label agree');
    byCabin[preset.id] = got.nearby;
  }
  assert.ok(byCabin.station > 0, 'the station cabin lights some marks');
  assert.equal(byCabin['lunar-base'], 0);
  assert.equal(questionRows(index.presetPoint(db, 'station'), db, core).marks.map(m => m.id).join(), questionRows(index.presetPoint(db, 'lunar-base'), db, core).marks.map(m => m.id).join(), 'marks keep their order across cabins');
});

test('bad input or a missing collection draws no strip rather than a row of dim marks', () => {
  const q = index.presetPoint(db, 'station');
  for (const bad of [null, {}, { ...q, o2: null }, { ...q, p: NaN }]) assert.equal(questionRows(bad, db, core), null);
  assert.equal(questionRows(q, null, core), null);
  assert.equal(questionRows(q, db, {}), null);
  assert.equal(questionRows(q, { ...db, materials: {} }, core), null);
});

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

test('the built strip: one labelled mark per row, one summary, no tab stops, and the cabin select relights the same marks', () => {
  const doc = globalThis.document = fakeDocument();
  try {
    let q = index.presetPoint(db, 'lunar-base');
    const world = { db, core, get q() { return q; }, setQ(patch) { if (patch.preset) q = index.presetPoint(db, patch.preset, q.concern, q.material); }, go() {}, navigate() {},
      cite(label) { const b = doc.createElement('button'); b.className = 'world-cite'; b.textContent = label; return b; } };
    const panel = build(world), find = name => doc.all(panel.element).find(n => n.className === name);
    const strip = find('vesta-welcome-rows'), marksBox = find('vesta-welcome-rows-marks'), caption = find('vesta-welcome-rows-caption');
    const select = doc.all(panel.element).find(n => n.tag === 'select' && n.attributes['aria-label'] === 'Mission cabin');
    const check = point => {
      const data = questionRows(point, db, core), marks = marksBox.children;
      assert.equal(strip.hidden, false);
      assert.equal(marks.length, data.total);
      assert.deepEqual(marks.map(m => m.dataset.row), data.marks.map(m => m.id));
      assert.equal(marks.filter(m => m.dataset.state === 'near').length, data.nearby);
      for (const [i, m] of marks.entries()) {
        assert.ok(m.title.includes(data.marks[i].id) && m.attributes['aria-label'] === m.title, 'each mark names its row id');
        assert.equal(m.title.endsWith(data.marks[i].nearby ? 'nearby conditions' : 'other conditions'), true);
        assert.equal(m.tag, 'span'); assert.equal('tabindex' in m.attributes || 'tabIndex' in m, false);
      }
      assert.equal(caption.textContent, data.caption);
      assert.equal(marksBox.attributes.role, 'img');
      assert.equal(marksBox.attributes['aria-label'], `${data.caption}.`);
      assert.equal(caption.attributes['aria-hidden'], 'true', 'the summary is read once, from the marks group');
      return marks;
    };
    const before = check(q).slice();
    const texts = panel.element.textContent;
    assert.ok(texts.indexOf('questions have nearby NASA evidence') < texts.indexOf(caption.textContent), 'the strip sits under the finding');
    for (const preset of destinations(db)) {
      select.value = preset.id; select.listeners.change();
      const after = check(index.presetPoint(db, preset.id));
      assert.ok(after.every((m, i) => m === before[i]), 'a cabin change keeps the same elements so the state can transition');
    }
    // A different question rebuilds the marks; a question without rows hides the strip.
    for (const material of Object.keys(db.materials)) for (const concern of status.CONCERNS) {
      const point = index.presetPoint(db, 'station', concern, material); panel.update(point);
      if (questionRows(point, db, core)) check(point);
      else { assert.equal(strip.hidden, true); assert.equal(marksBox.children.length, 0); }
    }
    panel.update({});
    assert.equal(strip.hidden, true, 'an invalid cabin shows no marks');
    const legend = find('vesta-welcome-rows-legend');
    assert.equal(legend.textContent, 'nearby conditionsother conditions');
    assert.deepEqual(legend.children.map(k => k.children[0].dataset.state), ['near', 'other']);
    assert.deepEqual(doc.all(panel.element).filter(n => n.tag === 'button' && n.className !== 'world-cite').map(b => b.textContent), ['Review this question']);
    panel.dispose();
  } finally { delete globalThis.document; }
});

test('the strip is plain CSS with a short transition that reduced motion removes, and fits the height budget', () => {
  const rule = name => css.match(new RegExp(`\\.vesta-welcome \\.${name}\\{([^}]*)\\}`))?.[1] || '';
  const px = (text, prop) => Number(text.match(new RegExp(`(?:^|;)${prop}:(\\d+)px`))?.[1]);
  const mark = rule('vesta-welcome-rows-mark'), box = rule('vesta-welcome-rows-marks');
  assert.match(mark, /transition:[^;]*\.\d+s/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.vesta-welcome \.vesta-welcome-rows-mark\{transition:none\}\}/);
  assert.doesNotMatch(css, /url\(|@import|@font-face/);
  assert.doesNotMatch(source, /canvas|<svg|new Image|fetch\(/i);
  // Lit and dim differ by fill as well as colour.
  assert.match(mark, /background:transparent/);
  assert.match(css, /rows-mark\[data-state=near\]\{background:var\(--amber\)/);
  // Height in the 430 px Transit column (16 px side padding): caption line + wrapped mark rows + legend line.
  const gap = px(box, 'gap'), width = px(mark, 'width'), height = px(mark, 'height');
  const perRow = Math.floor((430 - 32 + gap) / (width + gap));
  const most = Math.max(...Object.keys(db.materials).flatMap(m => status.CONCERNS.map(c => tableRows(m, c).length)));
  const rows = Math.ceil(most / perRow), margins = 2 * Number(box.match(/margin:(\d+)px 0/)[1]);
  const lines = Number(rule('vesta-welcome-rows-caption').match(/\/(\d+)px/)[1]) + Number(rule('vesta-welcome-rows-legend').match(/\/(\d+)px/)[1]);
  assert.ok(lines + margins + rows * height + (rows - 1) * gap <= 56, 'the largest question in the collection stays within 56 px');
  // The stylesheet token is the same wherever the sheet or the module is requested, so a returning visitor gets both.
  const token = source.match(/welcome\.css\?v=([\w-]+)/)[1];
  assert.deepEqual([...worldSource.matchAll(/welcome\.(?:css|js)\?v=([\w-]+)/g)].map(m => m[1]), [token, token]);
});
