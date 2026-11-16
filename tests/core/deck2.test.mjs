// The public seven-slide deck: every number it shows is recomputed here from web/data with the core modules,
// and the same text must exist as real HTML under each slide image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { nextExperiments } from '../../web/js/core/next-experiments.js';
import { describe, evaluate, OXYGEN_LIMIT } from '../../web/js/core/oxygen-limit.js';
import { sensitivity } from '../../web/js/core/tolerance-sensitivity.js';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const FILES = ['meta', 'investigations', 'tests', 'tables', 'findings', 'rules', 'sources', 'presets'];
const raw = Object.fromEntries(FILES.map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw);
const source = read('web/presentation/src/slides.html'), viewer = read('web/presentation/index.html'), css = read('web/presentation/viewer.css');
const plain = html => html.replace(/<\/?sub>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const sourceSlides = [...source.matchAll(/<section class="s" id="s(\d)">([\s\S]*?)<\/section>/g)].map(m => ({ n: +m[1], html: m[2], text: plain(m[2]) }));
const viewerSlides = [...viewer.matchAll(/<section class="slide[^>]*id="slide-(\d)"[^>]*>([\s\S]*?)<\/section>/g)].map(m => ({ n: +m[1], html: m[2] }));
const slideText = slide => plain(slide.html.match(/<p class="slide-text">([\s\S]*?)<\/p>/)?.[1] ?? '');
const fmt = n => n.toLocaleString('en-US');
const BANNED = /\b(safe|safety|proven|proves|validated|certified|certif\w*|guarantee\w*)\b/i;

test('exactly seven slides, each with the team name, the SI mark and a rendered 1280x720 image', () => {
  assert.deepEqual(sourceSlides.map(s => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(viewerSlides.map(s => s.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const slide of sourceSlides) {
    assert.match(slide.text, /TEAM ZERACK/, `slide ${slide.n}`);
    assert.match(slide.text, /SI-assisted visuals/, `slide ${slide.n}`);
    assert.ok(slide.text.includes(`${slide.n} / 7`));
    assert.equal((slide.html.match(/<h1/g) ?? []).length, slide.n === 1 ? 0 : 1, 'one headline claim per slide');
    const png = fs.readFileSync(new URL(`../../web/presentation/vesta-slide-${slide.n}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1280); assert.equal(png.readUInt32BE(20), 720);
  }
});

test('no slide text is declared under 24 px and nothing is fetched from another host', () => {
  const sizes = [...source.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => +m[1]);
  assert.ok(sizes.length > 20 && Math.min(...sizes) >= 24, `smallest ${Math.min(...sizes)}`);
  // The only relative size is the subscript of O2.
  assert.deepEqual([...source.matchAll(/font-size:\s*([\d.]+)em/g)].map(m => m[0]), ['font-size:.62em']);
  assert.doesNotMatch(source, /https?:\/\/|@import|@font-face|url\(/);
  const images = [...source.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(images.length >= 3);
  for (const src of images) {
    assert.match(src, /^\.\.\/(vesta-mascot\.png|capture-[a-z-]+\.jpg)$/);
    assert.ok(fs.existsSync(new URL(`../../web/presentation/${src.slice(3)}`, import.meta.url)), src);
  }
});

test('slide 4 states the lunar zero as a data gap that tolerance cannot move', () => {
  const withGravity = db.tests.filter(row => row.n.gclass != null);
  assert.ok(withGravity.length > 0 && withGravity.every(row => row.n.gclass === 'micro'));
  const lunar = sensitivity(db).presets.find(p => p.id === 'lunar-base');
  const at = scale => lunar.counts[sensitivity(db).tolerances.findIndex(t => t.scale === scale)];
  assert.deepEqual([at(1), at(2), at(4)], [0, 0, 0]);
  const line = `All ${fmt(withGravity.length)} rows with a gravity value are microgravity: the lunar 0 is a data gap, and it stays 0 at 1×, 2× and 4× tolerance.`;
  assert.ok(sourceSlides[3].text.includes(line), line);
  assert.ok(slideText(viewerSlides[3]).includes(line));
});

test('slide 6 shows the action with the counts of next-experiments.js for the lunar cabin', () => {
  const q = presetPoint(db, 'lunar-base'), model = nextExperiments(q, db);
  const { total, nearby } = model, moved = model.campaign.questions, first = model.firstSource.questions;
  assert.equal(nearby + moved + first, total); assert.equal(model.campaign.after, nearby + moved);
  const text = sourceSlides[5].text, under = slideText(viewerSlides[5]);
  assert.ok(text.includes(`one test campaign moves ${moved} of ${total}`), text);
  assert.ok(text.includes(`${q.o2}% O2 · ${q.p} kPa`) && text.includes('1/6 g'));
  assert.ok(text.includes(`for the ${Object.keys(db.materials).length} materials`));
  // Drawn bars: today = dashed zero + rows elsewhere + first source; after = nearby + first source, on one 700 px scale.
  const bars = sourceSlides[5].html.split('<div class="legend">')[0].split('<div class="row">').slice(1).map(row =>
    [...row.matchAll(/class="(near|other|none|zero)"(?: style="width:([\d.]+)px")?>(\d+)</g)].map(p => ({ kind: p[1], width: p[2] ? +p[2] : null, n: +p[3] })));
  assert.deepEqual(bars.map(bar => bar.map(p => [p.kind, p.n])), [[['zero', nearby], ['other', moved], ['none', first]], [['near', nearby + moved], ['none', first]]]);
  for (const bar of bars) for (const part of bar.filter(p => p.width != null)) assert.ok(Math.abs(part.width - 700 * part.n / total) < 0.06, `${part.kind} ${part.width}`);
  assert.ok(under.includes(`Today: ${nearby} questions with a nearby row, ${moved} with rows at other conditions, ${first} that need a first source.`), under);
  assert.ok(under.includes(`After: ${nearby + moved} with a nearby row, ${first} that need a first source.`));
  for (const body of [text, under]) {
    assert.match(body, /not a test protocol, not a predicted result/);
    assert.match(body, /Simulation: no hardware, sensors or autonomy/);
  }
});

test('slide 7 draws the four FLEX oxygen bands and the held-out check from oxygen-limit.js', () => {
  const tests = raw.tests.tests, pooled = describe(tests).lines.find(line => line.diluent === 'all' && line.fuel === 'All fuels'), report = evaluate(tests);
  assert.equal(pooled.cells.length, 4); assert.deepEqual(pooled.cells.map(c => c.band), OXYGEN_LIMIT.bands.map(b => b.id));
  const drawn = [...sourceSlides[6].html.matchAll(/<span class="v">(\d+)\/(\d+)<\/span><div class="col[^"]*" style="height:([\d.]+)px">/g)].map(m => ({ events: +m[1], tests: +m[2], height: +m[3] }));
  assert.deepEqual(drawn.map(d => [d.events, d.tests]), pooled.cells.map(c => [c.extinction, c.tests]));
  for (const [i, cell] of pooled.cells.entries()) {
    if (cell.extinction) assert.ok(Math.abs(drawn[i].height - 190 * cell.share) < 0.06, `bar ${i}`);
    else assert.ok(drawn[i].height <= 6, 'an empty band is a dashed line, not a bar');
  }
  const text = sourceSlides[6].text, under = slideText(viewerSlides[6]);
  assert.ok(text.includes(`${pooled.tests} tests from one NASA table`));
  const model = `${report.model.correct}/${report.rows}`, base = `${report.baseline.correct}/${report.rows}`;
  assert.ok(report.model.correct > report.baseline.correct);
  const widths = [...sourceSlides[6].html.matchAll(/<b>(\d+)\/(\d+)<\/b><span>[^<]+<\/span><i style="width:([\d.]+)px">/g)].map(m => [`${m[1]}/${m[2]}`, +m[3]]);
  assert.deepEqual(widths.map(w => w[0]), [model, base]);
  assert.ok(Math.abs(widths[0][1] - 420 * report.model.accuracy) < 0.06 && Math.abs(widths[1][1] - 420 * report.baseline.accuracy) < 0.06);
  for (const body of [text, under]) {
    assert.ok(body.includes(`${report.rows} dated tests, each test day held out in turn`));
    assert.match(body, /Liquid droplets in microgravity, not cabin materials\./);
    assert.match(body, /not a cabin prediction/);
    for (const cell of pooled.cells) assert.ok(body.includes(`${cell.extinction}/${cell.tests}`));
    assert.ok(body.includes(model) && body.includes(base));
  }
});

test('the k-NN lookup is no longer pitched and the wording stays inside the product rules', () => {
  for (const body of [source, viewer]) assert.doesNotMatch(body, /k-NN|nearest-neighbou?r|\b134\/212\b/i);
  for (const slide of sourceSlides) assert.doesNotMatch(slide.text, BANNED, `slide ${slide.n}`);
  for (const slide of viewerSlides) assert.doesNotMatch(plain(slide.html), BANNED, `viewer slide ${slide.n}`);
  assert.doesNotMatch(plain(viewer), /live (language )?model\b(?!.*)/);
});

test('the viewer repeats each slide as real text directly under its image', () => {
  for (const [i, slide] of viewerSlides.entries()) {
    assert.match(slide.html, /^\s*<img src="vesta-slide-\d\.png"[^>]*>\s*<p class="slide-text">[\s\S]*?<\/p>\s*<details>/, `slide ${i + 1}`);
    const under = slideText(slide), words = sourceSlides[i].text;
    assert.ok(under.length > 120, `slide ${i + 1} text is not a stub`);
    // Every number drawn on the slide is present in the HTML text (the slide counter aside).
    const numbers = t => new Set(t.replace(/\d \/ 7/, '').match(/\d[\d,.]*\d|\d/g) ?? []);
    const missing = [...numbers(words)].filter(n => !numbers(under).has(n));
    assert.deepEqual(missing, [], `slide ${i + 1}`);
    assert.match(under, /Team Zerack/); assert.match(under, /SI-assisted visuals/);
    assert.match(slide.html, new RegExp(`alt="Slide ${i + 1}: `));
  }
  assert.match(css, /\.slide-text\{[^}]*max-width/);
  assert.match(css, /@media print\{[\s\S]*\.slide-text\{display:none!important\}|details,\.slide-text\{display:none!important\}/);
});
