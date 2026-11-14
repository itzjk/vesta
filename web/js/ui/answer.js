import { el } from './el.js';
import { cite } from './cite.js';

export function answer(question, sentence, opts = {}) {
  const text = typeof sentence === 'string' ? sentence.trim() : '';
  if (!text) return el('header.simple-heading', { hidden: true });
  return el('header', { class: 'simple-heading' + (opts.class ? ' ' + opts.class : '') },
    el('h1.simple-question.answer-question', question),
    el('p.simple-answer.answer-sentence', { data: { answer: true } }, text),
    opts.sources?.length ? el('div.simple-sources', opts.sources.map(id => cite(id))) : null);
}
