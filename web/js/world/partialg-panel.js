// A view only: every sentence and number comes from core/partialg.js, which reads web/data/partialg-sources.json.
import { partialGravity, marginText } from '../core/partialg.js';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const link = (text, url) => { const a = node('a', text); a.href = url; a.rel = 'noopener'; a.target = '_blank'; return a; };
function ensureStyles() {
  if (document.querySelector('link[data-partialg-styles]')) return;
  const sheet = node('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/partialg.css?v=1', import.meta.url).href;
  sheet.dataset.partialgStyles = ''; document.head.append(sheet);
}
const fetchSources = () => fetch(new URL('../../data/partialg-sources.json', import.meta.url)).then(response => {
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
});

/** Collapsed <details>. The source file is read once, the first time the panel is opened (or at once when `sources` is passed). */
export function createPartialGravityPanel({ db, sources = null, load = fetchSources } = {}) {
  ensureStyles();
  const element = node('details', null, 'next-experiments partialg');
  const summary = node('summary', 'What NASA measured at lunar and Martian gravity'), body = node('div', null, 'next-experiments-body partialg-body');
  element.append(summary, body);
  let model = null, started = false;

  function render(data) {
    model = partialGravity(data, { rows: db?.tests ?? null });
    summary.textContent = model.heading;
    if (!model.ok) { body.replaceChildren(node('p', model.reason, 'next-experiments-note')); return model; }
    const source = node('p', 'Source: ', 'next-experiments-note');
    source.append(link(model.document.title, model.document.record_url), document.createTextNode(` (${model.document.authors}, ${model.document.year}), ${model.table.location}: “${model.table.title}”. `), link('PDF as fetched', model.document.url));
    const nodes = [node('p', model.lead, 'next-experiments-lead'), source];
    const scroll = node('div', null, 'partialg-scroll'), table = node('table', null, 'partialg-table');
    const head = node('tr');
    for (const key of ['level', 'moc', 'uloi', 'bar', 'margin']) { const th = node('th', model.columns[key]); th.scope = 'col'; head.append(th); }
    const thead = node('thead'); thead.append(head); table.append(node('caption', `Limiting oxygen, ${model.table.unit}, as printed in ${model.table.location}.`), thead);
    for (const item of model.items) {
      const tbody = node('tbody'), title = node('tr', null, 'partialg-material'), th = node('th', `${item.label}${item.pressure_psia == null ? '' : ` · tested at ${item.pressure_psia} psia`}`);
      th.colSpan = 5; th.scope = 'rowgroup'; title.append(th); tbody.append(title);
      for (const level of item.levels) {
        const tr = node('tr'), name = node('th', level.label); name.scope = 'row'; if (level.gravity === 'moon' || level.gravity === 'mars') tr.className = 'partialg-partial';
        const moc = node('td', level.moc.text, 'partialg-num'), uloi = node('td', level.uloi.text, 'partialg-num'); moc.title = `“${level.moc.quote}”`; uloi.title = `“${level.uloi.quote}”`;
        const track = node('span', null, 'partialg-track'), bar = node('span', null, 'partialg-bar');
        bar.style.left = `${(level.bar.from * 100).toFixed(1)}%`; bar.style.width = `${Math.max((level.bar.to - level.bar.from) * 100, 1).toFixed(1)}%`;
        track.setAttribute('role', 'img'); track.setAttribute('aria-label', `${level.moc.text} to ${level.uloi.text} percent oxygen`); track.append(bar);
        const cell = node('td'); cell.append(track);
        const margin = node('td', marginText(level.margin), 'partialg-num'); if (level.margin?.stated_quote) margin.title = `“${level.margin.stated_quote}”`;
        tr.append(name, moc, uloi, cell, margin); tbody.append(tr);
      }
      table.append(tbody);
    }
    scroll.append(table); nodes.push(scroll, node('p', model.margin_note, 'next-experiments-note'));
    nodes.push(node('h3', 'How the report defines these limits, in its own words'));
    const list = node('ul', null, 'partialg-notes');
    for (const entry of model.notes) { const li = node('li'); li.append(node('strong', `${entry.label}: `), document.createTextNode(`“${entry.quote}” (${entry.location})`)); list.append(li); }
    nodes.push(list);
    for (const other of model.also_read) { const p = node('p', 'Also read, no value transcribed: ', 'next-experiments-note'); p.append(link(other.title, other.url), document.createTextNode(`. ${other.why_not_shown}`)); nodes.push(p); }
    nodes.push(node('p', model.scope, 'next-experiments-limits'));
    body.replaceChildren(...nodes);
    return model;
  }
  function start() {
    if (started) return; started = true;
    body.replaceChildren(node('p', 'Loading the NASA report values.', 'next-experiments-note'));
    Promise.resolve().then(load).then(render).catch(() => { started = false; body.replaceChildren(node('p', 'The NASA report values could not be loaded. Close and reopen to retry.', 'next-experiments-note')); });
  }
  const onToggle = () => { if (element.open) start(); };
  element.addEventListener('toggle', onToggle);
  if (sources) { started = true; render(sources); }
  return { element, render, get model() { return model; }, destroy() { element.removeEventListener('toggle', onToggle); element.remove(); } };
}
