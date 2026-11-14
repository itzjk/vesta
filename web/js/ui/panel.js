// The hologram panel: thin frame, four corner brackets, soft edge glow. The active or decision panel is opts.strong.
import { el } from './el.js';

/** panel('RANKED EVIDENCE', body, { strong, tag, actions: [nodes], class, id, data, scroll, tone }) -> <section class="panel">; .bodyEl is the body node */
export function panel(title, body, opts = {}) {
  const head = title == null && !opts.tag && !opts.actions ? null : el('header.panel-head',
    title == null ? null : (title instanceof Node ? title : el('h2.panel-title', String(title))),
    opts.tag ? (opts.tag instanceof Node ? opts.tag : el('span.panel-tag', String(opts.tag))) : null,
    opts.actions ? el('div.panel-actions', opts.actions) : null);
  const bodyEl = el('div', { class: 'panel-body' + (opts.scroll ? ' panel-scroll' : '') }, body);
  const node = el('section', { class: 'panel' + (opts.strong ? ' panel-strong' : '') + (opts.tone ? ' panel-' + opts.tone : '') + (opts.class ? ' ' + opts.class : ''), id: opts.id, data: opts.data },
    el('i.bk.bk-tl', { 'aria-hidden': 'true' }), el('i.bk.bk-tr', { 'aria-hidden': 'true' }), el('i.bk.bk-bl', { 'aria-hidden': 'true' }), el('i.bk.bk-br', { 'aria-hidden': 'true' }),
    head, bodyEl);
  node.bodyEl = bodyEl;
  return node;
}
