import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, designPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { pressureAudit } from '../../web/js/core/assumption-audit.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw), html = read('web/index.html'), readme = read('README.md');
const lunar = presetPoint(db, 'lunar-base'), cells = status.cells(lunar, db), counts = status.tally(cells);

test('the static landing finding states exactly what the loaded collection computes', () => {
  const sentence = `For a lunar habitat (${lunar.o2}% O2, ${lunar.p} kPa, ${lunar.g_label}), ${counts.PROVEN} of ${cells.length} material-and-concern questions have a NASA source row at nearby conditions. ${counts.EXTRAPOLATED} have evidence only at other conditions and ${counts.NEVER_TESTED} have no source in this collection.`;
  assert.ok(html.includes(`<p id="lead-finding">${sentence}</p>`), sentence);
  assert.ok(html.includes(`<meta name="description" content="${sentence} `));
  assert.ok(readme.includes(sentence));
  assert.ok(html.includes(`<b>${counts.PROVEN} of ${cells.length}</b>`));
});

test('the four landing counts and the example row match the data', () => {
  const tests = raw.tests.tests, findings = raw.findings.findings;
  for (const [n, label] of [[db.investigations.length, 'NASA PSI investigations'], [tests.length.toLocaleString('en-US'), 'source-table rows'],
    [findings.length, 'quote-checked findings'], [cells.length, 'material-and-concern questions']])
    assert.ok(html.includes(`<li><b>${n}</b>${label}</li>`), `${n} ${label}`);
  const row = db.testById['PSI-25:1'];
  assert.deepEqual([row.investigation, row.fuel, row.o2_percent, row.pressure_kpa, row.gravity], ['BASS-II', 'PMMA', 22.2, null, 'microgravity']);
  assert.ok(html.includes('BASS-II, table row PSI-25:1. PMMA film, 22.2% oxygen, microgravity, <b>pressure not in the table</b>'));
  assert.ok(html.includes(db.invById['PSI-25'].psi_url));
});

test('the README one-condition contrast is computed, not asserted', () => {
  const station = presetPoint(db, 'station');
  const micro = status.cells(station, db), moon = status.cells(designPoint({ preset: 'custom', o2: station.o2, p: station.p, g: 'moon' }, db), db);
  const audit = pressureAudit(micro, db);
  assert.ok(readme.includes(`microgravity gives ${status.tally(micro).PROVEN} of ${micro.length} questions nearby evidence (all ${audit.inferred} matching rows rely on an assumed facility pressure); at 1/6 g it gives ${status.tally(moon).PROVEN}.`));
  assert.equal(audit.reported, 0);
});

test('the landing makes no autonomy or safety promise', () => {
  assert.doesNotMatch(html + read('web/js/views/brief.js'), /wait for Houston|fire officer|\bsafe to\b|proven safe/i);
  assert.match(html, /Coverage in this collection, not a safety rating\./);
});
