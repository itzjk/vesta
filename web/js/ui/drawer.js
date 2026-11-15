import { el, clear, fmt, button } from './el.js';
import { chip, tag, levelText, pressureText } from './chip.js';
import { empty } from './empty.js';
import { citeLabel } from './cite.js';
import { sourceLocator } from './source-locator.js?v=expert-20261115-1';
import { getDb, lookup, loadRawCells, openSource, closeSource } from '../store.js';

let host = null, backdrop = null, pane = null, body = null, current = null, lastFocus = null;
const backgroundInert = new Map();

function lockBackground() {
  for (const node of host.children) {
    if (node === pane || node === backdrop) continue;
    if (!backgroundInert.has(node)) backgroundInert.set(node, node.inert);
    node.inert = true;
  }
}

function unlockBackground() {
  for (const [node, wasInert] of backgroundInert) node.inert = wasInert;
  backgroundInert.clear();
}

function focusable() {
  return [...pane.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]')]
    .filter(node => node.tabIndex >= 0 && !node.disabled && !node.closest('[inert]') && node.getClientRects().length
      && getComputedStyle(node).visibility !== 'hidden');
}

function containKeyboard(event) {
  if (current == null) return;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); closeSource();
  } else if (event.key === 'Tab') {
    const stops = focusable(), index = stops.indexOf(document.activeElement);
    if (!stops.length || (event.shiftKey ? index <= 0 : index < 0 || index === stops.length - 1)) {
      event.preventDefault();
      (event.shiftKey ? stops.at(-1) || pane : stops[0] || pane).focus({ preventScroll: true });
    }
  }
}

const GCLASS = { micro: 'microgravity', partial: 'partial gravity', normal: 'normal gravity' };
const isChallenge = f => (f.n && f.n.read_in === 'challenge_page') || (f.source && f.source.kind === 'challenge-page');
const range = (v, unit, digits = 1) => Array.isArray(v) ? `${fmt.short(v[0], digits)} to ${fmt.short(v[1], digits)} ${unit}` : `${fmt.short(v, digits)} ${unit}`;
const NOT_STATED = 'not stated in the source';

function line(label, value, extra) { return el('div.dw-line', el('dt.t-label', label), el('dd', value, extra ? el('span.dw-raw', extra) : null)); }

