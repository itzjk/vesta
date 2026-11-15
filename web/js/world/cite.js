import { renderObservationLens } from './observation-lens.js';
import { el, css } from '../ui/el.js';
import { getDb, getCore, lookup, loadRawCells } from '../store.js';
import { sourceLocator } from '../ui/source-locator.js?v=sebas-20261115-1';

let binding = null, active = null, serial = 0;
const flags = () => new URLSearchParams(location.hash.split('?')[1] || '');
const quiet = () => flags().get('capture') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const sourceLink = (url, label) => /^https:\/\//i.test(url || '')
  ? el('a.wc-original', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label)
  : null;
const field = (label, value) => value == null || value === '' ? null : [el('dt', label), el('dd', String(value))];
const sentence = (quote, context) => el('blockquote.wc-sentence',
  context?.before ? el('span.wc-context', context.before.trimEnd() + ' ') : null,
  el('mark', quote),
  context?.after ? el('span.wc-context', (/^[.,;:!?)\u201d"']/.test(context.after.trimStart()) ? '' : ' ') + context.after.trim()) : null);

function findingContent(f, text, db) {
  const n = f.n || {}, src = f.source || {};
  const cells = f.cells?.length ? el('dl.wc-values', f.cells.map(c => field(c.column, c.raw))) : null;
  return [
    el('p.wc-kind', f.quote ? 'Quoted evidence' : 'NASA PSI table cells'),
    el('h2.wc-title', { id: 'wc-source-title' }, src.title || f.title || 'NASA evidence'),
    f.quote ? sentence(f.quote, f.context) : cells,
    src.kind === 'challenge-page' || n.read_in === 'challenge_page' ? el('p.wc-scope', 'Space Apps challenge page, not a NASA technical document.') : null,
    el('p.wc-level', text.level?.(f) || f.evidence_level || text.NOT_IN_SOURCE),
    el('p.wc-gate', f.gate?.pass === true ? (f.quote ? 'Quote matches cached source text after normalization.' : 'Cells verified against the PSI table.') : 'This record has not passed the evidence gate.'),
    sourceLocator(f),
    sourceLink(src.url, src.kind === 'challenge-page' ? 'Read the original challenge page ↗' : 'Read the original at NASA ↗'),
    el('details.wc-identifiers', el('summary', 'Identifiers and conditions'),
      el('dl.wc-values', field('Finding', f.id), field('Year', src.year), field('Investigation', f.investigation),
        field('Gravity', n.gclass ? text.gravity?.(n.gclass) || n.gclass : text.NOT_IN_SOURCE),
        field('Oxygen', text.oxygen?.(n.o2, text.NOT_IN_SOURCE)), field('Pressure', text.pressure?.(n.p, text.NOT_IN_SOURCE))),
      f.cells?.length ? el('ul.wc-row-links', f.cells.map(c => el('li', cite(`${c.column}: ${c.raw}`, c.row_id)))) : null),
    el('p.wc-scope', text.STATUS_LINE)
  ];
}

function rowContent(row, text, db, session) {
  const inv = db.invById?.[row.psi_id], n = row.n || {}, absent = text.NOT_IN_TABLE || 'not in the table';
  const raw = el('div.wc-raw', el('p', 'Loading the original table cells…'));
  loadRawCells().then(all => {
    if (active !== session) return;
    const cells = all?.[row.id] || all?.rows?.[row.id] || all?.raw?.[row.id];
    raw.replaceChildren(cells && typeof cells === 'object'
      ? el('dl.wc-values', Object.entries(cells).map(([key, value]) => field(key, value == null || value === '' ? 'empty cell' : value)))
      : el('p', 'The raw cells of this row are unavailable in the evidence base.'));
  }, () => { if (active === session) raw.replaceChildren(el('p', 'The original table cells could not be loaded.')); });
  return [
    el('p.wc-kind', 'NASA PSI test row'),
    el('h2.wc-title', { id: 'wc-source-title' }, inv?.name || inv?.full_name || row.investigation || 'Recorded test conditions'),
    el('p.wc-scope', { style: { overflowWrap: 'anywhere' } }, `${row.table_file || 'Table file not recorded'} · row ${row.row ?? 'not recorded'} · ${row.id}`),
    el('p.wc-level', 'A recorded table row, not a safety certification.'),
    el('dl.wc-values', field('Fuel', row.fuel ?? absent), field('Oxygen', text.oxygen?.(row.o2_percent, absent)),
      field('Oxygen basis', row.o2_basis === 'burner_stream' ? 'Gas fed through the burner, not cabin air' : row.o2_basis || absent),
      field('Pressure', text.pressure?.(row.pressure_kpa, absent)), field('Gravity', row.gravity ?? absent),
      field('Airflow', row.flow_cm_s == null ? absent : `${row.flow_cm_s} cm/s${row.flow_direction ? ' · ' + row.flow_direction : ''}`)),
    n.p_inferred != null ? el('p.wc-scope', `Pressure is not reported in the table. The facility-based inference is ${text.pressure?.(n.p_inferred)}.`) : null,
    n.p_inferred_source ? el('section', sentence(n.p_inferred_source.quote, n.p_inferred_source.context),
      el('p.wc-scope', n.p_inferred_source.assumption), sourceLink(n.p_inferred_source.url, 'Read the NASA facility evidence ↗')) : null,
    renderObservationLens({ row, db, text, cite }),
    Object.entries(row.outcomes || {}).length ? el('section', el('h3', 'What the table recorded'), el('dl.wc-values',
      Object.entries(row.outcomes).map(([key, value]) => field(key.replace(/_/g, ' '), value?.value == null ? value?.raw ?? absent : `${value.value}${value.unit ? ' ' + value.unit : ''}`)))) : null,
    sourceLink(inv?.psi_url, 'Open the original PSI record ↗'),
    el('details.wc-identifiers', el('summary', 'Identifiers and original cells'),
      el('dl.wc-values', field('PSI record', row.psi_id), field('Table file', row.table_file), field('Row', row.row), field('Row id', row.id), field('Test label', row.test_label)), raw),
    el('p.wc-scope', text.STATUS_LINE)
  ];
}

function configContent(record) {
  return [el('p.wc-kind', 'Cabin evidence'), el('h2.wc-title', { id: 'wc-source-title' }, record.label || record.short || 'Cabin conditions'),
    record.scope ? el('p.wc-scope', record.scope) : null,
    ...(record.sources || []).map(src => el('section.wc-record', sentence(src.quote, src.context),
      el('p.wc-level', src.kind === 'ntrs' ? 'Cabin reference condition · read in a NASA technical report' : src.kind === 'challenge-page' ? 'Cabin reference condition · read in the challenge page' : 'Cabin reference condition · read in a NASA page'),
      el('p.wc-scope', src.title), src.context ? null : el('p.wc-scope', 'Stored source excerpt. Read the linked document for its surrounding sentence.'), src.kind === 'challenge-page' ? el('p.wc-scope', 'Space Apps challenge page, not a NASA technical document.') : null,
      sourceLink(src.url, 'Read the original source ↗'),
      el('details.wc-identifiers', el('summary', 'Identifiers'), el('dl.wc-values', field('Record', record.id), field('Source', src.id), field('Year', src.year), field('Fields', src.field)))))];
}

const AGGREGATES = new Set(['design-coverage', 'selected-material-coverage', 'coverage-gravity', 'coverage-o2', 'coverage-pressure', 'map-exclusions', 'investigation-counts']);
const fileLink = (href, label) => el('a.wc-original', { href, target: '_blank', rel: 'noopener' }, label);

function investigationContent(record, text, db) {
  const rows = db.rowsByPsi[record.psi_id] || [];
  const findings = (record.finding_ids || []).map(id => db.findingById[id]).filter(Boolean);
  const endpoints = Object.entries(record.conditions || {}).filter(([, range]) => range?.min != null).map(([key, range]) =>
    el('li', key.replace(/_/g, ' ') + ': ', range.min_row_ids?.[0] ? cite(String(range.min), range.min_row_ids[0]) : String(range.min),
      ' to ', range.max_row_ids?.[0] ? cite(String(range.max), range.max_row_ids[0]) : String(range.max)));
  return [el('p.wc-kind', 'NASA PSI investigation'), el('h2.wc-title', { id: 'wc-source-title' }, record.name || record.full_name),
    el('p.wc-level', `${rows.length.toLocaleString('en-US')} source-table rows in this evidence base. A record describes a study; it is not a safety certification.`),
    sourceLink(record.psi_url, 'Read the original PSI investigation ↗'),
    endpoints.length ? el('section', el('h3', 'Recorded ranges'), el('ul.wc-row-links', endpoints)) : null,
    findings.length ? el('section', el('h3', 'Verified findings'), findings.map(f => el('p', cite(f.quote || f.claim, f.id)))) : null,
    record.objectives ? el('details.wc-identifiers', el('summary', 'Study objectives, as NASA gives them'), sentence(record.objectives)) : null,
    el('details.wc-identifiers', el('summary', 'Identifiers and tables'),
      el('dl.wc-values', field('PSI record', record.psi_id), field('DOI', record.doi), field('Platform', record.platform)),
      el('ul.wc-row-links', (record.tables || []).map(table => el('li', `${table.table_file}: ${table.rows} rows`)))),
    fileLink(`api/v1/tests/${record.psi_id}.csv`, 'Download this investigation’s rows'),
    el('p.wc-scope', text.STATUS_LINE)];
}

function aggregateContent(id, world, text, db) {
  const core = world?.core || getCore(), q = world?.q;
  const header = [el('p.wc-kind', 'Calculated from the evidence base'), el('h2.wc-title', { id: 'wc-source-title' }, 'What was searched')];
  if (id === 'investigation-counts' || id === 'map-exclusions') {
    const plotted = db.tests.filter(row => row.n?.o2 != null);
    const burner = db.tests.filter(row => row.o2_basis === 'burner_stream');
    const planes = [...new Set(plotted.map(row => row.n.gclass))];
    return [...header, el('p', `${db.investigations.length} PSI investigations and ${db.tests.length.toLocaleString('en-US')} source-table rows in VESTA’s evidence base.`),
      id === 'map-exclusions' ? el('p', `${plotted.length.toLocaleString('en-US')} rows have a single ambient oxygen value to plot. Burner-stream oxygen is not cabin air. ${burner.length} burner-stream rows are excluded from that plot.`) : null,
      id === 'map-exclusions' ? el('dl.wc-values', planes.map(plane => field(text.gravity(plane), `${plotted.filter(row => row.n.gclass === plane).length} plotted rows`))) : null,
      el('p.wc-level', 'Collection counts, not a NASA conclusion. A row may describe a test day or a series.'),
      fileLink('api/v1/investigations.json', 'Read the investigation records'), fileLink('api/v1/tests.csv', 'Read every source-table row'),
      el('details.wc-identifiers', el('summary', 'Calculation'), el('p', id === 'map-exclusions' ? 'Plot predicate: row.n.o2 != null. Pressure may be absent and remains on the separate rail. Gravity plane comes from the row.' : 'Counts are the lengths of db.investigations and db.tests, without resampling.')),
      el('p.wc-scope', text.STATUS_LINE)].filter(Boolean);
  }
  if (!q || !core.status || !core.match) return [...header, el('p', 'The cabin query is unavailable. Open a cabin before inspecting this calculation.')];
  const axes = core.status.axes(q, db), tally = core.status.tally(core.status.cells(q, db));
  const selected = core.status.cell(q.material, q.concern, q, db), tol = core.match.TOL;
  const values = db.cabinRows.filter(row => row.n.o2 != null).sort((a,b) => a.n.o2 - b.n.o2);
  const endpoints = values.length ? [values[0], values.at(-1)] : [];
  const related = [...new Set([...(selected.hit_ids || []).slice(0, 3), ...(selected.nearest ? [selected.nearest.id] : []), ...selected.finding_ids.slice(0, 2)])];
  const rows = related.map(id => lookup(id,db)).filter(Boolean);
  return [...header,
    el('p', `Searched ${db.cabinRows.length} cabin-material test rows ${text.base(db)} and ${db.findings.length} verified findings. This is a calculation across the collection.`),
    el('p', `Cabin: ${text.oxygen(q.o2)}, ${text.pressure(q.p)}, ${q.g_label || text.gravity(q.g)}.`),
    el('p', text.designAnswer(tally, db)),
    q.material ? el('p', text.cellSentence(selected, db.materials[q.material]?.label || q.material, db)) : null,
    el('p.wc-level', 'VESTA’s computed evidence coverage, not a NASA experiment or a safety rating.'),
    el('ul.wc-row-links',
      el('li', `Gravity: the same class (${q.gclass || 'not stated'}), ${axes.gravity.cabin} matching cabin-material rows.`),
      el('li', `Oxygen: within ±${tol.o2} percentage point, single ambient values only, ${axes.o2.cabin} matching rows.`),
      el('li', `Pressure: within ±${tol.p} kPa, ${axes.pressure.cabin} matching rows, including ${axes.pressure.cabin_inferred} facility-inferred values.`),
      el('li', `Both atmosphere conditions on the same row: ${axes.joint.cabin} rows. These axis counts do not imply a joint gravity, material and concern match.`)),
    el('p.wc-scope', 'Unknown conditions do not match. Model fuels are excluded from cabin-material coverage. Material coverage also requires the selected concern. Airflow, geometry, thickness and ignition are not matched.'),
    endpoints.length ? el('p', 'Ambient oxygen endpoints: ', cite(text.oxygen(values[0].n.o2), endpoints[0].id), ' to ', cite(text.oxygen(values.at(-1).n.o2), endpoints.at(-1).id)) : null,
    rows.length ? el('details.wc-identifiers', el('summary', 'Example rows and verified findings'), el('ul.wc-row-links', rows.map(hit => el('li', hit.kind === 'finding' ? cite(hit.finding.quote || hit.finding.claim, hit.finding.id) : cite(`${hit.row.psi_id}, row ${hit.row.row}`, hit.row.id))))) : null,
    fileLink('api/v1/tests.csv', 'Download the complete searched row collection'), fileLink('api/v1/findings.json', 'Read all verified findings'),
    db.presetById[q.preset] ? fileLink(`api/v1/coverage/${q.preset}.json`, 'Read this preset’s coverage calculation') : null,
    el('p.wc-scope', text.STATUS_LINE)].filter(Boolean);
}

function close(restore = true) {
  const session = active;
  if (!session) return;
  active = null;
  session.controller.abort();
  session.observer?.disconnect();
  session.trigger?.setAttribute('aria-expanded', 'false');
  session.handle?.close?.();
  session.handle?.dispose?.();
  session.shell?.remove();
  session.panel.remove();
  for (const [node, previous] of session.inert) node.inert = previous;
  session.suspended?.forEach(handle => handle.open?.());
  session.invalidate?.();
  dispatchEvent(new CustomEvent('vesta:cite', { detail: { open: false } }));
  if (restore && session.trigger?.isConnected) session.trigger.focus({ preventScroll: true });
}

function lock(session) {
  let branch = session.panel;
  while (branch?.parentElement && branch !== document.body) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || sibling.tagName === 'SCRIPT' || sibling.tagName === 'LINK' || sibling.tagName === 'STYLE') continue;
      session.inert.push([sibling, sibling.inert]); sibling.inert = true;
    }
    branch = branch.parentElement;
  }
}

