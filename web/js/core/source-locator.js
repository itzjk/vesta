// Locations in the pinned cached source text, never inferred PDF page numbers.
export const LOCATOR_SCHEMA = 'vesta.source-locators/1';
export const LOCATOR_NORMALIZATION = 'quotecheck-nfkc-fold-whitespace/1';
const FOLD = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '−': '-', '‐': '-', '‑': '-', '­': '' };
const FOLD_RE = /[‘’“”–—−‐‑­]/g;
// Exactly the Python whitespace set used by research/tools/quotecheck.py.
const WS = '\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const SPACE = new RegExp(`^[${WS}]$`, 'u');
const RUN = new RegExp(`[${WS}]+`, 'g'), TRIM = new RegExp(`^[${WS}]+|[${WS}]+$`, 'g');
const fold = value => String(value ?? '').normalize('NFKC').replace(FOLD_RE, char => FOLD[char]);
export const normalizeSourceQuote = value => fold(value).replace(RUN, ' ').replace(TRIM, '');

export function normalizeSourceLines(raw) {
  const chunks = [], lines = [];
  let pending = null;
  const sourceLines = String(raw ?? '').split('\n');
  const append = (value, line) => { chunks.push(value); for (let i = 0; i < value.length; i++) lines.push(line); };
  for (let index = 0; index < sourceLines.length; index++) {
    // NFKC cannot compose across LF. Map each UTF-16 position after folding,
    // including expanded ligatures, to its actual newline-delimited source line.
    for (const char of fold(sourceLines[index])) {
      if (SPACE.test(char)) { pending ??= index + 1; continue; }
      if (pending != null && chunks.length) append(' ', pending);
      pending = null; append(char, index + 1);
    }
    if (index + 1 < sourceLines.length) pending ??= index + 1;
  }
  const text = chunks.join('');
  if (text !== normalizeSourceQuote(raw)) throw new Error('Source normalization mapping differs from the quote gate.');
  return { text, lines };
}

export function locateSourceQuote(rawOrMapped, quote) {
  const mapped = typeof rawOrMapped === 'string' ? normalizeSourceLines(rawOrMapped) : rawOrMapped;
  const wanted = normalizeSourceQuote(quote);
  if (!wanted) return { status: 'unavailable', reason: 'empty_quote', occurrence_count: 0, locations: [] };
  const locations = [];
  let from = 0, index;
  while ((index = mapped.text.indexOf(wanted, from)) !== -1) {
    locations.push({ start_line: mapped.lines[index], end_line: mapped.lines[index + wanted.length - 1] });
    from = index + 1; // Preserve overlapping or repeated matches; never silently pick the first.
  }
  return { status: locations.length === 1 ? 'unique' : locations.length ? 'ambiguous' : 'unavailable',
    ...(locations.length ? {} : { reason: 'quote_not_found' }), occurrence_count: locations.length, locations };
}

export function validSourceTextPath(path) {
  return typeof path === 'string' && path.startsWith('raw/') && /\.(txt|json|csv)$/.test(path)
    && !/[\\\u0000-\u001f\u007f]/.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..');
}

export function sourceTextUrl(commit, file, start, end = start) {
  if (!/^[a-f0-9]{40}$/.test(commit || '') || !validSourceTextPath(file)
    || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) return null;
  return `https://github.com/itzjk/vesta/blob/${commit}/research/${file.split('/').map(encodeURIComponent).join('/')}?plain=1#L${start}${end === start ? '' : `-L${end}`}`;
}

export function sourceLocatorModel(manifest, finding, quoteSha256) {
  const unavailable = reason => ({ status: 'unavailable', reason, links: [] });
  if (manifest?.schema !== LOCATOR_SCHEMA || manifest.normalization !== LOCATOR_NORMALIZATION)
    return unavailable('manifest_unavailable');
  if (manifest.findings?.[finding?.id] && manifest.rejected?.[finding?.id]) return unavailable('record_mismatch');
  const record = manifest.findings?.[finding?.id] || manifest.rejected?.[finding?.id];
  if (!record || record.source_text_file !== finding.source?.text_file
    || !/^[a-f0-9]{64}$/.test(quoteSha256 || '') || record.quote_sha256 !== quoteSha256)
    return unavailable('record_mismatch');
  if (record.status === 'unavailable') return unavailable(record.reason || 'quote_not_found');
  if (!['unique', 'ambiguous'].includes(record.status) || !Array.isArray(record.locations)
    || record.occurrence_count !== record.locations.length || record.locations.length < 1
    || (record.status === 'unique') !== (record.locations.length === 1)
    || !/^[a-f0-9]{64}$/.test(record.source_sha256 || '')) return unavailable('invalid_record');
  const links = record.locations.map(range => ({ ...range,
    url: sourceTextUrl(manifest.source_commit, record.source_text_file, range.start_line, range.end_line) }));
  if (links.some(link => !link.url)) return unavailable('invalid_record');
  return { status: record.status, occurrence_count: record.occurrence_count,
    links: links.filter((link, index) => links.findIndex(other => other.url === link.url) === index),
    source_text_file: record.source_text_file, source_sha256: record.source_sha256, source_commit: manifest.source_commit };
}

// ---- Source-table rows: the NASA PSI investigation page, with table file and row number as the exact locator.
export const ROW_LINK_MISSING = 'NASA link not recorded';
export const ROW_LINK_LABEL = 'Open NASA PSI record';
/** Returns the recorded string unchanged when it is an https NASA address, otherwise null. Never builds a URL. */
export function nasaUrl(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /(^|\.)nasa\.gov$/.test(url.hostname) ? value : null;
  } catch { return null; }
}
/**
 * The link opens the investigation page, not the row itself: a row's own psi_url wins, otherwise the URL
 * recorded on its investigation. The table file and row number locate the row inside that record.
 */
export function rowSourceLink(row, investigation) {
  const own = nasaUrl(row?.psi_url), url = own || nasaUrl(investigation?.psi_url);
  const table = typeof row?.table_file === 'string' && row.table_file.trim() ? row.table_file : null;
  const number = Number.isSafeInteger(row?.row) ? row.row : null;
  return { status: url ? 'linked' : 'not_recorded', url, via: own ? 'row' : url ? 'investigation' : null,
    label: url ? ROW_LINK_LABEL : ROW_LINK_MISSING,
    investigation_id: row?.psi_id ?? investigation?.psi_id ?? null, table_file: table, row: number,
    locator: `${table ?? 'Table file not recorded'} · row ${number ?? 'not recorded'}` };
}
/** How many rows carry their own link, and how many resolve once the investigation record is consulted. */
export function rowLinkCoverage(rows, investigationById) {
  const out = { rows: 0, own: 0, resolved: 0, not_recorded: 0, without_locator: 0 };
  for (const row of rows ?? []) {
    const link = rowSourceLink(row, investigationById?.[row?.psi_id]);
    out.rows++; if (link.via === 'row') out.own++;
    if (link.url) out.resolved++; else out.not_recorded++;
    if (link.table_file == null || link.row == null) out.without_locator++;
  }
  return out;
}
