import { hardware } from '../scene/materials.js';
import { loadCases, evaluateCase } from './proof.js';
import { createProofSession } from './proof-session.js?v=habitat-20261115-1';
import { createProofReport, renderRejectedExcerpts } from './trust-report.js?v=habitat-20261115-1';
import { cite as contextualCite } from './cite.js?v=habitat-20261115-1';
import { sourceLocator } from '../ui/source-locator.js?v=habitat-20261115-1';
import { ensureInformationPolishStyles } from './information-polish.js?v=habitat-20261115-1';

const at = (value, path) => path.split('.').reduce((item, key) => item?.[key], value);
const count = value => Number.isFinite(value) ? value.toLocaleString('en-US') : 'not reported';
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const element = (tag, text, styles = {}) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  Object.assign(node.style, styles);
  return node;
};

export async function build(world) {
  ensureInformationPolishStyles();
  world.host.classList.add('information-polish');
  const { THREE, db, core } = world;
  const E = db.engine ?? {};
  const anchor = [0, -0.6, 0];
  const group = new THREE.Group();
  group.name = 'trust-rack';
  group.position.set(...anchor);
  group.visible = false;
  (world.scene ?? world.stage?.scene)?.add(group);
  const materials = new Set(), geometries = new Set();
  const material = (color, options = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.5, ...options });
    materials.add(result);
    return result;
  };
  const basalt = material(0x211e1b), alloy = material(0x5d5750), ivory = material(0xede4d4);
  const data = material(0x8fa3b5, { emissive: 0x5d7185, emissiveIntensity: 0.35 });
  const rust = material(0xc8553d, { emissive: 0x8f3a28, emissiveIntensity: 0.3 });
  const glass = material(0x8fa3b5, { transparent: true, opacity: 0.12, depthWrite: false, metalness: 0.1 });
  const mesh = (parent, geometry, mat, position = [0, 0, 0]) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position);
    parent.add(object);
    return object;
  };
  const box = (parent, size, mat, position) => mesh(parent, new THREE.BoxGeometry(...size), mat, position);
  const cylinder = (parent, radius, length, mat, position) => mesh(parent, new THREE.CylinderGeometry(radius, radius, length, 24), mat, position);
  const ring = (parent, radius, mat, position) => mesh(parent, new THREE.TorusGeometry(radius, 0.025, 6, 40), mat, position);
  box(group, [7.6, 0.15, 1.35], basalt, [0, -0.87, 0]);
  box(group, [7.6, 0.055, 0.055], alloy, [0, -0.7, 0.63]);
  box(group, [7.6, 0.055, 0.055], alloy, [0, -0.7, -0.63]);
  for (const x of [-3.65, 3.65]) {
    box(group, [0.13, 2.4, 0.13], alloy, [x, 0.24, -0.65]);
    box(group, [0.7, 0.12, 1.5], basalt, [x, -1, 0]);
  }
  box(group, [7.4, 0.11, 0.11], alloy, [0, 1.42, -0.65]);
  const xs = [-2.7, -0.9, 0.9, 2.7];
  const machines = xs.map((x, index) => {
    const machine = new THREE.Group();
    machine.position.x = x;
    group.add(machine);
    cylinder(machine, 0.57, 0.16, basalt, [0, -0.61, 0]);
    cylinder(machine, 0.52, 0.12, alloy, [0, 0.64, 0]);
    cylinder(machine, 0.5, 1.18, glass, [0, 0, 0]);
    const rotor = new THREE.Group();
    machine.add(rotor);
    const aperture = ring(rotor, 0.42, data, [0, 0, 0]);
    aperture.rotation.y = index % 2 ? Math.PI / 2 : 0;
    if (index === 0) {
      for (let i = 0; i < 4; i++) box(rotor, [0.44, 0.035, 0.3], ivory, [0, (i - 1.5) * 0.17, 0]);
    } else if (index === 1) {
      const scan = box(rotor, [0.72, 0.025, 0.56], data, [0, 0, 0]);
      scan.name = 'quote-scanner';
      for (const side of [-1, 1]) box(machine, [0.06, 0.95, 0.06], alloy, [side * 0.39, 0, -0.23]);
    } else if (index === 2) {
      for (let i = 0; i < 3; i++) box(rotor, [0.09, 0.24 + i * 0.17, 0.17], ivory, [(i - 1) * 0.19, -0.27 + i * 0.085, 0]);
    } else {
      const shield = mesh(rotor, new THREE.OctahedronGeometry(0.3, 0), ivory, [0, 0, 0]);
      shield.scale.set(0.8, 1.2, 0.5);
      ring(machine, 0.31, alloy, [0, 0, 0.24]);
    }
    for (const z of [-0.4, 0.4]) box(machine, [0.045, 1.14, 0.045], alloy, [-0.36, 0, z]);
    const indicator = box(machine, [0.2, 0.025, 0.04], data, [0, -0.5, 0.5]);
    return { machine, rotor, aperture, indicator };
  });
  for (let i = 0; i < xs.length - 1; i++) {
    const pipe = cylinder(group, 0.055, 0.78, data, [(xs[i] + xs[i + 1]) / 2, -0.08, 0]);
    pipe.rotation.z = Math.PI / 2;
  }
  const tokenGeometry = new THREE.BoxGeometry(0.16, 0.11, 0.045);
  const tokens = Array.from({ length: 9 }, () => mesh(group, tokenGeometry, ivory));
  const rejected = mesh(group, tokenGeometry, rust);
  for (const sign of [-1, 1]) {
    const stroke = box(rejected, [0.1, 0.018, 0.012], ivory, [0, 0, 0.03]);
    stroke.rotation.z = sign * Math.PI / 4;
  }
  const exit = ring(group, 0.23, rust, [xs[1], 0.56, 0]);
  exit.rotation.x = Math.PI / 2;
  // The bench is lit by the world's own lights at full strength: dimming them left the machines unreadable.
  for (const mat of materials) mat.envMapIntensity = .055;
  const wornHousing = hardware(THREE, 'metal', { color: 0x454b4d, roughness: .74, metalness: .48, envMapIntensity: .055 });
  materials.add(wornHousing);
  box(group, [15, 8, .12], wornHousing, [0, .1, -.88]);
  for (const x of [-4.12, 4.12]) box(group, [.12, 3.2, 1.7], wornHousing, [x, .1, -.08]);
  const fixture = material(0xc4c8c1, { emissive: 0xcad4ce, emissiveIntensity: 1.4, metalness: .1 });
  for (const x of xs) {
    box(group, [.82, .1, .28], wornHousing, [x, 1.36, .72]);
    box(group, [.66, .025, .18], fixture, [x, 1.3, .72]).layers.enable(1);
    const pool = new THREE.SpotLight(0xd2ddd9, 3.2, 4.5, .66, .65, 2); pool.position.set(x, 1.25, .74); pool.target.position.set(x, -.2, .05); group.add(pool, pool.target);
    const screenLight = new THREE.PointLight(0x7997af, .14, 1.3, 2); screenLight.position.set(x, -.1, .65); group.add(screenLight);
  }
  const light = new THREE.PointLight(0xe0b77e, 1.8, 5, 2); light.position.set(-2.3, 1.5, 1.6); group.add(light);
  group.add(new THREE.HemisphereLight(0x9baab5, 0x14110e, .045));

  const baseStyle = { color: 'var(--ivory, #ede4d4)', fontFamily: '"Source Sans 3", sans-serif', fontSize: '18px', lineHeight: '1.4', boxSizing: 'border-box' };
  const scenarioId = db.scenario?.meta?.id ?? Object.keys(E.officer ?? {}).find(key => E.officer[key] && typeof E.officer[key] === 'object');
  const definitions = [
    ['Extractor', 'extractor.psi_kept', 'NASA studies'],
    ['Verifier', 'verifier.quotes_verified', 'matched excerpts'],
    ['Ranker', 'ranker.findings', 'findings'],
    ['Officer', scenarioId ? `officer.${scenarioId}.steps` : null, 'drill decisions']
  ];
  const consoleEl = element('section', null, { ...baseStyle, width: '420px', padding: '18px', maxHeight: '650px', overflowY: 'auto', background: 'rgba(18,16,14,.92)' });
  consoleEl.className = 'trust-console';

  consoleEl.setAttribute('aria-label', 'Evidence checks and data');
  consoleEl.dataset.worldPanel = 'trust';
  const nav = element('nav', null, { display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '16px', marginBottom: '14px', maxWidth: 'calc(100% - 40px)' });
  nav.setAttribute('aria-label', 'Use the evidence');
  const body = element('div', null, { overflowY: 'auto', minHeight: '36px', flexShrink: '1', flexGrow: '1' });
  body.className = 'trust-content';
  body.tabIndex = 0;
  nav.style.flexShrink = '0';
  const controller = new AbortController();
  let alive = true, active = false, tab = 'home', manifest = null, serial = 0;
  let rejectedSourceRecords = null;
  let casesFile = null, running = false, consoleLayout = null;
  const results = [], marks = [];
  const completed = new Set();
  const buttons = new Map();
  const link = (label, href, download) => {
    const node = element('a', label, { color: 'var(--ivory, #ede4d4)', display: 'inline-block', padding: '10px 12px', margin: '0 8px 8px 0', minHeight: '44px', boxSizing: 'border-box', border: '1px solid var(--line-strong)', borderRadius: '4px', background: 'rgba(143,163,181,.08)', textDecoration: 'none' });
    node.className = 'trust-resource-link';
    node.href = href;
    if (download) node.download = download;
    else { node.target = '_blank'; node.rel = 'noopener'; }
    return node;
  };
  for (const [id, text] of [['checks', 'Checks'], ['rejected', 'Rejected excerpts'], ['report', 'Machines'], ['download', 'Download'], ['api', 'API'], ['assistant', 'Assistant']]) {
    const button = element('button', text, { font: 'inherit', background: 'none', border: '0', borderBottom: '1px solid var(--line-strong)', padding: '10px 0', minHeight: '44px', color: 'var(--ivory)', cursor: 'pointer' });
    button.type = 'button'; button.dataset.trust = id; button.style.flexShrink = '0';
    button.addEventListener('click', () => show(id));
    buttons.set(id, button); nav.append(button);
  }
  const consoleContent = element('div', null, { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0' });
  consoleContent.append(nav, body);
  consoleEl.append(consoleContent);
  const status = element('p', 'Evidence checks are not a safety certification.', { fontSize: '18px', color: 'var(--ivory-dim)', margin: '12px 0 0' });
  status.className = 'trust-status';
  status.style.flexShrink = '0';
  consoleContent.append(status);


  async function files() {
    if (manifest) return manifest;
    const response = await fetch('api/v1/index.json', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The file index did not load.');
    const result = await response.json();
    if (!Array.isArray(result.files)) throw new Error('This build does not list evidence files.');
    manifest = new Set(result.files.map(file => typeof file === 'string' ? file : file.path).filter(path => typeof path === 'string').map(path => path.replace(/^api\/v1\//, '')));
    return manifest;
  }
  async function rejectionSources() {
    if (rejectedSourceRecords) return rejectedSourceRecords;
    const response = await fetch('data/rejected-excerpts.json?v=habitat-20261115-1', { signal: controller.signal });
    if (!response.ok) throw new Error('Rejected source details did not load.');
    const audit = await response.json();
    if (audit.schema !== 'vesta.rejected-excerpts/1' || !Array.isArray(audit.records)) throw new Error('Unrecognized rejected-source report.');
    const accepted = new Map();
    for (const record of audit.records) {
      const rejection = E.verifier?.rejected?.find(item => item.id === record.id);
      const qualifier = E.verifier?.cut_before_qualifier?.find(item => item.id === record.id);
      if (!rejection || rejection.quote !== record.quote || rejection.why !== record.why) continue;
      if (record.why === 'cut_before_qualifier' && qualifier?.after !== record.context_after) continue;
      if (!record.source?.title || !/^https:\/\//.test(record.source.url ?? '')) continue;
      accepted.set(record.id, record);
    }
    rejectedSourceRecords = accepted;
    return accepted;
  }
  async function show(next) {
    tab = next;
    const request = ++serial;
    for (const [id, button] of buttons) button.setAttribute('aria-expanded', String(id === next));
    body.replaceChildren();
    consoleEl.dataset.tab = next;
    if (next === 'home') {
      body.append(element('p', 'Run the checks or take the evidence with you.'));
    } else if (next === 'checks') {
      renderChecks();
    } else if (next === 'report') {
      body.append(element('h2', 'Inside the machines', { fontSize: '24px', margin: '0 0 10px' }));
      for (const [name, path, unit] of definitions) body.append(element('p', `${name}: ${count(path ? at(E, path) : null)} ${unit}`, { margin: '6px 0' }));
      body.append(element('p', 'Text matching does not validate interpretation or certify safety.'));
      body.append(element('p', E.verifier?.review_coverage?.scope ?? 'Independent review coverage is not reported in this build.'));
      body.append(button('Inspect rejected excerpts', () => show('rejected')));
      const advanced = element('details'); advanced.append(element('summary', 'Advanced: build report'), link('Build report · JSON', 'data/engine.json', 'vesta-engine.json')); body.append(advanced);
    } else if (next === 'rejected') {
      body.append(element('h2', 'Rejected excerpts'), element('p', 'Loading the omitted context and source links…'));
      let sourceRecords = new Map();
      try { sourceRecords = await rejectionSources(); }
      catch { /* Render each real rejection with an explicit unavailable source state. */ }
      if (!alive || request !== serial) return;
      body.replaceChildren(renderRejectedExcerpts({ records: E.verifier?.rejected ?? [], sources: sourceRecords, locator: sourceLocator, rawLink: link }));
    } else if (next === 'assistant') {
      const site = new URL('.', location.href.split('#')[0]).href;
      body.append(element('p', 'Run from a clone of the repository. A browser cannot start a local stdio server.'));
      const config = JSON.stringify({ mcpServers: { vesta: { command: 'node', args: ['mcp/server.mjs', '--base', site] } } }, null, 2);
      const pre = element('pre', config, { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '18px' });
      pre.tabIndex = 0;
      const copy = element('button', 'Copy client configuration', { ...baseStyle, background: 'none', border: '1px solid var(--line-strong)', padding: '10px', minHeight: '44px', cursor: 'pointer' });
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(config); if (alive) copy.textContent = 'Copied'; }
        catch { getSelection()?.selectAllChildren(pre); if (alive) copy.textContent = 'Select and copy the configuration'; }
      });
      body.append(pre, copy, link('Setup instructions', 'https://github.com/itzjk/vesta/tree/main/mcp'));
    } else {
      body.append(element('p', 'Checking the available files…'));
      try {
        const listed = await files();
        if (!alive || request !== serial) return;
        body.replaceChildren();
        if (next === 'download') {
          const options = [['tests.csv', 'Source rows · CSV'], ['findings.csv', 'Findings · CSV'], ['sources.json', 'Attributed sources · JSON'], ['rules.json', 'Playbook rules · JSON']];
          options.filter(([path]) => listed.has(path)).forEach(([path, text]) => body.append(link(text, 'api/v1/' + path, path)));
          body.append(element('p', 'Rows include individual tests, test days and series. The total is not a count of independent burns.'));
        } else {
          body.append(link('API index · JSON', 'api/v1/index.json'));
          if (listed.has('engine.json')) body.append(link('Build counts · JSON', 'api/v1/engine.json'));
          const q = world.q ?? {};
          const path = `rank/${q.preset ?? 'lunar-base'}.${q.concern ?? 'prevention'}.json`;
          if (listed.has(path)) body.append(link('Preset evidence ranking · JSON', 'api/v1/' + path));
          body.append(element('p', 'Published files for the selected preset and concern; custom cabin changes are evaluated locally.'));
          body.append(element('p', core.text?.SCORE_LABEL ?? ''));
        }
        if (!body.children.length) body.append(element('p', 'This build does not list the requested files.'));
      } catch (error) {
        if (!alive || request !== serial || error.name === 'AbortError') return;
        body.replaceChildren(element('p', 'The file index could not be loaded. Select Download or Query the API to retry.'));
      }
    }
    if (active) world.invalidate?.();
  }
  const consoleHolo = world.hologram(consoleEl, { at: [2.7, -0.2, 0.6], width: 420, dock: 'right', marker: false, phoneRatio: .72, phoneBottom: 64 });
  consoleHolo.close();
  const markerHandles = [];
  definitions.forEach(([name], i) => {
    const marker = world.marker?.(consoleHolo, { at: [xs[i], 0.35, 0.55], label: i === 3 ? 'Run the checks' : `${name}: inspect the machine`, onClick() {
      if (i === 3) { openChecks(); return; }
      const next = i === 3 ? 'checks' : 'report';
      if (consoleHolo.target && tab === next) consoleHolo.close();
      else { show(next); consoleHolo.requested = true; consoleHolo.open(); }
    } });
    if (marker) { marker.element.dataset.trust = i === 3 ? 'run-checks' : name.toLowerCase(); markerHandles.push(marker); }
  });
  const dataMarker = world.marker?.(consoleHolo, { at: [0, -1.47, 0.7], label: 'Open the data console', onClick() {
    if (consoleHolo.target && tab === 'download') consoleHolo.close();
    else { show('download'); consoleHolo.requested = true; consoleHolo.open(); }
  } });
  if (dataMarker) { dataMarker.element.dataset.trust = 'console'; markerHandles.push(dataMarker); }
  const marksLayer = element('div');
  marksLayer.className = 'trust-proof-marks';
  marksLayer.hidden = true;
  marksLayer.dataset.stationUi = 'trust';
  Object.assign(marksLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  const chamberLabels = definitions.map(([name]) => {
    const label = element('span', name);
    label.className = 'trust-chamber-label';
    label.setAttribute('aria-hidden', 'true'); // The existing machine markers carry the accessible names.
    marksLayer.append(label);
    return label;
  });
  (world.overlay ?? world.host)?.append(marksLayer);
  const handles = [consoleHolo];
  const normalAnswer = () => `${count(E.verifier?.quotes_verified)} excerpts matched; ${count(E.verifier?.rejected?.length)} rejected.`;
  const summaryAnswer = () => `${results.length}/${casesFile?.cases.length ?? 10} cases checked · ${results.filter(r => r.pass).length} passed · ${results.filter(r => !r.pass).length} failed.`;
  const button = (label, action) => {
    const node = element('button', label, { font: 'inherit', padding: '10px 12px', cursor: 'pointer', minHeight: '44px' });
    node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const checksReport = createProofReport({ db, core, cite: (label, id, query) => contextualCite(label, id, world, { query }), onRun: startChecks,
    onStop: stopChecks, onRejected: () => show('rejected'), rawLink: link });
  const proofSession = createProofSession({
    load: () => loadCases({ signal: controller.signal }),
    evaluate: c => evaluateCase(c, db, core),
    onChange(state) {
      casesFile = state.file; running = ['loading', 'running'].includes(state.phase);
      if (!state.results.length) { completed.clear(); marks.splice(0).forEach(mark => mark.remove()); }
      results.splice(0, results.length, ...state.results);
      for (const result of results.slice(marks.length)) {
        completed.add(result.machine);
        const mark = element('span', result.pass ? '✓' : '×', { position: 'absolute', color: result.pass ? '#d6b57d' : '#e3957c', fontSize: '22px', lineHeight: '1', textShadow: '0 0 12px currentColor' });
        mark.dataset.proofMark = result.id; mark.dataset.machine = result.machine;
        mark.setAttribute('aria-hidden', 'true'); marksLayer.append(mark); marks.push(mark);
      }
      checksReport.update(state);
      if (active) {
        world.answer?.(state.phase === 'loading' ? 'Loading the reviewed expected outcomes…'
          : state.phase === 'error' ? 'Checks unavailable. Open the results to retry.' : summaryAnswer());
        world.invalidate?.();
      }
    }
  });
  function renderChecks() {
    body.replaceChildren(checksReport.element); checksReport.update(proofSession.snapshot());
  }
  function stopChecks() { proofSession.stop(); }
  function startChecks() {
    if (running || !alive || !active) return;
    show('checks'); return proofSession.run();
  }
  function openChecks() {
    show('checks'); consoleHolo.requested = true; consoleHolo.open();
    if (!running && !results.length) startChecks();
  }
  const isInspecting = () => world.host?.dataset.hologramOpen === 'true' || consoleHolo.target > 0;
  const camera = (t = 0) => {
    const phone = (world.host?.clientWidth ?? world.stage.size().width) < 760;
    const still = world.capture || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A narrow window that is also short gives a canvas wider than tall. The phone distance left the bench
    // small there: fit it to the width and centre it in the canvas (the station sentence sits below the scene).
    const short = phone && world.camera.aspect > 1;
    const phoneDistance = Math.max(short ? 10.8 : 16, 5.2 / (Math.tan(22 * Math.PI / 180) * world.camera.aspect));
    const phoneTarget = world.host?.dataset.cinema === 'true' ? -.2 : short ? .3 : 1.4;
    world.camera.userData.focusDistance = phone ? phoneDistance : isInspecting() ? 13 : 10.8;
    world.camera.userData.aperture = 1.1;
    const drift = still ? 0 : Math.sin(t * 0.22) * 0.18;
    return { position: [drift - .35, 0.5, phone ? phoneDistance : isInspecting() ? 13 : 10.8], target: [-.35, phone ? phoneTarget : -.2, 0], fov: phone ? 44 : 35 };
  };
  const screenPoint = new THREE.Vector3(), panelCamera = new THREE.PerspectiveCamera(), panelTarget = new THREE.Vector3();
  const stationOrigin = new THREE.Vector3(...(world.origin ?? [0, 0, 0]));
  show('checks');
  return {
    group, anchor, camera,
    actions: () => [['checks', () => running ? 'Checks running' : results.length ? 'Check results' : 'Run checks'], ['rejected', 'Rejected excerpts'], ['download', 'Download data'], ['api', 'Query the API'], ['assistant', 'Connect an assistant']].map(([id, label]) => ({ id, label, primary: id === 'checks', expanded: () => tab === id && consoleHolo.target > 0, run() { if (id === 'checks') openChecks(); else if (tab === id && consoleHolo.target) consoleHolo.close(); else { show(id); consoleHolo.requested = true; consoleHolo.open(); } } })),
    enter() { active = true; group.visible = true; marksLayer.hidden = false; world.answer?.(results.length && casesFile ? summaryAnswer() : normalAnswer()); },
    leave() { delete world.camera.userData.focusDistance; delete world.camera.userData.aperture; active = false; group.visible = false; marksLayer.hidden = true; stopChecks(); consoleHolo.close(); },
    update(t, state = {}) {
      if (!active) return;
      const reduced = state.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
      const size = world.stage.size();
      const phone = (world.host?.clientWidth ?? size.width) < 760;
      const viewHeight = world.host?.clientHeight ?? size.height;
      const layoutKey = `${viewHeight}:${world.host?.clientWidth ?? size.width}:${consoleEl.isConnected}`;
      if (consoleLayout !== layoutKey) {
        consoleLayout = layoutKey;
        const style = getComputedStyle(consoleEl);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const height = `${Math.max(120, (phone ? Math.min(viewHeight - 64, viewHeight * 0.72) : viewHeight - 170) - padding - 4)}px`;
        consoleContent.style.maxHeight = height; consoleContent.style.height = height;
      }
      marksLayer.hidden = world.host?.dataset.cinema === 'true' || document.documentElement.dataset.cinema === 'true' || world.filmActive === true || world.host?.dataset.flying === 'true';
      panelCamera.copy(world.camera ?? world.stage.camera);
      if (world.host?.dataset.flying !== 'true') {
        const framing = camera(t);
        panelCamera.position.fromArray(framing.position).add(stationOrigin);
        panelCamera.fov = framing.fov;
        panelCamera.lookAt(panelTarget.fromArray(framing.target).add(stationOrigin));
      }
      panelCamera.updateProjectionMatrix(); panelCamera.updateMatrixWorld(true);
      const canvas = world.host?.querySelector('.world-canvas');
      const offsetX = canvas?.offsetLeft ?? 0, offsetY = canvas?.offsetTop ?? 0;
      chamberLabels.forEach((label, i) => {
        screenPoint.set(xs[i], anchor[1] - .98, .78).add(stationOrigin).project(panelCamera);
        label.style.transform = `translate(${offsetX + (screenPoint.x + 1) * size.width / 2}px,${offsetY + (1 - screenPoint.y) * size.height / 2}px) translate(-50%, 0)`;
      });
      const machineCounts = new Map();
      marks.forEach(mark => {
        const i = definitions.findIndex(([name]) => name.toLowerCase() === mark.dataset.machine);
        const offset = machineCounts.get(i) ?? 0; machineCounts.set(i, offset + 1);
        screenPoint.set(xs[i], 1.3 + anchor[1], 0.3).add(stationOrigin).project(panelCamera);
        mark.style.transform = `translate(${offsetX + (screenPoint.x + 1) * size.width / 2 - 18 + offset % 2 * 22}px,${offsetY + (1 - screenPoint.y) * size.height / 2 - Math.floor(offset / 2) * 25}px)`;
      });
      const clock = reduced ? 2.8 : t;
      const cycle = ((clock % 7.6) + 7.6) % 7.6;
      const rejectPhase = clamp((cycle - 2.5) / 1.8);
      const ejection = smooth((rejectPhase - 0.4) / 0.6);
      rejected.visible = Array.isArray(E.verifier?.rejected) && E.verifier.rejected.length > 0 && cycle >= 2.5 && cycle < 4.3;
      rejected.position.set(xs[1] + ejection * 2.4, 0.12 + smooth(rejectPhase / 0.4) * 0.65 + ejection * 1.3, ejection * 0.8);
      rejected.rotation.set(ejection * 1.2, ejection * 0.9, -ejection * 2.7);
      machines.forEach(({ rotor, aperture, indicator }, i) => {
        const phase = clock * 1.35 - i * 0.8;
        if (i === 1) { rotor.position.y = Math.sin(phase * 2) * 0.32; rotor.rotation.y = 0; }
        else rotor.rotation.y = reduced ? 0.3 : phase * (i === 2 ? -0.45 : 0.35);
        aperture.rotation.z = i === 1 ? 0 : phase * 0.35;
        indicator.scale.x = completed.has(definitions[i][0].toLowerCase()) ? 1.8 : 0.75 + 0.25 * Math.sin(phase);
      });
      tokens.forEach((token, i) => {
        const progress = ((clock * 0.2 + i / tokens.length) % 1 + 1) % 1;
        token.position.set(xs[0] - 0.5 + progress * 6.4, -0.08 + Math.sin(progress * Math.PI * 6) * 0.045, 0.12);
        token.rotation.y = progress * Math.PI * 2;
        token.visible = progress < 0.98;
      });
      group.userData.flowTime = clock;
      group.userData.rejectionPhase = rejectPhase;
      const pose = { x: phone ? -3.4 : isInspecting() ? -3.9 : -4.3, y: phone && !isInspecting() ? -1.45 : -0.8, z: 1.25, yaw: 0.5, armR: rejected.visible ? 0.72 : 0.35, armFwd: 0.3, browTilt: rejected.visible ? -0.7 : -0.2, lookX: 0.6 + (state.pointerX ?? 0) * 0.15, lookY: 0.1, idle: reduced ? 0 : 1, blink: reduced ? 0 : Math.pow(Math.max(0, Math.cos(clock * 1.8)), 80), thrust: 0.55, beacon: 0.7 };
      Object.assign(world.vestaPose ?? {}, pose);
      world.vesta?.update?.(clock, { ...world.vesta.defaults, ...pose });
    },
    holograms() { return handles; },
    dispose() {
      alive = false; proofSession.dispose(); controller.abort(); serial++;
      markerHandles.forEach(marker => marker.dispose()); marksLayer.remove();
      handles.forEach(handle => handle?.dispose?.());
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => mat.dispose());
    }
  };
}
