import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, designPoint, presetPoint, CONCERNS } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import * as text from '../../web/js/core/text.js';
import { TOL } from '../../web/js/core/match.js';
import { nextExperiments, separation, separationText, itemText, campaignConditions, LIMITS, TOP } from '../../web/js/core/next-experiments.js';
import { createNextExperimentsPanel } from '../../web/js/world/next-experiments-panel.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const custom = designPoint({ preset: 'custom', o2: 22.2, p: 101.3, g: '0g' }, db);
const queries = [...db.presets.map(p => presetPoint(db, p.id)), custom];
const rowsFor = (material, concern) => (db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(concern));

/** The claim, executed: add one synthetic row at the cabin's own conditions per campaign question and re-run the real matcher. */
function withCampaignRows(model, q) {
  const rowsByMaterial = { ...db.rowsByMaterial };
  for (const item of model.items) rowsByMaterial[item.material] = [...rowsByMaterial[item.material],
    { id: `synthetic:${item.material}:${item.concern}`, n: { ...model.conditions, pillars: [item.concern] }, outcomes: {} }];
  return status.tally(status.cells(q, { ...db, rowsByMaterial }));
}

test('every question is nearby, in the campaign count or waiting for a first source row, for every cabin', () => {
  const before = JSON.stringify({ db, queries });
  for (const q of queries) {
    const model = nextExperiments(q, db), cells = status.cells(q, db), counts = status.tally(cells);
    assert.equal(model.total, cells.length);
    assert.equal(model.total, Object.keys(db.materials).length * CONCERNS.length);
    assert.equal(model.nearby, counts.PROVEN);
    assert.equal(model.nearby + model.campaign.questions + model.firstSource.questions, model.total);
    const gaps = cells.filter(c => c.status !== 'PROVEN');
    assert.equal(model.campaign.questions, gaps.filter(c => rowsFor(c.material, c.concern).length > 0).length);
    assert.equal(model.firstSource.no_source, counts.NEVER_TESTED);
    assert.equal(model.firstSource.finding_without_rows, gaps.filter(c => c.reasons.includes('finding_without_rows')).length);
    assert.equal(model.firstSource.questions, model.firstSource.no_source + model.firstSource.finding_without_rows);
    assert.ok(model.firstSource.items.every(g => g.nearest === null && rowsFor(g.material, g.concern).length === 0));
  }
  assert.equal(JSON.stringify({ db, queries }), before, 'the model mutates neither the data nor the query');
});

test('rows at the cabin conditions for the listed materials make exactly the counted questions nearby', () => {
  for (const q of queries) {
    const model = nextExperiments(q, db), after = withCampaignRows(model, q);
    assert.deepEqual(model.conditions, { gclass: q.gclass, o2: q.o2, p: q.p });
    assert.equal(after.PROVEN, model.campaign.after);
    assert.equal(after.PROVEN, model.nearby + model.campaign.questions);
    assert.equal(after.NEVER_TESTED, model.firstSource.no_source, 'questions with no source stay with no source');
    const materials = new Set(model.items.map(i => i.material));
    assert.deepEqual(new Set(model.campaign.materials.map(m => m.id)), materials);
    assert.equal(model.campaign.materials.reduce((sum, m) => sum + m.questions, 0), model.campaign.questions);
    assert.ok(model.campaign.materials.every(m => m.label === db.materials[m.id].label));
  }
});

test('each item names the nearest row from core and exactly the conditions that fail the matching rules', () => {
  for (const q of queries) {
    const model = nextExperiments(q, db);
    assert.equal(new Set(model.items.map(i => `${i.material}:${i.concern}`)).size, model.items.length);
    for (const item of model.items) {
      const nearest = status.nearestRow(item.material, item.concern, q, db);
      assert.equal(item.nearest.id, nearest.row.id);
      assert.ok(db.testById[item.nearest.id], 'the row id is a citable row of the collection');
      assert.deepEqual(item.nearest.delta, nearest.delta);
      assert.deepEqual(item.separates.map(p => p.code), nearest.fail, 'one entry per failed condition, none added');
      assert.ok(item.separates.length > 0);
      for (const part of item.separates) {
        if (part.axis === 'gravity') { assert.equal(part.row, nearest.row.n.gclass ?? null); assert.equal(part.cabin, q.gclass); assert.notEqual(part.row, part.cabin); }
        if (part.code === 'o2_outside') { assert.equal(part.delta, nearest.delta.o2); assert.ok(Math.abs(part.delta) > TOL.o2); }
        if (part.code === 'pressure_outside') { assert.equal(part.delta, nearest.delta.p); assert.ok(Math.abs(part.delta) > TOL.p);
          assert.equal(part.inferred, nearest.row.n.p == null); }
        if (part.code.endsWith('_not_reported')) assert.equal(part.delta ?? null, null);
      }
      assert.deepEqual(item.separates, separation(nearest, q));
    }
  }
});

