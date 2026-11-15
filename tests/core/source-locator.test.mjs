import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { normalizeSourceQuote, normalizeSourceLines, locateSourceQuote, sourceTextUrl, sourceLocatorModel, LOCATOR_SCHEMA, LOCATOR_NORMALIZATION } from '../../web/js/core/source-locator.js';
import { norm } from '../../tools/lib/gate.mjs';

const commit = 'c5ca71deb825e97c7eb5b9d9dd3c090a6c660330';
const sha = text => createHash('sha256').update(text).digest('hex');
const quote = 'A measured flame crosses two source lines.';
const finding = { id: 'TEST', quote, source: { text_file: 'raw/nasa/source test.txt' } };
const makeManifest = locations => ({ schema: LOCATOR_SCHEMA, normalization: LOCATOR_NORMALIZATION, source_commit: commit,
  findings: { TEST: { source_text_file: finding.source.text_file, quote_sha256: sha(quote), source_sha256: sha('source'),
    status: locations.length === 1 ? 'unique' : 'ambiguous', occurrence_count: locations.length, locations } } });

test('a cross-line quotation resolves to exact newline-delimited cached lines', () => {
  const raw = 'URL: source\n\nA measured flame crosses\ntwo source lines.\nEnd.';
  assert.deepEqual(locateSourceQuote(raw, quote), { status: 'unique', occurrence_count: 1, locations: [{ start_line: 3, end_line: 4 }] });
  assert.equal(normalizeSourceLines(raw).text, norm(raw));
});

test('Unicode, ligatures, combining marks, whitespace and punctuation match the existing gate', () => {
  const raw = 'header\r\nThe “ﬂame”—Cafe\u0301\u00a0has\u00ad a\u0085measured\u001cvalue.\nNext';
  const q = 'The "flame"-Café has a measured value.';
  assert.equal(normalizeSourceQuote(raw), norm(raw));
  assert.equal(normalizeSourceLines(raw).text, norm(raw));
  assert.deepEqual(locateSourceQuote(raw, q).locations, [{ start_line: 2, end_line: 2 }]);
  assert.deepEqual(locateSourceQuote('title\nA\f flame\nvalue', 'A flame value').locations, [{ start_line: 2, end_line: 3 }]);
  assert.deepEqual(locateSourceQuote('title\n😀 flame\nvalue', '😀 flame value').locations, [{ start_line: 2, end_line: 3 }]);
});

test('repeated quotations stay ambiguous and no occurrence is silently selected', () => {
  const result = locateSourceQuote(`${quote}\nseparator\n${quote}`, quote);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.occurrence_count, 2);
  assert.deepEqual(result.locations, [{ start_line: 1, end_line: 1 }, { start_line: 3, end_line: 3 }]);
  const model = sourceLocatorModel(makeManifest(result.locations), finding, sha(quote));
  assert.equal(model.status, 'ambiguous'); assert.equal(model.links.length, 2);
});

test('absent quotes and empty text never gain a fabricated location', () => {
  assert.deepEqual(locateSourceQuote('A different measured result.', quote), { status: 'unavailable', reason: 'quote_not_found', occurrence_count: 0, locations: [] });
  assert.equal(locateSourceQuote('', quote).status, 'unavailable');
  assert.equal(locateSourceQuote('text', ' \n ').reason, 'empty_quote');
});

test('pinned links encode filenames and reject path escapes, bad commits and ranges', () => {
  assert.equal(sourceTextUrl(commit, 'raw/nasa/a #?é%.txt', 2, 4), `https://github.com/itzjk/vesta/blob/${commit}/research/raw/nasa/a%20%23%3F%C3%A9%25.txt?plain=1#L2-L4`);
  assert.equal(sourceTextUrl(commit, 'raw/psi/record.json', 3), `https://github.com/itzjk/vesta/blob/${commit}/research/raw/psi/record.json?plain=1#L3`);
  assert.equal(sourceTextUrl(commit, 'raw/psi/table.csv', 4), `https://github.com/itzjk/vesta/blob/${commit}/research/raw/psi/table.csv?plain=1#L4`);
  for (const file of ['../secret.txt', 'raw/../secret.txt', 'raw//bad.txt', 'raw/./bad.txt', 'raw\\bad.txt', 'https://example.com/a.txt']) assert.equal(sourceTextUrl(commit, file, 1), null);
  assert.equal(sourceTextUrl('main', 'raw/a.txt', 1), null);
  assert.equal(sourceTextUrl(commit, 'raw/a.txt', 0), null);
  assert.equal(sourceTextUrl(commit, 'raw/a.txt', 5, 4), null);
});

