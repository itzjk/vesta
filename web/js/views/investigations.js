const NOT_IN_RECORD = 'not stated in the PSI record';
const NOT_IN_TABLE = 'not in the table';
const NO_TABLE = 'no test table in PSI';
const NO_TABLE_DETAIL = 'No experimental table in PSI for this record (ground investigation).';
const KPA_PER_PSI = 6.89476;
const CONCERNS = ['prevention', 'detection', 'suppression'];
const KIND_WORD = { test_day: 'several per test day', test_series: 'several per test series' };

const isNum = x => typeof x === 'number' && isFinite(x);
const words = s => String(s ?? '').replace(/^condition\./, '').replace(/_/g, ' ');
const short = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d);
const span = (lo, hi, d = 1) => (lo === hi ? short(lo, d) : `${short(lo, d)}–${short(hi, d)}`);
const DISPLAY_NAMES = { 'PSI-60': 'SPICE flame models', 'PSI-62': 'BASS flame-spread models', 'PSI-115': 'SAME smoke models', 'PSI-117': 'Cool-flame dynamics models', 'PSI-142': 'Cool-flame transitions' };
const displayName = i => DISPLAY_NAMES[i.psi_id] || i.name;
const natural = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const rawAxis = (rows, field, rawField) => {
  const numeric = rows.filter(r => isNum(r[field])).sort((a, b) => a[field] - b[field]);
  const ends = numeric.length ? [numeric[0], numeric[numeric.length - 1]] : [];
  const multi = rows.filter(r => r.multi?.[field]);
  return [...new Set([...ends, ...multi].filter(r => filled(r[rawField])).map(r => String(r[rawField])))].join('; ');
};
const filled = s => s != null && String(s).trim() !== '';
function axisOf(rows, numOf, multiKey, rawOf) {
  const a = { n: 0, min: null, max: null, list: [], list_rows: 0, range: null, range_rows: 0, raw_only: 0, lo: null, hi: null };
  const set = new Set();
  for (const r of rows) {
    const v = numOf(r), m = r.multi && r.multi[multiKey];
    if (isNum(v)) { a.n++; a.min = a.min == null ? v : Math.min(a.min, v); a.max = a.max == null ? v : Math.max(a.max, v); }
    else if (m && Array.isArray(m.values) && m.values.some(isNum)) {
      const vals = m.values.filter(isNum);
      if (m.kind === 'range') { a.range_rows++; a.range = a.range ? [Math.min(a.range[0], ...vals), Math.max(a.range[1], ...vals)] : [Math.min(...vals), Math.max(...vals)]; }
      else { a.list_rows++; for (const x of vals) set.add(x); }
    } else if (filled(rawOf(r))) a.raw_only++;
  }
  a.list = [...set].sort((x, y) => x - y);
  const all = [a.min, a.max, ...a.list, ...(a.range || [])].filter(isNum);
  if (all.length) { a.lo = Math.min(...all); a.hi = Math.max(...all); }
  const valuesOf = r => isNum(numOf(r)) ? [numOf(r)] : (r.multi?.[multiKey]?.values || []).filter(isNum);
  a.endpoint_ids = [...new Set([a.lo, a.hi].filter(isNum).map(v => rows.find(r => valuesOf(r).includes(v))?.id).filter(Boolean))];
  return a;
}
const tally = (rows, keyOf) => {
  const m = new Map(); let missing = 0;
  for (const r of rows) { const k = keyOf(r); if (k == null || k === '') missing++; else m.set(k, (m.get(k) || 0) + 1); }
  return { items: [...m.entries()].map(([value, n]) => ({ value, n })).sort((x, y) => y.n - x.n || natural(x.value, y.value)), missing };
};


export function summarize(rows = []) {
  const tests = rows.filter(r => r.row_kind !== 'dataset_index');
  const ambient = r => r.o2_basis === 'ambient';
  const burnerRows = tests.filter(r => r.o2_basis === 'burner_stream' && isNum(r.o2_percent));
  const kinds = tally(rows, r => r.row_kind).items;
  const inferred = tests.filter(r => !isNum(r.pressure_kpa) && r.n && isNum(r.n.p_inferred));
  const outcomes = new Map();
  for (const r of tests) for (const [name, o] of Object.entries(r.outcomes || {})) { const e = outcomes.get(name) || { name, n: 0, unit: (o && o.unit) || null }; e.n++; outcomes.set(name, e); }
  return {
    rows: rows.length, tests: tests.length, has_table: tests.length > 0, kinds,
    kind_word: KIND_WORD[kinds[0] && kinds[0].value] || 'several in one cell',
    first_row: tests[0] || null,
    fuels: tally(tests, r => r.fuel), forms: tally(tests, r => r.fuel_form),
    classes: tally(tests, r => r.n && r.n.fuel_class && r.n.fuel_class !== 'none' ? r.n.fuel_class : null).items.map(x => x.value),
    pillars: [...new Set(tests.flatMap(r => (r.n && r.n.pillars) || []))],
    gravity: tally(tests, r => r.gravity), platform: tally(tests, r => r.platform),
    o2: axisOf(tests.filter(ambient), r => (ambient(r) ? r.o2_percent : null), 'o2_percent', r => (ambient(r) ? r.o2_raw : null)),
    o2_burner: burnerRows.length ? { n: burnerRows.length, min: Math.min(...burnerRows.map(r => r.o2_percent)), max: Math.max(...burnerRows.map(r => r.o2_percent)) } : null,
    p: axisOf(tests, r => r.pressure_kpa, 'pressure_kpa', r => r.pressure_raw),
    p_inferred: inferred.length ? { n: inferred.length, value: inferred[0].n.p_inferred, row: inferred[0] } : null,
    flow: axisOf(tests, r => r.flow_cm_s, 'flow_cm_s', r => r.flow_raw),
    flow_dirs: tally(tests, r => r.flow_direction).items,
    outcomes: [...outcomes.values()],
  };
}


