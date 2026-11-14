import { getDb } from '../store.js';

const base = new URL('../../assets/nasa/media/', import.meta.url);
let catalog = null, loading = null, active = null, serial = 0;
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };

async function load() {
  if (catalog) return catalog;
  if (!loading) loading = fetch(new URL('media.json', base), { signal: AbortSignal.timeout(10000) }).then(async response => {
    if (!response.ok) throw new Error(`NASA picture index: HTTP ${response.status}`);
    const file = await response.json();
    if (!Array.isArray(file.images)) throw new Error('NASA picture index is invalid');
    catalog = file; return file;
  }).catch(error => { loading = null; throw error; });
  return loading;
}

function imagesFor(id) { return (catalog?.images || []).filter(image => image.psi_id === id).map(image => ({ ...image, src: new URL(image.file, base).href })); }

function style() {
  if (document.getElementById('nasa-media-style')) return;
  const el = node('style'); el.id = 'nasa-media-style';
  el.textContent = `
.nasa-media{box-sizing:border-box;padding:18px 20px;color:#ede4d4;background:rgba(18,16,14,.97);font:400 18px/1.4 var(--font-body,system-ui,sans-serif);max-width:100%;overflow-y:auto;overscroll-behavior:contain;max-height:70dvh}.nasa-media h2{margin:0;font-size:20px;line-height:1.3;font-weight:600}.nasa-media-top{position:sticky;top:0;z-index:1;background:#12100e;display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px}.nasa-media .nasa-media-top h2{font-size:20px!important;line-height:1.3!important;margin:0!important}.nasa-media button,.nasa-media-link{min-height:44px;padding:8px 12px;font:inherit;color:#ede4d4;border:1px solid #8f877b;border-radius:0;background:#211e1b;cursor:pointer}.nasa-media button:focus-visible,.nasa-media a:focus-visible{outline:2px solid #ede4d4;outline-offset:2px}.nasa-media>.world-panel-close{display:none}.nasa-media figure{margin:0}.nasa-media img{display:block;object-fit:contain;background:#07080b;width:100%;max-height:38dvh}.nasa-media img[hidden]{display:none}.nasa-media figcaption{margin-top:12px;font-size:18px;line-height:1.4;overflow-wrap:anywhere}.nasa-media a{color:#ede4d4;text-underline-offset:4px}.nasa-media p{margin:12px 0}.nasa-media-pager{display:flex;align-items:center;gap:12px;margin-top:14px}.nasa-media-pager span{font-size:14px}.nasa-media-credit{font-size:14px!important;color:#bdb3a3}.nasa-media-dialog{position:fixed;inset:10vh 24px auto auto;width:min(540px,calc(100vw - 48px));max-width:none;padding:0;border:0;background:transparent;color:#ede4d4}.nasa-media-dialog::backdrop{background:rgba(0,0,0,.45)}
@media(max-width:759px){.nasa-media{padding:16px;max-height:58dvh}.nasa-media img{max-height:26dvh}.nasa-media-dialog{inset:auto 12px 20px;width:calc(100vw - 24px);margin:0}.nasa-media h2{font-size:18px}}
`;
  document.head.append(el);
}

export function close() { serial++; active?.close(); }

