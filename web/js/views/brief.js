import { cite } from '../world/cite.js?v=sebas-20261115-2';

function heroWorld(ctx, compact = false) {
  const { ui, db } = ctx, el = ui.el;
  const finding = db.findingById['S-SHAPE-01'];
  const poster = innerWidth < 760 && !compact ? 'assets/scene/hero-phone.jpg' : 'assets/scene/hero.jpg';
  const host = el('div.bfh-stage', { 'aria-hidden': 'true' });
  const output = el('output.bfh-state', { for: compact ? 'brief-flame-details' : 'brief-flame' }, 'In space');
  const slider = el('input.bfh-slider', { id: compact ? 'brief-flame-details' : 'brief-flame', type: 'range', min: 0, max: 100, step: 1, value: 100,
    'aria-label': 'Illustrated flame, On Earth to In space', 'aria-valuetext': 'In space, rounded low-momentum flame' });
  const status = el('p.bfh-static', { hidden: true }, 'Still illustration. The flame control is available in the live 3D view.');
  const controls = el('div.bfh-controls',
    el('div.bfh-control-title', el('label', { for: slider.id }, 'Drag to change the view'), output),
    slider, el('div.bfh-ends', el('span', 'On Earth'), el('span', 'In space')), status);
  const note = el('p.bfh-note', 'Illustration of a NASA observation, not a simulation. Low-momentum flames only.');
  const description = el('p.bfh-description', 'VESTA floats beside a flame in a cabin with Mars in the window. The control changes a yellow teardrop illustration into a rounded blue flame.');
  const evidence = el('div.bfh-evidence', { data: { claim: finding?.id } },
    el('p.bfh-evidence-label', 'NASA observed'),
    finding ? el('blockquote', el('span.quote', cite(finding.quote, finding.id))) : el('p', 'The source observation is unavailable.'),
    el('p.bfh-scope', 'The observation concerns low-momentum flames, not every fire in space. Shape and colour do not establish safety.'));
  const picture = el('div.bfh-world', host, el('span.bfh-world-label', 'VESTA / Cabin illustration'), controls);
  const node = el(compact ? 'section.bfh.bfh-details' : 'div.bfh', picture, note, description);
  let alive = true, stage, observer, drag;
  const capture = ctx.capture || new URLSearchParams(location.hash.split('?')[1] || '').get('capture') === '1';
  const syncMode = () => {
    const isStill = stage?.mode === 'still';
    slider.disabled = isStill; status.hidden = !isStill;
    node.dataset.mode = isStill ? 'still' : 'live';
  };
  const change = () => {
    const space = Number(slider.value) / 100;
    output.textContent = space === 0 ? 'On Earth' : space === 1 ? 'In space' : 'Between illustrations';
    slider.setAttribute('aria-valuetext', space === 0 ? 'On Earth, yellow teardrop' : space === 1 ? 'In space, rounded low-momentum flame' : 'Transition between two illustrations');
    stage?.set({ space });
  };
  const pointer = event => {
    if (capture) return;
    const b = host.getBoundingClientRect();
    if (drag && stage?.mode !== 'still') {
      const delta = (event.clientX - drag.x) / b.width;
      if (Math.abs(delta) > .012) drag.moved = true;
      if (drag.moved) { slider.value = String(Math.round(Math.max(0, Math.min(100, drag.value + delta * 160)))); change(); }
    }
    stage?.set({ pointerX: (event.clientX - b.left) / b.width * 2 - 1, pointerY: 1 - (event.clientY - b.top) / b.height * 2 });
  };
  const down = event => {
    if (capture || stage?.mode === 'still' || event.button !== 0) return;
    drag = { x: event.clientX, value: Number(slider.value), moved: false };
    host.setPointerCapture(event.pointerId);
  };
  const up = () => { drag = null; };
  const leave = () => { if (!drag) stage?.set({ pointerX: 0, pointerY: 0 }); };
  host.addEventListener('pointerdown', down); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  slider.addEventListener('input', change); host.addEventListener('pointermove', pointer); host.addEventListener('pointerleave', leave);
  return {
    node, evidence,
    async start() {
      try {
        const [{ createStage }, hero] = await Promise.all([import('../scene/engine.js?v=sebas-20261115-2'), import('../scene/hero.js')]);
        if (!alive) return;
        stage = await createStage(host, { capture: ctx.capture || new URLSearchParams(location.hash.split('?')[1] || '').get('capture') === '1', still: poster });
        if (!alive) { stage.dispose(); return; }
        await stage.use({ ...hero, still: poster, build: async sceneCtx => ({ ...await hero.build(sceneCtx), still: poster }) }, { space: 1, framing: compact ? 'panel' : 'immersive' });
        if (!alive) return;
        observer = new MutationObserver(syncMode); observer.observe(host, { attributes: true, attributeFilter: ['data-scene-mode'] });
        syncMode();
      } catch {
        if (!alive) return;
        host.append(el('img.bfh-fallback', { src: poster, alt: '' }));
        slider.disabled = true; status.hidden = false;
      }
    },
    dispose() {
      alive = false; observer?.disconnect(); stage?.dispose();
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up);
      slider.removeEventListener('input', change); host.removeEventListener('pointermove', pointer); host.removeEventListener('pointerleave', leave);
    }
  };
}

