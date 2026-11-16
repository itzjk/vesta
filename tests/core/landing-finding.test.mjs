import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, designPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { pressureAudit } from '../../web/js/core/assumption-audit.js';
import { TOL } from '../../web/js/core/match.js';
import { sensitivity } from '../../web/js/core/tolerance-sensitivity.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations', 'tables', 'rules', 'sources', 'meta'].filter(name => fs.existsSync(new URL(`../../web/data/${name}.json`, import.meta.url))).map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw), html = read('web/index.html'), readme = read('README.md');
const lunar = presetPoint(db, 'lunar-base'), cells = status.cells(lunar, db), counts = status.tally(cells);

test('the static landing finding states exactly what the loaded collection computes', () => {
  const sentence = `For a lunar habitat (${lunar.o2}% O2, ${lunar.p} kPa, ${lunar.g_label}), ${counts.PROVEN} of ${cells.length} material-and-concern questions have a NASA source row at nearby conditions. ${counts.EXTRAPOLATED} have evidence only at other conditions and ${counts.NEVER_TESTED} have no source in this collection.`;
  assert.ok(html.includes(`<p id="lead-finding">${sentence}</p>`), sentence);
  assert.ok(html.includes(`<meta name="description" content="${sentence} `));
  assert.ok(readme.includes(sentence));
  assert.ok(html.includes(`<b>${counts.PROVEN} of ${cells.length}</b>`));
});

const en = n => n.toLocaleString('en-US');
const para = id => html.match(new RegExp(`<p id="${id}">(.*?)</p>`, 's'))?.[1] ?? '';
const lead = html.slice(html.indexOf('<section id="lead"'), html.indexOf('</section>') + 10);
const station = presetPoint(db, 'station'), stationCells = status.cells(station, db), stationCounts = status.tally(stationCells);

test('the terms line defines the questions and "nearby" from the shipped rules', () => {
  const materials = Object.keys(db.materials).length;
  assert.equal(materials * status.CONCERNS.length, cells.length);
  assert.ok(para('lead-terms').includes(`<b>${cells.length} questions</b> = ${materials} cabin materials × ${status.CONCERNS.join(', ')}.`));
  assert.ok(para('lead-terms').includes(`same gravity class, oxygen within ${TOL.o2} percentage point and pressure within ${TOL.p} kPa, on one source row.`));
});

test('the gap line counts rows by gravity class and the lunar count at 1x, 2x and 4x', () => {
  const tests = raw.tests.tests, by = cls => db.tests.filter(r => (r.n.gclass ?? null) === cls).length;
  const classes = new Set(db.tests.map(r => r.n.gclass ?? null));
  assert.deepEqual([...classes].sort(), [null, 'micro'].sort(), 'the sentence names every gravity class present');
  assert.equal(by('micro') + by(null) + by('partial'), tests.length);
  assert.ok(para('lead-gap').includes(`of ${en(tests.length)} source-table rows in ${db.investigations.length} NASA PSI investigations, ${en(by('micro'))} are microgravity, ${by(null)} state no gravity and ${by('partial')} are partial gravity.`));
  assert.equal(by('partial'), 0);
  const s = sensitivity(db, [1, 2, 4]), moon = s.presets.find(p => p.id === 'lunar-base');
  assert.equal(moon.counts[0], counts.PROVEN, 'the 1x column is the shipped tally');
  assert.ok(para('lead-gap').includes(`does not change the lunar count: ${moon.counts.map((n, i) => `${n} at ${s.tolerances[i].scale}×`).join(', ')}.`));
  assert.ok(moon.fixed && moon.reachable === 0);
});

test('the station line is the computed tally and pressure audit', () => {
  const audit = pressureAudit(stationCells, db);
  assert.ok(para('lead-station').includes(`a station cabin (${station.o2}% O2, ${station.p} kPa, ${station.g_label}) has <b>${stationCounts.PROVEN} of ${stationCells.length}</b> questions with nearby rows. They rest on ${audit.nearby} row matches, of which ${audit.reported} report pressure`));
  assert.ok(stationCounts.PROVEN > 0 && audit.reported === 0 && audit.inferred === audit.nearby);
});

