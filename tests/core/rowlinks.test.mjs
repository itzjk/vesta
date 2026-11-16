import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nasaUrl, rowSourceLink, rowLinkCoverage, ROW_LINK_MISSING, ROW_LINK_LABEL } from '../../web/js/core/source-locator.js';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const rows = JSON.parse(read('web/data/tests.json')).tests;
const investigations = JSON.parse(read('web/data/investigations.json')).investigations;
const byId = Object.fromEntries(investigations.map(i => [i.psi_id, i]));

test('every source-table row resolves to its NASA PSI page through the investigation record', () => {
  assert.ok(rows.length > 0 && investigations.length > 0);
  // Before: only what a row carries itself. After: the investigation record is consulted.
  const before = rows.filter(row => nasaUrl(row.psi_url)).length;
  const coverage = rowLinkCoverage(rows, byId);
  const recordable = rows.filter(row => typeof (row.psi_url || byId[row.psi_id]?.psi_url) === 'string').length;
  console.log(`row links: ${before}/${rows.length} rows carry their own NASA URL; ${coverage.resolved}/${rows.length} resolve through the investigation record; ${coverage.not_recorded} not recorded`);
  assert.equal(coverage.rows, rows.length);
  assert.equal(coverage.own, before);
  assert.equal(coverage.resolved + coverage.not_recorded, rows.length);
  assert.equal(coverage.resolved, recordable, 'a URL recorded in the data must not be dropped');
  assert.ok(coverage.resolved >= before);
  assert.equal(coverage.without_locator, rows.filter(r => !r.table_file || !Number.isSafeInteger(r.row)).length);

  const recorded = new Set([...rows.map(r => r.psi_url), ...investigations.map(i => i.psi_url)].filter(v => typeof v === 'string'));
  for (const row of rows) {
    const investigation = byId[row.psi_id], link = rowSourceLink(row, investigation);
    assert.equal(link.investigation_id, row.psi_id);
    assert.equal(link.table_file, row.table_file ?? null);
    assert.equal(link.row, row.row ?? null);
    if (link.table_file != null && link.row != null) assert.equal(link.locator, `${row.table_file} · row ${row.row}`);
    if (link.status === 'not_recorded') {
      assert.equal(link.url, null); assert.equal(link.label, ROW_LINK_MISSING); assert.equal(link.via, null);
      continue;
    }
    assert.equal(link.label, ROW_LINK_LABEL);
    assert.ok(recorded.has(link.url), `${row.id}: URL is not verbatim from the data`);
    assert.equal(link.url, row.psi_url && nasaUrl(row.psi_url) ? row.psi_url : investigation.psi_url);
    const url = new URL(link.url);
    assert.equal(url.protocol, 'https:');
    assert.match(url.hostname, /(^|\.)nasa\.gov$/);
  }
});

test('a link is never invented: missing, non-https and non-NASA addresses stay unlinked', () => {
  const row = { ...rows[0], psi_url: undefined }, good = byId[row.psi_id].psi_url;
  for (const psi_url of [undefined, null, '', 42, `http://${new URL(good).host}/x`, 'https://nasa.gov.example.org/x',
    'https://example.org/nasa.gov', 'https://user@psi.nasa.gov/x', 'javascript:alert(1)', ` ${good}`, 'https://notnasa.gov/x']) {
    const link = rowSourceLink(row, { psi_id: row.psi_id, psi_url });
    assert.deepEqual([link.status, link.url, link.label, link.via], ['not_recorded', null, ROW_LINK_MISSING, null], String(psi_url));
    assert.equal(link.locator, `${row.table_file} · row ${row.row}`, 'the locator survives a missing link');
  }
  assert.equal(rowSourceLink(row, undefined).status, 'not_recorded');
  assert.equal(rowSourceLink(undefined, undefined).locator, 'Table file not recorded · row not recorded');
  assert.equal(rowSourceLink({ ...row, psi_id: 'PSI-0' }, byId['PSI-0']).url, null, 'an unknown investigation gets no guessed URL');
});

test('a row keeps its own NASA link when it has one, otherwise the investigation link is used unchanged', () => {
  const row = rows[0], investigation = byId[row.psi_id], own = `${investigation.psi_url}?table=1`;
  assert.deepEqual([rowSourceLink({ ...row, psi_url: own }, investigation).url, rowSourceLink({ ...row, psi_url: own }, investigation).via], [own, 'row']);
  assert.deepEqual([rowSourceLink(row, investigation).url, rowSourceLink(row, investigation).via],
    [row.psi_url && nasaUrl(row.psi_url) ? row.psi_url : investigation.psi_url, row.psi_url && nasaUrl(row.psi_url) ? 'row' : 'investigation']);
  assert.equal(rowSourceLink({ ...row, psi_url: 'https://example.org/x' }, investigation).url, investigation.psi_url);
});

test('the row renderers use the shared resolver and its wording', () => {
  for (const file of ['web/js/world/cite.js', 'web/js/world/evidence-register.js', 'web/js/world/row-comparison.js', 'web/js/world/inventory-review-panel.js']) {
    const source = read(file);
    assert.match(source, /import \{ rowSourceLink \} from '\.\.\/core\/source-locator\.js/, file);
    assert.match(source, /rowSourceLink\(/, file);
    assert.match(source, /\.locator\b|origin\.label/, file);
  }
  assert.doesNotMatch(read('web/js/core/source-locator.js'), /psi\.nasa\.gov/, 'the resolver holds no URL of its own');
});