async function open(id, options = {}) {
  const token = ++serial;
  active?.close();
  style();
  const trigger = options.trigger || document.activeElement;
  const title = getDb()?.invById?.[id]?.name || id;
  const panel = node('section', null, 'nasa-media'); panel.setAttribute('aria-label', `${title}, NASA pictures`); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.dataset.nasaMedia = id;
  const top = node('div', null, 'nasa-media-top'), heading = node('h2', title), dismiss = node('button', 'Close'); dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Close NASA pictures'); top.append(heading, dismiss);
  const body = node('div'); panel.append(top, body);
  let handle, dialog, observer, closed = false, items = [], index = 0;
  const disposers = [];
  const on = (el, event, fn, options) => { el.addEventListener(event, fn, options); disposers.push(() => el.removeEventListener(event, fn, options)); };
  const session = { panel, close() {
    if (closed) return; closed = true;
    disposers.forEach(fn => fn()); observer?.disconnect(); handle?.dispose?.(); dialog?.remove();
    if (active === session) active = null;
    const restore = trigger?.isConnected && !trigger.closest('[inert],[hidden]') ? trigger : options.world?.host?.querySelector('[data-evidence-tool=compare],.world-marker:not([hidden])');
    restore?.focus({ preventScroll: true });
  } };
  active = session; dismiss.onclick = session.close;
  body.append(node('p', 'Loading NASA pictures…'));
  if (options.world?.hologram) {
    handle = options.world.hologram(panel, { at: [0, .2, 2], width: 540, dock: 'right', label: `${title}, NASA pictures`, marker: false });
    handle.toggle ? handle.toggle() : handle.open();
    options.world.invalidate?.();
    observer = new MutationObserver(() => { if (panel.hidden || panel.getAttribute('aria-hidden') === 'true' || !panel.isConnected) session.close(); });
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  } else {
    dialog = node('dialog', null, 'nasa-media-dialog'); dialog.append(panel); document.body.append(dialog); dialog.showModal();
    on(dialog, 'cancel', event => { event.preventDefault(); session.close(); });
    on(dialog, 'click', event => { if (event.target === dialog) session.close(); });
  }
  const focusables = () => [...panel.querySelectorAll('button:not([disabled]),a[href]')];
  on(document, 'keydown', event => {
    if (closed) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); session.close(); }
    if (event.key === 'Tab') {
      const list = focusables(), first = list[0], last = list.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
  }, true);
  on(document, 'pointerdown', event => { if (!panel.contains(event.target) && !trigger?.contains?.(event.target)) session.close(); }, true);
  on(window, 'hashchange', session.close);
  on(window, 'vesta:cite', event => { if (event.detail?.open) session.close(); });
  requestAnimationFrame(() => { if (!closed) dismiss.focus({ preventScroll: true }); });
  function render() {
    body.replaceChildren();
    if (!items.length) { body.append(node('p', 'No reviewed NASA picture is available for this investigation.')); return; }
    const item = items[index], figure = node('figure'), image = node('img'); image.src = item.src; image.alt = item.title; image.decoding = 'async'; image.addEventListener('load', () => options.world?.invalidate?.(), { once: true });
    image.addEventListener('error', () => { image.hidden = true; figure.prepend(node('p', 'This NASA picture could not be loaded.')); options.world?.invalidate?.(); }, { once: true });
    const caption = node('figcaption', item.title), credit = node('p', null, 'nasa-media-credit'), link = node('a', item.credit || 'NASA'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.append(link, ` · ${item.nasa_id}`);
    figure.append(image, caption, credit); body.append(figure);
    if (items.length > 1) {
      const pager = node('div', null, 'nasa-media-pager');
      const prev = node('button', 'Previous'), next = node('button', 'Next'), count = node('span', `${index + 1} / ${items.length}`);
      prev.type = next.type = 'button'; prev.disabled = index === 0; next.disabled = index === items.length - 1; count.setAttribute('aria-live', 'polite');
      prev.onclick = () => { index--; render(); panel.querySelector('.nasa-media-pager button')?.focus(); };
      next.onclick = () => { index++; render(); panel.querySelector('.nasa-media-pager button:last-child')?.focus(); };
      pager.append(prev, count, next); body.append(pager);
    }
    options.world?.invalidate?.();
  }
  try { await load(); if (closed || token !== serial) return session; items = imagesFor(id); render(); }
  catch { if (!closed) { body.replaceChildren(node('p', 'NASA pictures are unavailable. Try again.')); const retry = node('button', 'Retry'); retry.type = 'button'; retry.onclick = () => open(id, options); body.append(retry); options.world?.invalidate?.(); } }
  return session;
}

function button(id, options = {}) {
  const el = node('button', 'NASA pictures', 'nasa-media-link'); el.type = 'button'; el.dataset.nasaPictures = id;
  el.onclick = event => { event.stopPropagation(); open(id, { ...options, trigger: el }); }; return el;
}

export const media = { load, for: imagesFor, open, close, button };
export { load, imagesFor as forInvestigation, open, button };
export default media;