test('the static table shows three real rows that count as nearby for the station cabin', () => {
  const audit = pressureAudit(stationCells, db);
  const hits = new Set(stationCells.filter(c => c.status === 'PROVEN').flatMap(c => c.hit_ids));
  const table = lead.match(/<table id="lead-rows">(.*?)<\/table>/s)[1];
  assert.ok(table.includes(`Three of those ${audit.nearby} rows, as recorded.`));
  const rows = [...table.matchAll(/<tr><td><a href="([^"]+)" rel="noopener">([^<]+)<\/a><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)];
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(r => r[2])).size, 3);
  assert.equal((table.match(/<tr>/g) ?? []).length, 4, 'one header row and three data rows, nothing unparsed');
  for (const [, url, id, investigation, material, oxygen, pressure, gravity] of rows) {
    const row = db.testById[id];
    assert.ok(row && hits.has(id), `${id} is a nearby row for the station cabin`);
    assert.deepEqual([investigation, material, oxygen, gravity], [row.investigation, row.fuel, `${row.o2_percent}%`, row.gravity]);
    assert.equal(row.pressure_kpa, null);
    assert.equal(pressure, 'not in the table');
    assert.equal(url, db.invById[row.psi_id].psi_url);
    assert.match(url, /^https:\/\/psi\.nasa\.gov\//);
  }
});

