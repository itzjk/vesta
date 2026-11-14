import { el } from './el.js';
import { openSource, getDb, lookup } from '../store.js';


export function citeLabel(id, db = getDb()) {
  const hit = lookup(id, db);
  if (hit && hit.kind === 'row' && hit.row.psi_id != null && hit.row.row != null) return `${hit.row.psi_id}, row ${hit.row.row}`;
  if (hit && hit.kind === 'finding') return String(id);
  if (hit && hit.kind === 'config') return hit.record.short || hit.record.label || String(id);
  const m = String(id).match(/^(PSI-\d+)(?::.+)?:(\d+)$/);
  return m ? `${m[1]}, row ${m[2]}` : String(id);
}


export function cite(id, opts = {}) {
  const sid = String(id);
  return el('button', { class: 'cite' + (opts.small ? ' cite-small' : '') + (opts.class ? ' ' + opts.class : ''), type: 'button', data: { cite: sid },
    title: opts.title || 'Open the source', 'aria-label': 'Open the source of ' + sid,
    onclick: e => { e.preventDefault(); e.stopPropagation(); openSource(sid); } },
    el('span.cite-mark', { 'aria-hidden': 'true' }), el('span.cite-id', opts.label || citeLabel(sid)), el('span.cite-plain', 'source'));
}
