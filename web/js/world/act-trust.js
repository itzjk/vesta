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
  const light = new THREE.PointLight(0xe0a458, 9, 13, 2);
  light.position.set(-1, 3, 4);
  group.add(light);
  group.add(new THREE.HemisphereLight(0xede4d4, 0x211e1b, 1.5));

  const baseStyle = { color: 'var(--ivory, #ede4d4)', fontFamily: '"Source Sans 3", sans-serif', fontSize: '20px', lineHeight: '1.25', boxSizing: 'border-box' };
  const panel = element('section', null, { ...baseStyle, width: '960px', padding: '8px 12px', pointerEvents: 'auto' });
  panel.className = 'trust-hologram';
  panel.style.background = 'transparent';
  panel.style.borderTop = '0';
  panel.setAttribute('aria-label', 'Trust and evidence engine');
  const title = element('h1', 'Can you trust it?', { fontSize: '24px', fontWeight: '400', margin: '0 0 10px', color: 'var(--ivory-dim)' });
  const phrase = element('button', `${count(E.verifier?.quotes_verified)} quote excerpts matched source text; ${count(E.verifier?.rejected?.length)} were rejected.`, {
    background: 'none', color: 'inherit', border: '0', padding: '0', textAlign: 'left', font: 'inherit', fontSize: '36px', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '7px'
  });
  phrase.dataset.trust = 'counts';
  const labels = element('div', null, { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '28px', width: 'min(100%, 720px)', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' });
  const scenarioId = db.scenario?.meta?.id ?? Object.keys(E.officer ?? {}).find(key => E.officer[key] && typeof E.officer[key] === 'object');
  const stepsPath = scenarioId ? `officer.${scenarioId}.steps` : null;
  const definitions = [
    ['Extractor', 'extractor.psi_kept', 'NASA studies'],
    ['Verifier', 'verifier.quotes_verified', 'matched excerpts'],
    ['Ranker', 'ranker.findings', 'findings'],
    ['Officer', stepsPath, 'drill decisions']
  ];
  definitions.forEach(([name, path, unit]) => {
    const label = element('div');
    label.dataset.machine = name.toLowerCase();
    label.append(element('h2', name, { fontSize: '24px', margin: '0 0 5px' }));
    const value = element('button', count(path ? at(E, path) : null), { background: 'none', color: 'inherit', border: '0', borderBottom: '1px dotted var(--earth)', font: 'inherit', fontSize: '26px', padding: '4px 0', cursor: 'pointer' });
    value.dataset.count = path ?? '';
    value.setAttribute('aria-label', `${name}: ${value.textContent} ${unit}. Open build report`);
    value.addEventListener('click', () => show('report'));
    label.append(value, element('p', unit, { fontSize: '20px', color: 'var(--ivory-dim)', margin: '4px 0' }));
    labels.append(label);
  });
  panel.append(title, phrase, labels);
  const limit = element('p', 'Text matching does not validate VESTA’s interpretation or certify safety.', { fontSize: '20px', color: 'var(--ivory-dim)', margin: '16px 0 0' });
  panel.append(limit);

  const consoleEl = element('section', null, { ...baseStyle, width: '850px', padding: '12px', maxHeight: '510px', overflowY: 'auto', background: 'rgba(18,16,14,.92)' });
  consoleEl.className = 'trust-console';

  consoleEl.setAttribute('aria-label', 'Open evidence data console');
  const nav = element('nav', null, { display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginBottom: '14px' });
  nav.setAttribute('aria-label', 'Use the evidence');
  const body = element('div', null, { overflowY: 'auto', minHeight: '36px', flexShrink: '1' });
  body.tabIndex = 0;
  nav.style.flexShrink = '0';
  body.setAttribute('aria-live', 'polite');
  const controller = new AbortController();
  let alive = true, active = false, layoutWidth = null, tab = 'home', manifest = null, serial = 0;
  const buttons = new Map();
  const link = (label, href, download) => {
    const node = element('a', label, { color: 'var(--earth, #8fa3b5)', display: 'inline-block', padding: '10px 14px 10px 0', minHeight: '44px', boxSizing: 'border-box' });
    node.href = href;
    if (download) node.download = download;
    else { node.target = '_blank'; node.rel = 'noopener'; }
    return node;
  };
  for (const [id, text] of [['download', 'Download'], ['api', 'Query the API'], ['assistant', 'Connect an assistant']]) {
    const button = element('button', text, { font: 'inherit', background: 'none', border: '0', borderBottom: '1px solid var(--line-strong)', padding: '10px 0', minHeight: '44px', color: 'var(--ivory)', cursor: 'pointer' });
    button.type = 'button'; button.dataset.trust = id;
    button.addEventListener('click', () => show(tab === id ? 'home' : id));
    buttons.set(id, button); nav.append(button);
  }
  const consoleContent = element('div', null, { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0' });
  consoleContent.append(nav, body);
  consoleEl.append(consoleContent);
  const status = element('p', core.text?.STATUS_LINE ?? '', { fontSize: '18px', color: 'var(--ivory-dim)', margin: '12px 0 0' });
  status.style.flexShrink = '0';
  consoleContent.append(status);
  phrase.addEventListener('click', () => show('report'));

  async function files() {
    if (manifest) return manifest;
    const response = await fetch('api/v1/index.json', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The file index did not load.');
    const result = await response.json();
    if (!Array.isArray(result.files)) throw new Error('This build does not list evidence files.');
    manifest = new Set(result.files.map(file => typeof file === 'string' ? file : file.path).filter(path => typeof path === 'string').map(path => path.replace(/^api\/v1\//, '')));
    return manifest;
  }
  async function show(next) {
    tab = next;
    const request = ++serial;
    for (const [id, button] of buttons) button.setAttribute('aria-expanded', String(id === next));
    body.replaceChildren();
    consoleEl.dataset.tab = next;
    if (next === 'home') {
      body.append(element('p', 'Take the evidence with you.', { fontSize: '28px', margin: '0' }));
    } else if (next === 'report') {
      body.append(element('h2', 'What was checked', { fontSize: '26px', margin: '0 0 10px' }), link('Read the build report', 'data/engine.json'));
      body.append(element('p', E.verifier?.review_coverage?.scope ?? 'Independent review coverage is not reported in this build.'));
      const rejectedRecords = E.verifier?.rejected;
      if (Array.isArray(rejectedRecords)) {
        for (const record of rejectedRecords) {
          const why = String(record.why ?? record.reason ?? 'not reported').replace(/_/g, ' ');
          const row = element('p', null, { color: 'var(--ivory-dim)', margin: '12px 0' });
          row.append(element('b', record.id ?? 'Rejected excerpt'), document.createTextNode(`: ${why}.`));
          if (record.quote) row.append(element('blockquote', `“${record.quote}”`, { margin: '6px 0' }));
          body.append(row);
        }
      }
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
          body.append(link('Open the API index', 'api/v1/index.json'));
          if (listed.has('engine.json')) body.append(link('Query build counts', 'api/v1/engine.json'));
          const q = world.q ?? {};
          const path = `rank/${q.preset ?? 'lunar-base'}.${q.concern ?? 'prevention'}.json`;
          if (listed.has(path)) body.append(link('Query this cabin’s evidence', 'api/v1/' + path));
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
  show('home');
  const answerHolo = world.hologram(panel, { at: [0, 2.48, 0.1], face: true, unfoldFrom: [-2.2, 0.2, 1], width: 960, keepPosition: true });
  const consoleHolo = world.hologram(consoleEl, { at: [0, -2, 1.3], face: true, unfoldFrom: [-2.2, 0.2, 1], width: 850, keepPosition: true });
  const handles = [answerHolo, consoleHolo];
  const setVisible = on => handles.forEach(handle => on ? handle?.open?.() : handle?.close?.());
  setVisible(false);
  const camera = (t = 0) => {
    const phone = world.stage.size().width < 760;
    const still = world.capture || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const drift = still ? 0 : Math.sin(t * 0.22) * 0.65;
    return { position: [drift, 0.5, phone ? 24 : 10.8], target: [0, 0.2, 0], fov: phone ? 44 : 45 };
  };
  const screenPoint = new THREE.Vector3();
  const panelCamera = new THREE.PerspectiveCamera();
  const panelTarget = new THREE.Vector3();
  const stationOrigin = new THREE.Vector3(...(world.origin ?? [0, 0, 0]));
  const placePanel = (handle, screenY, distance, height) => {
    const camera = panelCamera;
    const half = Math.tan(camera.fov * Math.PI / 360) * distance;
    screenPoint.set(0, (1 - screenY / height * 2) * half, -distance).applyQuaternion(camera.quaternion).add(camera.position);
    const origin = world.origin ?? [0, 0, 0];
    handle?.set?.({ at: screenPoint.toArray().map((value, index) => value - origin[index]), keepPosition: true });
  };
  return {
    group, anchor, camera,
    enter() { active = true; group.visible = true; setVisible(true); },
    leave() { active = false; group.visible = false; setVisible(false); },
    update(t, state = {}) {
      if (!active) return;
      const reduced = state.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
      const size = world.stage.size();
      const phone = size.width < 760;
      panelCamera.copy(world.camera ?? world.stage.camera);
      if (world.host?.dataset.flying !== 'true') {
        const framing = camera(t);
        panelCamera.position.fromArray(framing.position).add(stationOrigin);
        panelCamera.fov = framing.fov;
        panelCamera.lookAt(panelTarget.fromArray(framing.target).add(stationOrigin));
      }
      if (layoutWidth !== size.width) {
      layoutWidth = size.width;
      panel.style.width = `${phone ? Math.max(280, size.width - 36) : Math.min(960, size.width - 100)}px`;
      consoleEl.style.width = `${phone ? Math.max(280, size.width - 36) : Math.min(850, size.width - 100)}px`;
      phrase.style.fontSize = phone ? '25px' : '36px';
      title.style.fontSize = phone ? '20px' : '24px';
      labels.style.gap = phone ? '5px' : '12px';
      labels.style.marginTop = phone ? '14px' : '28px';
      labels.querySelectorAll('h2').forEach(node => { node.style.fontSize = phone ? '18px' : '24px'; });
      labels.querySelectorAll('p').forEach(node => { node.style.fontSize = phone ? '18px' : '20px'; });
      limit.style.fontSize = phone ? '18px' : '20px';
      }
      consoleEl.style.height = `${phone ? Math.max(220, size.height * 0.29) : tab === 'home' ? 165 : size.height * 0.32}px`;
      const top = phone ? 82 : 75;
      placePanel(answerHolo, top + panel.offsetHeight / 2, 9.5, size.height);
      placePanel(consoleHolo, size.height - 72 - consoleEl.offsetHeight / 2, 9.5, size.height);
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
        indicator.scale.x = 0.75 + 0.25 * Math.sin(phase);
      });
      tokens.forEach((token, i) => {
        const progress = ((clock * 0.2 + i / tokens.length) % 1 + 1) % 1;
        token.position.set(xs[0] - 0.5 + progress * 6.4, -0.08 + Math.sin(progress * Math.PI * 6) * 0.045, 0.12);
        token.rotation.y = progress * Math.PI * 2;
        token.visible = progress < 0.98;
      });
      group.userData.flowTime = clock;
      group.userData.rejectionPhase = rejectPhase;
      const pose = { x: phone ? -3.4 : -4.3, y: phone ? -1.45 : -0.8, z: 1.25, yaw: 0.5, armR: rejected.visible ? 0.72 : 0.35, armFwd: 0.3, browTilt: rejected.visible ? -0.7 : -0.2, lookX: 0.6 + (state.pointerX ?? 0) * 0.15, lookY: 0.1, idle: reduced ? 0 : 1, blink: reduced ? 0 : Math.pow(Math.max(0, Math.cos(clock * 1.8)), 80), thrust: 0.55, beacon: 0.7 };
      Object.assign(world.vestaPose ?? {}, pose);
      world.vesta?.update?.(clock, { ...world.vesta.defaults, ...pose });
    },
    holograms() { return handles; },
    dispose() {
      alive = false; controller.abort(); serial++;
      handles.forEach(handle => handle?.dispose?.());
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => mat.dispose());
    }
  };
}
