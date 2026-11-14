const NA = 'not reported';
const PSI_PAGE = 'https://psi.nasa.gov/physci/repo/data/investigations/';
const WHERE = 'SI agents read NASA text and propose findings and rules at build time. Deterministic code checks every quote, computes every status and score, and runs the officer. Nothing is generated at runtime; the MCP server lets any SI assistant query the same evidence.';
const GATE_CMD = 'python3 research/tools/quotecheck.py <file>';
const DRAWERS = ['rejected', 'dropped', 'excluded', 'notes', 'unmapped'];
const STATUSES = ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED'];

const at = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const arr = (x) => (Array.isArray(x) ? x : []);
const words = (s) => String(s ?? '').replace(/_/g, ' ');

export function mount(root, ctx) {
  const { ui, db } = ctx, { el } = ui, E = db.engine;
  ui.css('css/views/engine.css?v=11');
  root.classList.add('eng');
  const unmount = () => { root.classList.remove('eng'); root.replaceChildren(); };
  if (!E || typeof E !== 'object' || !Object.keys(E).length) {
    root.replaceChildren(ui.empty('load', 'The build report (engine.json) did not load. No count is shown without its file.'));
    return unmount;
  }

  const num = (key) => {
    const v = at(E, key), ok = typeof v === 'number' && Number.isFinite(v);
    return el('b', { class: 'eng-num' + (ok ? '' : ' eng-na'), data: { count: key } }, ok ? v.toLocaleString('en-US') : NA);
  };
  const stat = (key, label, opts = {}) => el('div', { class: 'eng-stat' + (opts.wide ? ' eng-wide' : '') + (opts.tone ? ' eng-' + opts.tone : ''), data: { claim: key } },
    num(key), el('span.eng-lab', label, opts.more ? [' ', opts.more] : null));
  const scen = db.scenario?.meta?.id ?? Object.keys(E.officer ?? {}).find((k) => E.officer[k] && typeof E.officer[k] === 'object') ?? 'transit-avionics-01';
  const O = `officer.${scen}`;
  if (new URLSearchParams(location.hash.split('?')[1] ?? '').get('view') !== 'details') {
    root.classList.add('eng-simple');
    const title = 'Can you trust it?';
    const value = key => { const n = at(E, key); return typeof n === 'number' ? n.toLocaleString('en-US') : NA; };
    const sentence = `${value('verifier.quotes_verified')} quote excerpts matched source text; ${value('verifier.rejected.length')} were rejected. Recommendations remain VESTA interpretations.`;
    const pipeline = [
      ['extractor', 'Read', 'extractor.psi_kept', 'NASA investigations', 'SI proposes findings from NASA sources.'],
      ['verifier', 'Check', 'verifier.quotes_verified', 'quotes matched', 'Code checks the text and its conditions.'],
      ['ranker', 'Rank', 'ranker.findings', 'findings available', 'Code ranks relevance to your question.'],
      ['officer', 'Interpret', `${O}.steps`, 'scripted decisions', 'A playbook connects evidence to the drill.'],
    ];
    root.replaceChildren(
      ui.answer(title, sentence, { class: 'eng-simple-head' }),
      el('div.eng-simple-body', el('section.eng-simple-pipeline', { 'aria-label': 'Evidence pipeline' }, pipeline.map(([id, label, key, unit, text]) =>
        el('article.eng-simple-node', { data: { node: id } }, el('h2', label), num(key), el('p.eng-simple-unit', unit), el('p', text)))),
      el('section.eng-simple-limit',
        el('h2', 'Text matching is the first check.'),
        el('p', 'It does not validate VESTA’s interpretation or certify safety. Missing evidence stays visible; VESTA does not guess.'),
        el('a', { href: 'data/engine.json', target: '_blank', rel: 'noopener', class: 'eng-source' }, 'source'),
        ui.button('Use the data', { primary: true, href: '#/open', onClick: (e) => { e.preventDefault(); ctx.go('#/open'); } }))),
      el('p.eng-simple-status', ctx.core?.text?.STATUS_LINE ?? 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION'));
    return () => { root.classList.remove('eng-simple'); unmount(); };
  }
  const reviewWarnings = arr(E.warnings).filter(w => /review/.test(w.kind ?? ''));
  const reviewCoverage = E.verifier?.review_coverage;
  const reviewScope = reviewCoverage
    ? [reviewCoverage.scope, arr(reviewCoverage.unreported_families).length ? `Not reported: ${reviewCoverage.unreported_families.join(', ')}.` : null, arr(reviewCoverage.withheld_families).length ? `Withheld: ${reviewCoverage.withheld_families.join(', ')}.` : null].filter(Boolean).join(' ')
    : reviewWarnings.length
    ? 'Review totals cover reporting families only. Not reported: ' + reviewWarnings.map(w => `${w.family ?? 'unnamed family'} (${words(w.kind)})`).join('; ') + '.'
    : 'Review totals cover families that report independent review counts.';
  const more = (id, label) => el('button.eng-more', { type: 'button', data: { drawerOpen: id }, onclick: () => show(id) }, label);

  const built = E.generated_at ?? db.meta?.generated_at ?? null;
  const head = el('header.eng-head',
    el('h1.t-display-2', 'Engine'),
    el('p.eng-built', 'built ', el('b', { data: { built: built ?? '' } }, built ? ui.fmt.est(built) : NA), ' from the files in the repository'),
    el('p.eng-motto', 'SI reads; code checks.'));

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
        el('span.t-label', 'independent review: reporting families'),
        reviewCoverage ? el('span', num('verifier.review_coverage.reporting_families.length'), ' of ', num('verifier.review_coverage.total_families'), ' research families report review totals') : null,
        el('span', num('verifier.review.input'), ' candidates in reported review totals'),
        el('span', num('verifier.review.kept_unchanged'), ' kept unchanged'),
        el('span', num('verifier.review.kept_with_changes'), ' hints narrowed to their source text'),
        el('span', num('verifier.review.rejected'), ' rejected'),
        el('span', num('verifier.review.pending'), ' pending among reporting families'),
        el('p', reviewScope)),
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

  const rejected = arr(E.verifier?.rejected), dropped = arr(E.verifier?.conditions_dropped), excluded = arr(E.extractor?.psi_excluded);
  const warnings = arr(E.warnings), notes = tableNotes(db);
  const count = { rejected: rejected.length, dropped: dropped.length, excluded: excluded.length, notes: notes.length, unmapped: warnings.length };
  const label = { rejected: 'Rejected (did not ship)', dropped: 'Conditions dropped', excluded: 'Excluded records', notes: 'Table notes', unmapped: 'Build warnings' };
  const idCell = (id) => el('td.eng-id', db.findingById?.[id] ? ui.cite(id) : String(id ?? ''));
  const table = (heads, rows) => el('table.eng-table', el('thead', el('tr', heads.map((h) => el('th', h)))), el('tbody', rows));
  const none = (text) => el('p.eng-none', text);

  const bodies = {
    rejected: () => (rejected.length
      ? table(['Candidate', 'Quote starts', 'Why it did not ship'], rejected.map((r) => el('tr', { data: { rejectedId: r.id ?? '' } },
          el('td.eng-id', String(r.id ?? '')), el('td.eng-q', r.quote ? `"${r.quote}"` : String(r.file ?? r.family ?? r.kind ?? '')), el('td', words(r.why ?? r.reason ?? NA)))))
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
          el('td.eng-q', words(n.basis ?? ''), n.quote ? [': ', el('span.quote', n.quote), n.url ? [' ', el('a', { href: n.url, target: '_blank', rel: 'noopener' }, 'source')] : null] : null))))
      : none('The table notes are not in this build.')),
    unmapped: () => (warnings.length
      ? table(['Kind', 'Family / record', 'What the build could not map'], warnings.map((w) => el('tr', el('td', words(w.kind)), idCell(w.family ?? w.id), el('td', w.value == null ? String(w.message ?? w.why ?? '') : String(w.value)))))
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
    el('p.eng-review-limit', 'Quote verification means text matching, not independent scientific approval of every interpretation.'),
    el('div.eng-links', ui.button('Open data, API, MCP', { href: '#/open', small: true }), ui.button('engine.json', { href: 'data/engine.json', target: '_blank', small: true })),
  ], { class: 'eng-side' });

  root.replaceChildren(head, nodes, el('div.eng-bottom', drawers, cover, side));
  show(ctx.params?.d, false);
  return unmount;
}

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
