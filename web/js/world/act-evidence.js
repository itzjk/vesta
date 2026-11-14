import { build as buildField, fieldRows } from '../scene/field.js';
import { summarize } from '../views/investigations.js';

const concerns = ['prevention', 'detection', 'suppression'];
const concernWords = { prevention: 'Starting a fire', detection: 'Detecting a fire', suppression: 'Putting a fire out' };
const cabinWords = { station: 'Space station', spacecraft: 'Spacecraft', 'lunar-base': 'Moon base', rover: 'Pressurized rover', 'mars-base': 'Mars base' };
const plain = text => String(text || '').replace(/The PSI-\d+ record/g, 'The study record').replace(/The PSI-\d+/g, 'The study').replace(/PSI-\d+/g, 'this study').replace(/\bPMMA\b/g, 'acrylic plastic').replace(/\bISS\b/g, 'space station').replace(/microgravity/g, 'near-weightlessness').replace(/quiescent/g, 'still-air').replace(/coflow/g, 'flowing-air').replace(/extinguished/g, 'went out');
const words = text => String(text || '').replace(/_/g, ' ');
const materialWord = text => ({ PMMA: 'Acrylic plastic (PMMA)', SIBAL: 'Cotton/fiberglass fabric (SIBAL)' })[text] || text;
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
};

export function evidenceState(db, core, q, investigation = null) {
  const cells = core.status.cells(q, db), tally = core.status.tally(cells);
  const cell = core.status.cell(q.material, q.concern, q, db);
  const axes = core.status.axes(q, db);
  const inv = db.invById[investigation] || null;
  const rows = inv ? db.rowsByPsi[inv.psi_id] || [] : [];
  const summary = inv ? summarize(rows) : null;
  const findings = inv ? db.findings.filter(f => f.n.psi_id === inv.psi_id && f.claim && f.n.work !== 'operations').sort((a, b) => (a.n.work === 'flight' ? 0 : 1) - (b.n.work === 'flight' ? 0 : 1) || a.claim.length - b.claim.length) : [];
  return { cells, tally, cell, axes, gaps: core.text.gaps(axes, q, db), answer: core.text.designAnswer(tally, db), inv, rows, summary, finding: findings[0] || null };
}

