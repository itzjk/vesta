import { drawMap, mapData, LAYERS, MODEL_NOTE } from './design-map.js';

const CONCERNS = ['prevention', 'detection', 'suppression'];
const GRAVITY = [['0g', '0 g'], ['moon', '1/6 g'], ['mars', '3/8 g'], ['1g', '1 g']];
const ORDER = { NEVER_TESTED: 0, EXTRAPOLATED: 1, PROVEN: 2 };
const short = v => v == null ? 'not stated' : String(Math.round(v * 10) / 10);
const signed = v => (v > 0 ? '+' : '') + short(v);

export function selectedRows(db, material, concern) {
  return (db.rowsByMaterial[material] || []).filter(r => r.n.pillars.includes(concern));
}

export function rowsForExport(rows, q, db, compare) {
  return rows.map(r => {
    const m = compare(r.n, q, db.base);
    return { id: r.id, psi_id: r.psi_id, investigation: r.investigation, source_file: r.table_file, source_row: r.row,
      row_kind: r.row_kind, test_label: r.test_label, fuel: r.fuel, fuel_raw: r.fuel_raw, material_id: r.n.material_id,
      fuel_class: r.n.fuel_class, fuel_phase: r.fuel_phase, fuel_form: r.fuel_form, fuel_size: r.fuel_size,
      o2_percent: r.o2_percent, o2_basis: r.o2_basis, o2_raw: r.o2_raw, pressure_kpa: r.n.p,
      pressure_kpa_inferred: r.n.p_inferred, pressure_raw: r.pressure_raw, flow_cm_s: r.flow_cm_s, flow_raw: r.flow_raw,
      flow_direction: r.flow_direction, diluent: r.diluent, gravity: r.gravity, platform: r.platform,
      outcomes_json: r.outcomes, psi_url: r.psi_url || db.invById[r.psi_id]?.psi_url, license: r.license || db.invById[r.psi_id]?.license,
      delta_o2: m.delta.o2, delta_p_kpa: m.delta.p, fail: m.fail.join('|'),
      ...Object.fromEntries(Object.entries(r.raw || {}).map(([k, v]) => ['raw.' + k, v])) };
  });
}