test('ranking puts the materials that add the most questions first and shows at most five', () => {
  for (const q of queries) {
    const model = nextExperiments(q, db);
    assert.deepEqual(model.top, model.items.slice(0, TOP));
    assert.equal(TOP, 5);
    for (let i = 1; i < model.items.length; i++) {
      const a = model.items[i - 1], b = model.items[i];
      assert.ok(a.material_gain >= b.material_gain);
      if (a.material_gain === b.material_gain) assert.ok(a.separates.length <= b.separates.length);
    }
    for (const item of model.items) assert.equal(item.material_gain, model.items.filter(i => i.material === item.material).length);
    for (let i = 1; i < model.campaign.materials.length; i++) assert.ok(model.campaign.materials[i - 1].questions >= model.campaign.materials[i].questions);
    assert.equal(model.unstatedOnly, model.items.filter(i => i.separates.every(p => p.code.endsWith('_not_reported'))).length);
  }
});

test('sentences carry the computed counts and the cabin conditions, and stay inside the product wording rules', () => {
  for (const q of queries) {
    const model = nextExperiments(q, db);
    assert.ok(model.campaign.questions > 0, 'the shipped collection leaves a campaign gap for every preset');
    assert.ok(model.sentence.startsWith(`One test campaign at ${text.gravity(q.gclass)}`));
    assert.ok(model.sentence.includes(text.oxygen(q.o2)) && model.sentence.includes(text.pressure(q.p)));
    assert.ok(model.sentence.includes(`would give a nearby row to ${model.campaign.questions} of ${model.total} questions`));
    assert.ok(model.sentence.includes(`these ${model.campaign.materials.length} material`));
    assert.ok(model.after.includes(`${model.campaign.after} of ${model.total} instead of ${model.nearby} of ${model.total}`));
    assert.ok(model.firstSentence.startsWith(`${model.firstSource.questions} more question`));
    assert.ok(model.firstSentence.includes(`${model.firstSource.no_source} with no source in this collection`));
    assert.equal(model.recover === null, model.unstatedOnly === 0);
    if (model.recover) assert.ok(model.recover.startsWith(`For ${model.unstatedOnly} of these`));
    assert.ok(model.summary.startsWith('What a reviewer could request next'));
    const copy = [model.sentence, model.firstSentence, model.after, model.recover, model.summary, model.limits,
      ...model.items.map(i => itemText(i, db)), ...model.firstSource.items.map(i => itemText(i, db))].filter(Boolean).join(' ');
    assert.doesNotMatch(copy, /\b(safe to|proven|validated|certified|will (burn|ignite|pass|fail|show)|must (test|run)|NASA never|nobody has)\b/i);
    assert.doesNotMatch(copy, /undefined|NaN|null/);
  }
  assert.match(LIMITS, /not a test protocol and not a prediction/);
  assert.match(LIMITS, /not independent experiments/);
  assert.match(LIMITS, /absent from this collection/);
  assert.ok(LIMITS.includes(`within ${TOL.o2} point`) && LIMITS.includes(`within ${TOL.p} kPa`));
});

test('signed differences read as cabin minus row, and unstated conditions are named instead of guessed', () => {
  const lunar = presetPoint(db, 'lunar-base'), model = nextExperiments(lunar, db);
  for (const item of model.items) {
    const line = itemText(item, db);
    assert.ok(line.includes(item.nearest.id) && line.includes(db.materials[item.material].label) && line.includes(text.concern(item.concern)));
    for (const part of item.separates) {
      const words = separationText(part);
      assert.ok(line.includes(words));
      if (Number.isFinite(part.delta)) assert.ok(words.includes(`cabin ${text.signed(part.delta)} ${part.axis === 'o2' ? 'points' : 'kPa'}`));
      else if (part.axis !== 'gravity') assert.match(words, /not stated on the row$/);
      if (part.axis === 'gravity' && part.row) assert.equal(words, `gravity class: row ${text.gravity(part.row)}, cabin ${text.gravity(lunar.gclass)}`);
      if (part.inferred && Number.isFinite(part.delta)) assert.match(words, /assumed from the facility/);
    }
  }
  if (db.base.partial_rows === 0) assert.ok(model.items.every(i => i.separates[0].axis === 'gravity'), 'no partial-gravity row: gravity separates every item');
  for (const gap of model.firstSource.items) assert.match(itemText(gap, db), /no row at all for this question in this collection\.$/);
});