test('the landing offers one primary action and the slides, with no script and no external asset', () => {
  assert.ok(lead.includes('<a class="cta" href="#/design">Check your cabin</a>'));
  const slides = (read('web/presentation/index.html').match(/<section class="slide/g) ?? []).length;
  assert.ok(lead.includes(`<a href="presentation/">See the ${slides} slides</a>`));
  assert.equal((lead.match(/class="cta"/g) ?? []).length, 1);
  assert.doesNotMatch(lead, /<script|<img|<link|url\(|@import|style="/i);
  for (const [, href] of lead.matchAll(/href="([^"]+)"/g)) assert.match(href, /^(#\/design|presentation\/|https:\/\/psi\.nasa\.gov\/|https:\/\/ntrs\.nasa\.gov\/citations\/\d+$)/);
  assert.match(html, /<style>html\[data-ready\] #lead\{display:none\}#lead\{position:fixed;inset:0;[^}]*overflow:auto/);
  assert.ok(lead.includes('Rows are table records, not independent experiments. “No source” means absent from this collection, not unstudied by NASA.'));
  assert.doesNotMatch(lead.replace(/not a safety rating|fire-safety questions/g, ''), /\bsafe|\bproven\b|validated|certified|never tested/i);
  const words = lead.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
  assert.ok(words <= 460, `the block stays short: ${words} words`);
  assert.ok(lead.indexOf('class="cta"') < lead.indexOf('id="lead-flex"'), 'the primary action stays above the two supporting results, inside the first screen');
});

test('the README one-condition contrast is computed, not asserted', () => {
  const micro = stationCells, moon = status.cells(designPoint({ preset: 'custom', o2: station.o2, p: station.p, g: 'moon' }, db), db);
  const audit = pressureAudit(micro, db);
  assert.ok(readme.includes(`microgravity gives ${status.tally(micro).PROVEN} of ${micro.length} questions nearby evidence (all ${audit.inferred} matching rows rely on an assumed facility pressure); at 1/6 g it gives ${status.tally(moon).PROVEN}.`));
  assert.equal(audit.reported, 0);
});

test('the landing makes no autonomy or safety promise', () => {
  assert.doesNotMatch(html + read('web/js/views/brief.js'), /wait for Houston|fire officer|\bsafe to\b|proven safe/i);
  assert.match(html, /Coverage in this collection, not a safety rating\./);
});

test('the FLEX and next-request landing lines are recomputed from the modules that own them', async () => {
  const { describe, evaluate } = await import('../../web/js/core/oxygen-limit.js');
  const { nextExperiments } = await import('../../web/js/core/next-experiments.js');
  const d = describe(raw.tests.tests), e = evaluate(raw.tests.tests), c = d.lines[0].cells;
  assert.equal(d.lines[0].diluent, 'all');
  assert.ok(e.model.beats_baseline && e.model.correct > e.baseline.correct, 'the model line may only stay while it beats the baseline');
  assert.ok(html.includes(`went out on its own in ${c[0].extinction}/${c[0].tests} tests at 18% oxygen or less, ${c[1].extinction}/${c[1].tests} at 18–22%, ${c[2].extinction}/${c[2].tests} at 22–30% and ${c[3].extinction}/${c[3].tests} above 30%.`));
  assert.ok(html.includes(`checked on ${e.test_days} held-out test days, gets ${e.model.correct}/${e.rows} right vs ${e.baseline.correct}/${e.rows} for the majority baseline and ${e.threshold_baseline.correct}/${e.rows} for a single oxygen cut; the gain over that cut is not statistically clear.`));
  const m = nextExperiments(lunar, db), top = m.top[0];
  assert.ok(html.includes(`would give a nearby row to ${m.campaign.questions} of ${m.total} questions; the other ${m.total - m.nearby - m.campaign.questions} need a first table row (${counts.NEVER_TESTED} have no source, ${m.total - m.nearby - m.campaign.questions - counts.NEVER_TESTED} has a finding but no row). Closest row today: ${top.nearest.id} (PMMA prevention): ${top.separates[1].delta} oxygen points and ${Math.abs(top.separates[2].delta)} kPa away, at a different gravity class.`));
  assert.deepEqual([top.material, top.concern, top.separates[1].axis, top.separates[2].axis], ['pmma', 'prevention', 'o2', 'pressure']);
});

test('the outside-the-tables line counts NTRS snapshot records by title and links only stored titles and URLs', async () => {
  const { outsideCollection, featured } = await import('../../web/js/core/outside-collection.js');
  const index = JSON.parse(read('research/ntrs-index.json'));
  const out = outsideCollection({ index, sources: raw.sources, findings: raw.findings }), n = out.counts.snapshot, pick = featured(out);
  assert.ok(n.total > 0 && n.admitted > 0 && n.listed > 0 && n.admitted + n.listed === n.total);
  assert.equal(pick.admitted.length, 1);
  assert.equal(pick.listed.length, 1);
  const link = r => `<a href="${r.url}" rel="noopener">${r.title}</a>`;
  assert.equal(para('lead-outside'), `<b>Outside:</b> PSI tables are microgravity by design. Our NTRS snapshot lists ${n.total} NASA titles naming Moon, Mars, partial or normal gravity. VESTA quotes ${n.admitted}: ${link(pick.admitted[0])}; ${n.listed} are unread: ${link(pick.listed[0])}.`);
  for (const r of [...pick.admitted, ...pick.listed]) {
    const stored = index.find(row => String(row.id) === r.id);
    assert.deepEqual([r.title, r.url], [stored.title, stored.url], 'verbatim from research/ntrs-index.json');
  }
  assert.ok(raw.sources.sources.some(s => String(s.id) === pick.admitted[0].id && s.finding_ids.length > 0), 'the quoted example is a source of findings');
  assert.ok(!raw.sources.sources.some(s => String(s.id) === pick.listed[0].id), 'the unread example is not a source');
  assert.ok(lead.indexOf('id="lead-gap"') < lead.indexOf('id="lead-outside"') && lead.indexOf('id="lead-outside"') < lead.indexOf('id="lead-station"'));
  assert.ok(!db.tests.some(r => (r.n.gclass ?? null) === 'partial'), 'the sentence stays only while the tables hold no partial-gravity row');
});

test('the zero is not only gravity: the lunar oxygen and pressure in microgravity also give no nearby question', async () => {
  const micro = designPoint({ preset: 'custom', o2: lunar.o2, p: lunar.p, g: '0g' }, db);
  assert.equal(micro.gclass, 'micro');
  const n = status.tally(status.cells(micro, db)).PROVEN;
  assert.ok(html.includes(`<b>It is not only gravity:</b> the same ${lunar.o2}% oxygen and ${lunar.p} kPa in microgravity also give ${n} of ${cells.length}.`));
  const { evaluate } = await import('../../web/js/core/oxygen-limit.js');
  const e = evaluate(raw.tests.tests);
  assert.equal(JSON.stringify(e.uncertainty).includes('"includes_zero":true'), html.includes('the gain over that cut is not statistically clear'));
});
