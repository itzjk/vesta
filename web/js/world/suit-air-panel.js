// Collapsed panel for the prediction view (mounted from act-evidence.js beside the gravity-contrast panel): suit pressure, cabin pressure and cabin oxygen, from NASA documents.
// All numbers and sentences come from core/suit-air.js and data/suitair-sources.json; this file only draws them.
import { suitAir } from '../core/suit-air.js?v=suitair-20261115-2';

const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };

const mounted = new WeakMap();
/** One collapsed panel per loaded index; calling again returns the same element. */
export function createSuitAirPanel({ db } = {}) {
  if (db && mounted.has(db)) return mounted.get(db);
  const element = make('details', null, 'op-method suit-air'), body = make('div');
  element.append(make('summary', 'Spacewalk suit pressure and cabin oxygen: what NASA sources state, put side by side'), body);
  let file = null, loading = false;
  const form = make('div', null, 'op-form'), suitLabel = make('label'), suit = make('input'), cabinLabel = make('label', 'Cabin total pressure'), cabin = make('select');
  suit.type = 'range'; suitLabel.append(make('span'), suit); cabinLabel.append(cabin); form.append(suitLabel, cabinLabel);
  const out = make('div'); out.setAttribute('aria-live', 'polite');
  function draw() {
    // Before the first draw the controls hold browser defaults, not cited values, so they are not read.
    const ready = cabin.options.length > 0, view = suitAir(file, db.tests, ready ? { suit: Number(suit.value), cabin: cabin.value } : {});
    if (!ready) {
      for (const item of view.cabins) { const option = make('option', item.label); option.value = item.id; cabin.append(option); }
      suit.min = view.slider.min; suit.max = view.slider.max; suit.step = view.slider.step; suit.value = view.slider.value;
    }
    suitLabel.firstChild.textContent = `Suit pressure: ${view.suit.toFixed(1)} psia`;
    const wrap = make('div', null, 'op-fuels'), table = make('table'), thead = make('thead'), head = make('tr'), tbody = make('tbody');
    for (const text of view.head) { const th = make('th', text); th.scope = 'col'; head.append(th); }
    for (const row of view.rows) { const tr = make('tr'); row.cells.forEach((text, i) => { const cell = make(i ? 'td' : 'th', text); if (!i) cell.scope = 'row'; tr.append(cell); }); tbody.append(tr); }
    thead.append(head); table.append(thead, tbody); wrap.append(table);
    const sources = make('details', null, 'op-method'), list = make('ul'); sources.append(make('summary', `Each constant and its NASA sentence (${view.sources.length})`), list);
    for (const item of view.sources) {
      const li = make('li'), link = make('a', item.where); link.href = item.url; link.rel = 'noopener';
      li.append(make('b', item.value ? `${item.label}: ${item.value}. ` : `${item.label}. `), make('q', item.quote), ' ', link); list.append(li);
    }
    out.replaceChildren(make('p', view.lead, 'op-oxygen-lead'), ...(view.flex_line ? [make('p', view.flex_line)] : []), make('p', view.pressure_line, 'op-limit'), make('p', view.stated_line), wrap,
      make('p', view.formula, 'op-note'), make('p', view.formula_note, 'op-note'), make('p', view.range_line, 'op-note'),
      make('p', view.inspired_line, 'op-note'), make('p', view.check_line, 'op-note'), sources);
  }
  suit.addEventListener('input', draw); cabin.addEventListener('change', draw);
  element.addEventListener('toggle', async () => {
    if (!element.open || file || loading) return;
    loading = true; body.replaceChildren(make('p', 'Loading the NASA source entries…', 'op-note'));
    try {
      const response = await fetch(new URL('../../data/suitair-sources.json?v=suitair-20261115-2', import.meta.url));
      if (!response.ok) throw new Error(String(response.status));
      file = await response.json(); body.replaceChildren(make('p', file.scope, 'op-limit'), form, out); draw();
    } catch { body.replaceChildren(make('p', 'The NASA source entries could not be loaded, so nothing is shown.', 'op-limit')); }
    loading = false;
  });
  if (db) mounted.set(db, element);
  return element;
}