export function mount(root, ctx) {
  const { db, ui, core } = ctx, { el: e } = ui, S = core.status, T = core.text;
  ui.css('css/views/design.css');
  root.classList.add('design-view');
  let q = { ...ctx.q }, disposed = false, map = null, mapHost, mapInfo, rawPromise;
  const cellKey = ctx.params.cell?.split(':');
  if (cellKey?.length === 2 && db.materials[cellKey[0]] && CONCERNS.includes(cellKey[1]) ) {
    q.material = cellKey[0]; q.concern = cellKey[1];
    if (ctx.q.material !== q.material || ctx.q.concern !== q.concern) ctx.setQ({ material: q.material, concern: q.concern }, { render: false });
  }
  let show = ctx.params.show === undefined ? ['solid'] : ctx.params.show.split(',').filter(v => LAYERS.some(l => l.id === v));
  const cite = id => ui.cite(id, { small: true });
  const claim = (id, ...kids) => e('div', { data: { claim: id } }, kids);
  const firstRow = rows => rows[0]?.id;
  const sourceCite = rec => cite(rec.id);
  const btn = (label, data, onClick, active = false) => e(data.preset || data.mat ? 'div' : 'button', { role: 'button', tabindex: 0, onkeydown: ev => { if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); onClick(); } }, class: 'design-choice' + (active ? ' is-active' : ''), type: 'button', data,
    'aria-pressed': String(active), onclick: onClick }, label);
  const title = (num, text, end) => e('div.design-section-title', e('span.design-index', num), e('h2', text), end);
  const pointTitle = e('span.design-point-title');
  const counts = e('span.design-counts');
  const heading = e('header.design-heading', e('div', e('span.t-label', '02 / RANK'), e('h1', 'How far beyond the evidence?')),
    e('div.design-heading-right', { data: { claim: 'design-coverage' } }, pointTitle, counts));
  const banner = e('div.design-gravity-banner');
  const cabinBody = e('div.design-cabin-body');
  const cabin = ui.panel('Cabin', cabinBody, { class: 'design-cabin' });
  const controls = e('div.design-controls');
  const presets = e('div.design-presets', db.presets.map(p => btn(
    [e('span', p.short || p.label), e('span.design-preset-values', `${short(p.o2)} % · ${p.p_display}`)],
    { preset: p.id, claim: p.id }, () => ctx.setQ({ preset: p.id }), p.id === q.preset)));
  for (const b of presets.children) b.append(sourceCite(db.presetById[b.dataset.preset]));
  const presetSource = e('div.design-preset-source');
  const slider = (name, key, min, max) => {
    const value = e('output', { for: 'design-' + key });
    const input = e('input', { id: 'design-' + key, type: 'range', min, max, step: 0.5, value: q[key], data: { slider: key }, 'aria-label': name,
      oninput: ev => {
        const start = performance.now();
        ctx.setQ({ [key]: Number(ev.target.value) }, { render: false });
        q = { ...ctx.q };
        paint(false);
        root.dataset.sliderMs = (performance.now() - start).toFixed(2);
      } });
    return { node: e('label.design-slider', e('span', name), value, input), input, value };
  };
  const oxygen = slider('Oxygen by volume', 'o2', 12, 100), pressure = slider('Pressure', 'p', 20, 110);
  const gravities = e('div.design-gravities', GRAVITY.map(([id, label]) => btn(label, { g: id }, () => ctx.setQ({ g: id }), q.g === id)));
  const concerns = e('div.design-concerns', CONCERNS.map(id => btn(T.concern(id), { concern: id }, () => selectCell(q.material, id), q.concern === id)));
  const materials = e('div.design-materials', Object.entries(db.materials).map(([id, m]) => btn(
    [e('span', m.label), e('span.design-material-count', String(m.rows))], { mat: id, claim: firstRow(selectedRows(db, id, q.concern)) || firstRow(db.rowsByMaterial[id] || []) },
    () => selectCell(id, q.concern), q.material === id)));
  for (const b of materials.children) {
    const row = firstRow(db.rowsByMaterial[b.dataset.mat] || []);
    if (row) b.append(cite(row));
  }
  const copy = ui.button('Copy link', { small: true, action: 'copy-link', onClick: async () => {
    try { await navigator.clipboard.writeText(location.href); copy.querySelector('.btn-label').textContent = 'Link copied'; }
    catch { copy.querySelector('.btn-label').textContent = 'Copy the address bar'; }
  } });
  controls.append(oxygen.node, pressure.node, e('div.design-control-label', 'Gravity'), gravities,
    e('div.design-control-label', 'Concern'), concerns, e('div.design-control-label', 'Materials · PSI rows'), materials,
    e('div.design-cabin-actions', ui.button('Reset', { small: true, action: 'reset', onClick: () => {
      ctx.setParams({ cell: null, show: null }, { render: false }); ctx.setQ({ preset: 'lunar-base', material: 'pmma', concern: 'prevention' });
    } }), copy));
  cabinBody.append(presets, presetSource, controls);

  const mapBody = e('div.design-map-body');
  const layerControls = e('div.design-layers', LAYERS.map(l => e('label',
    e('input', { type: 'checkbox', checked: show.includes(l.id), data: { layer: l.id }, onchange: ev => {
      show = ev.target.checked ? [...new Set([...show, l.id])] : show.filter(id => id !== l.id);
      ctx.setParams({ show: show.join(',') || 'none' }, { render: false }); draw();
    } }), e('span', l.label + (l.model ? ' (model)' : '')))));
  mapHost = e('div.design-map-host');
  mapInfo = e('div.design-map-info');
  const nearestLine = e('div.design-nearest', { data: { nearest: true } });
  const mapNotes = e('div.design-map-notes');
  mapBody.append(e('div.design-map-intro', e('span', 'Oxygen vs pressure'), e('span', 'NASA PSI test rows')), layerControls, mapHost,
    e('div.design-map-legend', e('span', e('i.design-dot.hollow'), 'facility pressure inferred'), e('span', e('i.design-dot'), 'reported pressure'), e('span', 'n.r. = pressure not in table')),
    nearestLine, mapInfo, mapNotes);
  const envelope = ui.panel('Tested envelope', mapBody, { strong: true, class: 'design-envelope' });
  const rankedBody = e('div.design-ranked-body'), rankedList = e('div.design-ranked-list'), gapList = e('div.design-gaps');
  const rankedCount = e('span.design-ranked-count');
  const concernSelect = e('select', { 'aria-label': 'Ranked evidence concern', onchange: ev => selectCell(q.material, ev.target.value) },
    CONCERNS.map(id => e('option', { value: id, selected: id === q.concern }, T.concern(id))));
  rankedBody.append(e('div.design-ranked-controls', concernSelect, rankedCount), rankedList, gapList);
  const rankedPanel = ui.panel('Ranked evidence', rankedBody, { class: 'design-ranked' });
  const matrixBody = e('div.design-matrix-body'), matrixGrid = e('div.design-matrix-grid');
  const matrixPanel = ui.panel('Material × concern', matrixBody, { class: 'design-matrix' });
  const whyBody = e('div.design-why-body'), why = ui.panel('Why this cell', whyBody, { class: 'design-why', strong: true });
  matrixBody.append(matrixGrid);
  const legend = e('div.design-legend', ui.chip('PROVEN', { small: true }), ui.chip('EXTRAPOLATED', { small: true }), ui.chip('NEVER_TESTED', { small: true }), ui.statusLine(db));
  const top = e('div.design-top', cabin, envelope, rankedPanel), bottom = e('div.design-bottom', matrixPanel, why);
  root.append(e('div.design-layout', heading, banner, top, bottom, legend));

  function selectCell(material, concern) {
    ctx.setParams({ cell: material ? `${material}:${concern}` : null }, { render: false });
    ctx.setQ({ material, concern });
  }
  const currentCell = () => S.cell(q.material, q.concern, q, db);
  const nearestRow = c => db.testById[c.nearest?.id || c.hit_ids?.[0]] || null;
  const cellCites = c => {
    const ids = [...(c.hit_ids || []).slice(0, 1), ...(c.nearest ? [c.nearest.id] : []), ...c.finding_ids.slice(0, 1)];
    const fallback = firstRow(db.rowsByMaterial[c.material] || []);
    return [...new Set(ids.length ? ids : fallback ? [fallback] : [])].map(cite);
  };
  function draw() {
    if (disposed) return;
    const data = mapData(db, show), c = currentCell();
    const drawn = drawMap(ui, mapHost, { data, q, nearest: nearestRow(c), markers: db.markers, bands: db.bands,
      sel: { material: q.material, concern: q.concern }, tol: core.match.TOL, text: T, onOpen: id => ctx.openSource ? ctx.openSource(id) : ui.openSource(id),
      onInfo: rec => {
        if (!rec) return;
        mapInfo.replaceChildren(claim(rec.id, e('span', rec.label + ': '), e('span', '“' + rec.sources[0].quote + '” '), sourceCite(rec)));
      } });
    mapHost.replaceChildren(drawn.node); map = drawn;
    const burnerRows = db.tests.filter(r => r.o2_basis === 'burner_stream' && r.o2_percent != null);
    const multiRows = db.tests.filter(r => r.multi?.o2_percent);
    mapNotes.replaceChildren(
      claim(firstRow(burnerRows) || 'map-exclusions', `Not plotted: ${data.burner.n} rows with burner-stream oxygen${data.burner.max == null ? '' : `, up to ${short(data.burner.max)} %`}. `, burnerRows.length ? cite(burnerRows[0].id) : null),
      claim(firstRow(multiRows) || 'map-multi', `${data.multi.n} rows list several oxygen values in one cell. `, multiRows.length ? cite(multiRows[0].id) : null,
        e('a', { href: '#/investigations' }, 'See Summarize')), e('p', MODEL_NOTE + '.'));
    const off = Object.values(data.layers).filter(l => l.on).reduce((n, l) => n + l.off_axis, 0);
    if (off) mapNotes.append(e('p', `${off} selected rows lie outside the pressure axis.`));
  }

  function revealCell() {
    const selected = matrixGrid.querySelector('.is-selected');
    if (selected) matrixBody.scrollTop = Math.max(0, selected.offsetTop - matrixGrid.offsetTop - 70);
  }

  function paint(withMap = true) {
    const c = currentCell(), row = nearestRow(c), ax = S.axes(q, db), cells = Object.keys(db.materials).flatMap(id => CONCERNS.map(p => S.cell(id, p, q, db)));
    const preset = db.presetById[q.preset];
    pointTitle.replaceChildren(e('span', `${preset?.short || preset?.label || 'Custom cabin'} · ${short(q.o2)} % O2 · ${T.pressure(q.p)} · ${q.g_label || 'gravity not stated'}`), preset ? sourceCite(preset) : row ? cite(row.id) : null);
    counts.replaceChildren(...['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'].map(id => e('span', { data: { status: id } }, `${cells.filter(c => c.status === id).length} ${T.status(id)}`)));
    oxygen.value.textContent = `${short(q.o2)} %`; pressure.value.textContent = T.pressure(q.p);
    oxygen.input.value = q.o2; pressure.input.value = q.p;
    oxygen.input.setAttribute('aria-valuetext', `${short(q.o2)} percent oxygen`); pressure.input.setAttribute('aria-valuetext', T.pressure(q.p));
    for (const b of presets.children) { const on = b.dataset.preset === q.preset; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); }
    presetSource.replaceChildren(preset ? claim(preset.id, e('q', preset.sources[0].quote), sourceCite(preset), e('p', { title: preset.scope }, preset.scope)) : e('p', 'Custom design point. Values are selected by you.'));
    const partial = q.gclass === 'partial', pf = db.findingById['S-PARTG-02'], bound = db.findingById['S-PARTG-03'];
    banner.hidden = !partial;
    banner.replaceChildren(e('span.design-banner-mark', '!'), e('div',
      pf ? claim(pf.id, e('q', pf.quote), cite(pf.id)) : e('p', 'Partial-gravity source not available.'),
      bound ? claim(bound.id, e('span', 'The challenge page says results “could bound” intermediate gravity; that is not demonstrated. '), cite(bound.id)) : null));
    nearestLine.replaceChildren(e('span.t-label', c.status === 'PROVEN' ? 'Tested at this cabin' : 'Nearest test · selected material + concern'),
      row ? claim(row.id, e('strong', `${row.investigation}, ${row.fuel}${row.fuel_form ? ' ' + row.fuel_form : ''}`),
        e('span', ` · ${short(row.n.o2)} % O2 · ${T.pressure(row.n.p ?? row.n.p_inferred)}${row.n.p == null && row.n.p_inferred != null ? ' inferred' : ''}`),
        c.nearest ? e('span.design-delta', ' · ', `${c.nearest.delta.o2 == null ? 'oxygen not stated' : signed(c.nearest.delta.o2) + ' points O2'}, ${c.nearest.delta.p == null ? 'pressure not stated' : signed(c.nearest.delta.p) + ' kPa'} (cabin minus test)`) : null,
        e('span.design-row-source', ` · ${row.table_file} · row ${row.row} `), cite(row.id)) : e('p', 'No test row for this material and concern. Model fuels are not a cabin-material nearest test.'));
    const ranks = db.findings.some(f => f.pillar === q.concern) ? core.rank.rank(db.findings, q, db) : [];
    concernSelect.value = q.concern; rankedCount.textContent = `Top ${Math.min(ranks.length, 25)} of ${ranks.length}`;
    rankedList.replaceChildren(...ranks.slice(0, 25).map((entry, i) => {
      const f = entry.f, cov = S.findingStatus(f, q, db, { fuel_class: db.materials[q.material]?.fuel_class });
      const sentences = Object.fromEntries(T.terms(entry, q).map(t => [t.key, t.sentence]));
      return e('article.design-rank-card', { data: { claim: f.id, finding: f.id } },
        e('div.design-rank-head', e('span.design-rank-order', String(i + 1).padStart(2, '0')), e('strong.design-score', entry.total), ui.chip(cov.status, { small: true })),
        e('h3', String(f.topic || f.pillar).replace(/_/g, ' ')), e('p.design-evidence-level', T.level(f)),
        e('p.design-rank-quote', f.quote ? '“' + f.quote + '”' : f.claim), cite(f.id),
        f.n.psi_id && db.rowsByPsi[f.n.psi_id]?.length ? e('span.design-table-badge', `PSI table: ${db.rowsByPsi[f.n.psi_id].length} rows`) : null,
        ui.scorebar(entry.parts, { small: true, sentences }),
        e('details.design-rank-why', e('summary', 'Why this score + coverage'),
          e('div.design-reasons', cov.reasons.map(code => ui.reason(code, { delta: cov.delta, q, n: db }))),
          T.terms(entry, q).map(t => e('p', e('b', `${t.label} ${t.value ?? ''}: `), t.sentence))));
    }));
    if (!ranks.length) rankedList.append(e('p.design-empty', `No verified finding for ${q.concern} ${T.base(db)}.`));
    const gaps = T.gaps(ax, q, db);
    gapList.replaceChildren(e('div.design-gap-title', e('h3', 'Gaps at this cabin'), e('span', `${gaps.length} axes`)),
      ...gaps.map(g => {
        const pool = g.axis === 'gravity' ? db.cabinRows : g.axis === 'o2' ? db.cabinRows.filter(r => r.n.o2 != null) : db.cabinRows.filter(r => r.n.p != null || r.n.p_inferred != null);
        const id = firstRow(pool);
        return e('div.design-gap', { data: { gap: g.axis, status: 'NEVER_TESTED', claim: id || 'coverage' }, title: g.sentence },
          e('div', e('i'), e('strong', g.label), e('b', '0 rows')), e('span.design-gap-word', 'NEVER TESTED'),
          g.extra ? e('p', g.extra) : null, id ? cite(id) : null);
      }));
    if (!gaps.length) gapList.append(e('p.design-no-gap', 'Cabin-material rows cover each axis separately. The matrix checks all conditions on the same row.'));
    const ids = Object.keys(db.materials).sort((a, b) => {
      const ca = cells.find(c => c.material === a && c.concern === q.concern), cb = cells.find(c => c.material === b && c.concern === q.concern);
      return ORDER[ca.status] - ORDER[cb.status] || db.materials[b].rows - db.materials[a].rows || a.localeCompare(b);
    });
    matrixGrid.replaceChildren(e('div.design-matrix-header', e('span', 'Material / gaps first'), ...CONCERNS.map(p => e('span', T.concern(p)))),
      ...ids.map(id => e('div.design-matrix-row', e('strong', db.materials[id].label), ...CONCERNS.map(p => {
        const x = cells.find(c => c.material === id && c.concern === p), selected = id === q.material && p === q.concern;
        const b = e('div', { class: 'design-matrix-cell' + (selected ? ' is-selected' : ''), role: 'button', tabindex: 0,
          data: { cell: `${id}:${p}`, status: x.status, claim: `${id}:${p}` }, onclick: () => selectCell(id, p),
          onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectCell(id, p); } },
          title: T.cellSentence(x, db.materials[id].label, db) }, ui.chip(x.status, { small: true }),
          e('span.design-cell-rows', `${x.status === 'PROVEN' ? x.hit_ids.length : x.rows} rows`), x.qualifier ? e('span.design-inferred', 'pressure inferred') : null,
          ...cellCites(x));
        if (x.status === 'PROVEN' && x.observed?.length) b.append(e('span.design-recorded', `recorded: ${x.observed.map(o => o.name.replace(/_/g, ' ')).join(', ')}`));
        return b;
      }))));
    const label = db.materials[q.material]?.label || q.material || 'No material selected';
    const reasonVals = { delta: c.nearest?.delta, q, n: db };
    const elsewhereIds = c.elsewhere || [];
    whyBody.replaceChildren(e('div.design-why-content', e('div.design-why-question', e('h3', label), e('span', '× ' + T.concern(q.concern))),
      e('div.design-why-tools', ui.chip(c.status, { qualifier: c.qualifier, small: true }),
        ui.button('Rows CSV', { small: true, action: 'export-csv', onClick: exportRows }),
        ui.button('Report JSON', { small: true, action: 'export-json', onClick: () => ui.downloadJson('vesta-design-report.json', {
          schema: 'vesta.design-report/1', query: q, preset_sources: preset?.sources || [], axes: ax, cells,
          ranked: ranks.map(({ f, ...r }) => ({ id: f.id, ...r, ...S.findingStatus(f, q, db) })),
          constants: { W: core.rank.W, LEVEL: core.rank.LEVEL, SPAN: core.rank.SPAN, TOL: core.match.TOL }, scope: T.SCOPE
        }) })), claim(`${c.material}:${c.concern}`, e('p.design-cell-sentence', T.cellSentence(c, label, db)), ...cellCites(c)),
      elsewhereIds.length ? e('p.design-elsewhere', 'This material also appears in: ', ...elsewhereIds.map(p => {
        const rows = selectedRows(db, q.material, p), names = [...new Set(rows.map(r => r.investigation))].join(', ');
        return e('span', `${p}${names ? ` (${names})` : ''} `, rows.length ? cite(rows[0].id) : null);
      })) : null,
      e('div.design-reasons', c.reasons.map(code => ui.reason(code, reasonVals))),
      c.reasons.length && c.status !== 'NEVER_TESTED' ? e('details.design-why-detail', e('summary', 'Full coverage reasons'), ...c.reasons.map(code => e('p.design-reason-sentence', T.reasonSentence(code, reasonVals)))) : null,
      c.observed?.length ? e('details.design-why-detail', e('summary', 'Recorded outcomes'), claim(c.hit_ids[0], e('p.design-observed', T.observed(c.observed).join('; ')), cite(c.hit_ids[0]))) : null,
      e('details.design-why-detail', e('summary', 'Ranking method + tolerances'), e('p.design-choices', T.CHOICES))));
    if (withMap) { draw(); mapInfo.replaceChildren(); }
    else map?.setPoint(q, row);
  }

  async function exportRows() {
    const exportQ = { ...q }, rows = selectedRows(db, exportQ.material, exportQ.concern);
    if (!rows.every(r => r.raw)) {
      try {
        rawPromise ||= fetch('data/tests-raw.json').then(r => { if (!r.ok) throw new Error('Raw cells did not load'); return r.json(); });
        const result = await rawPromise, raw = result.rows || result.raw || result;
        for (const r of rows) if (raw[r.id]) r.raw = raw[r.id];
        if (!rows.every(r => r.raw)) throw new Error('Raw cells are incomplete');
      } catch {
        whyBody.append(e('p.design-export-error', 'Raw cells did not load. Retry Rows CSV when the evidence files are available.'));
        rawPromise = null; return;
      }
    }
    const out = rowsForExport(rows, exportQ, db, core.match.match);
    const columns = out.length ? [...new Set(out.flatMap(r => Object.keys(r)))] : ['id', 'psi_id', 'source_file', 'source_row', 'delta_o2', 'delta_p_kpa', 'fail'];
    ui.downloadCsv(`vesta-${exportQ.material || 'none'}-${exportQ.concern}.csv`, core.csv.toCsv(out, columns));
  }
  paint();
  let frame = requestAnimationFrame(() => { if (!disposed) { draw(); revealCell(); } });
  ui.css('css/views/design.css').then(() => { if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { draw(); revealCell(); }); } });
  return () => { disposed = true; cancelAnimationFrame(frame); root.classList.remove('design-view'); };
}
