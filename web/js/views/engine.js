// Engine (#/engine): Extractor, Verifier, Ranker, Officer with the counts of this build. DESIGN.md 2.5 and 4.8.
// Every number on this screen is read from web/data/engine.json (db.engine) and carries data-count="<dotted key>".
// A count the build could not derive prints "not reported", never 0. Nothing here is typed.
const NA = 'not reported';
const PSI_PAGE = 'https://psi.nasa.gov/physci/repo/data/investigations/';
const WHERE = 'SI agents read NASA text and propose findings and rules at build time. Deterministic code checks every quote, computes every status and score, and runs the officer. Nothing is generated at runtime; the MCP server lets any SI assistant query the same evidence.';
const GATE_CMD = 'python3 research/tools/quotecheck.py <file>';
const DRAWERS = ['rejected', 'dropped', 'excluded', 'notes', 'unmapped'];
const STATUSES = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];

const at = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const arr = (x) => (Array.isArray(x) ? x : []);
const words = (s) => String(s ?? '').replace(/_/g, ' ');
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n).trimEnd() + '...' : String(s));

export function mount(root, ctx) {
  const { ui, db } = ctx, { el } = ui, E = db.engine;
  ui.css('css/views/engine.css');
  root.classList.add('eng');
  const unmount = () => { root.classList.remove('eng'); root.replaceChildren(); };
  if (!E || typeof E !== 'object' || !Object.keys(E).length) {
    root.replaceChildren(ui.empty('load', 'The build report (engine.json) did not load. No count is shown without its file.'));
    return unmount;
  }

  // one number of engine.json: <b data-count="extractor.psi_kept">24</b>
  const num = (key) => {
    const v = at(E, key), ok = typeof v === 'number' && Number.isFinite(v);
    return el('b', { class: 'eng-num' + (ok ? '' : ' eng-na'), data: { count: key } }, ok ? v.toLocaleString('en-US') : NA);
  };
  const stat = (key, label, opts = {}) => el('div', { class: 'eng-stat' + (opts.wide ? ' eng-wide' : '') + (opts.tone ? ' eng-' + opts.tone : ''), data: { claim: key } },
    num(key), el('span.eng-lab', label, opts.more ? [' ', opts.more] : null));
  const scen = db.scenario?.meta?.id ?? Object.keys(E.officer ?? {}).find((k) => E.officer[k] && typeof E.officer[k] === 'object') ?? 'transit-avionics-01';
  const O = `officer.${scen}`;
  const more = (id, label) => el('button.eng-more', { type: 'button', data: { drawerOpen: id }, onclick: () => show(id) }, label);

  // ---------------------------------------------------------------- header
  const built = E.generated_at ?? db.meta?.generated_at ?? null;
  const head = el('header.eng-head',
    el('h1.t-display-2', 'Engine'),
    el('p.eng-built', 'built ', el('b', { data: { built: built ?? '' } }, built ? ui.fmt.est(built) : NA), ' from the files in the repository'),
    el('p.eng-motto', 'SI reads; code checks.'));

  // ---------------------------------------------------------------- the four nodes
  const si = E.si_use ?? {};
  const node = (id, title, who, stats) => {
    const p = ui.panel(title, el('div.eng-stats', stats), { class: 'eng-node', data: { node: id }, tag: who });
    if (si[id]) p.bodyEl.append(el('p.eng-use', si[id]));
    return p;
  };
  const termCount = Object.keys(ctx.core?.rank?.W ?? {}).length;
  const arrow = () => el('i.eng-arrow', { 'aria-hidden': 'true' }, ui.svg('svg', { viewBox: '0 0 28 16', width: 28, height: 16 },
    ui.svg('path', { d: 'M0 8h24M18 2l7 6-7 6', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
  const nodes = el('div.eng-flow',
    el('div.eng-src', { data: { node: 'sources' } },
      el('span.t-label', 'read at build time'),
      el('b', 'NASA PSI'), el('span', 'investigation records and experimental tables'),
      el('b', 'NTRS'), el('span', 'NASA technical reports'),
      el('b', 'NASA pages'), el('span', 'fact sheets, mission pages; and the challenge page')),
    arrow(),
    node('extractor', 'Extractor', ui.chip('SI', { small: true, label: 'SI agents · declared' }), [
      stat('extractor.psi_records_read', 'PSI records read'),
      stat('extractor.psi_kept', 'kept', { more: el('span.eng-sub', '· ', num('extractor.psi_excluded.length'), ' excluded ', more('excluded', 'why')) }),
      stat('extractor.tables', 'PSI tables'),
      stat('extractor.test_rows', 'test rows'),
      stat('extractor.source_texts', 'NASA texts cached'),
      stat('extractor.ntrs_records', 'NTRS records'),
      stat('extractor.facts', 'fact-sheet facts'),
      stat('extractor.records_without_table', 'records with no table'),
      stat('extractor.candidate_findings', 'candidate findings'),
      stat('extractor.candidate_rules', 'rules proposed'),
    ]),
    arrow(),
    node('verifier', 'Verifier', ui.tag('deterministic code'), [
      stat('verifier.quotes_checked', 'quotes checked'),
      stat('verifier.quotes_verified', 'quotes verified'),
      stat('verifier.rejected.length', 'rejected', { more: more('rejected', 'list') }),
      stat('verifier.conditions_dropped.length', 'conditions dropped', { more: more('dropped', 'list') }),
      stat('verifier.cut_before_qualifier.length', 'cut before a qualifier'),
      stat('verifier.config_quotes_verified', 'preset, protocol and table-note quotes'),
      el('div.eng-review', { data: { claim: 'verifier.review' } },
        el('span.t-label', 'independent review of the SI candidates'),
        el('span', num('verifier.review.kept_unchanged'), ' kept unchanged'),
        el('span', num('verifier.review.kept_with_changes'), ' narrowed: an SI-written hint that went past its quote was cut back'),
        el('span', num('verifier.review.rejected'), ' rejected'),
        el('span', num('verifier.review.pending'), ' pending, not shown anywhere else')),
    ]),
    arrow(),
    node('ranker', 'Ranker', ui.tag('deterministic formula'), [
      stat('ranker.findings', 'findings ranked'),
      stat('ranker.table_findings', 'of them read from PSI tables'),
      stat('ranker.rules_shipped', 'rules shipped'),
      stat('ranker.rows_indexed', 'rows indexed'),
      stat('ranker.cabin_rows', 'cabin-material rows'),
      stat('ranker.model_rows', 'model-fuel rows'),
      stat('ranker.burner_stream_rows', 'burner-stream rows, never plotted'),
      stat('ranker.multi_value_rows', 'rows with several values in a cell'),
      stat('ranker.rank_files', 'rank files'),
      el('div.eng-stat', el('b', { class: 'eng-num' + (termCount ? '' : ' eng-na') }, termCount ? String(termCount) : NA), el('span.eng-lab', 'score terms')),
    ]),
    arrow(),
    node('officer', 'Officer', ui.tag('deterministic playbook'), [
      stat(`${O}.steps`, 'steps in the drill'),
      stat('officer.protocol_lines', 'ISS protocol lines'),
      stat(`${O}.experiment`, 'from experiments'),
      stat(`${O}.summary`, 'from NASA summaries'),
      stat(`${O}.operations`, 'from ISS operations'),
      stat(`${O}.no_source`, 'NO SOURCE', { tone: 'nosource' }),
      el('p.eng-rule', 'No source, no action.'),
    ]));

  // ---------------------------------------------------------------- drawers
  const rejected = arr(E.verifier?.rejected), dropped = arr(E.verifier?.conditions_dropped), excluded = arr(E.extractor?.psi_excluded);
  const warnings = arr(E.warnings), notes = tableNotes(db);
  const count = { rejected: rejected.length, dropped: dropped.length, excluded: excluded.length, notes: notes.length, unmapped: warnings.length };
  const label = { rejected: 'Rejected (did not ship)', dropped: 'Conditions dropped', excluded: 'Excluded records', notes: 'Table notes', unmapped: 'Unmapped values' };
  const idCell = (id) => el('td.eng-id', db.findingById?.[id] ? ui.cite(id) : String(id ?? ''));
  const table = (heads, rows) => el('table.eng-table', el('thead', el('tr', heads.map((h) => el('th', h)))), el('tbody', rows));
  const none = (text) => el('p.eng-none', text);

  const bodies = {
    rejected: () => (rejected.length
      ? table(['Candidate', 'Quote starts', 'Why it did not ship'], rejected.map((r) => el('tr', { data: { rejectedId: r.id ?? '' } },
          el('td.eng-id', String(r.id ?? '')), el('td.eng-q', r.quote ? `"${clip(r.quote, 110)}"` : String(r.file ?? r.family ?? r.kind ?? '')), el('td', words(r.why ?? r.reason ?? NA)))))
      : none('0 rejected in this build report.')),
    dropped: () => (dropped.length
      ? table(['Finding', 'Condition', 'Value the SI wrote', 'Why it was dropped'], dropped.map((r) => el('tr', { data: { droppedId: r.id ?? '', claim: 'dropped' } },
          idCell(r.id), el('td', words(r.field)), el('td', r.value == null ? '' : typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)), el('td', words(r.why ?? 'the number is not in the quote')))))
      : none('0 conditions dropped.')),
    excluded: () => (excluded.length
      ? table(['PSI record', 'Why it is not one of the investigations'], excluded.map((r) => el('tr', { data: { excludedId: r.psi_id ?? '' } },
          el('td.eng-id', el('a', { href: PSI_PAGE + encodeURIComponent(r.psi_id), target: '_blank', rel: 'noopener' }, r.psi_id), r.name ? el('span.eng-dim', ' ' + r.name) : null), el('td', r.why ?? NA))))
      : none('No record was excluded.')),
    notes: () => (notes.length
      ? table(['PSI table', 'Cabin material', 'Fuel class', 'May speak to', 'Pressure from', 'Basis'], notes.map((n) => el('tr',
          el('td.eng-id', el('b', n.label), n.tables.length ? el('span.eng-dim', ' ' + n.tables.join(', ')) : null),
          el('td', n.cabin ? 'yes' : 'no'), el('td', words(n.fuel_class ?? NA)), el('td', n.pillars.length ? n.pillars.join(', ') : 'none'),
          el('td', n.facility && n.facility !== 'none' ? `${String(n.facility).toUpperCase()} facility, shown as inferred` : 'the table only'),
          el('td.eng-q', words(n.basis ?? ''), n.quote ? [': ', el('span.quote', clip(n.quote, 150)), n.url ? [' ', el('a', { href: n.url, target: '_blank', rel: 'noopener' }, 'source')] : null] : null))))
      : none('The table notes are not in this build.')),
    unmapped: () => (warnings.length
      ? table(['Kind', 'Record', 'What the build could not map'], warnings.map((w) => el('tr', el('td', words(w.kind)), idCell(w.id), el('td', w.value == null ? String(w.message ?? w.why ?? '') : String(w.value)))))
      : none('0 unmapped values. Every evidence level, source kind and habitat tag in the research files is in the fixed vocabulary.')),
  };
  const tabs = el('div.eng-tabs', { role: 'tablist' }, DRAWERS.map((id) => el('button.eng-tab', { type: 'button', role: 'tab', data: { drawer: id }, onclick: () => show(id) },
    el('span', label[id]), el('b.num', String(count[id])))));
  const body = el('div.eng-drawer', { role: 'tabpanel' });
  const gate = el('p.eng-gate', 'Rerun the gate: ', el('code', GATE_CMD), el('span.eng-dim', '  ·  gate script: '), el('code', String(E.gate ?? 'research/tools/quotecheck.py')));
  const drawers = ui.panel(null, [tabs, body, gate], { class: 'eng-drawers' });

  function show(id, write = true) {
    const open = DRAWERS.includes(id) ? id : 'rejected';
    for (const t of tabs.children) { const on = t.dataset.drawer === open; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); }
    body.dataset.drawerBody = open;
    body.replaceChildren(bodies[open]());
    body.scrollTop = 0;
    if (write && ctx.params?.d !== open) ctx.setParams?.({ d: open }, { replace: true, render: false });
  }

  // ---------------------------------------------------------------- where the SI is, and the coverage the Ranker computed
  const cells = E.ranker?.cells ?? {};
  const presetIds = arr(db.presets).map((p) => p.id).filter((id) => cells[id]);
  const coverage = presetIds.length ? el('table.eng-table.eng-cov', { data: { claim: 'ranker.cells' } },
    el('thead', el('tr', el('th', 'Material x concern cells at'), STATUSES.map((s) => el('th', el('span', { data: { status: s } }, s.replace(/_/g, ' ')))))),
    el('tbody', presetIds.map((id) => el('tr', el('td', words(id)), STATUSES.map((s) => el('td.eng-c', num(`ranker.cells.${id}.${s}`)))))))
    : none('Coverage counts are not in this build.');
  const cover = ui.panel('Coverage computed', [
    coverage,
    el('p.eng-line', ctx.core?.text?.STATUS_LINE ?? 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION'),
  ], { class: 'eng-cover', tag: 'from the test rows' });
  const side = ui.panel('Where the SI is', [
    el('p.eng-where', WHERE),
    el('div.eng-links', ui.button('Open data, API, MCP', { href: '#/open', small: true }), ui.button('engine.json', { href: 'data/engine.json', target: '_blank', small: true })),
  ], { class: 'eng-side' });

  root.replaceChildren(head, nodes, el('div.eng-bottom', drawers, cover, side));
  show(ctx.params?.d, false);
  return unmount;
}

// config/table-notes.json as the build ships it in tables.json: what each PSI table is allowed to speak to, and why.
function tableNotes(db) {
  const out = [];
  for (const t of arr(db.tables)) {
    const n = t?.note;
    if (!n || typeof n !== 'object') continue;
    const src = n.source ?? arr(n.sources)[0] ?? null;
    out.push({ label: t.investigation ?? t.name ?? t.psi_id ?? t.table_file ?? '', tables: [t.psi_id, t.key ?? t.table_key].filter(Boolean),
      cabin: !!n.cabin, fuel_class: n.fuel_class, pillars: arr(n.pillars), facility: n.facility, basis: n.basis ?? (src ? 'NASA text' : 'PSI record'), quote: n.quote ?? src?.quote ?? null, url: src?.url ?? null });
  }
  return out;
}
