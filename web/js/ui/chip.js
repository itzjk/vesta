// Status chips, reason pills and tags. A chip is a pill with a shape and a word, never colour alone (DESIGN.md 6.3).
import { el, svg } from './el.js';

// The words come from core/text.js once the shell has loaded it; these stand in until then.
const WORDS = { PROVEN: 'PROVEN', EXTRAPOLATED: 'EXTRAPOLATED', NEVER_TESTED: 'NEVER TESTED', SOURCED: 'SOURCED', NO_SOURCE: 'NO SOURCE',
                SIMULATED: 'SIMULATED', INTERPRETATION: 'INTERPRETATION', SI: 'SI' };
const QUALIFIER = { pressure_inferred: 'pressure inferred' };
let text = null;
/** Called by the shell with the core/text.js module. */
export function useText(mod) { text = mod || null; }
export const getText = () => text;

const tryText = (fn, ...args) => { try { const s = text && typeof text[fn] === 'function' ? text[fn](...args) : null; return typeof s === 'string' && s.trim() ? s : null; } catch { return null; } };

/** Any spelling of a status to its stable id: 'never tested', 'NO SOURCE', 'proven' -> NEVER_TESTED, NO_SOURCE, PROVEN. */
export function statusId(s) { return String(s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_'); }
export function statusWord(id) { const k = statusId(id); return WORDS[k] ? (tryText('status', k) || WORDS[k]).toUpperCase() : (tryText('status', k) || k.replace(/_/g, ' ')); }

function mark(id, ring) {
  const s = svg('svg.chip-mark', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' });
  const c = 'currentColor';
  if (id === 'PROVEN' && ring) s.append(svg('circle', { cx: 8, cy: 8, r: 5.2, fill: 'none', stroke: c, 'stroke-width': 2.6 }));
  else if (id === 'PROVEN') s.append(svg('circle', { cx: 8, cy: 8, r: 6.4, fill: c }));
  else if (id === 'EXTRAPOLATED') s.append(svg('circle', { cx: 8, cy: 8, r: 5.6, fill: 'none', stroke: c, 'stroke-width': 1.8 }), svg('path', { d: 'M8 2.4a5.6 5.6 0 0 0 0 11.2z', fill: c }));
  else if (id === 'NEVER_TESTED') s.append(svg('circle', { cx: 8, cy: 8, r: 5.4, fill: 'none', stroke: c, 'stroke-width': 2 }));
  else if (id === 'SOURCED') s.append(svg('path', { d: 'M8 1.2 14.8 8 8 14.8 1.2 8z', fill: c }));
  else if (id === 'NO_SOURCE') s.append(svg('path', { d: 'M3 3l10 10M13 3L3 13', fill: 'none', stroke: c, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
  else if (id === 'SIMULATED') s.append(svg('rect', { x: 2.5, y: 2.5, width: 11, height: 11, rx: 2, fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-dasharray': '3 2' }));
  else s.append(svg('circle', { cx: 8, cy: 8, r: 5.4, fill: 'none', stroke: c, 'stroke-width': 1.6 }), svg('circle', { cx: 8, cy: 8, r: 1.8, fill: c }));
  return s;
}

/**
 * chip('PROVEN', { qualifier: 'pressure_inferred' })   chip('NEVER_TESTED')   chip('SOURCED', { detail: 'flight experiment' })
 * opts: qualifier | inferred, label (replaces the word), detail (dim text after the word), small, title
 */
export function chip(status, opts = {}) {
  const id = statusId(status);
  const qual = opts.qualifier || (opts.inferred ? 'pressure_inferred' : null);
  const ring = id === 'PROVEN' && qual === 'pressure_inferred';
  const word = opts.label || statusWord(id);
  const node = el('span', { class: 'chip chip-' + id.toLowerCase().replace(/_/g, '-') + (ring ? ' chip-hollow' : '') + (opts.small ? ' chip-small' : '') + (opts.class ? ' ' + opts.class : ''),
    data: { status: id, qualifier: qual || null }, title: opts.title },
    mark(id, ring), el('span.chip-word', word),
    qual ? el('span.chip-qual', '· ' + (QUALIFIER[qual] || String(qual).replace(/_/g, ' '))) : null,
    opts.detail != null && opts.detail !== '' ? el('span.chip-detail', opts.detail) : null,
    tryText('statusMeaning', id, qual) ? el('span.chip-meaning', tryText('statusMeaning', id, qual)) : null);
  return node;
}

/** Small amber pill: why a question or a finding is not PROVEN here. The code stays in data-reason. */
export function reason(code, values = {}) {
  const words = tryText('reason', code, values) || String(code).replace(/_/g, ' ');
  return el('span.reason', { data: { reason: code }, title: String(code) }, words);
}

/** A neutral label pill: tag('VESTA · interpretation'), tag('SI-written claim', { tone: 'dim' }). */
export function tag(label, opts = {}) {
  return el('span', { class: 'tag tag-' + (opts.tone || 'ice') + (opts.class ? ' ' + opts.class : ''), title: opts.title, data: opts.data }, label);
}

/** "flight experiment · read in a 2015 NASA review" from core/text.js; null when the module cannot say. */
export function levelText(finding) {
  if (!finding) return null;
  return tryText('level', finding) || null;                       // core/text.js level(f) reads f.n and f.source.year
}
/** "8.2 psia (56.5 kPa)" from core/text.js, with the same arithmetic as a stand-in (1 psi = 6.89476 kPa). */
export function pressureText(kpa) {
  if (Array.isArray(kpa)) return tryText('pressure', kpa) || `${pressureText(kpa[0])} to ${pressureText(kpa[1])}`;
  if (typeof kpa !== 'number' || !isFinite(kpa)) return null;
  return tryText('pressure', kpa) || `${Math.round(kpa / 6.89476 * 10) / 10} psia (${Math.round(kpa * 10) / 10} kPa)`;
}

/** The fixed line that sits under every status legend. The count of investigations is read from the index, never typed. */
export function statusLine(db, opts = {}) {
  const n = db && Array.isArray(db.investigations) ? db.investigations.length : null;
  const fixed = (text && typeof text.STATUS_LINE === 'string' && text.STATUS_LINE) || 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION';
  const base = n == null ? null : (tryText('base', n) || `in VESTA\u2019s evidence base (${n} PSI investigations)`);
  return el('p.status-line', fixed, opts.base === false || !base ? null : el('span.t-dim', ` \u00b7 ${base}`));
}
/** The three status chips and the fixed line: legend(db) */
export function legend(db, opts = {}) {
  return el('div.legend', chip('PROVEN'), chip('PROVEN', { qualifier: 'pressure_inferred' }), chip('EXTRAPOLATED'), chip('NEVER_TESTED'), statusLine(db, opts));
}