async function open(id, trigger, world) {
  const returnTo = active?.panel.contains(trigger) ? active.trigger : trigger;
  close(false);
  const currentSerial = ++serial;
  await css('css/world.css?v=sebas-20261115-1');
  if (!returnTo.isConnected || currentSerial !== serial) return;
  const session = { id, trigger: returnTo, controller: new AbortController(), inert: [], panel: null };
  const context = world || binding;
  const db = context?.db || getDb(), text = context?.core?.text || getCore().text || {};
  session.invalidate = context?.invalidate;
  const hit = lookup(id, db) || (db?.invById?.[id] ? { kind: 'investigation', record: db.invById[id] } : AGGREGATES.has(id) ? { kind: 'aggregate' } : null);
  const panel = el('section.wc-source', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wc-source-title', tabindex: '-1', data: { source: id, sourceKind: hit?.kind || 'missing', quiet: quiet() } });
  session.panel = panel;
  active = session;
  const dismiss = el('button.wc-dismiss', { type: 'button', onclick: () => close() }, 'Close evidence ×');
  panel.append(dismiss, el('div.wc-content', (hit?.kind === 'finding' ? findingContent(hit.finding, text, db)
    : hit?.kind === 'row' ? rowContent(hit.row, text, db, session)
      : hit?.kind === 'config' ? configContent(hit.record)
        : hit?.kind === 'investigation' ? investigationContent(hit.record, text, db)
          : hit?.kind === 'aggregate' ? aggregateContent(id, context, text, db)
        : [el('h2.wc-title', { id: 'wc-source-title' }, 'Evidence unavailable'), el('p', 'No record with this identifier is in VESTA’s evidence base. Nothing is inferred.'), el('details.wc-identifiers', el('summary', 'Identifier'), el('p', id))]).filter(Boolean)));
  returnTo.setAttribute('aria-expanded', 'true');
  dispatchEvent(new CustomEvent('vesta:cite', { detail: { open: true, id } }));
  if (context?.hologram && context.stage?.mode !== 'still') {
    try {
      const camera = context.camera || context.stage?.camera;
      const point = camera && context.THREE ? new context.THREE.Vector3(0, 0, -4).applyQuaternion(camera.quaternion).add(camera.position) : null;
      const at = point ? point.toArray().map((value, i) => value - (context.origin?.[i] || 0)) : [0, 0, 0];
      session.suspended = context.citationPanels?.(trigger) || [];
      session.suspended.forEach(handle => handle.close?.());
      session.handle = await context.hologram(panel, { at, face: true, width: innerWidth < 760 ? innerWidth - 36 : 690, source: true, phoneRatio: hit?.row?.psi_id === 'PSI-69' ? .70 : undefined, keepPosition: true });
      if (active !== session || currentSerial !== serial) { session.handle?.dispose?.(); return; }
      session.handle?.open?.();
      context.invalidate?.();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (active !== session) return;
    } catch {
      session.handle?.dispose?.(); session.handle = null;
    }
  }
  if (!panel.isConnected) {
    const shell = el('dialog.wc-shell', { 'aria-label': 'Evidence hologram', oncancel: event => { event.preventDefault(); close(); } }, panel);
    session.shell = shell; document.body.append(shell); shell.showModal();
    shell.addEventListener('click', event => { if (event.target === shell) close(); });
  } else lock(session);
  panel.addEventListener('keydown', event => event.stopPropagation(), { signal: session.controller.signal });
  const options = { capture: true, signal: session.controller.signal };
  document.addEventListener('keydown', event => {
    if (active !== session) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const stops = [...panel.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex="0"]')].filter(node => node.getClientRects().length && !node.disabled && !node.closest('[inert]'));
    const index = stops.indexOf(document.activeElement);
    if (event.shiftKey ? index <= 0 : index < 0 || index === stops.length - 1) {
      event.preventDefault(); (event.shiftKey ? stops.at(-1) || panel : stops[0] || panel).focus({ preventScroll: true });
    }
  }, options);
  document.addEventListener('focusin', event => { if (active === session && !panel.contains(event.target)) dismiss.focus({ preventScroll: true }); }, options);
  addEventListener('hashchange', () => close(false), { signal: session.controller.signal });
  session.observer = new MutationObserver(() => { if (active === session && !returnTo.isConnected) close(false); });
  session.observer.observe(document.body, { childList: true, subtree: true });
  dismiss.focus({ preventScroll: true });
}

export function configureCitations(world) {
  close(false);
  binding = world;
  return () => { if (binding === world) { close(false); binding = null; } };
}

export function cite(text, id, world) {
  const sid = String(id ?? '');
  const phrase = el('button.world-cite', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', data: { cite: sid },
    onclick: event => { event.preventDefault(); event.stopPropagation(); open(sid, phrase, world); } }, text);
  return phrase;
}

export { open as openCitation };