test('a stale quote digest, changed source path or malformed manifest fails closed', () => {
  const manifest = makeManifest([{ start_line: 2, end_line: 3 }]);
  assert.equal(sourceLocatorModel(manifest, finding, sha(quote)).status, 'unique');
  assert.equal(sourceLocatorModel(manifest, finding, sha(quote + '!')).reason, 'record_mismatch');
  assert.equal(sourceLocatorModel(manifest, { ...finding, source: { text_file: 'raw/other.txt' } }, sha(quote)).reason, 'record_mismatch');
  assert.equal(sourceLocatorModel({ ...manifest, normalization: 'different' }, finding, sha(quote)).reason, 'manifest_unavailable');
  assert.equal(sourceLocatorModel({ ...manifest, source_commit: 'main' }, finding, sha(quote)).reason, 'invalid_record');
  manifest.findings.TEST.occurrence_count = 2;
  assert.equal(sourceLocatorModel(manifest, finding, sha(quote)).reason, 'invalid_record');
});

test('rejected excerpt locations are separate and never change evidence-gate status', () => {
  const source = makeManifest([{ start_line: 2, end_line: 3 }]);
  const rejected = { ...finding, why: 'cut_before_qualifier' };
  const manifest = { ...source, findings: {}, rejected: source.findings };
  assert.equal(sourceLocatorModel(manifest, rejected, sha(quote)).status, 'unique');
  assert.equal(rejected.why, 'cut_before_qualifier');
  assert.equal(sourceLocatorModel({ ...manifest, findings: source.findings }, rejected, sha(quote)).reason, 'record_mismatch');
});

test('every shipped locator agrees with the pinned cached text, quote digest and gate normalization', () => {
  const root = new URL('../../', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('web/data/source-locators.json', root)));
  const rows = JSON.parse(fs.readFileSync(new URL('web/data/findings.json', root))).findings.filter(row => row.quote);
  assert.equal(manifest.totals.quoted_findings, rows.length);
  const rejected = JSON.parse(fs.readFileSync(new URL('web/data/rejected-excerpts.json', root))).records;
  assert.equal(manifest.totals.rejected_excerpts, rejected.length);
  const cache = new Map();
  for (const row of [...rows, ...rejected]) {
    const record = manifest.findings[row.id] || manifest.rejected[row.id]; assert.ok(record, row.id);
    assert.equal(record.quote_sha256, sha(row.quote), row.id);
    if (record.reason === 'source_not_in_pinned_commit') {
      assert.equal(record.status, 'unavailable'); assert.deepEqual(record.locations, []);
      assert.throws(() => execFileSync('git', ['show', `${commit}:research/${record.source_text_file}`], { cwd: root, stdio: 'pipe' }));
      assert.equal(sourceLocatorModel(manifest, row, sha(row.quote)).status, 'unavailable');
      continue;
    }
    if (!cache.has(record.source_text_file)) {
      const bytes = fs.readFileSync(new URL(`research/${record.source_text_file}`, root));
      const raw = bytes.toString('utf8'), mapped = normalizeSourceLines(raw);
      assert.equal(mapped.text, norm(raw), record.source_text_file);
      cache.set(record.source_text_file, { bytes, mapped });
    }
    const { bytes, mapped } = cache.get(record.source_text_file);
    assert.equal(record.source_sha256, sha(bytes), row.id);
    const found = locateSourceQuote(mapped, row.quote);
    assert.deepEqual(record.locations, found.locations, row.id);
    assert.equal(record.status, found.status, row.id);
    assert.notEqual(found.status, 'unavailable', row.id);
    assert.equal(sourceLocatorModel(manifest, row, sha(row.quote)).status, found.status, row.id);
  }
  assert.equal(cache.size, manifest.totals.cached_source_files);
});
