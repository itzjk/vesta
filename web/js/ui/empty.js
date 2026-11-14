// The designed empty states of DESIGN.md 2.8. Each is a state with a sentence, not an error.
import { el, svg, button } from './el.js';

const ICON = {
  load:        'M12 3v10m0 4v.5M4.5 20.5h15L12 3z',                         // the evidence did not load
  none:        'M4 6h16M4 12h10M4 18h6',                                    // nothing verified for this selection
  gap:         'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',                      // never tested: a hollow dot
  feed:        'M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM4 11a9 9 0 0 1 9 9M4 5a15 15 0 0 1 15 15',
  placeholder: 'M5 5h14v14H5zM9 9h6v6H9z',
};

/** empty('none', 'No verified finding for detection in VESTA’s evidence base (24 PSI investigations).', { label, onClick | href } | node) */
export function empty(kind, text, action) {
  const k = ICON[kind] ? kind : 'none';
  const act = !action ? null : action instanceof Node ? action : button(action.label, { onClick: action.onClick, href: action.href, action: action.action, primary: action.primary });
  return el('div', { class: 'empty empty-' + k, data: { empty: k }, role: 'status' },
    svg('svg.empty-icon', { viewBox: '0 0 24 24', width: 28, height: 28, 'aria-hidden': 'true' }, svg('path', { d: ICON[k], fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })),
    el('p.empty-text', text instanceof Node ? text : String(text ?? '')),
    act ? el('div.empty-action', act) : null);
}
