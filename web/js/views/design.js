import { drawMap, mapData, LAYERS, MODEL_NOTE, mountField } from './design-map.js?v=11';

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
  ui.css('css/views/design.css?v=11');
  ui.css('css/cabin-controls.css?v=1');
  if (ctx.params.view !== 'details' && ctx.view !== 'details') return mountSimple(root, ctx);
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
  const presetSelect = e('select.design-preset-select', { 'aria-label': 'Cabin preset', onchange: ev => ctx.setQ({ preset: ev.target.value }) },
    e('option', { value: 'custom' }, 'Custom cabin'), ...db.presets.map(p => e('option', { value: p.id }, p.short || p.label)));
  const presets = e('label.design-preset-field', e('span', 'Cabin preset'), presetSelect);
  const presetSource = e('div.design-preset-source');
  const presetDetails = e('details.design-preset-details', e('summary', 'Preset source and limits'), presetSource);
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
    e('div.design-control-label', 'Concern'), concerns, e('details.design-material-picker', e('summary', `Material: ${db.materials[q.material]?.label || 'choose'} · ${Object.keys(db.materials).length} choices`), materials),
    e('div.design-cabin-actions', ui.button('Reset', { small: true, action: 'reset', onClick: () => {
      ctx.setParams({ cell: null, show: null }, { render: false }); ctx.setQ({ preset: 'lunar-base', material: 'pmma', concern: 'prevention' });
    } }), copy));
  cabinBody.append(presets, controls, presetDetails);

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
  mapBody.append(layerControls, mapHost,
    e('div.design-map-legend', e('span', e('i.design-dot.hollow'), 'facility pressure inferred'), e('span', e('i.design-dot'), 'reported pressure'), e('span', 'n.r. = pressure not in table')),
    nearestLine, mapInfo, mapNotes);
  const envelope = ui.panel('Tested envelope', mapBody, { strong: true, class: 'design-envelope', tag: 'Oxygen % vs pressure · NASA PSI' });
  const rankedBody = e('div.design-ranked-body'), rankedList = e('div.design-ranked-list'), gapList = e('div.design-gaps');
  const rankedCount = e('span.design-ranked-count');
  const concernSelect = e('select', { 'aria-label': 'Ranked evidence concern', onchange: ev => selectCell(q.material, ev.target.value) },
    CONCERNS.map(id => e('option', { value: id, selected: id === q.concern }, T.concern(id))));
  rankedBody.append(e('div.design-ranked-controls', concernSelect, rankedCount), rankedList, gapList);
  const rankedPanel = ui.panel('Related findings for this cabin', rankedBody, { class: 'design-ranked' });
  const matrixBody = e('div.design-matrix-body'), matrixGrid = e('div.design-matrix-grid');
  const matrixPanel = ui.panel('Material × concern', matrixBody, { class: 'design-matrix' });
  const whyBody = e('div.design-why-body'), why = ui.panel('Why this cell', whyBody, { class: 'design-why', strong: true });
  matrixBody.append(e('p.design-matrix-caption', `${Object.keys(db.materials).length} materials · ${Object.keys(db.materials).length * CONCERNS.length} questions · scroll for all materials`), matrixGrid);
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
    if (!map) map = mountField(ui, mapHost, { ...ctx, q });
    map.setPoint(q); map.setLayers(show);
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
    if (selected) {
      const row = selected.closest('.design-matrix-row');
      const sticky = matrixBody.querySelector('.design-matrix-caption').offsetHeight + matrixGrid.querySelector('.design-matrix-header').offsetHeight;
      const scale = ui.stageScale?.() || 1;
      matrixBody.scrollTop += (row.getBoundingClientRect().top - matrixBody.getBoundingClientRect().top) / scale - sticky;
    }
  }

  function paint(withMap = true) {
    const c = currentCell(), row = nearestRow(c), ax = S.axes(q, db), cells = Object.keys(db.materials).flatMap(id => CONCERNS.map(p => S.cell(id, p, q, db)));
    const preset = db.presetById[q.preset];
    pointTitle.replaceChildren(e('span', `${preset?.short || preset?.label || 'Custom cabin'} · ${short(q.o2)} % O2 · ${T.pressure(q.p)} · ${q.g_label || 'gravity not stated'}`), preset ? sourceCite(preset) : row ? cite(row.id) : null);
    counts.replaceChildren(...['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'].map(id => e('span', { data: { status: id } }, `${cells.filter(c => c.status === id).length} ${T.status(id)}`)));
    oxygen.value.textContent = `${short(q.o2)} %`; pressure.value.textContent = T.pressure(q.p);
    oxygen.input.value = q.o2; pressure.input.value = q.p;
    for (const { input } of [oxygen, pressure]) input.style.setProperty('--control-fill', `${100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
    for (const [parent, key, value] of [[gravities, 'g', q.g], [concerns, 'concern', q.concern], [materials, 'mat', q.material]]) {
      for (const b of parent.children) { const on = b.dataset[key] === value; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); }
    }
    controls.querySelector('.design-material-picker summary').textContent = `Material: ${db.materials[q.material]?.label || 'choose'} · ${Object.keys(db.materials).length} choices`;
    oxygen.input.setAttribute('aria-valuetext', `${short(q.o2)} percent oxygen`); pressure.input.setAttribute('aria-valuetext', T.pressure(q.p));
    presetSelect.value = q.preset || 'custom';
    presetSource.replaceChildren(preset ? claim(preset.id, e('q', preset.sources[0].quote), sourceCite(preset), e('p', { title: preset.scope }, preset.scope)) : e('p', 'Custom design point. Values are selected by you.'));
    const partial = q.gclass === 'partial', pf = db.findingById['S-PARTG-02'], bound = db.findingById['S-PARTG-03'];
    banner.hidden = !partial;
    banner.replaceChildren(e('span.design-banner-mark', '!'), e('div',
      pf ? claim(pf.id, e('q', pf.quote), cite(pf.id)) : e('p', 'Partial-gravity source not available.'),
      bound ? claim(bound.id, e('span', 'The challenge page says results “could bound” intermediate gravity; that is not demonstrated. '), cite(bound.id)) : null));
    nearestLine.replaceChildren(e('span.t-label', c.status === 'PROVEN' ? 'Tested near these atmosphere conditions' : 'Nearest test · selected material + concern'),
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
        e('div.design-rank-head', e('span.design-rank-order', String(i + 1).padStart(2, '0')), e('strong.design-score', `${entry.total}/100`), ui.chip(cov.status, { small: true })),
        e('h3', String(f.topic || f.pillar).replace(/_/g, ' ')), e('p.design-evidence-level', T.level(f)),
        e('p.design-applicability', T.materialNote(f, q, db) || 'Finding coverage is separate from the selected material question.'),
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
        return e('div.design-gap', { data: { gap: g.axis, status: 'NEVER_TESTED', claim: 'coverage-' + g.axis }, title: g.sentence },
          e('div', e('i'), e('strong', g.label), e('b', '0 rows')), e('span.design-gap-word', 'NEVER TESTED'),
          g.extra ? e('p', g.extra) : null, aggregateSource(ui, ctx, q, g.axis));
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
      e('p.design-coverage-limits', `Atmospheric match only: oxygen within ±${core.match.TOL.o2} percentage point and pressure within ±${core.match.TOL.p} kPa, at the same gravity class. Facility pressure may be inferred. Flow, sample geometry, thickness and ignition are not matched.`),
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
  ui.css('css/views/design.css?v=11').then(() => { if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { draw(); revealCell(); }); } });
  return {
    update(next) {
      q = { ...next.q };
      show = next.params.show === undefined ? ['solid'] : next.params.show.split(',').filter(v => LAYERS.some(l => l.id === v));
      for (const input of layerControls.querySelectorAll('input')) input.checked = show.includes(input.dataset.layer);
      paint(); revealCell();
    },
    unmount() { disposed = true; cancelAnimationFrame(frame); map?.dispose(); root.classList.remove('design-view'); }
  };
}

function aggregateSource(ui, ctx, q, axis = null) {
  const { el: e } = ui, { db, core } = ctx;
  return e('button.design-source-link', { type: 'button', data: { action: 'coverage-source', axis }, onclick: ev => {
    const opener = ev.currentTarget, ax = core.status.axes(q, db), tol = core.match.TOL;
    const selected = core.status.cell(q.material, q.concern, q, db), tally = core.status.tally(core.status.cells(q, db));
    const tests = db.cabinRows, values = tests.filter(r => r.n.o2 != null).sort((a, b) => a.n.o2 - b.n.o2);
    const endpoints = values.length ? [values[0], values[values.length - 1]] : [];
    const dialog = e('dialog.design-source-dialog', { 'aria-label': 'Coverage calculation source' });
    const close = () => dialog.close();
    dialog.append(e('header', e('h2', 'How this coverage was calculated'), ui.button('Close', { onClick: close })),
      e('p', `Searched ${tests.length} cabin-material test rows ${core.text.base(db)}. This is a calculation across the collection, not a claim supported by one row.`),
      e('p', `Cabin: ${short(q.o2)} % oxygen, ${core.text.pressure(q.p)}, ${q.g_label || 'gravity not stated'}.`),
      e('p', `${core.text.designAnswer(tally)} Related findings searched: ${db.findings.length}.`),
      q.material ? e('p', `${db.materials[q.material]?.label || q.material} × ${q.concern}: ${selected.rows} test rows, ${selected.finding_ids.length} verified findings, ${selected.hit_ids?.length || 0} matching rows. Status: ${core.text.status(selected.status)}. `,
        ...[...new Set([...(selected.hit_ids || []).slice(0, 1), ...(selected.nearest ? [selected.nearest.id] : []), ...selected.finding_ids.slice(0, 2)])].map(id => ui.cite(id))) : null,
      e('ul', e('li', `Gravity: same class (${q.gclass || 'not stated'}), ${ax.gravity.cabin} matching cabin-material rows.`),
        e('li', `Oxygen: within ±${tol.o2} percentage point, clean ambient values only, ${ax.o2.cabin} matching rows.`),
        e('li', `Pressure: within ±${tol.p} kPa, reported or facility-inferred, ${ax.pressure.cabin} matching rows (${ax.pressure.cabin_inferred} inferred).`),
        e('li', `Both atmosphere conditions on the same row: ${ax.joint.cabin} rows. Flow, geometry, thickness and ignition are not matched.`)),
      e('p', 'Unknown conditions do not count as matches. Model fuels are excluded from the cabin-material set. Material coverage also requires the selected concern.'),
      endpoints.length ? e('p', `Ambient oxygen endpoints: ${short(values[0].n.o2)} % to ${short(values[values.length - 1].n.o2)} %. `,
        ...endpoints.map(r => ui.cite(r.id))) : null,
      e('div.design-source-actions', ui.button('Download searched rows CSV', { onClick: () => ui.downloadCsv('vesta-cabin-material-coverage.csv', core.csv.toCsv(tests.map(r => ({ id: r.id, material: r.n.material_id, concerns: r.n.pillars.join('|'), gravity_class: r.n.gclass, oxygen_percent: r.n.o2, pressure_kpa: r.n.p, pressure_inferred_kpa: r.n.p_inferred, ...core.match.match(r.n, q, db.base).delta })))) }),
        e('a', { href: 'api/v1/tests.csv', target: '_blank', rel: 'noopener' }, 'All PSI test rows'),
        e('a', { href: 'api/v1/findings.json', target: '_blank', rel: 'noopener' }, 'All verified findings')),
      db.presetById[q.preset] ? e('p', e('a', { href: `api/v1/coverage/${q.preset}.json`, target: '_blank', rel: 'noopener' }, 'Preset coverage JSON')) : null);
    dialog.addEventListener('click', event => { if (event.target.closest('[data-cite]')) close(); }, { capture: true });
    dialog.addEventListener('close', () => { dialog.remove(); if (opener.isConnected) opener.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
  } }, 'source');
}

function mountSimple(root, ctx, retained = null) {
  const { db, ui, core } = ctx, { el: e } = ui, q = ctx.q, T = core.text;
  root.classList.add('design-view', 'design-simple-view');
  const cells = core.status.cells(q, db), tally = core.status.tally(cells), ax = core.status.axes(q, db);
  const c = core.status.cell(q.material, q.concern, q, db), preset = db.presetById[q.preset];
  const materialName = label => ({ PMMA: 'Acrylic plastic (PMMA)', SIBAL: 'Cotton/fiberglass fabric (SIBAL)' })[label] || label;
  const plainConcern = { prevention: 'Starting a fire', detection: 'Detecting a fire', suppression: 'Putting a fire out' };
  const labels = { station: 'Space station', spacecraft: 'Spacecraft', 'lunar-base': 'Moon base', rover: 'Pressurized rover', 'mars-base': 'Mars base' };
  const answer = T.designAnswer(tally);
  const source = id => ui.cite(id, { label: 'source', class: 'design-simple-source' });
  const heading = ui.answer('Has a cabin like yours been tested?', answer, { class: 'design-simple-heading' });
  heading.querySelector('[data-answer]').setAttribute('data-claim', 'design-coverage');
  heading.append(e('p.design-simple-scope', T.base(db) + '. ', aggregateSource(ui, ctx, q)));
  const where = e('select', { 'aria-label': 'Where?', data: { preset: q.preset }, onchange: ev => ctx.setQ({ preset: ev.target.value }) },
    db.presets.map(p => e('option', { value: p.id, selected: p.id === q.preset }, labels[p.id] || p.label)));
  const concern = e('select', { 'aria-label': 'What worries you?', data: { concern: q.concern }, onchange: ev => ctx.setQ({ concern: ev.target.value }) },
    CONCERNS.map(id => e('option', { value: id, selected: q.concern === id }, plainConcern[id])));
  const material = e('select', { 'aria-label': 'Material', data: { mat: q.material }, onchange: ev => ctx.setQ({ material: ev.target.value }) },
    !q.material ? e('option', { value: '', selected: true }, 'Choose a material') : null,
    Object.entries(db.materials).map(([id, m]) => e('option', { value: id, selected: q.material === id }, materialName(m.label))));
  const choices = e('section.design-simple-choices', e('h2', 'Your cabin'),
    e('div', e('h3', 'Where?'), where), e('label', 'What worries you?', concern), e('label', 'Material', material),
    e('p.design-simple-atmosphere', { data: { claim: preset?.id || 'custom-cabin' } },
      `${short(q.o2)} % oxygen · ${q.g_label || 'gravity not stated'}.`, e('br'), `Air pressure: ${short(T.psia(q.p))} psia (pounds per square inch). `, preset ? source(preset.id) : 'Chosen by you.'));
  const host = retained?.host || e('div.design-simple-map-host');
  const mapPanel = e('section.design-simple-map', e('h2', 'Where the evidence stops'), host);
  const statusText = q.material ? T.statusMeaning(c.status, c.qualifier) : 'Choose a material to check its evidence coverage.';
  const result = e('section.design-simple-result', e('h2', q.material ? `${materialName(db.materials[q.material]?.label || q.material)} · ${plainConcern[q.concern].toLowerCase()}` : 'Selected material question'),
    e('div.design-simple-selected', { data: { status: c.status, cell: `${q.material}:${q.concern}`, claim: 'selected-material-coverage' } },
      e('strong', T.status(c.status)), e('p', statusText), aggregateSource(ui, ctx, q)),
    e('h3', 'Gaps across cabin materials'));
  const gapNames = { gravity: 'Gravity', o2: 'Oxygen', pressure: 'Air pressure' };
  const gaps = T.gaps(ax, q, db);
  for (const gap of gaps) {
    const sentence = gap.axis === 'gravity' ? `No test row at ${q.g_label}.`
      : gap.axis === 'o2' ? `No test row near ${short(q.o2)} % oxygen.`
      : 'No test row near this pressure.';
    result.append(e('div.design-simple-gap', { data: { gap: gap.axis, claim: 'coverage-' + gap.axis } }, e('strong', gapNames[gap.axis]), e('p', sentence), aggregateSource(ui, ctx, q, gap.axis)));
  }
  if (!gaps.length) result.append(e('p', 'Each axis has nearby test rows. Only the selected material and concern are checked together; this does not validate a cabin.'));
  if (c.status === 'PROVEN') {
    const outcomeNames = { o2_final_percent: 'final oxygen', co2_final_percent: 'final carbon dioxide', co_final_ppm: 'final carbon monoxide' };
    if (c.observed?.length) result.append(e('p.design-simple-observed', `Recorded: ${c.observed.map(o => outcomeNames[o.name] || o.name.replace(/_/g, ' ')).join(', ')}. `, source(c.hit_ids[0])));
    result.append(e('p', 'A nearby-condition match only. Airflow and sample shape are not matched.'));
  }
  const footer = e('footer.design-simple-footer', e('p', T.STATUS_LINE), ui.button('Run the fire drill', { primary: true, action: 'drill', onClick: () => ctx.go('#/incident?view=simple&play=1') }));
  root.append(e('div.design-simple-layout', heading, e('div.design-simple-blocks', mapPanel, e('div.design-simple-sidebar', choices, result)), footer));
  const field = retained?.field || mountField(ui, host, ctx);
  field.setPoint(q);
  let current;
  return {
    update(next) {
      root.replaceChildren();
      current = mountSimple(root, next, { host, field });
    },
    unmount() { if (current) current.unmount(); else field.dispose(); root.classList.remove('design-view', 'design-simple-view'); }
  };
}