export async function build(world) {
  const { THREE: T, db, core } = world;
  const stage = world.stage.context || world.stage.ctx || world.stage;
  const group = new T.Group();
  group.name = 'evidence-room';
  const field = await buildField({ ...stage, THREE: T, world: true });
  group.add(field.group);
  const wall = new T.Group();
  group.add(wall);
  const wallMaterial = new T.MeshStandardMaterial({ color: 0x28241f, roughness: .88, metalness: .18 });
  const seamMaterial = new T.MeshBasicMaterial({ color: 0x8f3a28 });
  const doors = [-1, 1].map(side => {
    const door = new T.Group();
    const slab = new T.Mesh(new T.BoxGeometry(7.6, 8.4, .25), wallMaterial);
    const seam = new T.Mesh(new T.BoxGeometry(.035, 7.8, .03), seamMaterial);
    seam.position.set(-side * 3.65, 0, .15);
    door.add(slab, seam); door.position.set(side * 3.8, 0, 5.1);
    wall.add(door);
    return door;
  });
  const frameMaterial = new T.MeshStandardMaterial({ color: 0x322d27, roughness: .7, metalness: .3 });
  for (const y of [-4.3, 4.3]) {
    const beam = new T.Mesh(new T.BoxGeometry(17, .22, .4), frameMaterial);
    beam.position.set(0, y, 5.1); wall.add(beam);
  }
  const style = node('style');
  style.textContent = `
.evidence-holo{color:var(--ivory,#ede4d4);font-family:var(--font-body,'Source Sans 3',sans-serif);font-size:20px;line-height:1.38;box-sizing:border-box;max-width:100%;padding:18px 22px 20px;background:rgba(25,23,21,.88);border:0;border-radius:0;box-shadow:none;border-top:1px solid rgba(224,164,88,.45)}
.evidence-holo h2{font-size:25px;line-height:1.15;margin:0 0 14px;font-weight:600}.evidence-holo p{margin:10px 0}.evidence-holo button,.evidence-holo select,.evidence-holo a{font:inherit}.evidence-holo button,.evidence-holo select{min-height:44px;color:var(--ivory,#ede4d4)}
.evidence-holo select{width:100%;padding:7px 10px;background:var(--bg-2,#211e1b);border:1px solid var(--line-strong,rgba(237,228,212,.34));border-radius:0;box-sizing:border-box}.evidence-holo option{background:var(--bg-2,#211e1b);color:var(--ivory,#ede4d4)}
.evidence-tabs{display:flex;gap:18px;margin-bottom:16px}.evidence-tabs button{padding:4px 0;background:none;border:0;border-bottom:1px solid transparent;color:var(--ivory-dim,#b9ae9d)}.evidence-tabs button[aria-pressed=true]{color:var(--ivory,#ede4d4);border-color:var(--amber,#e0a458)}
.evidence-holo label{display:block;margin:12px 0}.evidence-holo label>span{display:block;color:var(--ivory-dim,#b9ae9d);margin-bottom:4px}.evidence-note{font-size:18px;color:var(--ivory-dim,#b9ae9d)}.evidence-answer{width:900px;background:transparent;border:0;padding:0;overflow:visible}.evidence-answer h2{font-size:24px;color:var(--ivory-dim,#b9ae9d);font-weight:400}.evidence-console{font-size:18px}.evidence-console h2{font-size:22px}.evidence-console details{margin-top:12px}.evidence-console summary{min-height:44px;line-height:44px;cursor:pointer}.evidence-selected-status>h2{margin-top:10px}.evidence-console{width:420px;max-height:var(--evidence-console-height,510px)!important;overflow:auto;overscroll-behavior:contain}.evidence-answer .evidence-answer-sentence{font-size:34px;line-height:1.15;margin:0 0 16px!important}.evidence-selected-status{padding-top:14px;border-top:1px solid var(--line,rgba(237,228,212,.14))}.evidence-selected-status strong{display:block;font-weight:600;color:var(--amber,#e0a458)}.evidence-selected-status[data-status=NEVER_TESTED] strong{color:var(--rust-text,#e2795f)}.evidence-selected-status[data-status=PROVEN] strong{color:var(--ivory,#ede4d4)}
.evidence-next{display:block;margin-top:16px;min-height:44px;padding:8px 14px;background:var(--rust-deep,#8f3a28);color:var(--ivory,#ede4d4);border:0;text-align:left;text-decoration:none}.evidence-detail{display:inline-block;min-height:44px;line-height:44px;color:var(--ivory-dim,#b9ae9d);text-underline-offset:4px}.evidence-holo :focus-visible{outline:2px solid var(--ivory,#ede4d4);outline-offset:4px}
.evidence-world-active .field-labels{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}.evidence-world-active .field-label{position:absolute;max-width:230px;color:var(--ivory-dim,#b9ae9d);font:18px/1.2 'Source Sans 3',sans-serif;white-space:normal;background:rgba(18,16,14,.85);padding:3px 6px;transform:translate(-5%,-50%)}.evidence-world-active .field-label small{display:block;font-size:16px}.evidence-world-active .field-gap-label{color:var(--rust-text,#e2795f);max-width:200px}.evidence-world-active .field-data-label{color:var(--earth,#8fa3b5)}.evidence-world-active .field-cabin-label{color:var(--rust-text,#e2795f)}.evidence-world-active .field-tick{font-size:16px;background:none}.evidence-world-active .field-delta-label{display:none}.evidence-world-active .field-hover-label{max-width:320px;z-index:3;color:var(--ivory,#ede4d4)}
@media(max-width:759px){.evidence-answer>h2{display:none}.evidence-answer{padding:0;max-height:230px!important}.evidence-answer h2{font-size:20px;margin-bottom:8px}.evidence-answer>.evidence-note{font-size:16px}.evidence-holo{font-size:18px;padding:14px 16px}.evidence-answer{padding:0}.evidence-holo h2{font-size:22px}.evidence-answer .evidence-answer-sentence{font-size:24px}.evidence-answer,.evidence-console{width:350px}.evidence-console{max-height:420px}.evidence-note{font-size:18px}.evidence-world-active .field-axis,.evidence-world-active .field-tick,.evidence-world-active .field-rail-label{display:none}.evidence-world-active .field-plane-label{font-size:16px;max-width:150px}.evidence-world-active .field-plane-label small{font-size:16px}.evidence-world-active .field-hover-label{font-size:16px}}
`;
  (world.host || stage.renderer.domElement.parentElement).append(style);
  const host = stage.renderer.domElement.parentElement;
  const answerEl = node('section', null, 'evidence-holo evidence-answer');
  answerEl.setAttribute('aria-label', 'Calculated evidence coverage');
  const consoleEl = node('section', null, 'evidence-holo evidence-console');
  consoleEl.setAttribute('aria-label', 'Evidence console');
  for (const el of [answerEl, consoleEl]) {
    el.dataset.evidenceHologram = '';
    for (const event of ['pointerdown', 'wheel', 'keydown']) el.addEventListener(event, e => e.stopPropagation());
  }
  const handles = [
    world.hologram(answerEl, { at: [4.9, -.1, 7.5], width: 500, face: 'camera', unfoldFrom: [-4.6, -.4, 7] }),
    world.hologram(consoleEl, { at: [-5.5, .2, 7.5], width: 420, face: 'camera', unfoldFrom: [-4.6, -.4, 7] })
  ];
  let active = false, currentQ = world.q, panel = world.route === 'investigations' ? 'investigations' : 'cabin';
  let investigation = db.invById[world.params?.sel] ? world.params.sel : null;
  let lastKey = '', lastTime = 0, entrance = null, reaction = -100, orbit = .292, elevation = .126, drag = null;
  const canvas = stage.renderer.domElement;
  const dragging = event => {
    if (!active || !drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 5) {
      orbit = Math.max(-.5, Math.min(.85, drag.orbit - dx * .0025));
      elevation = Math.max(-.15, Math.min(.35, drag.elevation + dy * .001));
      event.stopPropagation();
      world.invalidate?.();
    }
  };
  const startDrag = event => { if(active) drag = { x: event.clientX, y: event.clientY, orbit, elevation }; };
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerdown', startDrag);
  canvas.addEventListener('pointermove', dragging);
  window.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  const projection = new T.Vector3(), origin = new T.Vector3(...(world.origin || [0, 0, 0]));
  const phone = () => stage.size().width < 760;
  const layout = () => {
    const { width, height } = stage.size();
    const camera = stage.camera;
    camera.updateMatrixWorld();
    const depth = 18, focal = height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const place = (handle, x, y, z) => {
      projection.set((x * width - width / 2) * depth / focal, (height / 2 - y * height) * depth / focal, -depth + z).applyQuaternion(camera.quaternion).add(camera.position).sub(origin);
      handle.set({ at: projection.toArray(), keepPosition: true });
    };
    if (phone()) {
      answerEl.style.width = `${width - 40}px`;
      answerEl.style.maxHeight = '230px';
      consoleEl.style.width = `${width - 40}px`;
      consoleEl.style.setProperty('--evidence-console-height', `${Math.min(310, height * .38)}px`);
      place(handles[0], .5, .185, 0); place(handles[1], .5, .72, -.15);
      field.group.scale.set(.58, .65, .8); field.group.position.y = 1.8;
    } else {
      answerEl.style.width = `${Math.min(960, width - 160)}px`;
      consoleEl.style.width = '350px'; consoleEl.style.setProperty('--evidence-console-height', `${height * .57}px`);
      place(handles[0], .54, .18, 0); place(handles[1], .155, .6, -.15);
      field.group.scale.set(1, 1, 1); field.group.position.y = 0;
    }
  };
  const plotted = fieldRows(db);
  const phrase = (text, id) => world.cite(text, id);
  const details = (label, route, extra = {}) => {
    const a = node('a', label, 'evidence-detail');
    const params = new URLSearchParams({ view: 'details', preset: currentQ.preset, concern: currentQ.concern, mat: currentQ.material || '', ...extra });
    a.href = `#/${route}?${params}`;
    return a;
  };
  const coverageSource = id => id === 'NEVER_TESTED' ? 'design-coverage' : 'selected-material-coverage';
  function applyQ(patch) {
    reaction = lastTime;
    world.setQ(patch, { render: false });
    currentQ = world.q;
    lastKey = '';
    world.invalidate?.();
  }
  function chooseInvestigation(id) {
    investigation = db.invById[id] ? id : null;
    reaction = lastTime;
    world.setParams?.({ sel: investigation }, { render: false });
    lastKey = '';
    paint();
    world.invalidate?.();
  }
  function selector(label, name, options, value, change) {
    const wrapper = node('label'), select = node('select');
    wrapper.append(node('span', label), select);
    select.setAttribute('aria-label', label); select.dataset.evidenceChoice = name;
    for (const [id, text] of options) { const option = node('option', text); option.value = id; select.append(option); }
    select.value = value || '';
    select.addEventListener('change', () => change(select.value));
    return wrapper;
  }
  function paint() {
    let selectedBlock = null;
    const s = evidenceState(db, core, currentQ, investigation), text = core.text;
    const focus = document.activeElement?.dataset.evidenceChoice;
    const scroll = consoleEl.scrollTop;
    answerEl.replaceChildren(node('h2', panel === 'cabin' ? 'Has a cabin like yours been tested?' : 'What did these investigations find?'));
    const sentence = node('p', null, 'evidence-answer-sentence');
    sentence.dataset.answer = ''; sentence.dataset.claim = 'design-coverage';
    if (panel === 'cabin') sentence.append(phrase(s.answer, 'design-coverage'));
    else sentence.append(phrase(`Explore ${db.investigations.length} investigations and ${db.tests.length.toLocaleString('en-US')} source-table rows.`, 'investigation-counts'));
    answerEl.append(sentence);
    if (panel === 'cabin') {
      const selected = node('div', null, 'evidence-selected-status'); selected.dataset.status = s.cell.status;
      selected.append(node('h2', `${materialWord(db.materials[currentQ.material]?.label || 'Choose a material')} · ${concernWords[currentQ.concern]?.toLowerCase() || currentQ.concern}`));
      if (currentQ.material) {
        const symbol = { PROVEN: '●', EXTRAPOLATED: '◐', NEVER_TESTED: '○' }[s.cell.status];
        selected.append(node('strong', `${symbol} ${text.status(s.cell.status)}`), phrase(text.statusMeaning(s.cell.status, s.cell.qualifier), coverageSource(s.cell.status)));
        if (s.cell.status === 'PROVEN') selected.append(node('p', 'A nearby-condition match only. Airflow and sample shape are not matched.', 'evidence-note'));
      }
      selectedBlock = selected;
      const explanation = node('details');
      explanation.append(node('summary', 'Why this result?'));
      const explanationText = node('p', null, 'evidence-note');
      explanationText.append(phrase(text.cellSentence(s.cell, materialWord(db.materials[currentQ.material]?.label), db), 'selected-material-coverage'));
      explanation.append(explanationText);
      for (const gap of s.gaps) { const line = node('p', null, 'evidence-note'); line.append(phrase(gap.sentence, 'coverage-' + gap.axis)); explanation.append(line); }
      if (currentQ.material) selected.append(explanation);
      else selected.append(node('p', 'Choose a material to check its evidence coverage.', 'evidence-note'));
    } else {
      selectedBlock = node('div');
      selectedBlock.append(node('p', 'Choose an investigation. Its real rows brighten in the room; every point opens its table row.', 'evidence-note'));
      const included = node('p', null, 'evidence-note');
      included.append(phrase(`${plotted.length.toLocaleString('en-US')} rows have a single ambient oxygen value to plot. Other rows stay in the instrument view.`, 'map-exclusions'));
      selectedBlock.append(included);
    }
    answerEl.append(node('p', text.STATUS_LINE, 'evidence-note'));
    const next = node('button', 'Run the fire drill', 'evidence-next'); next.type = 'button';
    next.addEventListener('click', () => world.navigate ? world.navigate('drill') : world.go('#/incident?play=1'));
    const tabs = node('div', null, 'evidence-tabs');
    for (const [id, label] of [['cabin', 'Choose a cabin'], ['investigations', 'Investigations']]) {
      const button = node('button', label); button.type = 'button'; button.setAttribute('aria-pressed', String(panel === id)); button.dataset.evidenceTab = id;
      button.addEventListener('click', () => { panel = id; if (id === 'cabin') investigation = null; lastKey = ''; paint(); world.invalidate?.(); }); tabs.append(button);
    }
    consoleEl.replaceChildren(tabs);
    if (panel === 'cabin') {
      consoleEl.append(selector('Where?', 'preset', db.presets.map(p => [p.id, cabinWords[p.id] || p.short || p.label]), currentQ.preset, preset => applyQ({ preset })),
        selector('What worries you?', 'concern', concerns.map(id => [id, concernWords[id]]), currentQ.concern, concern => applyQ({ concern })),
        selector('Material', 'material', [['', 'Choose a material'], ...Object.entries(db.materials).map(([id, m]) => [id, materialWord(m.label)])], currentQ.material, material => applyQ({ material })));
      const atmosphere = node('p', null, 'evidence-note');
      atmosphere.append(phrase(`${text.oxygen(currentQ.o2)} · ${currentQ.g_label || text.gravity(currentQ.g)} · ${text.pressure(currentQ.p)}.`, db.presetById[currentQ.preset] ? currentQ.preset : 'design-coverage'));
      consoleEl.append(atmosphere, selectedBlock, node('p', 'Rust: your cabin. Ivory: cabin materials. Grey-blue: model fuels, a different fuel class. Hollow points have facility-inferred pressure.', 'evidence-note'), details('Open all cabin instruments', 'design'));
    } else {
      const options = [['', 'All investigations'], ...db.investigations.map(i => [i.psi_id, plain(i.name || i.full_name)])];
      consoleEl.append(selector('Investigation', 'investigation', options, investigation, chooseInvestigation));
      if (s.inv) {
        consoleEl.append(node('h2', plain(s.inv.name)));
        const fuels = s.summary.fuels.items.map(f => plain(f.value));
        const material = !s.summary.has_table ? s.summary.rows ? 'Dataset index, not individual burns.' : 'No experimental table in PSI.' : fuels.length ? `What burned: ${fuels.slice(0, 3).join(', ')}${fuels.length > 3 ? `; ${fuels.length - 3} other fuels` : ''}.` : 'Fuel is not stated in these table rows.';
        const materialLine = node('p'); materialLine.append(phrase(material, s.inv.psi_id)); consoleEl.append(materialLine);
        if (s.finding) {
          const findingLine = node('p'); findingLine.append(phrase(plain(s.finding.claim), s.finding.id)); consoleEl.append(findingLine, node('p', `${text.level(s.finding)}. A finding about this study, not a cabin safety approval.`, 'evidence-note'));
        } else {
          const outcomes = s.summary.outcomes.map(o => words(o.name));
          const summaryLine = node('p');
          summaryLine.append(phrase(outcomes.length ? `Recorded: ${outcomes.slice(0, 2).join(', ')}.` : s.summary.kinds.every(k => k.value === 'dataset_index') && s.summary.rows ? 'These rows index datasets rather than individual burns.' : 'No reviewed written finding is linked to this record yet.', s.inv.psi_id));
          consoleEl.append(summaryLine);
        }
        const plottedRows = plotted.filter(p => p.row.psi_id === s.inv.psi_id).length;
        const rowsLine = node('p', null, 'evidence-note'); rowsLine.append(phrase(`${s.rows.length.toLocaleString('en-US')} source-table rows; ${plottedRows.toLocaleString('en-US')} plotted here. A row can describe a day, series or dataset, rather than one burn.`, s.inv.psi_id)); consoleEl.append(rowsLine);
        consoleEl.append(details('Read full record and compare', 'investigations', { sel: s.inv.psi_id }));
      } else consoleEl.append(node('p', 'All plotted rows are visible. Pick a study to isolate its evidence, including studies with no plottable rows.', 'evidence-note'), details('Open all records and compare', 'investigations'));
    }
    if (panel === 'investigations') consoleEl.append(selectedBlock);
    consoleEl.append(next);
    consoleEl.scrollTop = scroll;
    if (focus) consoleEl.querySelector(`[data-evidence-choice="${focus}"]`)?.focus({ preventScroll: true });
    consoleEl.dataset.investigation = investigation || 'all';
    host.dataset.evidenceSelectedRows = String(investigation ? plotted.filter(p => p.row.psi_id === investigation).length : plotted.length);
  }
  paint();
  field.setVisible(false);
  group.visible = false;
  return {
    group,
    anchor: [0, 0, 0],
    camera() { return { position: [Math.sin(orbit) * 24, Math.sin(elevation) * 25, Math.cos(orbit) * 24], target: [phone() ? 0 : -2, .2, 0], fov: 40 }; },
    enter() {
      active = true; entrance = null; group.visible = true; field.setVisible(true); host.classList.add('evidence-world-active');
      const nextPanel = world.route === 'investigations' ? 'investigations' : 'cabin';
      panel = nextPanel; lastKey = ''; paint();
      handles.forEach(h => h.open?.());
    },
    leave() {
      active = false; drag = null; group.visible = false; field.setVisible(false); host.classList.remove('evidence-world-active'); delete host.dataset.evidenceActive;
      handles.forEach(h => h.close?.());
    },
    update(t, state = {}) {
      if (!active || state.active === false) return;
      lastTime = t; entrance ??= t;
      currentQ = state.q || world.q;
      const key = JSON.stringify([currentQ, panel, investigation]);
      if (key !== lastKey) { lastKey = key; paint(); }
      const fixed = state.capture || state.reduced || stage.mode === 'still';
      const a = fixed ? 1 : Math.min(1, Math.max(0, (t - entrance) / 1.2));
      const ease = a * a * (3 - 2 * a);
      doors.forEach((door, i) => { door.position.x = (i ? 1 : -1) * (3.8 + 8.3 * ease); });
      layout();
      field.update(t, { db, q: currentQ, capture: state.capture, reduced: state.reduced, investigation: panel === 'investigations' ? investigation : null });
      if (world.vesta?.update) {
        const pulse = fixed ? 0 : Math.max(0, 1 - (t - reaction) / 1.1);
        const idleTime = fixed ? 2 : t;
        world.vesta.update(idleTime, { ...world.vesta.defaults, x: phone() ? 1.2 : 3.2, y: phone() ? 1.6 : -3.1, z: 7.6, scale: phone() ? 1.1 : 1.8, yaw: .5, idle: fixed ? 0 : 1, blink: fixed ? 0 : Math.max(0, 1 - Math.abs((t % 4.7) - 3.9) / .085), lookX: Math.max(-1, Math.min(1, state.pointerX || .3)), lookY: state.pointerY || .1, armR: .6 + pulse * .25, armFwd: .5, thrust: .55 + pulse * .35, browTilt: -.2, beaconWarm: .65 });
      }
      host.dataset.evidenceWall = ease.toFixed(3);
      host.dataset.evidenceInvestigation = investigation || 'all';
      host.dataset.evidenceActive = 'true';
    },
    pick(x, y) { return active ? field.pick(x, y) : null; },
    holograms() { return handles; },
    dispose() {
      active = false; canvas.removeEventListener('pointerdown', startDrag); canvas.removeEventListener('pointermove', dragging); window.removeEventListener('pointerup', endDrag); canvas.removeEventListener('pointercancel', endDrag);
      field.dispose(); handles.forEach(h => h.dispose?.()); style.remove(); host.classList.remove('evidence-world-active');
      const seen = new Set();
      group.traverse(o => { for (const resource of [o.geometry, ...[o.material].flat()]) if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose?.(); } });
      group.removeFromParent();
    }
  };
}