const CONCERNS = ['prevention', 'detection', 'suppression'];
const CONCERN_LABEL = { prevention: 'Prevention', detection: 'Detection', suppression: 'Suppression' };
const ADVANCE_MS = 6000, STRIKE_MS = 1200;

const isNum = x => typeof x === 'number' && isFinite(x);
const words = s => String(s ?? '').replace(/_/g, ' ');
const findingTitle = f => f.title || f.claim;
const dig = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function mountDetails(root, ctx) {
  const { ui, db } = ctx, el = ui.el, fmt = ui.fmt;
  ui.css('css/views/brief.css?v=13');
  ui.css('css/world.css?v=sebas-20261115-2');
  const core = ctx.core || {}, rankMod = core.rank, statusMod = core.status, text = core.text;
  const nInv = db.investigations.length;
  const base = `in VESTA’s evidence base (${nInv} PSI investigations)`;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const wipe = node => { while (node.firstChild) node.removeChild(node.firstChild); };
  let q = ctx.q, alive = true;

  const say = (fn, ...a) => { try { const s = text && typeof text[fn] === 'function' ? text[fn](...a) : null; return typeof s === 'string' && s ? s : null; } catch { return null; } };
  const pressure = kpa => say('pressure', kpa) || (isNum(kpa) ? `${fmt.short(kpa / 6.89476)} psia (${fmt.short(kpa)} kPa)` : 'not stated');
  const level = f => say('level', f) || words(f.n.work);
  const dataset = (path, label = 'source data') => el('a.world-cite', { href: path, target: '_blank', rel: 'noopener', data: { cite: path } }, label);
  const count = (key, value) => {
    const v = value === undefined ? dig(db.engine, key) : value;
    return el('b.bf-n.num', { data: { count: key } }, isNum(v) ? fmt.n(v) : 'not reported');
  };
  const comm = db.scenario && db.scenario.meta && db.scenario.meta.comm;
  const delay = (comm && db.findingById[comm.one_way_finding]) || db.findings.find(f => f.n.topic === 'comm_delay' && /one way/i.test(f.quote || '')) || null;
  const why = db.findings.find(f => f.n.read_in === 'challenge_page' && /hard to find/i.test(f.quote || '')) || null;
  const sub = el('p.bf-sub');
  if (delay) sub.append(el('span.bf-sub-claim', { data: { claim: delay.id } }, 'Mars: ', el('span.quote', cite(delay.quote, delay.id))));
  if (why) sub.append(' ', el('span.bf-sub-claim', { data: { claim: why.id } }, 'NASA’s combustion data: ', el('span.quote', cite(why.quote, why.id))));
  const hero = el('header.bf-hero',
    el('div.bf-hero-text',
      el('h1.bf-tagline', 'The fire officer that doesn’t wait for Houston'),
      sub.childNodes.length ? sub : null),
    el('div.bf-drill',
      typeof ui.vesta === 'function' ? ui.vesta('point', { size: 104 }) : null,
      ui.button('Run fire drill', { primary: true, action: 'drill', icon: '▶', class: 'bf-drill-btn', title: 'Open Incident mode and start the simulated fire', onClick: () => ctx.go('#/incident?play=1') })));
  function families() {
    const order = [], by = new Map();
    for (const f of db.families || []) { by.set(f.id, { id: f.id, label: f.label, grouping: f.grouping, n: 0 }); order.push(f.id); }
    for (const i of db.investigations) {
      const id = i.family ?? 'none';
      if (!by.has(id)) { by.set(id, { id, label: i.family_label || words(id), grouping: null, n: 0 }); order.push(id); }
      by.get(id).n++;
    }
    return order.map(id => by.get(id)).filter(f => f.n > 0);
  }
  function summarizePanel() {
    const fams = families(), max = Math.max(1, ...fams.map(f => f.n));
    const eng = db.engine && db.engine.extractor;
    const rows = eng && isNum(eng.test_rows) ? count('extractor.test_rows') : el('b.bf-n.num', fmt.n(db.tests.length));
    const tabs = eng && isNum(eng.tables) ? count('extractor.tables') : el('b.bf-n.num', fmt.n(db.tables.length));
    const excluded = db.excluded || [];
    const body = el('div.bf-sum', { data: { claim: 'investigation-summary' } },
      el('div.bf-big', el('span.bf-big-n.num', { data: { total: 'investigations' } }, String(nInv)), el('span.bf-big-t', 'PSI combustion', el('br'), 'investigations')),
      el('p.bf-line', rows, ' test rows in ', tabs, ' PSI tables'),
      el('ul.bf-fams', fams.map(f => el('li',
        el('button.bf-fam', { type: 'button', data: { fam: f.id }, title: (f.grouping ? f.grouping + '. ' : '') + 'Open these investigations', onclick: () => ctx.go('#/investigations?fam=' + encodeURIComponent(f.id)) },
          el('span.bf-fam-label', f.label), el('span.bf-fam-n.num', { data: { famCount: f.n } }, String(f.n)),
          el('span.bf-fam-track', el('span.bf-fam-bar', { style: { width: (100 * f.n / max) + '%' } })))))),
      excluded.length ? el('p.bf-note', `${excluded.length} more PSI records matched the search and are excluded: ${excluded.map(x => x.psi_id).join(', ')}.`) : null,
      el('div.bf-foot', dataset('api/v1/investigations.json', 'PSI records'), ui.button('Browse + compare', { icon: '›', onClick: () => ctx.go('#/investigations') })));
    return ui.panel('Summarize', body, { class: 'bf-p1', data: { panel: 'summarize' } });
  }
  const rules = (db.rules || []).filter(r => (r.finding_ids || []).some(id => db.findingById[id]));
  const bestOf = (rule, point) => {
    const F = (rule.finding_ids || []).map(id => db.findingById[id]).filter(Boolean);
    if (!F.length) return null;
    if (!rankMod || !isNum(point.o2) || !isNum(point.p)) return { f: F[0], total: 0 };
    return rankMod.rank(F, point, db)[0];
  };
  let ruleIdx = 0;
  if (rules.length) {
    let top = -1;
    rules.forEach((r, i) => { const b = bestOf(r, q); const s = b ? b.total + (r.pillar === q.concern ? 1000 : 0) : -1; if (s > top) { top = s; ruleIdx = i; } });
  }
  let touched = !!ctx.capture;
  const ruleBody = el('div.bf-rule');
  const ruleCount = el('span.bf-rule-count.num');
  function showRule(i) {
    ruleIdx = (i + rules.length) % rules.length;
    const rule = rules[ruleIdx];
    const f = (rule.finding_ids || []).map(id => db.findingById[id]).filter(Boolean)[0] || null;
    ruleCount.textContent = `rule ${ruleIdx + 1} of ${rules.length}`;
    wipe(ruleBody);
    const tri = ui.triad(rule, db, { strikeAfter: ctx.capture ? 0 : STRIKE_MS });
    for (const col of tri.querySelectorAll('[data-claim]')) {
      const id = col.dataset.claim, finding = db.findingById[id];
      const quote = col.querySelector('.triad-quote,.triad-strike');
      if (quote && finding) quote.replaceChildren(cite(quote.textContent, id));
      const cells = col.querySelectorAll('.triad-cells li');
      cells.forEach((cell, index) => {
        const record = finding?.cells?.[index];
        if (record?.row_id) cell.replaceChildren(cite(cell.textContent, record.row_id));
      });
    }
    tri.querySelectorAll('.triad-foot .cite').forEach(node => node.remove());
    ruleBody.append(
      el('div.bf-triad', { data: { claim: rule.id, rule: rule.id } }, tri),
      el('div.bf-rule-meta',
        f ? el('p.bf-rule-src', { data: { claim: f.id } }, el('span.bf-rule-level', cite(level(f), f.id)),
              f.gate && f.gate.pass ? el('span.bf-ok', { title: 'The quote stands verbatim in the cached NASA text (research/tools/quotecheck.py)' }, '✓ quote verified') : null) : null,
        rule.limits ? el('p.bf-rule-limits', { data: { claim: rule.id } }, el('span.bf-k', 'Limits'), f ? cite(rule.limits, f.id) : rule.limits) : null),
      el('div.bf-rule-all', el('span.bf-k', 'All rules'), rules.map((r, k) => el('button.bf-rule-pill', { type: 'button', data: { rule: r.id }, 'aria-pressed': k === ruleIdx ? 'true' : 'false', title: r.id,
        onclick: () => { touched = true; showRule(k); } }, words(r.topic)))));
  }
  function interpretPanel() {
    if (!rules.length) {
      return ui.panel('Interpret', ui.empty('none', 'No verified rule yet. Rules appear when their quotes pass the gate.', { label: 'Open Engine', onClick: () => ctx.go('#/engine') }),
        { strong: true, class: 'bf-p3', data: { panel: 'interpret' } });
    }
    const nav = el('div.bf-rule-nav', ruleCount,
      el('button.bf-arrow', { type: 'button', 'aria-label': 'Previous rule', data: { ruleNav: 'prev' }, onclick: () => { touched = true; showRule(ruleIdx - 1); } }, '‹'),
      el('button.bf-arrow', { type: 'button', 'aria-label': 'Next rule', data: { ruleNav: 'next' }, onclick: () => { touched = true; showRule(ruleIdx + 1); } }, '›'));
    const p = ui.panel('Interpret', ruleBody, { strong: true, actions: [nav], class: 'bf-p3', data: { panel: 'interpret' } });
    p.addEventListener('pointerdown', () => { touched = true; });
    p.addEventListener('keydown', () => { touched = true; });
    showRule(ruleIdx);
    const loop = () => later(() => { if (!alive || touched) return; showRule(ruleIdx + 1); loop(); }, ADVANCE_MS);
    if (!touched && rules.length > 1) loop();
    return p;
  }
  const rankBody = el('div.bf-rank');
  function gapRows(ax) {
    const citeFor = Object.fromEntries(['gravity', 'o2', 'pressure'].map(axis => [axis, () => dataset('api/v1/tests.json', 'searched rows')]));
    const list = text && typeof text.gaps === 'function' ? text.gaps(ax, q, nInv)
      : ['gravity', 'o2', 'pressure'].filter(a => ax[a].cabin === 0).map(a => ({ axis: a, label: a === 'gravity' ? `Gravity ${q.g_label}` : a === 'o2' ? `Cabin materials at ${fmt.short(q.o2)} % O2` : `Cabin materials at ${pressure(q.p)}`, count: 0, extra: null }));
    return list.map(g => ({ axis: g.axis, head: g.label, detail: `${fmt.n(g.count)} rows` + (g.extra ? ` \u00B7 ${g.extra}` : ''), title: g.sentence || null, cite: citeFor[g.axis] ? citeFor[g.axis]() : null }));
  }
  function renderRank() {
    wipe(rankBody);
    const presetSel = el('select.bf-select', { 'aria-label': 'Cabin', data: { q: 'preset' }, onchange: e => ctx.setQ({ preset: e.target.value }) },
      db.presets.map(p => el('option', { value: p.id, selected: p.id === q.preset, data: { preset: p.id } }, p.short || p.label || p.id)),
      q.preset === 'custom' || !db.presetById[q.preset] ? el('option', { value: 'custom', selected: true, data: { preset: 'custom' } }, 'Custom cabin') : null);
    const concernSel = el('select.bf-select', { 'aria-label': 'Concern', data: { q: 'concern' }, onchange: e => ctx.setQ({ concern: e.target.value }) },
      CONCERNS.map(c => el('option', { value: c, selected: c === q.concern, data: { concern: c } }, CONCERN_LABEL[c])));
    const usable = !!(rankMod && statusMod && isNum(q.o2) && isNum(q.p));
    const cabin = usable
      ? `${fmt.short(q.o2)} % O2 · ${pressure(q.p)} · ${q.g_label || 'gravity not set'}` + (q.material ? ` · ${(db.materials[q.material] && db.materials[q.material].label) || q.material}` : '')
      : 'This cabin has no verified source sentence, so nothing is ranked for it.';
    rankBody.append(el('div.bf-for', el('span.bf-k', 'for'), presetSel, concernSel), el('p.bf-cabin', { data: { claim: 'cabin' } }, db.presetById[q.preset] ? cite(cabin, q.preset) : cabin));

    const onPillar = db.findings.filter(f => f.pillar === q.concern);
    if (usable && !onPillar.length) rankBody.append(ui.empty('none', `No verified finding for ${q.concern} ${base}.`));
    else if (usable) {
      const ask = q.material && db.materials[q.material] ? { fuel_class: db.materials[q.material].fuel_class } : {};
      const top = rankMod.rank(db.findings, q, db).slice(0, 3);
      rankBody.append(el('p.bf-score-note', text.SCORE_LABEL), el('ol.bf-top', top.map((r, i) => {
        const st = statusMod.findingStatus(r.f, q, db, ask);
        return el('li.bf-top-row', { data: { claim: r.f.id, rank: i + 1 } },
          el('span.bf-top-i.num', String(i + 1)),
          el('span.bf-top-score.num', { title: 'Score out of 100: pillar 30, atmosphere 25, gravity 15, level 15, material 10, habitat 5' }, String(r.total)),
          el('span.bf-top-topic', { title: words(r.f.n.topic || r.f.topic) }, cite(findingTitle(r.f), r.f.id)), ui.chip(st.status, { small: true }),
          el('span.bf-top-level', level(r.f)));
      })));
    }
    if (usable) {
      const ax = statusMod.axes(q, db), gaps = gapRows(ax);
      rankBody.append(el('div.bf-gaps', { data: { gaps: gaps.length } },
        gaps.length
          ? [el('p.bf-gaps-head', ui.chip('NEVER_TESTED', { small: true }), el('span', 'at this cabin')),
             el('ul.bf-gap-list', gaps.map(g => el('li.bf-gap', { title: g.title, data: { gap: g.axis, claim: g.cite ? 'gap-' + g.axis : null } },
               el('span.bf-gap-text', el('b.bf-gap-head', g.head), ' ', el('span.bf-gap-detail', g.detail)), g.cite))),
             el('p.bf-note', `Counted over ${fmt.n(db.cabinRows.length)} cabin-material test rows ${base}.`)]
          : el('p.bf-gaps-none', { data: { claim: 'axis-coverage' } }, `This collection has rows near each selected axis value: ${fmt.n(ax.gravity.cabin)} cabin-material rows at ${q.g_label}, ${fmt.n(ax.o2.cabin)} within 1 point of ${fmt.short(q.o2)} % O2, ${fmt.n(ax.pressure.cabin)} within 5 kPa of the pressure (${fmt.n(ax.pressure.cabin_inferred)} with the pressure inferred from the facility), ${base}.`, dataset('data/tests.json'))));
    }
    rankBody.append(el('div.bf-foot',
      el('p.bf-legend', (text && text.STATUS_LINE) || 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION'),
      ui.button('Open Design mode', { icon: '›', onClick: () => ctx.go('#/design') })));
  }
  function rankPanel() { renderRank(); return ui.panel('Rank', rankBody, { class: 'bf-p2', data: { panel: 'rank' } }); }
  function strips() {
    const e = db.engine || {};
    const scen = (db.scenario && db.scenario.meta && db.scenario.meta.id) || Object.keys(e.officer || {}).find(k => e.officer[k] && typeof e.officer[k] === 'object');
    const rejected = e.verifier && Array.isArray(e.verifier.rejected) ? e.verifier.rejected.length : null;
    const steps = scen && e.officer && e.officer[scen] ? e.officer[scen].steps : null;
    const arrow = () => el('span.bf-arrowsep', { 'aria-hidden': 'true' }, '›');
    const engine = el('section.bf-strip.bf-engine', { data: { strip: 'engine', claim: 'build-counts' } },
      el('span.bf-strip-k', 'Engine'),
      el('p.bf-strip-text',
        el('b.bf-lead', 'SI reads; code checks.'), ' ',
        el('span.bf-node', 'Extractor: ', count('extractor.psi_kept'), ' PSI records, ', count('extractor.source_texts'), ' NASA texts'), arrow(),
        el('span.bf-node', 'Verifier: ', count('verifier.quotes_verified'), ' quotes verified, ', count('verifier.rejected.length', rejected), ' rejected'), arrow(),
        el('span.bf-node', 'Ranker: ', count('ranker.findings'), ' findings, ', count('ranker.rows_indexed'), ' rows'), arrow(),
        el('span.bf-node', 'Officer: ', count(`officer.${scen || 'scenario'}.steps`, steps), ' steps.'), ' ',
        el('b.bf-lead', 'No source, no action.'), ' ', dataset('data/engine.json', 'build counts')),
      ui.button('more', { small: true, icon: '›', onClick: () => ctx.go('#/engine') }));
    const file = (label, href) => el('a.bf-open-link', { href, target: '_blank', rel: 'noopener' }, label);
    const inApp = (label, hash) => el('a.bf-open-link', { href: hash, onclick: ev => { ev.preventDefault(); ctx.go(hash); } }, label);
    const open = el('section.bf-strip.bf-open', { data: { strip: 'open' } },
      el('span.bf-strip-k', 'Open'),
      el('p.bf-strip-text.bf-open-links',
        file('tests.csv', 'api/v1/tests.csv'), file('findings.csv', 'api/v1/findings.csv'), file('api/v1', 'api/v1/index.json'),
        inApp('MCP server', '#/open'), inApp('telemetry format', '#/open'), inApp('NTRS snapshot', '#/open')));
    return [engine, open];
  }
  const world = heroWorld(ctx, true);
  world.node.append(world.evidence);
  const page = el('div.bf', { data: { screen: 'brief' } }, hero, world.node, strips());
  root.replaceChildren(page);
  world.start();
  const tagline = hero.querySelector('.bf-tagline');

  return {
    unmount() { world.dispose(); alive = false; for (const id of timers) clearTimeout(id); timers.clear(); },
    update(next) { ctx = next; q = next.q; renderRank(); },
  };
}


const details = ctx => (ctx.view || ctx.params?.view) === 'details';

function mountSimple(root, ctx) {
  const { ui, db } = ctx, el = ui.el;
  ui.css('css/views/brief.css?v=13');
  ui.css('css/world.css?v=sebas-20261115-2');
  const investigations = db.engine.extractor.psi_kept;
  const rows = db.engine.extractor.test_rows;
  const goLink = (label, href, className) => el('a', {
    href, class: className, onclick: event => { event.preventDefault(); ctx.go(href); }
  }, label);
  const world = heroWorld(ctx);
  const hero = el('header.bfs-intro',
    el('div.bfs-intro-copy',
      el('p.bfs-eyebrow', 'VESTA / NASA fire evidence'),
      el('h1.bfs-title', "Explore NASA's fire experiments."),
      el('p.bfs-promise', 'See where the evidence stops.'),
      el('div.bfs-actions',
        ui.button('Explore the evidence', { primary: true, icon: '›', onClick: () => ctx.go('#/investigations') }),
        goLink('Run the fire drill', '#/incident', 'bfs-secondary')),
      el('p.bfs-counts', { data: { claim: 'brief-counts' } },
        el('a.world-cite', { href: 'api/v1/index.json', target: '_blank', rel: 'noopener' }, `${ui.fmt.n(investigations)} investigations · ${ui.fmt.n(rows)} source-table rows`))),
    world.node);

  const path = el('div.bfs-path', { 'aria-hidden': 'true' });
  path.innerHTML = '<svg viewBox="0 0 1200 170" preserveAspectRatio="none"><path d="M 12 28 C 180 28 200 138 410 138 S 660 28 820 28 S 1050 138 1188 138" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="28" r="5" fill="currentColor"/><circle cx="1188" cy="138" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const journey = el('section.bfs-journey', { 'aria-label': 'How to use VESTA' }, path,
    el('h2', 'Choose a cabin,', el('br'), el('span', 'follow the evidence,'), el('br'), 'find the gaps.'),
    el('p', 'Set the conditions. Open the original NASA sources. See where the evidence stops.'),
    goLink('Choose your cabin ↗', '#/design', 'bfs-path-link'));
  const research = el('section.bfs-research',
    el('p.bfs-who', 'For students, researchers and spacecraft designers.'), world.evidence);

  const rule = db.ruleById['R-SHAPE'] || db.rules.find(r => r.finding_ids.some(id => db.findingById[id]));
  const lesson = el('details.bfs-lesson');
  if (rule) {
    const finding = rule.finding_ids.find(id => db.findingById[id]);
    const summary = rule.vesta_decides.replace(/low-momentum/g, 'slow-moving').replace(/microgravity/g, 'near-weightlessness');
    lesson.append(el('summary', 'One lesson: flames need not point up', el('span', 'Read the evidence +')),
      el('div.bfs-lesson-body', { data: { claim: rule.id } },
        el('span.bfs-summary-label', 'Summary'), el('p', finding ? cite(summary, finding) : summary),
        el('p.bfs-limit', rule.limits)));
  }
  const footer = el('footer.bfs-footer',
    el('p', 'An evidence explorer and a scripted drill. Evidence coverage is not safety certification.'),
    el('div', goLink('How quotes are checked', '#/engine'), el('span', ' · '), goLink('Use the open data', '#/open')));
  root.replaceChildren(el('div.bfs', { data: { screen: 'brief', simple: true } }, hero, journey, research, lesson, footer));
  const fit = () => {
    if (innerWidth < 760) hero.style.setProperty('--brief-screen-height', `${Math.max(460, innerHeight - root.getBoundingClientRect().top)}px`);
  };
  fit();
  const resize = new ResizeObserver(fit); resize.observe(document.getElementById('bar'));
  addEventListener('resize', fit);
  world.start();
  return { unmount() { resize.disconnect(); removeEventListener('resize', fit); world.dispose(); } };
}

export function mount(root, ctx) {
  let mode = details(ctx), handle = (mode ? mountDetails : mountSimple)(root, ctx);
  return {
    unmount() { handle.unmount?.(); },
    update(next) {
      if (mode !== details(next) || !mode) {
        handle.unmount?.(); mode = details(next); handle = (mode ? mountDetails : mountSimple)(root, next);
      } else handle.update(next);
    }
  };
}