test('a cabin with an unset condition, or an empty collection, yields no manufactured campaign', () => {
  const open = nextExperiments({ ...custom, p: null }, db);
  assert.equal(campaignConditions({ ...custom, p: null }), null);
  assert.equal(open.campaign.questions, 0);
  assert.deepEqual(open.campaign.materials, []);
  assert.equal(open.after, null);
  assert.match(open.sentence, /^Set gravity, oxygen and pressure/);
  const empty = nextExperiments(custom, buildIndex({}));
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
  assert.match(empty.sentence, /nothing to request/);
});

function fakeDocument() {
  const make = tag => {
    const el = { tagName: tag.toUpperCase(), children: [], dataset: {}, listeners: {}, className: '', open: false, _text: '',
      append(...kids) { for (const k of kids) el.children.push(k); },
      replaceChildren(...kids) { el.children = [...kids]; el._text = ''; },
      addEventListener(type, fn) { (el.listeners[type] ||= []).push(fn); },
      removeEventListener(type, fn) { el.listeners[type] = (el.listeners[type] ?? []).filter(f => f !== fn); },
      contains(other) { return other === el || el.children.some(c => c?.contains?.(other)); },
      closest() { return null; }, remove() { el.removed = true; },
      get textContent() { return el._text + el.children.map(c => c.textContent ?? '').join(''); },
      set textContent(value) { el._text = String(value); el.children = []; } };
    return el;
  };
  const head = make('head');
  return { createElement: make, createTextNode: value => ({ textContent: String(value) }), querySelector: () => null, head };
}
const walk = (el, out = []) => { out.push(el); for (const c of el.children ?? []) walk(c, out); return out; };

test('panel: collapsed unless the cabin has zero nearby questions, cites each nearest row and opens its question', () => {
  const doc = globalThis.document = fakeDocument();
  try {
    const cites = [], opened = [];
    const panel = createNextExperimentsPanel({ db, onOpen: (m, c) => opened.push(`${m}:${c}`),
      cite(label, id) { const b = doc.createElement('button'); b.className = 'world-cite'; b.textContent = label; cites.push(id); return b; } });
    assert.equal(panel.element.tagName, 'DETAILS');
    assert.equal(doc.head.children.length, 1);
    assert.match(doc.head.children[0].href, /css\/next-experiments\.css/);
    for (const q of queries) {
      cites.length = 0;
      const model = panel.update(q), expected = nextExperiments(q, db);
      assert.deepEqual(model, expected);
      assert.equal(panel.element.open, expected.nearby === 0, `${expected.cabin}: open only with zero nearby questions`);
      const nodes = walk(panel.element), all = panel.element.textContent;
      assert.equal(nodes.find(n => n.tagName === 'SUMMARY').textContent, expected.summary);
      for (const line of [expected.sentence, expected.firstSentence, expected.after, expected.limits]) assert.ok(all.includes(line));
      assert.deepEqual(cites, expected.top.map(i => i.nearest.id));
      const buttons = nodes.filter(n => n.dataset?.nextMaterial);
      assert.deepEqual(buttons.map(b => `${b.dataset.nextMaterial}:${b.dataset.nextConcern}`), expected.top.map(i => `${i.material}:${i.concern}`));
      assert.equal(nodes.filter(n => n.className === 'next-experiments-limits').length, 1, 'one limits line');
      const body = nodes.find(n => n.className === 'next-experiments-body'), target = buttons[0];
      target.closest = () => target;
      body.listeners.click[0]({ target });
      assert.equal(opened.at(-1), `${expected.top[0].material}:${expected.top[0].concern}`);
    }
    const station = queries.find(q => nextExperiments(q, db).nearby > 0), bare = queries.find(q => nextExperiments(q, db).nearby === 0);
    if (station && bare) {
      panel.update(bare); assert.equal(panel.element.open, true);
      panel.update(station); assert.equal(panel.element.open, false);
      const summary = walk(panel.element).find(n => n.tagName === 'SUMMARY');
      summary.listeners.click[0](); panel.element.open = true;
      panel.update(station); assert.equal(panel.element.open, true, 'a visitor toggle is kept across cabin changes');
    }
    panel.dispose(); assert.equal(panel.element.removed, true);
  } finally { delete globalThis.document; }
});
