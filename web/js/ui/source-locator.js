import { el } from './el.js';
import { sourceLocatorModel } from '../core/source-locator.js?v=sebas-20261115-1';

let manifestPromise;
const load = () => manifestPromise ||= fetch(new URL('../../data/source-locators.json?v=sebas-20261115-1', import.meta.url))
  .then(response => { if (!response.ok) throw new Error('Locator manifest unavailable'); return response.json(); })
  .catch(error => { manifestPromise = null; throw error; });
const digest = async quote => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(quote)))].map(byte => byte.toString(16).padStart(2, '0')).join('');

export function sourceLocator(finding, { instrument = false } = {}) {
  if (!finding?.quote) return null;
  const noteClass = instrument ? 'dw-hint' : 'wc-scope';
  const box = el('div.source-locator', { data: { sourceLocator: finding.id }, 'aria-live': 'polite' }, el('p', { class: noteClass }, 'Loading cached source location…'));
  Promise.all([load(), digest(finding.quote)]).then(([manifest, hash]) => {
    const model = sourceLocatorModel(manifest, finding, hash);
    box.dataset.locatorStatus = model.status;
    if (model.status === 'unavailable') {
      box.replaceChildren(el('p', { class: noteClass }, 'Cached source location unavailable. Use the original source and quoted passage.'));
      return;
    }
    const links = model.links.map(link => el('a', { class: instrument ? 'btn btn-small' : 'wc-original',
      href: link.url, target: '_blank', rel: 'noopener noreferrer' },
      `Cached source text · ${link.start_line === link.end_line ? `line ${link.start_line}` : `lines ${link.start_line}–${link.end_line}`} ↗`));
    const about = el('details', { class: instrument ? 'dw-locator-detail' : 'wc-identifiers' }, el('summary', 'About this locator'),
      el('p', { class: noteClass }, 'These are lines in the cached source snapshot, not PDF page numbers. A location does not mean an excerpt passed the evidence gate. Matching applies Unicode normalization, folds typographic quotes and dashes, removes soft hyphens, and collapses whitespace.'),
      el('p', { class: noteClass, style: { overflowWrap: 'anywhere' } }, `${model.source_text_file} · source commit ${model.source_commit.slice(0, 12)} · SHA-256 ${model.source_sha256}`));
    box.replaceChildren(
      ...(model.status === 'ambiguous' ? [el('p', { class: noteClass }, `${model.occurrence_count} matching passages in the cached text; no single location is selected.`)] : []),
      ...links, about);
  }).catch(() => {
    box.dataset.locatorStatus = 'unavailable';
    box.replaceChildren(el('p', { class: noteClass }, 'Cached source location could not be loaded. The original source link remains available.'));
  });
  return box;
}
