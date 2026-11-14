// A thin track with a glowing segment for a tested range; several values in one cell as ticks; hollow when inferred;
// text when the table has no value (DESIGN.md 6.3). Bars that share an axis must be given the same axisMin and axisMax.
import { el } from './el.js';
import { fmt } from './el.js';

/** rangebar(13.6, 22.2, 0, 100, { unit: '%', multi: [21, 26.5, 34, 40], inferred, mark: 34, nullText, digits, label }) */
export function rangebar(min, max, axisMin, axisMax, opts = {}) {
  const multi = Array.isArray(opts.multi) ? opts.multi.filter(x => typeof x === 'number' && isFinite(x)) : [];
  const has = typeof min === 'number' && isFinite(min);
  if (!has && !multi.length) return el('div.rangebar.rangebar-null', { data: { empty: 'true' } }, el('span.rangebar-text', opts.nullText || 'not in the table'));
  const lo = has ? min : Math.min(...multi), hi = has ? (typeof max === 'number' && isFinite(max) ? max : min) : Math.max(...multi);
  const span = (axisMax - axisMin) || 1, pos = x => Math.max(0, Math.min(100, (x - axisMin) / span * 100));
  const d = opts.digits ?? 1, unit = opts.unit ? ' ' + opts.unit : '';
  const label = opts.label ?? (multi.length && !has ? multi.map(x => fmt.short(x, d)).join('; ') + unit
              : lo === hi ? fmt.short(lo, d) + unit : `${fmt.short(lo, d)}–${fmt.short(hi, d)}${unit}`);
  const track = el('div.rangebar-track');
  if (has) track.append(el('span', { class: 'rangebar-seg' + (opts.inferred ? ' rangebar-hollow' : '') + (lo === hi ? ' rangebar-point' : ''), style: { left: pos(lo) + '%', width: Math.max(0, pos(hi) - pos(lo)) + '%' } }));
  for (const x of multi) track.append(el('span.rangebar-tick', { style: { left: pos(x) + '%' }, title: fmt.short(x, d) + unit }));
  if (typeof opts.mark === 'number') track.append(el('span.rangebar-mark', { style: { left: pos(opts.mark) + '%' }, title: 'your cabin: ' + fmt.short(opts.mark, d) + unit }));
  return el('div', { class: 'rangebar' + (opts.inferred ? ' is-inferred' : ''), title: opts.title, data: { min: lo, max: hi } }, track, opts.label === '' ? null : el('span.rangebar-text.num', label + (opts.inferred ? ' (inferred)' : '')));
}
