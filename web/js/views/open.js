// Open data (#/open): downloads, the static API, the MCP server, the telemetry format and the NTRS snapshot. DESIGN.md 2.6, 4.4 to 4.7.
// Every link is a plain file under web/ and is shown only when api/v1/index.json lists it. "Try it" fetches the file and prints it.
// Counts come from engine.json (data-count). The NTRS panel is a snapshot with its time; nothing in it enters the evidence base.
const RECORDING = {"schema":"vesta.mcp-recording/1","note":"One real exchange with mcp/server.mjs over stdio, recorded by mcp/record.mjs against the evidence files of this build. The answer text is JSON; it is shown parsed here.","evidence_generated_at":"2026-11-14T12:55:10-05:00","command":"node mcp/server.mjs","server":{"name":"vesta","version":"1.0.0"},"protocol_version":"2025-06-18","tools":[{"name":"search_evidence","description":"Search VESTA's verified findings (verbatim NASA quotes and PSI table findings) on spacecraft fire safety. Every word of `query` must appear in the claim or the quote. Returns no_source when nothing matches; VESTA never answers without a source.","input":["query","pillar","topic","investigation","limit"],"required":[]},{"name":"rank_evidence","description":"Rank the verified findings for a cabin and a concern with the published VESTA score (pillar 30, atmosphere 25, gravity 15, level 15, material 10, habitat 5). Each result carries its score parts, its coverage status at that cabin (PROVEN or EXTRAPOLATED) and the reasons. Oxygen, pressure and gravity default to the preset of the habitat.","input":["habitat","concern","o2_percent","pressure_kpa","gravity","material","limit"],"required":["habitat","concern"]},{"name":"check_design","description":"Place a cabin (oxygen, pressure, gravity) on the map of what is in VESTA's evidence base (24 PSI investigations). Returns, per axis, how many cabin-material test rows sit at that value, and one cell per material and concern marked PROVEN (tested at these conditions), EXTRAPOLATED (evidence exists, a condition differs) or NEVER_TESTED, with reasons and the nearest test. Status is evidence coverage, not a safety certification.","input":["o2_percent","pressure_kpa","gravity","materials","concern"],"required":["o2_percent","pressure_kpa","gravity"]},{"name":"get_finding","description":"Fetch one record by id: a finding (for example S-VENT-01) with its verbatim quote, the rest of its sentence, its gated conditions and its source link; or a PSI test row (for example PSI-25:1) with its normalised fields and its raw table cells.","input":["id"],"required":["id"]}],"request":{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"rank_evidence","arguments":{"habitat":"lunar-base","concern":"prevention","limit":3}}},"response":{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"query\":{\"preset\":\"lunar-base\",\"habitat\":\"lunar-base\",\"concern\":\"prevention\",\"o2\":34,\"p_kpa\":56.5,\"gclass\":\"partial\",\"g_display\":\"1/6 g\",\"material\":null},\"weights\":{\"pillar\":30,\"atmosphere\":25,\"gravity\":15,\"level\":15,\"material\":10,\"habitat\":5},\"results\":[{\"rank\":1,\"id\":\"SOLIDS-110\",\"total\":77,\"parts\":{\"pillar\":30,\"atmosphere\":25,\"gravity\":4.5,\"level\":7.5,\"material\":5,\"habitat\":5},\"status\":\"EXTRAPOLATED\",\"reasons\":[\"not_an_experiment\",\"gravity_not_reported\"],\"work\":\"summary\",\"read_in\":\"nasa_report\",\"claim\":\"The SoFIE project slides state that few thin fuel sheet materials are rated even in 1 g at 34% O2 and 8.2 psia, the exploration atmosphere.\",\"quote\":\"Thin fuel sheets: few materials rated even in 1g at 34% O2, 8.2 psia (exploration atmosphere).\",\"url\":\"https://ntrs.nasa.gov/api/citations/20200000361/downloads/20200000361.pdf\"},{\"rank\":2,\"id\":\"OPERATIONS-242\",\"total\":73,\"parts\":{\"pillar\":15,\"atmosphere\":25,\"gravity\":15,\"level\":7.5,\"material\":5,\"habitat\":5},\"status\":\"EXTRAPOLATED\",\"reasons\":[\"not_an_experiment\"],\"work\":\"summary\",\"read_in\":\"nasa_report\",\"claim\":\"One planned FM2 mode investigates flame spread on the Moon in a normoxic environment, for example 34% oxygen at 0.558 atm.\",\"quote\":\"Mode 3: To investigate a planned normoxic environment (for example 34% O2 at 0.558 atm) on flame spread on the Moon compared to Earth.\",\"url\":\"https://ntrs.nasa.gov/citations/20210020516\"},{\"rank\":3,\"id\":\"S-EXPL-01\",\"total\":70,\"parts\":{\"pillar\":15,\"atmosphere\":25,\"gravity\":4.5,\"level\":15,\"material\":5,\"habitat\":5},\"status\":\"EXTRAPOLATED\",\"reasons\":[\"gravity_not_reported\"],\"work\":\"flight\",\"read_in\":\"nasa_page\",\"claim\":\"Saffire samples were also burned at 8.2 psia and 34% oxygen to simulate the atmosphere of deep space exploration vehicles.\",\"quote\":\"In addition, the samples were burned at 8.2 psia and 34% oxygen levels to simulate atmosphere conditions for deep space exploration vehicles.\",\"url\":\"https://www.nasa.gov/wp-json/wp/v2/migration/309559\"}],\"scope\":\"decision-support prototype, not certified flight software\"}"}]}}};
const FEED_GONE = 'Feed unavailable. The evidence base is unaffected.';
const NOT_VERIFIED = 'NOT VERIFIED: nothing enters the evidence base until its quote passes the gate';
const MAX_LINES = 400;
const TOOLS_FALLBACK = ['search_evidence', 'rank_evidence', 'check_design', 'get_finding'];