export function axisText(a, opts = {}) {
  const c = opts.conv || (x => x), d = opts.digits ?? 1, parts = [];
  if (a.n) parts.push(span(c(a.min), c(a.max), d));
  if (a.list.length) parts.push(a.list.map(x => short(c(x), d)).join('; ') + (opts.kind_word ? ` (${opts.kind_word})` : ''));
  if (a.range) parts.push(span(c(a.range[0]), c(a.range[1]), d) + (opts.kind_word ? ' (a range per row)' : ''));
  return parts.length ? parts.join(' · ') : null;
}
export function mount(root, ctx) {
  const { ui, db } = ctx, el = ui.el, fmt = ui.fmt;
  ui.css('css/views/investigations.css?v=10');
  const core = ctx.core || {}, text = core.text || {};
  const nInv = db.investigations.length;
  const base = `in VESTA’s evidence base (${nInv} PSI investigations)`;
  const psiaText = v => (typeof text.pressure === 'function' ? text.pressure(v) : `${short(v / KPA_PER_PSI)} psia (${short(v)} kPa)`);
  const fuelClass = id => (typeof text.fuelClass === 'function' ? text.fuelClass(id) : words(id));
    const rowsOf = id => db.rowsByPsi[id] || [];
  const S = new Map(db.investigations.map(i => [i.psi_id, summarize(rowsOf(i.psi_id))]));
  const findingsOf = new Map();
  for (const f of db.findings) if (f.n.psi_id) { if (!findingsOf.has(f.n.psi_id)) findingsOf.set(f.n.psi_id, []); findingsOf.get(f.n.psi_id).push(f); }
  const F = id => findingsOf.get(id) || [];
  const famLabel = i => i.family_label || (i.family ? words(i.family) : NOT_IN_RECORD);
  const famList = (() => { const m = new Map(); for (const i of db.investigations) if (i.family && !m.has(i.family)) m.set(i.family, famLabel(i)); return [...m.entries()]; })();
  const classList = [...new Set([...S.values()].flatMap(s => s.classes))].sort();
  const link = (id, url, label, title) => url
    ? el('a.cite.cite-small.sm-link', { href: url, target: '_blank', rel: 'noopener', data: { cite: id }, title: title || 'Open the NASA source' }, el('span.cite-id', label), el('span.cite-plain', 'source'), el('span.sm-ext', { 'aria-hidden': 'true' }, '↗'))
    : el('span.cite.cite-small.sm-link.sm-link-none', { data: { cite: id }, title: 'No link in the record' }, el('span.cite-id', label));
  const srcTag = kind => el('span.sm-src', { data: { src: kind } }, kind);

  let scrollTop = 0, simpleScroll = 0;
  function render() {
    if ((ctx.view || ctx.params?.view) !== 'details') { renderSimple(); return; }
    const { q, params } = ctx;
    const sel0 = params.sel && db.invById[params.sel] ? params.sel : null;
    const cmp = [...new Set(String(params.cmp || '').split(',').map(s => s.trim()).filter(id => db.invById[id]))].slice(0, 3);
    const fam = params.fam || '', cls = params.cls || '', pil = CONCERNS.includes(params.pil) ? params.pil : '', tab = params.tab === '1';
    let order = db.investigations.map(i => ({ psi_id: i.psi_id, score: null }));
    const rankable = core.rank && typeof core.rank.rankInvestigations === 'function' && isNum(q.o2) && isNum(q.p);
    if (rankable) { try { order = core.rank.rankInvestigations(db, q); } catch (e) { console.warn('VESTA: rankInvestigations failed: ' + e.message); } }
    else order.sort((a, b) => natural(a.psi_id, b.psi_id));
    const scoreOf = new Map(order.map(o => [o.psi_id, o.score]));
    const shown = order.map(o => db.invById[o.psi_id]).filter(Boolean).filter(i => {
      const s = S.get(i.psi_id);
      if (fam && i.family !== fam) return false;
      if (cls && !s.classes.includes(cls)) return false;
      if (pil && !s.pillars.includes(pil) && !F(i.psi_id).some(f => f.pillar === pil)) return false;
      if (tab && !s.has_table) return false;
      return true;
    });
    const sel = sel0 || cmp[0] || (shown[0] && shown[0].psi_id) || null;
    const select = (key, label, options, value) => el('label.sm-filter', el('span.sm-filter-k', label),
      el('select.sm-select', { data: { filter: key }, onchange: e => ctx.setParams({ [key]: e.target.value || null }) },
        el('option', { value: '', selected: !value }, 'all'), options.map(([v, t]) => el('option', { value: v, selected: v === value }, t))));
    const preset = db.presetById[q.preset];
    const filters = el('div.sm-filters',
      select('fam', 'Family', famList, fam),
      select('cls', 'Fuel class', classList.map(c => [c, fuelClass(c)]), cls),
      select('pil', 'Pillar', CONCERNS.map(c => [c, c[0].toUpperCase() + c.slice(1)]), pil),
      el('label.sm-check', el('input', { type: 'checkbox', checked: tab || null, data: { filter: 'tab' }, onchange: e => ctx.setParams({ tab: e.target.checked ? '1' : null }) }), el('span', 'has a test table')),
      el('span.sm-sorted', rankable ? ['sorted by relevance for ', el('b', (preset && (preset.short || preset.label)) || 'a custom cabin'), ' · ', el('b', q.concern), '. Relevance, 0 to 100 · VESTA’s weighting, not a probability and not a safety rating. Score = mean of the three best findings; records with no finding follow.'] : 'sorted by PSI id'));
    const toggleCmp = id => {
      let next = cmp.includes(id) ? cmp.filter(x => x !== id) : [...cmp, id];
      if (next.length > 3) next = next.slice(next.length - 3);
      ctx.setParams({ cmp: next.length ? next.join(',') : null });
    };
    const cell = (cls2, content, title) => el('td', { class: cls2, title: title || (typeof content === 'string' ? content : null) }, content);
    const absent = () => el('span.sm-absent', NOT_IN_TABLE);
    const tr = i => {
      const s = S.get(i.psi_id), id = i.psi_id, score = scoreOf.get(id);
      const head = [
        el('td.sm-c-cmp', el('input', { type: 'checkbox', checked: cmp.includes(id) || null, 'aria-label': `Compare ${i.name || id}`, data: { cmp: id }, onclick: e => e.stopPropagation(), onchange: () => toggleCmp(id) })),
        cell('sm-c-name', el('b', displayName(i) || id), i.full_name || i.name || id),
        el('td.sm-c-psi', s.first_row ? ui.cite(s.first_row.id, { small: true, label: id, title: `Open row 1 of the PSI table of ${id}` }) : link(id, i.psi_url || `https://psi.nasa.gov/physci/repo/data/investigations/${id}`, id, 'Open the PSI record of ' + id)),
        cell('sm-c-fam', famLabel(i)),
      ];
      let rest;
      if (!s.has_table) rest = [el('td.sm-c-none', { colspan: 5 }, NO_TABLE)];
      else {
        const fuels = s.fuels.items.map(f => f.value).join(', '), forms = s.forms.items.map(f => f.value).join(', ');
        const o2 = axisText(s.o2);
        const o2Title = [axisText(s.o2, { kind_word: s.kind_word }), s.o2_burner ? `${s.o2_burner.n} rows give the oxygen of the burner stream (${span(s.o2_burner.min, s.o2_burner.max)} %), not of the atmosphere` : null].filter(Boolean).join('. ');
        const p = axisText(s.p, { conv: x => x / KPA_PER_PSI }), pk = axisText(s.p);
        const flow = axisText(s.flow);
        rest = [
          cell('sm-c-fuels', fuels ? [fuels, forms ? el('span.sm-dim', ' · ' + forms) : null] : absent(), fuels ? fuels + (forms ? ' · ' + forms : '') : NOT_IN_TABLE),
          cell('sm-c-o2 num', o2 ? o2 : s.o2_burner ? el('span.sm-absent', { title: o2Title }, 'burner stream only') : absent(), [o2Title || NOT_IN_TABLE, 'raw cells: ' + (rawAxis(rowsOf(id).filter(r => r.o2_basis === 'ambient'), 'o2_percent', 'o2_raw') || NOT_IN_TABLE)].join(' · ')),
          cell('sm-c-p num', p ? [p, el('span.sm-dim', ` (${pk})`)] : absent(), p ? `${p} psia (${pk} kPa) · raw cells: ${rawAxis(rowsOf(id), 'pressure_kpa', 'pressure_raw')}` + (s.p.list.length ? ` · ${s.kind_word}` : '') : s.p_inferred ? `${NOT_IN_TABLE}; ${psiaText(s.p_inferred.value)} inferred from the facility` : NOT_IN_TABLE),
          cell('sm-c-flow num', flow ? flow : s.flow.raw_only ? el('span.sm-absent', 'kept raw') : absent(), flow ? `${flow} cm/s · raw cells: ${rawAxis(rowsOf(id), 'flow_cm_s', 'flow_raw')}` : s.flow.raw_only ? `${s.flow.raw_only} rows keep the raw cell; no clean number` : NOT_IN_TABLE),
          cell('sm-c-n num', fmt.n(s.rows), `${fmt.n(s.rows)} rows · ${s.kinds.map(k => `${words(k.value)} ${k.n}`).join(', ')}`),
        ];
      }
      return el('tr', { class: 'sm-row' + (id === sel ? ' is-sel' : '') + (cmp.includes(id) ? ' is-cmp' : ''), tabindex: 0, data: { sel: id, claim: id },
        title: score == null ? 'No verified finding yet for this record' : `Relevance ${score} of 100: the mean of its three best findings at this cabin`,
        onclick: () => ctx.setParams({ sel: id }), onkeydown: e => { if (e.key === 'Enter') ctx.setParams({ sel: id }); } },
        head, rest, cell('sm-c-f num', String(F(id).length), `${F(id).length} verified findings`));
    };
    const table = el('table.sm-table',
      el('thead', el('tr',
        el('th.sm-c-cmp', { title: 'Tick 2 or 3 to compare' }, 'Cmp'), el('th.sm-c-name', 'Investigation'), el('th.sm-c-psi', 'PSI'), el('th.sm-c-fam', 'Family'),
        el('th.sm-c-fuels', 'Fuels · form'), el('th.sm-c-o2', 'O2 %'), el('th.sm-c-p', 'Pressure psia (kPa)'), el('th.sm-c-flow', 'Flow cm/s'), el('th.sm-c-n', 'Rows'), el('th.sm-c-f', { title: 'Verified findings' }, 'F'))),
      el('tbody', shown.map(tr)));
    const scroller = el('div.sm-scroll', shown.length ? table : ui.empty('none', `No investigation matches these filters ${base}.`, { label: 'Clear filters', onClick: () => ctx.setParams({ fam: null, cls: null, pil: null, tab: null }) }));

    const excluded = db.excluded || [], related = db.related || [];
    const under = el('div.sm-under',
      excluded.length ? el('p.sm-excluded', el('b', 'Excluded: '), excluded.map((x, k) => [k ? '; ' : '', `${x.psi_id} ${x.name || ''}`.trim(), x.why ? ` (${x.why})` : x.research_area ? ` (${x.research_area})` : '']), '.') : null,
      related.length ? el('details.sm-related',
        el('summary', `${related.length} related NASA investigations that are not in PSI (${related.slice(0, 4).map(r => r.name).join(', ')}${related.length > 4 ? ' …' : ''})`, el('span.sm-src', 'NASA page or report, not PSI data')),
        el('ul', related.map(r => { const ids = (r.finding_ids || []).filter(id => db.findingById[id]);
          return el('li', { data: { claim: ids.length ? 'related-' + r.name : null } }, el('b', r.name), r.full_name && r.full_name !== r.name ? ` · ${r.full_name}` : '', ` · ${ids.length} verified findings `, ids.slice(0, 4).map(id => ui.cite(id, { small: true }))); }))) : null);

    const left = ui.panel(`1 Summarize · ${shown.length} of ${nInv} PSI investigations`, [filters, scroller, under], { class: 'sm-left', data: { panel: 'table' } });
    const right = el('div', { class: 'sm-right' + (cmp.length >= 2 ? ' is-comparing' : '') }, cmp.length >= 2 ? comparePanel(cmp) : null, sel && cmp.length < 2 ? detailPanel(db.invById[sel], false) : null,
      cmp.length < 2 ? el('p.sm-hint', cmp.length === 1 ? `Tick one or two more rows to compare with ${db.invById[cmp[0]].name || cmp[0]}.` : 'Tick 2 or 3 rows in the Cmp column to compare them attribute by attribute.') : null);

    root.replaceChildren(el('div.sm', { data: { screen: 'investigations', rows: shown.length } }, left, right));
    const sc = root.querySelector('.sm-scroll'); if (sc) { sc.scrollTop = scrollTop; sc.addEventListener('scroll', () => { scrollTop = sc.scrollTop; }, { passive: true }); }
  }
  function facts(inv, fields, max = 2) {
    const list = (inv.facts || []).filter(f => fields.includes(f.field) && f.quote);
    if (!list.length) return null;
    const one = f => el('p.sm-fact', { data: { claim: f.id } }, srcTag('fact sheet'), el('span.quote', f.quote), ' ', link(f.id, f.source && f.source.url, 'NASA fact sheet', (f.source && f.source.url) || null));
    return [list.slice(0, max).map(one), list.length > max ? el('details.sm-more', el('summary', `${list.length - max} more from the fact sheet`), list.slice(max).map(one)) : null];
  }
  function line(label, body, claimId) {
    return el('div.sm-line', { data: { line: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), claim: claimId || null } }, el('div.sm-line-k', label), el('div.sm-line-v', body));
  }
  function detailPanel(inv, compact) {
    const id = inv.psi_id, s = S.get(id), sum = db.summariesByPsi[id] || inv;
    const psiUrl = inv.psi_url || `https://psi.nasa.gov/physci/repo/data/investigations/${id}`;
    const record = () => link(id, psiUrl, 'PSI record', 'Open the PSI record of ' + id);
    const computed = () => [srcTag('computed from the table'), link(id + ':rows', `api/v1/tests/${id}.csv`, 'all source rows')];

    const actions = [
      s.has_table ? ui.button('PSI tables', { href: psiUrl, target: '_blank', small: true, title: (inv.tables || []).map(t => t.table_file).join('; ') }) : null,
      ui.button('Open at PSI', { href: psiUrl, target: '_blank', small: true, icon: '↗' }),
      s.has_table ? ui.button('Rows CSV', { href: `api/v1/tests/${id}.csv`, target: '_blank', small: true, title: `The ${fmt.n(s.rows)} rows of this investigation, normalised columns and raw cells` }) : null,
    ];
    const objective = filled(inv.objectives)
      ? [el('p.sm-verbatim.quote', String(inv.objectives).trim()), ' ', srcTag('PSI record, verbatim'), record()]
      : [el('span.sm-absent', NOT_IN_RECORD), ' ', record()];

    const lines = [line('Source rows', [el('p', `${fmt.n(s.rows)} source-table rows. ${s.kinds.map(k => `${fmt.n(k.n)} ${words(k.value)}`).join('; ') || 'No rows in this collection'}. `, record())], id + ':row-kinds'), line('Objective', [objective, facts(inv, ['objective'], 1)], id + ':objective')];
    if (!s.has_table) {
      lines.push(line('Test table', [el('span.sm-absent', NO_TABLE_DETAIL), ' ', record()], id + ':table'));
      if (filled(inv.approach)) lines.push(line('Approach', [el('p.sm-verbatim.quote', String(inv.approach).trim()), ' ', srcTag('PSI record, verbatim'), record()], id + ':approach'));
    } else {
      const fuels = s.fuels.items.map(f => `${f.value} ${fmt.n(f.n)}${f === s.fuels.items[0] ? ' rows' : ''}`).concat(s.fuels.missing ? [`not named in the cell ${fmt.n(s.fuels.missing)}`] : []);
      const forms = s.forms.items.map(f => `${f.value} ${fmt.n(f.n)}`);
      lines.push(line('Fuels and samples', [
        el('p', fuels.length ? fuels.join(' · ') : el('span.sm-absent', NOT_IN_TABLE), ' ', computed()),
        el('p', el('span.sm-dim', 'form: '), forms.length ? forms.join(' · ') : el('span.sm-absent', NOT_IN_TABLE)),
        facts(inv, ['fuel'])], id + ':fuels'));

      const o2 = axisText(s.o2, { kind_word: s.kind_word }), p = s.p.lo != null, flow = axisText(s.flow, { kind_word: s.kind_word });
      lines.push(line('Conditions', [
        el('p', el('span.sm-dim', 'O2 '), o2 ? `${o2} % (${fmt.n(s.o2.n + s.o2.list_rows + s.o2.range_rows)} rows)` : el('span.sm-absent', NOT_IN_TABLE),
          s.o2_burner ? el('span.sm-dim', ` · ${fmt.n(s.o2_burner.n)} more rows give the oxygen fed through the burner (${span(s.o2_burner.min, s.o2_burner.max)} %), which is not a cabin atmosphere`) : null, ' ', endpointSources(id, s.o2), computed()),
        el('p', el('span.sm-dim', 'pressure '), p
            ? [axisText(s.p, { conv: x => x / KPA_PER_PSI, kind_word: s.kind_word }), ' psia (', axisText(s.p), ' kPa)', endpointSources(id, s.p)]
            : [el('span.sm-absent', NOT_IN_TABLE), s.p_inferred ? [el('span.sm-dim', ` · ${psiaText(s.p_inferred.value)} inferred from the facility on ${fmt.n(s.p_inferred.n)} rows, shown as inferred `), ui.cite(s.p_inferred.row.id, { small: true })] : null]),
        el('p', el('span.sm-dim', 'flow '), flow ? `${flow} cm/s` + (s.flow_dirs.length ? ` (${s.flow_dirs.map(d => d.value).join(', ')})` : '')
            : s.flow.raw_only ? `kept raw on ${fmt.n(s.flow.raw_only)} rows (no clean number in the cell)` : el('span.sm-absent', NOT_IN_TABLE)),
        facts(inv, ['conditions'])], id + ':conditions'));

      const varied = sum ? (sum.varied || []).map(v => words(v.field) + (isNum(v.min) && isNum(v.max) ? ` ${span(v.min, v.max, 2)}` : v.distinct ? ` (${v.distinct})` : '')) : [];
      const constant = sum ? (sum.constant || []).map(c => `${words(c.field)} = ${c.value}`) : [];
      lines.push(line('Varied / constant', [
        el('p', el('span.sm-dim', 'varied: '), varied.length ? varied.join(' · ') : el('span.sm-absent', NOT_IN_TABLE), ' ', computed()),
        el('p', el('span.sm-dim', 'constant: '), constant.length ? constant.join(' · ') : el('span.sm-absent', NOT_IN_TABLE)),
        facts(inv, ['variables'])], id + ':varied'));

      const out = sum && sum.outcomes ? sum.outcomes.map(o => words(o.name) + (isNum(o.min) && isNum(o.max) ? ` ${span(o.min, o.max, 2)}${o.unit ? ' ' + o.unit : ''}` : '') + ` (${fmt.n(o.n ?? o.cells)})`) : s.outcomes.map(o => `${words(o.name)} (${fmt.n(o.n)})`);
      const sentences = (inv.psi_measurement_sentences || []).slice(0, 2);
      lines.push(line('Measurements', [
        el('p', el('span.sm-dim', 'table outcomes: '), out.length ? out.join(' · ') : el('span.sm-absent', NOT_IN_TABLE), ' ', computed()),
        sentences.length ? el('p', el('span.sm-dim', 'sentences of the PSI record that mention a measurement: '), sentences.map(t => [el('span.quote', t), ' ']), record()) : null,
        facts(inv, ['measurements'])], id + ':measurements'));
    }
    for (const [label, value] of [['Approach', inv.approach], ['Hypothesis', inv.hypothesis]]) {
      if (label === 'Approach' && !s.has_table && filled(value)) continue;
      lines.push(line(label, [filled(value) ? el('p.sm-verbatim.quote', String(value).trim()) : el('span.sm-absent', NOT_IN_RECORD), ' ', srcTag('PSI record'), record()], id + ':' + label.toLowerCase()));
    }
    const years = Array.isArray(inv.years) && inv.years.some(Boolean) ? inv.years.filter(Boolean).join('–') : null;
    const val = (label, v) => [el('span.sm-dim', label + ' '), filled(v) ? String(v) : el('span.sm-absent', NOT_IN_RECORD)];
    lines.push(line('Hardware · years · PI', [
      el('p', val('hardware', inv.hardware), ' · ', val('platform', inv.platform)),
      el('p', val('years', years), ' · ', val('PI', inv.pi), ' ', srcTag('PSI record'), record()),
      facts(inv, ['hardware', 'dates'], 1)], id + ':hardware'));
    const pubs = inv.publications || [];
    lines.push(line('Publications', el('p', pubs.length ? [`${fmt.n(pubs.length)} listed in the PSI record `, pubs.filter(p => p.doi).slice(0, 4).map(p => el('a.sm-doi', { href: 'https://doi.org/' + String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, ''), target: '_blank', rel: 'noopener', title: p.title || p.doi }, 'DOI ↗'))] : el('span.sm-absent', NOT_IN_RECORD), ' ', record()), id + ':publications'));
    const fs = F(id);
    lines.push(line('Verified findings', fs.length
      ? el('p', `${fmt.n(fs.length)} `, fs.slice(0, 8).map(f => ui.cite(f.id, { small: true })), fs.length > 8 ? el('span.sm-dim', ` +${fs.length - 8} more on the Design screen`) : null)
      : el('p.sm-absent', `No verified finding names this record yet ${base}.`), fs.length ? id + ':findings' : null));
    if (inv.si_summary && typeof inv.si_summary === 'object') {
      const parts = Object.entries(inv.si_summary).filter(([k, v]) => ['fuels', 'sample_geometry', 'variables', 'measurements', 'conditions'].includes(k) && filled(v) && typeof v !== 'object');
      if (parts.length) lines.push(line('Extractor summary', [el('p', srcTag('summary written by the Extractor (SI)')), parts.map(([k, v]) => el('p', el('span.sm-dim', words(k) + ': '), String(v))), record()], id + ':summary'));
    }
    const title = el('h2.panel-title.sm-detail-title', el('span', inv.name || id), el('span.sm-detail-sub', [inv.full_name && inv.full_name !== inv.name ? inv.full_name : null, id].filter(Boolean).join(' · ')));
    return ui.panel(title, lines, { class: 'sm-detail' + (compact ? ' is-compact' : ''), actions, scroll: true, data: { panel: 'detail', sel: id } });
  }
  function comparePanel(ids) {
    const cols = ids.map(id => ({ id, inv: db.invById[id], s: S.get(id), sum: db.summariesByPsi[id] || db.invById[id] }));
    const k = cols.length;
    const setRow = (label, valuesOf, note) => {
      const lists = cols.map(c => valuesOf(c) || []);
      const countOf = v => lists.filter(l => l.includes(v)).length;
      const shared = [...new Set(lists.flat())].filter(v => countOf(v) === k);
      return el('tr', { data: { attr: label } }, el('th', label, note ? el('span.sm-src', note) : null),
        lists.map(l => el('td', l.length ? el('div.sm-vals', l.map(v => el('span', { class: 'sm-val' + (countOf(v) === k ? ' is-shared' : countOf(v) === 1 ? ' is-only' : ''), title: countOf(v) === k ? 'in every column' : countOf(v) === 1 ? 'in this column only' : null }, v))) : el('span.sm-absent', NOT_IN_TABLE))),
        el('td.sm-verdict', { title: shared.length ? 'shared: ' + shared.join(', ') : 'none shared' }, shared.length ? ['shared: ', shared.slice(0, 3).join(', '), shared.length > 3 ? ` · +${shared.length - 3} more` : ''] : lists.some(l => !l.length) ? 'not comparable: missing value' : 'none shared'));
    };
    const textRow = (label, valueOf) => {
      const vals = cols.map(valueOf), same = vals.every(v => v === vals[0]);
      const missing = vals.filter(v => !filled(v) || v === NOT_IN_RECORD || v === NOT_IN_TABLE || v === NO_TABLE).length;
      return el('tr', { data: { attr: label } }, el('th', label), vals.map(v => el('td', filled(v) ? String(v) : el('span.sm-absent', NOT_IN_RECORD))), el('td.sm-verdict', missing ? 'not comparable: missing value' : same ? 'same' : 'differs'));
    };
    const barRow = (label, pick, opts = {}) => {
      const axes = cols.map(c => pick(c.s)), his = axes.map(a => a.hi).filter(isNum);
      const axisMax = opts.max ?? (his.length ? Math.max(...his) * 1.08 : 1), conv = opts.conv || (x => x);
      const withVal = axes.filter(a => a.lo != null);
      const lo = withVal.length ? Math.max(...withVal.map(a => a.lo)) : null, hi = withVal.length ? Math.min(...withVal.map(a => a.hi)) : null;
      const verdict = withVal.length === 0 ? `not comparable: no numeric ${label.startsWith('Flow') ? 'flow' : label} in these tables` : withVal.length < k ? 'not comparable: missing value' : axes.every(a => a.lo === axes[0].lo && a.hi === axes[0].hi) ? 'same' : lo <= hi ? `differs · overlap ${span(conv(lo), conv(hi))}${opts.unit ? ' ' + opts.unit : ''}` : 'differs · no overlap';
      return el('tr', { data: { attr: label } }, el('th', label, opts.note ? el('span.sm-src', opts.note) : null),
        cols.map((c, n) => { const a = axes[n];
          if (a.lo == null) return el('td', ui.rangebar(null, null, 0, axisMax, { nullText: a.raw_only ? 'kept raw' : NOT_IN_TABLE }), opts.extra ? opts.extra(c) : null);
          const lbl = opts.label ? opts.label(a, c.s) : undefined;
          return el('td', { data: { claim: `${c.id}:${label}` } }, ui.rangebar(a.n ? a.min : a.range ? a.range[0] : null, a.n ? a.max : a.range ? a.range[1] : null, 0, axisMax, { multi: a.list, unit: opts.unit, label: lbl }), endpointSources(c.id, a), opts.extra ? opts.extra(c) : null); }),
        el('td.sm-verdict', verdict));
    };
    const pLabel = (a, s) => `${axisText(a, { conv: x => x / KPA_PER_PSI })} psia (${axisText(a)} kPa)`;
    const pExtra = c => (c.s.p.lo == null && c.s.p_inferred
      ? el('div.sm-inferred', ui.rangebar(c.s.p_inferred.value, c.s.p_inferred.value, 0, pMax, { inferred: true, label: psiaText(c.s.p_inferred.value) }), ui.cite(c.s.p_inferred.row.id, { small: true })) : null);
    const pHis = cols.flatMap(c => [c.s.p.hi, c.s.p_inferred && c.s.p_inferred.value]).filter(isNum);
    const pMax = pHis.length ? Math.max(...pHis) * 1.08 : 110;
    const rowsAll = () => cols.flatMap(c => rowsOf(c.id));
    const exportCsv = async () => {
      const csv = core.csv && typeof core.csv.toCsv === 'function' ? core.csv.toCsv : null;
      if (!csv || typeof ui.downloadCsv !== 'function') return;
      const n = key => ({ key, get: r => (r.n ? r.n[key === 'pressure_kpa_inferred' ? 'p_inferred' : key] : null) });
      const colsCsv = ['id', 'psi_id', 'investigation', { key: 'source_file', get: r => r.table_file }, { key: 'source_row', get: r => r.row }, 'row_kind', 'test_label', 'fuel', 'fuel_raw', n('material_id'), n('fuel_class'),
        'fuel_phase', 'fuel_form', 'fuel_size', 'o2_percent', 'o2_basis', 'o2_raw', 'pressure_kpa', n('pressure_kpa_inferred'), 'pressure_raw', 'flow_cm_s', 'flow_raw', 'flow_direction', 'diluent', 'gravity', 'platform',
        { key: 'outcomes_json', get: r => r.outcomes || {} }];
      try {
        const response = await fetch('data/tests-raw.json');
        if (!response.ok) throw new Error('Raw cells did not load');
        const file = await response.json(), raw = file.rows || file.raw || file;
        const rows = rowsAll().map(r => ({ ...r, raw: raw[r.id] || r.raw || {} }));
        const keys = [...new Set(rows.flatMap(r => Object.keys(r.raw)))];
        colsCsv.push({ key: 'psi_url', get: r => db.invById[r.psi_id]?.psi_url }, { key: 'license', get: r => db.invById[r.psi_id]?.license });
        colsCsv.push(...keys.map(key => ({ key: 'raw.' + key, get: r => r.raw[key] })));
        ui.downloadCsv(`vesta-compare-${ids.join('-')}.csv`, csv(rows, colsCsv));
      } catch {
        const note = root.querySelector('.sm-export-note');
        if (note) { note.hidden = false; note.textContent = 'Raw cells did not load. Retry the export.'; }
      }
    };
    const layers = [...new Set(cols.flatMap(c => c.s.classes).map(c => (c === 'liquid_droplet' ? 'droplet' : c === 'gas' ? 'gas' : c === 'solid' || c === 'smoke_source' ? 'solid' : null)).filter(Boolean))];
    const table = el('table.sm-cmp', { data: { claim: ids.join(',') }, style: { '--k': String(k) } },
      el('thead', el('tr', el('th', 'Attribute'), cols.map(c => el('th', { data: { claim: c.id + ':compare' } }, el('b', c.inv.name || c.id), el('span.sm-cmp-id', c.id), c.s.first_row ? ui.cite(c.s.first_row.id, { small: true, title: 'Open the first row of this PSI table' }) : link(c.id, c.inv.psi_url, 'PSI record'))), el('th', 'Same / differs'))),
      el('tbody',
        textRow('Family', c => famLabel(c.inv)),
        setRow('Fuels', c => c.s.fuels.items.map(f => f.value)),
        setRow('Fuel form', c => c.s.forms.items.map(f => f.value)),
        barRow('O2 %', s => s.o2, { max: 100, unit: '%', note: 'ambient, 0 to 100' }),
        barRow('Pressure', s => s.p, { max: pMax, label: pLabel, extra: pExtra, conv: x => x / KPA_PER_PSI, unit: 'psia' }),
        barRow('Flow cm/s', s => s.flow, { unit: 'cm/s' }),
        setRow('Gravity', c => c.s.gravity.items.map(g => g.value === 'microgravity' ? '0 g' : g.value === 'normal gravity' ? '1 g' : g.value)),
        setRow('Varied', c => (c.sum ? (c.sum.varied || []).map(v => words(v.field)) : []), 'computed from the table'),
        setRow('Held constant', c => (c.sum ? (c.sum.constant || []).map(v => `${words(v.field)} = ${v.value}`) : []), 'computed from the table'),
        setRow('Recorded', c => c.s.outcomes.map(o => words(o.name))),
        textRow('Source rows', c => (c.s.has_table ? `${fmt.n(c.s.tests)} (${c.s.kinds.map(x => words(x.value)).join(', ')})` : NO_TABLE)),
        textRow('Verified findings', c => String(F(c.id).length))));
    const actions = [
      ui.button('Show ' + (layers.length ? layers.join(' and ') + ' test layers' : 'test layers'), { small: true, icon: '›', onClick: () => ctx.go('#/design' + (layers.length ? '?show=' + layers.join(',') : '')) }),
      ui.button('Export compared rows CSV', { small: true, action: 'export-csv', onClick: exportCsv, title: `${fmt.n(rowsAll().length)} rows` }),
    ];
    return ui.panel(`Compare (${k} of 3)`, [el('p.sm-map-note', 'The Design map shows all investigations in these layers, not only this comparison.'), el('div.sm-cmp-scroll', table), el('div.sm-cmp-actions', actions), el('p.sm-export-note', { hidden: true, role: 'status' })], { class: 'sm-compare', strong: true, data: { panel: 'compare' } });
  }

  function endpointSources(id, axis) {
    return el('span.sm-endpoints', (axis.endpoint_ids || []).map((rid, i) => ui.cite(rid, { small: true, label: (axis.endpoint_ids.length > 1 ? (i ? 'maximum' : 'minimum') : 'value') + ' source' })), link(id + ':csv', `api/v1/tests/${id}.csv`, 'all rows CSV'));
  }
  function renderSimple() {
    const n = db.engine.extractor.psi_kept, total = db.engine.extractor.test_rows;
    const selected = ctx.params.sel && db.invById[ctx.params.sel] ? ctx.params.sel : 'PSI-25';
    const inv = db.invById[selected] || db.investigations[0];
    const source = i => link(i.psi_id, i.psi_url, 'source');
    const kindLabel = k => ({ test: 'individual-test rows', test_day: 'test-day rows', test_series: 'test-series rows', test_group_reference: 'group-reference rows', session: 'session rows', dataset_index: 'dataset-index rows' })[k] || words(k);
    const plain = f => f.claim.replace(/The PSI-\d+ record/g, 'The study record').replace(/The PSI-\d+/g, 'The study').replace(/PSI-\d+/g, 'this study').replace(/Quench test burns on PMMA rods/g, 'In extinguishing tests, acrylic-plastic rod burns').replace(/\bPMMA\b/g, 'acrylic plastic').replace(/\bISS\b/g, 'space station').replace(/microgravity/g, 'near-weightlessness').replace(/quiescent/g, 'still-air').replace(/coflow/g, 'flowing-air').replace(/cool flame extinction/g, 'cool flames going out').replace(/extinguished/g, 'went out');
    const material = i => {
      const s = S.get(i.psi_id), names = s.fuels.items.map(f => f.value);
      if (!s.has_table) return s.rows ? 'Dataset index, not individual burns' : 'No experimental table in PSI';
      if (!names.length) return NOT_IN_TABLE;
      return names.slice(0, 3).join(', ').replace(/\bPMMA\b/g, 'acrylic plastic') + (names.length > 3 ? `; ${names.length - 3} other fuel${names.length - 3 === 1 ? '' : 's'}` : '');
    };
    const finding = i => {
      const candidates = F(i.psi_id).filter(f => f.claim && f.n.work !== 'operations');
      return candidates.sort((a, b) => (a.n.work === 'flight' ? 0 : 1) - (b.n.work === 'flight' ? 0 : 1) || a.claim.length - b.claim.length)[0];
    };
    const rowSummary = i => {
      const s = S.get(i.psi_id), names = s.outcomes.map(o => words(o.name));
      return names.length ? `Recorded: ${names.slice(0, 2).join(', ')}.` : s.kinds.length && s.kinds.every(k => k.value === 'dataset_index') ? 'These rows index datasets rather than individual burns.' : s.rows ? 'No normalized outcome value is recorded in these source rows; see the study record for measurements.' : 'No experimental test table in this collection.';
    };
    const intro = ui.answer('What has NASA tested about fire in space?', `Explore ${n} investigations and ${ui.fmt.n(total)} source-table rows to see what burned, what changed and what was measured.`, { class: 'sms-intro' });
    intro.querySelector('[data-answer]').dataset.claim = 'investigation-counts';
    intro.querySelector('[data-answer]').append(' ', link('investigations', 'api/v1/investigations.json', 'source'));
    intro.append(el('p.sms-note', 'Some rows describe a day, a series or a dataset, rather than one burn. Select an investigation for its finding.'));
    const table = el('table.sms-table',
      el('thead', el('tr', ['Investigation', 'What burned', 'Source rows', 'One finding'].map(t => el('th', { scope: 'col' }, t)))),
      el('tbody', (core.rank?.rankInvestigations(db, ctx.q).map(r => db.invById[r.psi_id]) || db.investigations).map(i => {
        const f = finding(i), s = S.get(i.psi_id);
        return el('tr', { class: i.psi_id === inv.psi_id ? 'is-selected' : '', data: { investigation: i.psi_id } },
          el('th', { scope: 'row' }, el('button.sms-pick', { type: 'button', 'aria-pressed': i.psi_id === inv.psi_id ? 'true' : 'false', onclick: () => { ctx.setParams({ sel: i.psi_id }); if (matchMedia('(max-width:759px)').matches) requestAnimationFrame(() => root.querySelector('.sms-selection')?.scrollIntoView({ block: 'start' })); } }, displayName(i))),
          el('td', { data: { label: 'What burned', claim: i.psi_id + ':fuel' } }, material(i), ' ', source(i)),
          el('td', { data: { label: 'Source rows', claim: i.psi_id + ':rows' } }, String(s.rows), ' ', s.rows ? link(i.psi_id + ':csv', `api/v1/tests/${i.psi_id}.csv`, 'source') : source(i)),
          el('td', { data: { label: 'One finding', claim: f?.id || i.psi_id + ':outcome' } }, f ? plain(f) : rowSummary(i), ' ', f ? ui.cite(f.id, { label: 'source' }) : source(i)));
      })));
    const f = finding(inv), s = S.get(inv.psi_id);
    const detail = el('aside.sms-selection', { 'aria-label': 'Selected investigation' },
      el('span.sms-eyebrow', 'SELECTED INVESTIGATION'), el('h2', displayName(inv)),
      el('p', { data: { claim: inv.psi_id + ':material' } }, material(inv), '. ', source(inv)),
      el('p.sms-finding', { data: { claim: f?.id || inv.psi_id } }, f ? plain(f) : rowSummary(inv), ' ', f ? ui.cite(f.id, { label: 'source' }) : source(inv)),
      el('p.sms-limit', f ? (ctx.core.text.level(f) + '. A finding about this study, not a cabin safety approval.') : 'No reviewed written finding is linked to this record yet.'),
      el('p.sms-note', `${ui.fmt.n(s.rows)} source rows: ${s.kinds.map(k => `${ui.fmt.n(k.n)} ${kindLabel(k.value)}`).join('; ') || 'none in this collection'}.`),
      el('button.sms-details-link', { type: 'button', onclick: () => ctx.setParams({ view: 'details', sel: inv.psi_id }) }, 'See full record and compare'));
    const content = el('section.sms-content', el('div.sms-list', el('p.sms-list-label', `${n} investigations · scroll to explore`), el('div.sms-scroll', table)), detail);
    const footer = el('footer.sms-footer', el('div', el('p', `In VESTA’s evidence base (${n} PSI investigations).`), el('p', ctx.core.text.STATUS_LINE)),
      ui.button('Check a cabin', { primary: true, icon: '›', onClick: () => ctx.go('#/design') }));
    root.replaceChildren(el('div.sms', { data: { screen: 'investigations', simple: true, rows: n } }, intro, content, footer));
    const list = root.querySelector('.sms-scroll');
    list.scrollTop = simpleScroll;
    list.addEventListener('scroll', () => { simpleScroll = list.scrollTop; }, { passive: true });
  }

  render();
  return { unmount() {}, update(next) { ctx = next; render(); } };
}
