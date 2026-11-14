import { build as buildField, fieldRows } from '../scene/field.js?v=2';
import { summarize } from '../views/investigations.js';
import { receiptControls } from '../ui/receipt.js';
import { media } from './media.js';
import { G, CONCERNS } from '../core/index.js';
import { TOL } from '../core/match.js';
import { searchEvidence, cabinMatches, compareInvestigations, NO_MATCH } from './ask.js?v=2';

const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const words = value => String(value ?? '').replace(/_/g, ' ');

export function evidenceState(db, core, q, investigation = null) {
  const cells = core.status.cells(q, db), tally = core.status.tally(cells);
  const inv = db.invById[investigation] || null, rows = inv ? db.rowsByPsi[inv.psi_id] || [] : [];
  return { cells, tally, cell: core.status.cell(q.material, q.concern, q, db), axes: core.status.axes(q, db), answer: core.text.designAnswer(tally, db), inv, rows, summary: inv ? summarize(rows) : null, matches: cabinMatches(db, q) };
}

export async function build(world) {
  const { THREE: T, db, core } = world;
  const stage = world.stage.context || world.stage.ctx || world.stage;
  const host = stage.renderer.domElement.parentElement, root = world.host || host;
  const group = new T.Group(); group.name = 'evidence-room';
  const field = await buildField({ ...stage, THREE: T, world: true }); group.add(field.group);
  const metal = new T.MeshStandardMaterial({ color: 0x282b2c, roughness: .42, metalness: .75 });
  const trim = new T.MeshStandardMaterial({ color: 0x80796a, roughness: .55, metalness: .7 });
  const consoleBody = new T.Mesh(new T.BoxGeometry(6.4, .26, 1.7), metal);
  consoleBody.position.set(0, -3.4, 5); consoleBody.rotation.x = .3; group.add(consoleBody);
  const dialMeshes = ['o2', 'p', 'g'].map((key, i) => {
    const dial = new T.Group(); dial.position.set((i - 1) * 2, -3.1, 5.5);
    const wheel = new T.Mesh(new T.CylinderGeometry(.34, .37, .18, 32), trim); wheel.rotation.x = Math.PI / 2; dial.add(wheel);
    const indicator = new T.Mesh(new T.BoxGeometry(.035, .23, .05), new T.MeshBasicMaterial({ color: 0xe0a458 })); indicator.position.set(0, .13, .13); dial.add(indicator);
    group.add(dial); return { key, dial };
  });
  const beacons = new T.Group(); group.add(beacons);
  const toolLocations = { ask: [4.7, .4, 4.5], cabin: [0, -3.1, 5.5], compare: [-4.7, .4, 4.5] };
  for (const at of Object.values(toolLocations)) {
    const light = new T.Mesh(new T.SphereGeometry(.055, 12, 8), new T.MeshBasicMaterial({ color: 0xe0a458 })); light.position.fromArray(at); beacons.add(light);
  }
  const style = node('style');
  style.textContent = `
.world-host[data-cinema=true] .evidence-tools,.world-host[data-film=true] .evidence-tools{visibility:hidden!important;pointer-events:none!important}.evidence-tools{position:absolute;inset:0;pointer-events:none;z-index:7}.evidence-tools[hidden]{display:none}.evidence-tool{position:absolute;width:44px;height:44px;transform:translate(-50%,-50%);border:1px solid #e0a45866;border-radius:50%;background:#17191880;box-shadow:0 0 14px #e0a45822;color:#f0d4a4;font:24px/1 sans-serif;pointer-events:auto;cursor:pointer}.evidence-tool:hover,.evidence-tool[aria-expanded=true]{background:#61422cbb;border-color:#e0a458}.evidence-tool:focus-visible{outline:2px solid #fff;outline-offset:3px}
.evidence-holo{box-sizing:border-box;color:#ede4d4;font:18px/1.4 var(--font-body,'Source Sans 3',sans-serif);padding:20px;background:rgba(17,20,20,.96);border:0;border-top:1px solid #e0a45866;border-radius:0;box-shadow:none}.evidence-holo h2{font-size:24px;line-height:1.2;margin:0 44px 18px 0}.evidence-holo p{margin:12px 0}.evidence-holo button,.evidence-holo input,.evidence-holo select{font:inherit;color:inherit}.evidence-holo select,.evidence-holo input[type=search]{box-sizing:border-box;width:100%;min-height:44px;background:#252928;border:1px solid #90948b88;border-radius:0;padding:8px}.evidence-holo option{background:#252928}.evidence-holo label{display:block;margin:14px 0}.evidence-holo label>span{display:block;margin-bottom:5px}.evidence-holo :focus-visible{outline:2px solid #ede4d4;outline-offset:3px}.evidence-console{width:410px;overflow:auto;overscroll-behavior:contain;max-height:var(--evidence-panel-height,560px)!important}.evidence-close{position:absolute;right:12px;top:10px;width:44px;height:44px;border:0;background:transparent;font-size:26px!important;cursor:pointer}.evidence-note{color:#c0b7a8;font-size:18px}.evidence-answer{background:none;border:0;padding:0;text-align:center;width:940px;overflow:visible;pointer-events:auto;font-size:22px}.evidence-answer p{margin:0}.evidence-answer .world-cite{font:inherit}.evidence-results{list-style:none;padding:0;margin:14px 0}.evidence-results li{padding:12px 0;border-bottom:1px solid #ede4d422}.evidence-results .world-cite{font-size:18px;line-height:1.4;text-align:left}.evidence-results small{display:block;color:#c0b7a8;font-size:14px;margin-top:6px}.evidence-compare-a{color:#e0a458}.evidence-compare-b{color:#80c8d5}.evidence-dial{display:grid!important;grid-template-columns:78px 1fr;gap:8px 14px;align-items:center}.evidence-dial>span{grid-column:2}.evidence-dial-knob{grid-column:1;grid-row:1/3;display:block;width:68px;height:68px;border-radius:50%;background:repeating-conic-gradient(from 0deg,#9a968b 0 2deg,#3b403f 2deg 15deg);border:4px solid #292d2c;box-shadow:inset 0 0 0 8px #4b504e,0 5px 8px #0009;position:relative;transform:rotate(var(--dial-angle,0deg))}.evidence-dial-knob:after{content:'';position:absolute;width:3px;height:20px;background:#e0a458;top:9px;left:32px}.evidence-dial input{grid-column:2;width:100%;accent-color:#e0a458;min-height:32px;margin:0}.evidence-dial output{font-variant-numeric:tabular-nums}.evidence-holo details{margin-top:16px}.evidence-holo summary{min-height:44px;cursor:pointer}.evidence-holo a{color:inherit}.evidence-world-active .field-labels{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}.evidence-world-active .field-label{position:absolute;max-width:200px;color:#c0b7a8;font:14px/1.25 var(--font-body,'Source Sans 3',sans-serif);background:#111515db;padding:5px 7px;transform:none;transition:opacity .15s}.evidence-world-active .field-label small{display:block;font-size:14px}.evidence-world-active .field-hover-label{font-size:16px;max-width:260px;color:#ede4d4}.evidence-world-active .field-delta-label{display:none}.evidence-world-active .field-cabin-label{color:#ee9b7b}
@media(max-width:759px){.evidence-console{width:354px;padding:16px}.evidence-answer{font-size:18px}.evidence-tool{width:44px;height:44px}.evidence-holo h2{font-size:22px}.evidence-world-active .field-axis,.evidence-world-active .field-tick,.evidence-world-active .field-rail-label{display:none}}
`;
  root.append(style);
  const tools = node('div', null, 'evidence-tools'); (world.overlay || root).append(tools); tools.dataset.stationUi = 'evidence'; tools.hidden = true;
  const consoleEl = node('section', null, 'evidence-holo evidence-console'); consoleEl.dataset.worldPanel = '';
  consoleEl.setAttribute('aria-label', 'Evidence console');
  for (const el of [consoleEl]) for (const event of ['pointerdown', 'pointerup', 'wheel', 'keydown']) el.addEventListener(event, e => { e.stopPropagation(); if (event === 'keydown' && e.key === 'Escape') setPanel(null); });
  const consoleHandle = world.hologram(consoleEl, { at: [-5, 0, 7], width: 410, face: 'camera', manual: true, marker: false, dock: 'left' });
  let active = false, panel = null, fieldMode = 'cabin', currentQ = world.q, search = '', results = [], resultPsi = [], activeFinding = null;
  let investigation = db.invById[world.params?.sel] ? world.params.sel : null, comparison = db.invById[world.params?.compare] ? world.params.compare : null;
  let lastKey = '', lastTime = 0, reaction = -100, orbit = .23, elevation = .10, drag = null, dialDrag = null;
  const projected = new T.Vector3();
  const canvas = stage.renderer.domElement, phone = () => stage.size().width < 760;
  const buttons = Object.entries({ ask: ['⌕', 'Ask the evidence'], cabin: ['◉', 'Fly your own cabin'], compare: ['⇄', 'Compare investigations'] }).map(([id, [symbol, label]]) => {
    const marker = world.marker?.({ element: consoleEl, get target() { return panel === id && consoleHandle.target; } }, { at: toolLocations[id], label, onClick: () => setPanel(panel === id ? null : id) });
    const button = marker?.element || node('button', symbol, 'evidence-tool'); button.type = 'button'; button.dataset.worldMarker = ''; button.dataset.evidenceTool = id;
    button.setAttribute('aria-label', label); button.setAttribute('aria-expanded', 'false'); button.title = label;
    for (const name of ['pointerdown', 'pointerup']) button.addEventListener(name, e => e.stopPropagation());
    button.onclick = () => setPanel(panel === id ? null : id); if (!marker) tools.append(button); return { id, button, marker };
  });
  function setPanel(next) {
    panel = next; if (next) fieldMode = next; buttons.forEach(({ id, button }) => button.setAttribute('aria-expanded', String(id === panel)));
    if (panel) { paintPanel(); if (!consoleHandle.target) consoleHandle.toggle ? consoleHandle.toggle() : consoleHandle.open(); } else consoleHandle.close();
    lastKey = ''; world.invalidate?.();
    if (panel === 'ask') consoleEl.querySelector('input')?.focus({ preventScroll: true });
  }
  const outside = event => { if (active && panel && !consoleEl.contains(event.target) && !tools.contains(event.target) && !event.target.closest('.world-marker')) setPanel(null); };
  const escape = event => { if (active && event.key === 'Escape' && panel) { event.stopPropagation(); setPanel(null); } };
  const citation = event => { if (active && event.detail?.open) setPanel(null); };
  root.addEventListener('pointerdown', outside); window.addEventListener('keydown', escape); window.addEventListener('vesta:cite', citation);
  const panelObserver = new MutationObserver(() => { if (active && panel && !consoleHandle.target) setPanel(null); else if (active && !panel && consoleHandle.target) setPanel('cabin'); });
  panelObserver.observe(consoleEl, { attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  const dialRay = new T.Raycaster();
  const startDrag = e => {
    if (!active) return;
    const bounds = canvas.getBoundingClientRect();
    dialRay.setFromCamera({ x: (e.clientX-bounds.left)/bounds.width*2-1, y: 1-(e.clientY-bounds.top)/bounds.height*2 }, stage.camera);
    const hit = dialRay.intersectObjects(dialMeshes.map(d=>d.dial),true)[0];
    const target = hit && dialMeshes.find(d=>d.dial.children.includes(hit.object));
    if (target) {
      dialDrag={ key:target.key, x:e.clientX, y:e.clientY, base:target.key==='g' ? Object.keys(G).indexOf(currentQ.g) : currentQ[target.key] };
      setPanel('cabin'); e.stopPropagation(); return;
    }
    if (!panel) drag = { x:e.clientX,y:e.clientY,orbit,elevation };
  };
  const dragging = e => {
    if (!active) return;
    if (dialDrag) {
      const delta=(e.clientX-dialDrag.x)-(e.clientY-dialDrag.y), key=dialDrag.key;
      const scale=key==='g' ? .025 : key==='o2' ? .1 : .5;
      const max=key==='g' ? Object.keys(G).length-1 : key==='o2' ? 100 : 550;
      const value=Math.max(key==='p' ? 1 : 0,Math.min(max,dialDrag.base+delta*scale));
      applyQ({[key]:key==='g' ? Object.keys(G)[Math.round(value)] : Math.round(value*10)/10});
      e.stopPropagation(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 5) { orbit = Math.max(-.45, Math.min(.65, drag.orbit - dx * .0025)); elevation = Math.max(-.1, Math.min(.3, drag.elevation + dy * .001)); e.stopPropagation(); world.invalidate?.(); }
  };
  const endDrag = () => { drag = null; dialDrag = null; };
  canvas.addEventListener('pointerdown', startDrag); canvas.addEventListener('pointermove', dragging); window.addEventListener('pointerup', endDrag);
  const plotted = fieldRows(db);
  const format = n => n.toLocaleString('en-US');
  const phrase = (text, id) => world.cite(text, id);
  function selector(label, name, options, value, change, cls) {
    const wrapper = node('label', null, cls), select = node('select'); wrapper.append(node('span', label), select);
    select.setAttribute('aria-label', label); select.dataset.evidenceChoice = name;
    for (const [id, text] of options) { const option = node('option', text); option.value = id; select.append(option); }
    select.value = value || ''; select.onchange = () => change(select.value); return wrapper;
  }
  function applyQ(patch) {
    reaction = lastTime; world.setQ(patch, { render: false }); currentQ = world.q;
    refreshAnswer(); refreshDials(); lastKey = ''; world.invalidate?.();
  }
  function refreshAnswer() {
    const s = evidenceState(db, core, currentQ, investigation);
    const pair = compareInvestigations(db, investigation, comparison);
    const text = fieldMode === 'compare' && pair ? pair.short : `${format(s.matches.length)} source rows within tolerance.`;
    world.answer?.(text);
    const count = consoleEl.querySelector('[data-cabin-count]');
    if (count) count.textContent = `${format(s.matches.length)} counting source-table rows within tolerance.`;
    host.dataset.evidenceMatches = String(s.matches.length);
    return s;
  }
  function refreshDials() {
    const preset = consoleEl.querySelector('[data-evidence-choice="preset"]'); if (preset) preset.value = currentQ.preset;
    for (const key of ['o2', 'p', 'g']) {
      const input = consoleEl.querySelector(`[data-evidence-dial="${key}"]`); if (!input) continue;
      input.value = key === 'g' ? Object.keys(G).indexOf(currentQ.g) : currentQ[key];
      const label = key === 'o2' ? core.text.oxygen(currentQ.o2) : key === 'p' ? core.text.pressure(currentQ.p) : currentQ.g_label;
      input.parentElement.querySelector('output').textContent = label;
      input.setAttribute('aria-valuetext', label);
      input.parentElement.style.setProperty('--dial-angle', `${-135 + 270 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))}deg`);
    }
  }
  function dial(label, key, min, max, step) {
    const wrapper = node('label', null, 'evidence-dial'), title = node('span', `${label} `), output = node('output'), input = node('input');
    title.append(output); const knob = node('i', null, 'evidence-dial-knob'); knob.setAttribute('aria-hidden', 'true');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.dataset.evidenceDial = key; input.setAttribute('aria-label', label);
    input.oninput = () => applyQ({ [key]: key === 'g' ? Object.keys(G)[Number(input.value)] : Number(input.value) });
    wrapper.append(knob, title, input); return wrapper;
  }
  function renderResults() {
    results = searchEvidence(db, search, currentQ); resultPsi = [...new Set(results.map(r => r.psi).filter(Boolean))];
    const container = consoleEl.querySelector('[data-search-results]'); if (!container) return;
    container.replaceChildren();
    if (!search.trim()) return;
    container.append(node('p', results.length ? `${results.length} verified findings` : NO_MATCH));
    const list = node('ol', null, 'evidence-results');
    for (const result of results) {
      const item = node('li'), trigger = phrase(result.finding.claim, result.finding.id); trigger.dataset.evidenceFinding = result.finding.id;
      const rows = result.psi ? plotted.filter(p => p.row.psi_id === result.psi).length : 0;
      trigger.addEventListener('click', () => { activeFinding = result.finding.id; resultPsi = result.psi ? [result.psi] : []; world.invalidate?.(); });
      item.append(trigger, node('small', `${core.text.level(result.finding)} · ${rows ? `${rows} linked plotted rows` : 'No linked plotted rows'}`)); list.append(item);
    }
    container.append(list); host.dataset.evidenceSearchResults = String(results.length); host.dataset.evidenceSearchRows = String(plotted.filter(p => resultPsi.includes(p.row.psi_id)).length);
  }
  function paintPanel() {
    const title = { ask: 'Ask the evidence', cabin: 'Fly your own cabin', compare: 'Compare investigations' }[panel];
    const close = node('button', '×', 'evidence-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close evidence console'); close.onclick = () => setPanel(null);
    consoleEl.replaceChildren(node('h2', title), close); consoleEl.dataset.evidencePanel = panel || '';
    if (panel === 'ask') {
      const input = node('input'); input.type = 'search'; input.placeholder = 'ventilation, oxygen 34, cool flame'; input.value = search; input.setAttribute('aria-label', 'Ask the evidence'); input.maxLength = 240;
      input.oninput = () => { search = input.value; activeFinding = null; renderResults(); world.invalidate?.(); };
      const resultList = node('div'); resultList.dataset.searchResults = ''; resultList.setAttribute('aria-live', 'polite');
      consoleEl.append(input, resultList); renderResults();
    }
    if (panel === 'cabin') {
      consoleEl.append(selector('Cabin preset', 'preset', [['custom', 'Custom cabin'], ...db.presets.map(p => [p.id, p.short || p.label])], currentQ.preset, preset => { applyQ({ preset }); paintPanel(); }), dial('Oxygen', 'o2', 0, 100, .1), dial('Pressure', 'p', 1, 550, .1), dial('Gravity', 'g', 0, Object.keys(G).length - 1, 1));
      const count = node('p'); count.dataset.cabinCount = ''; count.setAttribute('aria-live', 'polite'); consoleEl.append(count);
      const details = node('details'); details.append(node('summary', 'Match rules and material coverage'));
      const s = evidenceState(db, core, currentQ);
      details.append(node('p', `Same gravity class, oxygen ±${TOL.o2} percentage point, pressure ±${TOL.p} kPa. Includes facility-inferred pressure; excludes non-counting rows.`, 'evidence-note'));
      details.append(selector('Question', 'concern', CONCERNS.map(id => [id, words(id)]), currentQ.concern, concern => { applyQ({ concern }); paintPanel(); }), selector('Material', 'material', [['', 'Choose a material'], ...Object.entries(db.materials).map(([id, m]) => [id, m.label])], currentQ.material, material => { applyQ({ material }); paintPanel(); }));
      const sentence = node('p'); sentence.append(phrase(core.text.cellSentence(s.cell, db.materials[currentQ.material]?.label, db), 'selected-material-coverage')); details.append(sentence);
      const receipt = node('details'); receipt.append(node('summary', 'Save or recheck this cabin'), receiptControls({ db, getQuery: () => currentQ, onReplay: q => { applyQ({ ...q, preset: 'custom' }); paintPanel(); } }));
      consoleEl.append(details, receipt); refreshDials();
    }
    if (panel === 'compare') {
      const options = [['', 'Choose an investigation'], ...db.investigations.map(i => [i.psi_id, i.name || i.full_name])];
      const pick = (side, value) => { if (side === 'a') { investigation = value || null; if (comparison === investigation) comparison = null; } else comparison = value || null; activeFinding = null; resultPsi = []; paintPanel(); refreshAnswer(); world.invalidate?.(); };
      consoleEl.append(selector('Amber investigation', 'investigation', options, investigation, value => pick('a', value), 'evidence-compare-a'), selector('Blue investigation', 'comparison', options.filter(([id]) => !id || id !== investigation), comparison, value => pick('b', value), 'evidence-compare-b'));
      const pair = compareInvestigations(db, investigation, comparison);
      if (pair) {
        const line = node('p', pair.line); line.dataset.evidenceComparison = ''; consoleEl.append(line);
        for (const [id, summary, cls] of [[investigation, pair.left, 'evidence-compare-a'], [comparison, pair.right, 'evidence-compare-b']]) {
          const line = node('p', null, cls); line.append(phrase(`${db.invById[id].name}: ${summary.rows} source-table rows, ${plotted.filter(p => p.row.psi_id === id).length} plotted.`, id)); const pictures = media.button(id, { world }); pictures.addEventListener('click', () => setPanel(null));
          consoleEl.append(line, pictures);
        }
      } else consoleEl.append(node('p', 'Choose two different investigations.', 'evidence-note'));
    }
    const scope = node('details'); scope.append(node('summary', 'Evidence scope'), node('p', core.text.STATUS_LINE, 'evidence-note'), node('p', `${plotted.length} rows with a single ambient oxygen value are plotted. A row can represent a day, series or dataset. Hollow points use facility-inferred pressure.`, 'evidence-note'));
    const link = node('a', 'Instrument view'); link.href = `#/design?view=details&preset=custom&o2=${currentQ.o2}&p=${currentQ.p}&g=${currentQ.g}&concern=${currentQ.concern}&mat=${currentQ.material || ''}`; scope.append(link); consoleEl.append(scope);
    refreshAnswer();
  }
  function layout() {
    const { width, height } = stage.size(), camera = stage.camera; camera.updateMatrixWorld();
    field.group.scale.set(phone() ? .62 : 1, phone() ? .78 : 1, 1); field.group.position.y = phone() ? 1.2 : 0;
    group.updateMatrixWorld(true);
    for (const { id, button, marker } of buttons) {
      if (marker) continue;
      projected.fromArray(toolLocations[id]).applyMatrix4(group.matrixWorld).project(camera);
      const x = Math.max(30, Math.min(width - 50, (projected.x + 1) * width / 2));
      const y = Math.max(110, Math.min(height * .76, (1 - projected.y) * height / 2));
      button.style.left = `${x}px`; button.style.top = `${y}px`;
    }
  }
  field.setVisible(false); group.visible = false; refreshAnswer();
  return {
    group,
    camera() { return { position: [Math.sin(orbit) * 24, Math.sin(elevation) * 25, Math.cos(orbit) * 24], target: [0, phone() ? .4 : -.1, 0], fov: phone() ? 48 : 40 }; },
    enter() { active = true; group.visible = true; field.setVisible(true); tools.hidden = false; host.classList.add('evidence-world-active'); panel = null; consoleHandle.close(); lastKey = ''; refreshAnswer(); },
    leave() { delete stage.camera.userData.focusDistance; active = false; drag = null; dialDrag = null; group.visible = false; tools.hidden = true; field.setVisible(false); host.classList.remove('evidence-world-active'); setPanel(null); },
    update(t, state = {}) {
      if (!active || state.active === false) return;
      lastTime = t; currentQ = state.q || world.q;
      const key = JSON.stringify([currentQ, panel, fieldMode, investigation, comparison]);
      if (key !== lastKey) { lastKey = key; refreshAnswer(); refreshDials(); }
      const fixed = state.capture || state.reduced || stage.mode === 'still';
      stage.camera.userData.focusDistance = stage.camera.position.distanceTo(group.getWorldPosition(projected));
      layout();
      const compare = fieldMode === 'compare';
      field.update(t, { db, q: currentQ, capture: state.capture, reduced: state.reduced, investigation: compare ? investigation : null, comparison: compare ? comparison : null, highlightInvestigations: fieldMode === 'ask' && search.trim() ? resultPsi : null, highlightEmpty: fieldMode === 'ask' && !!search.trim() && !resultPsi.length, labels: !!panel, pointerX: state.pointerX, pointerY: state.pointerY });
      dialMeshes.forEach(({ key, dial }) => { const value = key === 'g' ? Object.keys(G).indexOf(currentQ.g) / (Object.keys(G).length - 1) : key === 'o2' ? currentQ.o2 / 100 : currentQ.p / 550; dial.rotation.z = (value - .5) * Math.PI * 1.5; });
      const pulse = fixed ? 0 : Math.max(0, 1 - (t - reaction) / 1.1);
      world.vesta?.update?.(fixed ? 2 : t, { ...world.vesta.defaults, x: phone() ? 2.1 : 5.5, y: phone() ? -2.1 : -2.6, z: 6.5, scale: phone() ? .95 : 1.3, yaw: -.4, idle: fixed ? 0 : 1, blink: fixed ? 0 : Math.max(0, 1 - Math.abs(t % 4.7 - 3.9) / .085), lookX: state.pointerX || 0, lookY: state.pointerY || 0, armR: .6 + pulse * .25, armFwd: .5, thrust: .55 + pulse * .35 });
      host.dataset.evidenceActive = 'true'; host.dataset.evidenceInvestigation = investigation || 'all'; host.dataset.evidenceComparison = comparison || ''; host.dataset.evidenceSelectedRows = String(plotted.filter(p => compare ? p.row.psi_id === investigation || p.row.psi_id === comparison : fieldMode === 'ask' && search.trim() ? resultPsi.includes(p.row.psi_id) : true).length); host.dataset.evidenceFinding = activeFinding || '';
    },
    pick(x, y) { return active && !dialDrag ? field.pick(x, y) : null; },
    holograms() { return []; },
    dispose() {
      active = false; panelObserver.disconnect(); root.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); window.removeEventListener('vesta:cite', citation); canvas.removeEventListener('pointerdown', startDrag); canvas.removeEventListener('pointermove', dragging); window.removeEventListener('pointerup', endDrag);
      field.dispose(); consoleHandle.dispose(); buttons.forEach(({ marker }) => marker?.dispose()); tools.remove(); style.remove(); host.classList.remove('evidence-world-active');
      const seen = new Set(); group.traverse(o => { for (const resource of [o.geometry, ...[o.material].flat()]) if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose?.(); } }); group.removeFromParent();
    }
  };
}