function findingView(f, db) {
  const n = f.n || {}, src = f.source || {}, challenge = isChallenge(f);
  const level = levelText(f);
  const verified = f.gate ? f.gate.pass === true : null;
  const ctx = !challenge && f.context ? f.context : null;
  const quote = f.quote
    ? el('blockquote.dw-quote', { data: { claim: f.id } },
        ctx && ctx.before ? el('span.dw-context', ctx.before.replace(/\s+$/, '') + ' ') : null,
        el('mark.dw-mark', f.quote),
        ctx && ctx.after ? el('span.dw-context', (/^[.,;:!?)\u201d"']/.test(ctx.after.trimStart()) ? '' : ' ') + ctx.after.trim()) : null)
    : null;
  const cells = Array.isArray(f.cells) && f.cells.length
    ? el('table.dw-table', el('thead', el('tr', el('th', 'Row'), el('th', 'Column'), el('th', 'Cell as PSI gives it'))),
        el('tbody', f.cells.map(c => el('tr', el('td', el('button.dw-rowlink', { type: 'button', onclick: () => openSource(c.row_id) }, citeLabel(c.row_id, db))), el('td', String(c.column)), el('td.t-white', String(c.raw))))))
    : null;
  const pressure = n.p == null ? null : Array.isArray(n.p) ? `${pressureText(n.p[0])} to ${pressureText(n.p[1])}` : pressureText(n.p);
  return [
    el('header.dw-head',
      el('div.dw-kicker', el('span.t-label', f.quote ? 'Finding' : 'Table finding'), f.pillar ? tag(f.pillar) : null, f.topic ? tag(String(f.topic).replace(/_/g, ' '), { tone: 'dim' }) : null),
      el('h2.dw-title', src.title || f.topic?.replace(/_/g, ' ') || 'NASA finding'),
      el('p.dw-id', f.id),
      verified === true ? el('div.dw-verified', { title: 'The quote matches cached source text after the documented Unicode, punctuation and whitespace normalization in research/tools/quotecheck.py' }, el('span.dw-check', { 'aria-hidden': 'true' }), f.quote ? 'quote verified' : 'cells verified against the PSI table') : null),
    challenge ? el('p.dw-note', 'Space Apps challenge page (not a NASA technical document)') : null,
    quote, cells, sourceLocator(f, { instrument: true }),
    ctx ? el('p.dw-hint', 'The highlighted words are the quote. The rest of its sentence is shown in dim text.') : null,
    f.claim ? el('section.dw-sec', el('div.dw-kicker', el('span.t-label', 'Claim'), tag('SI-written claim', { tone: 'cream' })), el('p.dw-claim', f.claim)) : null,
    el('section.dw-sec', el('span.t-label', 'Source'),
      el('dl.dw-list',
        line('Title', src.title || 'not stated'),
        src.year ? line('Year', String(src.year)) : null,
        level ? line('Level', level) : null,
        f.investigation ? line('Investigation', String(f.investigation) + (n.psi_id ? ` (${n.psi_id})` : '')) : null),
      src.url ? el('p.dw-links', button(challenge ? 'Open the challenge page' : 'Open NASA source', { href: src.url, target: '_blank', small: true, icon: '↗' }), el('span.dw-url', src.url)) : null),
    el('section.dw-sec', el('span.t-label', 'Conditions the source states (gated)'),
      el('dl.dw-list',
        line('Gravity', n.gclass ? GCLASS[n.gclass] || n.gclass : NOT_STATED),
        line('Oxygen', n.o2 == null ? NOT_STATED : range(n.o2, '% by volume')),
        line('Pressure', pressure || NOT_STATED),
        n.material_ids && n.material_ids.length ? line('Materials', n.material_ids.join(', ')) : null,
        n.fuel_class ? line('Fuel class', String(n.fuel_class).replace(/_/g, ' ')) : null),
      n.dropped && n.dropped.length ? el('p.dw-hint', `Removed by the conditions gate (the number is not in the quote): ${n.dropped.join(', ')}.`) : null),
  ];
}

function rowView(r, db) {
  const n = r.n || {}, inv = db.invById ? db.invById[r.psi_id] : null;
  const rawBox = el('div.dw-rawcells', el('p.dw-hint', 'Loading the raw cells of this row…'));
  loadRawCells().then(all => {
    const cells = all && (all[r.id] || (all.rows && all.rows[r.id]) || (all.raw && all.raw[r.id]));
    clear(rawBox);
    if (!cells || typeof cells !== 'object') { rawBox.append(el('p.dw-hint', 'The raw cells of this row are not in tests-raw.json.')); return; }
    rawBox.append(el('table.dw-table', el('thead', el('tr', el('th', 'Column of the PSI table'), el('th', 'Cell'))),
      el('tbody', Object.entries(cells).map(([k, v]) => el('tr', el('td', k), el('td.t-white', v == null || v === '' ? el('span.t-dim', 'empty cell') : String(v)))))));
  }, () => { clear(rawBox); rawBox.append(el('p.dw-hint', 'The raw cells did not load (data/tests-raw.json).')); });
  const absent = 'not in the table';
  const o2 = r.o2_percent == null ? absent : `${fmt.short(r.o2_percent, 2)} %`;
  const p = r.pressure_kpa != null ? pressureText(r.pressure_kpa)
          : n.p_inferred != null ? el('span', 'not in the table', el('span.dw-inferred', ` · inferred from the facility: ${pressureText(n.p_inferred)}`)) : absent;
  const facilitySource = n.p_inferred_source?.gate?.pass === true ? n.p_inferred_source : null;
  const outcomes = Object.entries(r.outcomes || {});
  const multi = Object.entries(r.multi || {});
  return [
    el('header.dw-head',
      el('div.dw-kicker', el('span.t-label', 'PSI test row'), n.fuel_class ? tag(String(n.fuel_class).replace(/_/g, ' ')) : null, r.row_kind ? tag(String(r.row_kind).replace(/_/g, ' '), { tone: 'dim' }) : null),
      el('h2.dw-title', (inv && (inv.name || inv.full_name)) || r.investigation || 'PSI test row'),
      el('p.dw-id', { data: { claim: r.id } }, `${r.psi_id}, row ${r.row}`)),
    el('section.dw-sec', el('span.t-label', 'Where it stands in PSI'),
      el('dl.dw-list', line('PSI id', r.psi_id), line('Table file', r.table_file || 'not stated'), line('Row', String(r.row)), r.test_label ? line('Test label', String(r.test_label)) : null)),
    el('section.dw-sec', el('span.t-label', 'Normalised value · raw cell'),
      el('dl.dw-list',
        line('Fuel', r.fuel ?? absent, r.fuel_raw != null ? `raw: ${r.fuel_raw}` : null),
        line('Oxygen', o2, r.o2_raw != null ? `raw: ${r.o2_raw}` : null),
        line('Oxygen basis', r.o2_basis ? (r.o2_basis === 'burner_stream' ? 'burner stream (the gas fed through the burner; never plotted as cabin air)' : String(r.o2_basis)) : absent),
        line('Pressure', p, r.pressure_raw != null ? `raw: ${r.pressure_raw}` : null),
        line('Flow', r.flow_cm_s == null ? absent : `${fmt.short(r.flow_cm_s, 2)} cm/s${r.flow_direction ? ' · ' + r.flow_direction : ''}`, r.flow_raw != null ? `raw: ${r.flow_raw}` : null),
        line('Gravity', r.gravity ?? absent),
        r.fuel_form ? line('Form', String(r.fuel_form) + (r.fuel_size ? ` · ${r.fuel_size}` : '')) : null,
        r.diluent ? line('Diluent', String(r.diluent)) : null,
        r.platform ? line('Platform', String(r.platform)) : null),
      multi.length ? el('p.dw-hint', 'Several values in one cell: ' + multi.map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join('; ') : JSON.stringify(v)}`).join(' · ')) : null),
    facilitySource ? el('section.dw-sec.dw-facility',
      el('h3.t-label', 'Why pressure is inferred'),
      el('p.dw-hint', facilitySource.assumption),
      el('blockquote.dw-quote', el('mark.dw-mark', facilitySource.quote)),
      el('p.dw-sub', facilitySource.title, facilitySource.year ? ` (${facilitySource.year})` : ''),
      facilitySource.url ? button('NASA facility source', { href: facilitySource.url, target: '_blank', small: true, icon: '↗' }) : null) : null,
    outcomes.length ? el('section.dw-sec', el('span.t-label', 'What the table recorded'),
      el('dl.dw-list', outcomes.map(([k, o]) => line(k.replace(/_/g, ' '), o && o.value != null ? `${typeof o.value === 'number' ? fmt.short(o.value, 3) : o.value}${o.unit ? ' ' + o.unit : ''}` : (o && o.raw != null ? String(o.raw) : absent), o && o.raw != null ? `raw: ${o.raw}` : null)))) : null,
    el('section.dw-sec', el('span.t-label', 'Raw cells'), rawBox),
    el('section.dw-sec', el('p.dw-links',
      inv && inv.psi_url ? button('PSI record', { href: inv.psi_url, target: '_blank', small: true, icon: '↗' }) : null,
      button(`Rows CSV (${r.psi_id})`, { href: `api/v1/tests/${r.psi_id}.csv`, target: '_blank', small: true, icon: '↓' })),
      el('p.dw-hint', 'NASA PSI data, CC0-1.0. A table row cites as PSI id, table file and row.')),
  ];
}

function configView(record) {
  return [
    el('header.dw-head', el('span.t-label', record.kind || 'Source'), el('h2.dw-title', record.label || record.id), tag(record.id)),
    record.scope ? el('p.dw-note', record.scope) : null,
    ...(record.sources || []).map(source => el('section.dw-sec',
      el('div.dw-kicker', el('span.t-label', source.field || 'Source'), source.gate?.pass === true ? tag('quote verified') : null),
      source.kind === 'challenge-page' ? el('p.dw-note', 'Space Apps challenge page (not a NASA technical document)') : null,
      source.quote ? el('blockquote.dw-quote', el('mark.dw-mark', source.quote)) : null,
      el('dl.dw-list', line('Title', source.title || 'not stated in the source'), source.year ? line('Year', String(source.year)) : null),
      source.url ? el('p.dw-links', button('Open source', { href: source.url, target: '_blank', small: true }), el('span.dw-url', source.url)) : null))
  ];
}

function render(id) {
  const db = getDb();
  clear(body);
  const hit = lookup(id, db);
  pane.dataset.kind = hit ? hit.kind : 'none';
  pane.dataset.source = id;
  if (!hit) { body.append(el('header.dw-head', el('span.t-label', 'Source'), el('h2.dw-id', String(id))), empty('none', 'No source with this id in VESTA’s evidence base. Nothing is shown without its source.')); return; }
  body.append(...(hit.kind === 'finding' ? findingView(hit.finding, db) : hit.kind === 'config' ? configView(hit.record) : rowView(hit.row, db)).filter(Boolean));
  body.scrollTop = 0;
}

export const drawer = {
  
  mount(stage) {
    if (pane) return;
    host = stage;
    backdrop = el('div#drawer-backdrop', { hidden: true, onclick: () => closeSource() });
    body = el('div.dw-body');
    pane = el('aside#drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Source', hidden: true, tabindex: -1 },
      el('i.bk.bk-tl'), el('i.bk.bk-bl'),
      el('button.dw-close', { type: 'button', 'aria-label': 'Close the source drawer', title: 'Close (Esc)', onclick: () => closeSource() }, '×'),
      body);
    host.append(backdrop, pane);
    document.addEventListener('keydown', containKeyboard, true);
    document.addEventListener('focusin', event => {
      if (current != null && !pane.contains(event.target)) (focusable()[0] || pane).focus({ preventScroll: true });
    });
  },
  
  show(id) {
    if (!pane) return;
    if (current === id && !pane.hidden) return;
    if (current == null) lastFocus = document.activeElement;
    current = id; render(id);
    backdrop.hidden = false; pane.hidden = false;
    lockBackground();
    requestAnimationFrame(() => { pane.classList.add('is-open'); backdrop.classList.add('is-open'); });
    pane.focus({ preventScroll: true });
  },
  hide() {
    if (!pane || current == null) return;
    current = null;
    pane.classList.remove('is-open'); backdrop.classList.remove('is-open');
    pane.hidden = true; backdrop.hidden = true;
    unlockBackground();
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch {} }
  },
  
  open(id) { openSource(id); },
  close() { closeSource(); },
  isOpen: () => current != null,
  current: () => current,
};
