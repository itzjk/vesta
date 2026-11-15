// Derive locators only. This does not rebuild or alter findings, gates or source text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LOCATOR_SCHEMA, LOCATOR_NORMALIZATION, normalizeSourceLines, locateSourceQuote, validSourceTextPath } from '../web/js/core/source-locator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), commit = args[args.indexOf('--source-commit') + 1];
if (!args.includes('--source-commit') || !/^[a-f0-9]{40}$/.test(commit || ''))
  throw new Error('Usage: node tools/source-locators.mjs --source-commit <full pinned commit>');
const git = argv => execFileSync('git', argv, { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const pinned = git(['rev-parse', '--verify', `${commit}^{commit}`]).toString().trim();
if (pinned !== commit) throw new Error('Source commit must resolve to the exact supplied commit.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const input = fs.readFileSync(path.join(root, 'web/data/findings.json'));
const rows = JSON.parse(input).findings, sources = new Map();
const rejectedPath = path.join(root, 'web/data/rejected-excerpts.json');
const rejectedInput = fs.existsSync(rejectedPath) ? fs.readFileSync(rejectedPath) : null;
const rejectedData = rejectedInput ? JSON.parse(rejectedInput) : null;
if (rejectedData && (rejectedData.schema !== 'vesta.rejected-excerpts/1' || rejectedData.source_commit !== commit))
  throw new Error('Rejected excerpts must name the same pinned source commit.');

function locateRecords(records) {
  const findings = {};
  for (const finding of [...records].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (!finding.quote) continue; // Table findings keep their source-table row locators.
    if (Object.hasOwn(findings, finding.id)) throw new Error(`Duplicate finding id: ${finding.id}`);
    const source_text_file = finding.source?.text_file, quote_sha256 = sha(finding.quote);
    if (!validSourceTextPath(source_text_file)) {
      findings[finding.id] = { source_text_file: source_text_file ?? null, quote_sha256,
        status: 'unavailable', reason: 'source_path_unavailable', occurrence_count: 0, locations: [] };
      continue;
    }
    if (!sources.has(source_text_file)) {
      const relative = `research/${source_text_file}`;
      let original;
      try { original = git(['show', `${commit}:${relative}`]); }
      catch { sources.set(source_text_file, null); }
      if (original) {
        const local = path.join(root, relative);
        if (fs.existsSync(local) && !fs.readFileSync(local).equals(original))
          throw new Error(`Cached source differs from pinned commit: ${relative}`);
        sources.set(source_text_file, { mapped: normalizeSourceLines(original.toString('utf8')), digest: sha(original) });
      }
    }
    if (!sources.get(source_text_file)) {
      findings[finding.id] = { source_text_file, quote_sha256, status: 'unavailable',
        reason: 'source_not_in_pinned_commit', occurrence_count: 0, locations: [] };
      continue;
    }
    const { mapped, digest } = sources.get(source_text_file);
    findings[finding.id] = { source_text_file, quote_sha256, source_sha256: digest, ...locateSourceQuote(mapped, finding.quote) };
  }
  return findings;
}
const findings = locateRecords(rows), rejected = locateRecords(rejectedData?.records || []);
if (Object.keys(rejected).some(id => Object.hasOwn(findings, id))) throw new Error('An identifier cannot be both accepted and rejected.');
const tally = records => Object.values(records).reduce((counts, record) => { counts[record.status]++; return counts; }, { unique: 0, ambiguous: 0, unavailable: 0 });
const totals = { quoted_findings: Object.keys(findings).length, rejected_excerpts: Object.keys(rejected).length,
  cached_source_files: [...sources.values()].filter(Boolean).length, accepted: tally(findings), rejected: tally(rejected) };
const manifest = { schema: LOCATOR_SCHEMA, normalization: LOCATOR_NORMALIZATION, source_commit: commit,
  source_commit_time: git(['show', '-s', '--format=%cI', commit]).toString().trim(), findings_sha256: sha(input),
  ...(rejectedInput ? { rejected_excerpts_sha256: sha(rejectedInput) } : {}),
  locator_scope: 'Line numbers in pinned cached source text, not NASA PDF page numbers. A text location does not mean an excerpt passed the evidence gate. Normalization matches quotecheck.py.', totals, findings, rejected };
const output = path.join(root, 'web/data/source-locators.json');
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({ file: path.relative(root, output), sha256: sha(fs.readFileSync(output)), ...totals }) + '\n');
