// The ranking score as a six-segment bar: one segment per term, in fixed order, width = parts (DESIGN.md 3.4, 6.3).
import { el } from './el.js';
import { getCore } from '../store.js';

export const TERMS = ['pillar', 'atmosphere', 'gravity', 'level', 'material', 'habitat'];
const r1 = x => Math.round(x * 10) / 10;

/**
 * scorebar(parts, { total, sentences: { pillar: 'Answers your concern (prevention).', ... }, weights })
 * parts: the `parts` object of core/rank.js score(), or the whole rank row { total, parts }.
 * The weights are read from core/rank.js (W); each slot is as wide as its weight and filled by its part.
 */
export function scorebar(parts, opts = {}) {
  const row = parts && parts.parts && typeof parts.parts === 'object' ? parts : null;
  const p = row ? row.parts : (parts || {});
  const W = opts.weights || (getCore().rank && getCore().rank.W) || null;
  const total = opts.total ?? (row ? row.total : null);
  const sentences = opts.sentences || {};
  const bar = el('div.scorebar-track', { role: 'img', 'aria-label': TERMS.map(k => `${k} ${r1(p[k] || 0)}${W ? ' of ' + W[k] : ''}`).join(', ') });
  for (const k of TERMS) {
    const v = typeof p[k] === 'number' ? p[k] : 0, max = W ? W[k] : v;
    const tip = (sentences[k] ? sentences[k] + ' ' : '') + `${k}: ${r1(v)}${W ? ' of ' + W[k] : ''}`;
    bar.append(el('span', { class: 'scorebar-slot scorebar-' + k, tabindex: 0, title: tip, data: { term: k, tip, value: r1(v) }, style: { flex: `${max || 0.0001} 1 0` } },
      el('span.scorebar-fill', { style: { width: (max ? Math.max(0, Math.min(1, v / max)) * 100 : 0) + '%' } })));
  }
  return el('div', { class: 'scorebar' + (opts.small ? ' scorebar-small' : ''), data: { total: total ?? null } },
    total == null ? null : el('span.scorebar-total.t-number', String(total)), bar,
    opts.meaning === false ? null : el('span.scorebar-meaning', (getCore().text?.SCORE_LABEL || "relevance, 0 to 100 · VESTA's weighting, not a probability and not a safety rating")),
    opts.legend ? el('span.scorebar-legend', TERMS.map(k => el('span', { data: { term: k } }, `${k} ${r1(p[k] || 0)}`))) : null);
}