const at = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const arr = (x) => (Array.isArray(x) ? x : []);
const norm = (p) => String(p).replace(/^\.\//, '').replace(/^api\/v1\//, '');
const firstSentence = (s) => { const t = String(s ?? ''), i = t.indexOf('. '); return i < 0 ? t : t.slice(0, i + 1); };

export function mount(root, ctx) {
  const { ui, db } = ctx, { el } = ui, E = db.engine ?? {};
  ui.css('css/views/open.css');
  root.classList.add('opn');
  const ac = new AbortController();
  let alive = true;
  const get = (path) => fetch(path, { signal: ac.signal, cache: 'no-store' });

  const count = (key) => {
    const v = at(E, key), ok = typeof v === 'number' && Number.isFinite(v);
    return el('b', { class: 'opn-n', data: { count: key } }, ok ? v.toLocaleString('en-US') : 'not reported');
  };
  const preset = db.presetById?.[ctx.q?.preset] ? ctx.q.preset : (db.presetById?.['lunar-base'] ? 'lunar-base' : arr(db.presets)[0]?.id);
  const concern = ctx.q?.concern ?? 'prevention';
  const scen = db.scenario?.meta?.id ?? null;
  const site = () => new URL('.', location.href.split('#')[0]).href;

  // ---------------------------------------------------------------- header
  const head = el('header.opn-head',
    el('h1.t-display-2', 'Open data'),
    el('p.opn-sub', 'Every link is a plain file on this site: no key, no login, relative URLs. PSI table rows are NASA data (CC0-1.0); quotes are verbatim NASA text.'));

  // ---------------------------------------------------------------- download + API (filled once the manifest is read)
  const dl = ui.panel('Download', el('div.opn-wait', 'Reading api/v1/index.json'), { class: 'opn-dl' });
  const viewHead = el('div.opn-vhead'), viewBody = el('pre.opn-pre', { tabindex: 0 });
  const apiList = el('div.opn-api-list');
  const api = ui.panel('API', [apiList, el('div.opn-viewer', viewHead, viewBody)], { class: 'opn-api', tag: 'GET · static files' });

  async function tryIt(path, row) {
    for (const r of apiList.querySelectorAll('.opn-row')) r.classList.toggle('on', r === row);
    viewHead.replaceChildren(el('span.opn-get', 'GET'), el('code', path), el('span.opn-dim', 'loading'));
    viewBody.textContent = '';
    try {
      const res = await get(path), text = await res.text();
      if (!alive) return;
      let shown = text;
      if (res.ok && /\.json$/.test(path)) { try { shown = JSON.stringify(JSON.parse(text), null, 1); } catch { /* print as it came */ } }
      const lines = shown.split('\n'), cut = lines.length > MAX_LINES;
      viewHead.replaceChildren(el('span.opn-get', 'GET'), el('code', path), el('span', { class: res.ok ? 'opn-ok' : 'opn-dim' }, String(res.status)),
        el('span.opn-dim', `${text.length.toLocaleString('en-US')} characters${cut ? ` · first ${MAX_LINES} of ${lines.length.toLocaleString('en-US')} lines shown` : ''}`),
        el('a', { class: 'opn-open', href: path, target: '_blank', rel: 'noopener' }, 'open the file'));
      viewBody.textContent = res.ok ? (cut ? lines.slice(0, MAX_LINES).join('\n') : shown) : 'The file did not answer.';
      viewBody.scrollTop = 0;
      ctx.setParams?.({ try: norm(path) }, { replace: true, render: false });
    } catch (e) { if (alive && e.name !== 'AbortError') { viewHead.replaceChildren(el('span.opn-get', 'GET'), el('code', path), el('span.opn-dim', 'did not load')); viewBody.textContent = 'The file did not load.'; } }
  }

  function fillFromManifest(listed) {
    const has = (p) => listed.has(norm(p));
    const file = (p, label, extra) => (has(p) ? ui.button([el('span.opn-file', label), extra ? el('span.opn-meta', extra) : null], { href: 'api/v1/' + norm(p), download: true, data: { file: norm(p) } }) : null);
    const buttons = [
      file('tests.csv', 'tests.csv', [count('extractor.test_rows'), ' rows']),
      file('findings.csv', 'findings.csv', [count('ranker.findings'), ' findings']),
      file('tests.json', 'tests.json'),
      file('findings.json', 'findings.json'),
      file('rules.json', 'rules.json', [count('ranker.rules_shipped'), ' rules']),
      file('investigations.json', 'investigations.json', [count('extractor.psi_kept'), ' PSI investigations']),
      file('sources.json', 'sources.json'),
      file('presets.json', 'presets.json'),
      file('protocol.json', 'protocol.json', [count('officer.protocol_lines'), ' lines']),
    ].filter(Boolean);
    dl.bodyEl.replaceChildren(buttons.length ? el('div.opn-files', buttons) : ui.empty('none', 'The API manifest lists no download.'),
      el('p.opn-note', 'tests.csv is the delivered table, byte for byte: one row per PSI test, the normalised value beside its raw cell. A range is never collapsed to a midpoint.'));

    const rows = [
      preset && [`rank/${preset}.${concern}.json`, 'the top findings for this cabin and concern: score parts, status, reasons'],
      preset && [`coverage/${preset}.json`, 'the gap register: each axis and every material x concern cell'],
      ['tests/PSI-69.csv', 'the rows of one investigation: normalised columns, then the raw PSI cells'],
      scen && [`officer/${scen}.json`, 'the decision log the officer produces for the drill'],
      ['engine.json', 'the counts of this build'],
      ['index.json', 'the manifest: every path, the weights, spans, tolerances and reason codes'],
    ].filter((r) => r && has(r[0]));
    apiList.replaceChildren(...rows.map(([p, what]) => {
      const path = 'api/v1/' + p;
      const row = el('div.opn-row', { data: { api: p } },
        el('span.opn-get', 'GET'), el('a', { class: 'opn-path', href: path, target: '_blank', rel: 'noopener' }, path), el('span.opn-what', what),
        ui.button('try it', { small: true, data: { try: p }, onClick: () => tryIt(path, row) }));
      return row;
    }));
    if (!rows.length) { apiList.replaceChildren(ui.empty('none', 'The API manifest lists none of the documented paths.')); return; }
    const want = ctx.params?.try && rows.find((r) => r[0] === ctx.params.try) ? ctx.params.try : rows[0][0];
    tryIt('api/v1/' + want, apiList.querySelector(`[data-api="${CSS.escape(want)}"]`));
  }

  get('api/v1/index.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((idx) => {
    if (!alive) return;
    const listed = new Set(), isPath = (s) => /^[\w./-]+\.(json|csv|jsonl)$/.test(s) && !/^https?:/.test(s);
    (function visit(x) {
      if (typeof x === 'string') { if (isPath(x)) listed.add(norm(x)); }
      else if (Array.isArray(x)) x.forEach(visit);
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (isPath(k)) listed.add(norm(k)); visit(v); }
    })(idx);
    listed.add('index.json');
    fillFromManifest(listed);
    fillTelemetry(listed);
  }).catch((e) => {
    if (!alive || e.name === 'AbortError') return;
    const gone = () => ui.empty('load', 'The API manifest (api/v1/index.json) did not load. No link is shown that might not answer.');
    dl.bodyEl.replaceChildren(gone()); api.bodyEl.replaceChildren(gone()); fillTelemetry(new Set());
  });

  // ---------------------------------------------------------------- MCP
  const config = () => JSON.stringify({ mcpServers: { vesta: { command: 'node', args: ['mcp/server.mjs', '--base', site()] } } }, null, 1);
  const cmd = el('code.opn-cmd', `node mcp/server.mjs --base ${site()}`);
  const toolsEl = el('div.opn-tools', TOOLS_FALLBACK.map((n) => el('div.opn-tool', { data: { tool: n } }, el('b', n))));
  const recHead = el('div.opn-vhead', el('span.opn-dim', 'recorded call'));
  const recBody = el('pre.opn-pre.opn-rec', { tabindex: 0 });
  const copyBtn = ui.button('copy client config', { small: true, data: { copy: 'mcp-config' }, onClick: async () => {
    const text = config();
    recHead.replaceChildren(el('span.opn-get', 'client config'), el('span.opn-dim', 'run from a clone of the repository; any MCP client that starts a stdio server takes this block'));
    recBody.textContent = text;
    try { await navigator.clipboard.writeText(text); copyBtn.querySelector('.btn-label').textContent = 'copied'; } catch { getSelection()?.selectAllChildren(recBody); }
  } });
  const recBtn = ui.button('recorded call', { small: true, data: { show: 'mcp-recorded' }, onClick: () => showRecording() });
  const mcp = ui.panel('MCP server', [
    el('p.opn-note', 'For SI assistants: the same evidence and the same core modules as this screen, over stdio. Node, no packages.'),
    cmd, toolsEl, el('div.opn-actions', copyBtn, recBtn), el('div.opn-viewer', recHead, recBody),
  ], { class: 'opn-mcp', tag: 'stdio · JSON-RPC 2.0' });
  let recording = null;
  function showRecording() {
    if (!recording) { recHead.replaceChildren(el('span.opn-dim', 'No recorded call in this build (node mcp/record.mjs writes it).')); recBody.textContent = ''; return; }
    recHead.replaceChildren(el('span.opn-get', 'recorded'), el('code', `tools/call ${recording.request?.params?.name ?? ''}`),
      el('span.opn-dim', 'a real exchange with the server, stored at build time: a stdio server cannot be started from a URL'));
    recBody.textContent = '> ' + JSON.stringify(recording.request) + '\n\n< ' + JSON.stringify(JSON.parse(recording.response.result.content[0].text), null, 1);
    recBody.scrollTop = 0;
  }
  recording = RECORDING;
  if (recording?.tools?.length) toolsEl.replaceChildren(...recording.tools.map((t) => el('div.opn-tool', { data: { tool: t.name } },
    el('b', t.name), el('code', `{ ${arr(t.input).map((k) => (arr(t.required).includes(k) ? k : k + '?')).join(', ')} }`), el('span', { title: t.description }, firstSentence(t.description)))));
  showRecording();

  // ---------------------------------------------------------------- telemetry format
  const telBody = el('div.opn-tel-body');
  const frames = arr(db.scenario?.frames).length;
  const tel = ui.panel('Telemetry format', telBody, { class: 'opn-tel', tag: ctx.core?.officer?.TELEMETRY ?? 'vesta.telemetry/1' });
  function fillTelemetry(listed) {
    const link = (p, label) => (listed.has(norm(p)) ? ui.button(label, { small: true, href: 'api/v1/' + p, target: '_blank', data: { file: p } }) : null);
    telBody.replaceChildren(
      el('p.opn-note', 'JSON Lines, one flat frame per line. Required: schema and t. A field that is absent is unknown, and no rule fires on it.',
        frames ? ` The scripted scenario has ${frames.toLocaleString('en-US')} frames, all marked simulated.` : ''),
      el('div.opn-actions', link('telemetry.schema.json', 'schema'), scen ? link(`scenarios/${scen}.jsonl`, 'scenario .jsonl') : null, scen ? link(`scenarios/${scen}.meta.json`, 'scenario meta') : null,
        ui.button('bring your own file in Incident', { small: true, onClick: () => ctx.go('#/incident') })));
  }

  // ---------------------------------------------------------------- NTRS snapshot
  const feedBody = el('div.opn-feed-body');
  const feedTag = el('span.panel-tag', { data: { feed: 'snapshot' } }, 'snapshot');
  const ntrs = ui.panel('NTRS', feedBody, { class: 'opn-feed', tag: feedTag });
  const feedGone = () => { feedTag.textContent = 'no snapshot'; feedBody.replaceChildren(ui.empty('feed', FEED_GONE)); };
  const inBase = new Map();                                    // NTRS id -> finding ids of the source that carries it
  for (const s of arr(db.sources)) if (s && s.id != null) inBase.set(String(s.id), [...(inBase.get(String(s.id)) ?? []), ...arr(s.finding_ids)]);
  function fillFeed(feed) {
    const items = arr(feed?.items);
    if (!feed || feed.schema !== 'vesta.ntrs-feed/1' || !items.length) return feedGone();
    feedTag.textContent = `snapshot of ${ui.fmt.est(feed.fetched_at)}`;
    const yes = items.filter((i) => inBase.has(String(i.id))).length;
    feedBody.replaceChildren(
      el('p.opn-note', `${items.length} newest records, `, feed.origin === 'ntrs-api' ? 'fetched from the NTRS citations API at build time.' : 'taken without the network from the harvested NTRS index: the most recent years.',
        ` ${yes} of them already back a verified finding.`),
      el('p.opn-legend', NOT_VERIFIED),
      el('ol.opn-items', items.map((i) => {
        const ids = inBase.get(String(i.id));
        return el('li.opn-item', { data: { ntrs: i.id, inBase: ids ? 'true' : 'false' } },
          el('a', { class: 'opn-title', href: i.url, target: '_blank', rel: 'noopener' }, i.title),
          el('div.opn-item-meta',
            el('span', { class: 'opn-flag' + (ids ? ' opn-in' : '') }, ids ? 'IN EVIDENCE BASE' : 'NOT VERIFIED'),
            ids ? ids.filter((id) => db.findingById?.[id]).slice(0, 2).map((id) => ui.cite(id)) : null,
            el('span.opn-dim', ['NTRS ' + i.id, i.created ? String(i.created).slice(0, 10) : i.year ? String(i.year) : null, i.sti_type ? String(i.sti_type).replace(/_/g, ' ').toLowerCase() : null, i.center].filter(Boolean).join(' · '))));
      })));
  }
  if (ctx.params?.feed === 'off') feedGone();
  else get('feed/ntrs.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((f) => { if (alive) fillFeed(f); }).catch((e) => { if (alive && e.name !== 'AbortError') feedGone(); });

  root.replaceChildren(head, el('div.opn-grid', el('div.opn-col', dl, api), el('div.opn-col', mcp, tel), el('div.opn-col', ntrs)));
  return () => { alive = false; ac.abort(); root.classList.remove('opn'); root.replaceChildren(); };
}
