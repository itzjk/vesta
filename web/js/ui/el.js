// DOM helpers shared by the shell and every view. No framework.
const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(node, attrs, isSvg) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') { for (const c of String(v).split(/\s+/)) if (c) node.classList.add(c); }
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'style') { if (typeof v === 'string') node.setAttribute('style', v); else for (const [p, x] of Object.entries(v)) { if (x == null) continue; p.startsWith('--') ? node.style.setProperty(p, x) : (node.style[p] = x); } }
    else if (k === 'data') { for (const [d, x] of Object.entries(v)) if (x != null && x !== false) node.setAttribute('data-' + d.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), x === true ? '' : String(x)); }
    else if (k === 'on') { for (const [ev, fn] of Object.entries(v)) if (typeof fn === 'function') node.addEventListener(ev, fn); }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') ) { node[k] = v; if (k !== 'value') node.setAttribute(k, ''); }
    else node.setAttribute(k, String(v));
  }
}
function add(node, kids) {
  for (const c of kids) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) add(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
function make(create, spec, rest, isSvg) {
  const m = String(spec).match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/);
  const node = create(m && m[1] ? m[1] : 'div');
  if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) part[0] === '#' ? (node.id = part.slice(1)) : node.classList.add(part.slice(1));
  let kids = rest;
  const a = rest[0];
  if (a && typeof a === 'object' && !(a instanceof Node) && !Array.isArray(a)) { apply(node, a, isSvg); kids = rest.slice(1); }
  add(node, kids);
  return node;
}

/** el('div.card#x', { data: { view: 'brief' }, onclick: fn }, 'text', child, [more]) */
export const el = (spec, ...rest) => make(t => document.createElement(t), spec, rest, false);
/** svg('circle', { cx: 4, cy: 4, r: 2 }) */
export const svg = (spec, ...rest) => make(t => document.createElementNS(SVG_NS, t), spec, rest, true);

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

const sheets = new Map();
/** Adds a stylesheet once. The path is relative to index.html: css('css/views/design.css'). */
export function css(path) {
  if (sheets.has(path)) return sheets.get(path);
  const p = new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = path;
    link.onload = () => resolve(true); link.onerror = () => resolve(false);
    document.head.append(link);
  });
  sheets.set(path, p);
  return p;
}

/** True when frames must be deterministic (capture=1) or the person asked for no motion. */
export const still = () => document.documentElement.hasAttribute('data-capture') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const pad = n => String(n).padStart(2, '0');
export const fmt = {
  /** A number with a fixed count of decimals and thousands separators; null prints nothing (the caller says why it is absent). */
  n(x, digits = 0) { return typeof x === 'number' && isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : ''; },
  /** As short as the value allows: 34, 22.2, 56.5 */
  short(x, max = 1) { return typeof x === 'number' && isFinite(x) ? String(Math.round(x * 10 ** max) / 10 ** max) : ''; },
  pct(x, digits = 1) { return typeof x === 'number' && isFinite(x) ? fmt.short(x, digits) + ' %' : ''; },
  /** Seconds since the alarm as T+04:00 (T-00:30 before it). */
  time(s) { if (typeof s !== 'number' || !isFinite(s)) return ''; const a = Math.abs(Math.round(s)); return (s < 0 ? 'T-' : 'T+') + pad(Math.floor(a / 60)) + ':' + pad(a % 60); },
  mmss(s) { if (typeof s !== 'number' || !isFinite(s)) return ''; const a = Math.abs(Math.round(s)); return pad(Math.floor(a / 60)) + ':' + pad(a % 60); },
  /** An ISO time printed in Eastern time: 2026-11-14 13:40 EST */
  est(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.timeZoneName}`;
  },
  estClock(iso) { const s = fmt.est(iso); return s ? s.slice(11) : ''; },
};

/** A button or a link that looks like one. The one amber filled button per screen is opts.primary. */
export function button(label, opts = {}) {
  const attrs = { class: 'btn' + (opts.primary ? ' btn-primary' : '') + (opts.small ? ' btn-small' : '') + (opts.class ? ' ' + opts.class : ''), title: opts.title, data: { ...(opts.data || {}), action: opts.action } };
  const kids = [opts.icon ? el('span.btn-icon', { 'aria-hidden': 'true' }, opts.icon) : null, el('span.btn-label', label)];
  if (opts.href) return el('a', { ...attrs, href: opts.href, target: opts.target, rel: opts.target === '_blank' ? 'noopener' : null, download: opts.download, onclick: opts.onClick }, kids);
  return el('button', { ...attrs, type: 'button', disabled: opts.disabled || null, onclick: opts.onClick }, kids);
}
