import { build as buildField, fieldRows } from '../scene/field.js?v=6';
import { buildSamples } from '../scene/samples.js';
import { SAMPLE_NOTES } from '../scene/sample-kit.js';
import { balanceWorldLight } from '../scene/materials.js';
import { summarize, axisText } from '../views/investigations.js';
import { receiptControls } from '../ui/receipt.js';
import { media } from './media.js';
import { G, CONCERNS } from '../core/index.js';
import { TOL } from '../core/match.js';
import { css } from '../ui/el.js';
import { build as buildCoverage } from './coverage.js';
import { build as buildGapBrief } from '../ui/gapbrief.js';
import { searchEvidence, cabinMatches, compareInvestigations, NO_MATCH } from './ask.js?v=3';
import { evidenceGuidePose } from './evidence-guide.js';
import { createRackUI } from './evidence-rack-ui.js';

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
  await Promise.all([css('css/coverage.css'), css('css/evidence-rack.css')]);
  let selectedMaterial = null, selectedConcern = world.q.concern || CONCERNS[0], hoveredMaterial = null, sceneMode = 'rack';
  const wall = buildCoverage(world, { onSelection: onCoverageSelection }), gaps = buildGapBrief(world);
  const stage = world.stage.context || world.stage.ctx || world.stage;
  const host = stage.renderer.domElement.parentElement, root = world.host || host;
  const group = new T.Group(); group.name = 'evidence-room';
  const labelObstacles = [];
  const field = await buildField({ ...stage, THREE: T, world: true, labelObstacles, invalidate: world.invalidate });
  field.setVisible(false);
  let rack;
  try { rack = await buildSamples({ THREE: T, mode: stage.mode, db }); }
  catch (error) { field.dispose(); wall.dispose(); gaps.dispose(); throw error; }
  const rackFill = new T.HemisphereLight(0xede4d4, 0x191715, .24);
  group.add(field.group, rack.group, rackFill);
  const balanceLight = balanceWorldLight(world, 0, .1);
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
  consoleEl.addEventListener('keydown', event => { if (event.key === 'Escape') setPanel(null); }, true);
  const consoleHandle = world.hologram(consoleEl, { at: [-5, 0, 7], width: 440, face: 'camera', manual: true, marker: false, dock: 'left', phoneRatio: .62 });
  let active = false, panel = null, fieldMode = 'cabin', currentQ = world.q, search = '', results = [], resultPsi = [], activeFinding = null;
  let investigation = db.invById[world.params?.sel] ? world.params.sel : null, comparison = db.invById[world.params?.compare] ? world.params.compare : null;
  let lastKey = '', lastTime = 0, reaction = -100, highlightedMaterials = null;
  let guideRow = null, savedAperture, savedExposure;
  const guideTarget = new T.Vector3(), guideScreen = new T.Vector3(), guideHead = new T.Vector3();
  const companion = node('div', null, 'evidence-companion'); companion.hidden = true;
  companion.append(node('span', 'VESTA'), node('small', 'Your evidence guide'));
  host.append(companion);
  labelObstacles.push(companion, ...root.querySelectorAll('.world-guide-intro'));
  const projected = new T.Vector3(), cameraTarget = new T.Vector3(), origin = new T.Vector3(...world.origin);
  const phone = () => stage.size().width < 760;
  const rackUI = createRackUI({ materials: db.materials, onSelect: material => openMaterial(material), onHover: material => { hoveredMaterial = material; world.invalidate?.(); } });
  tools.append(rackUI.element);
  function onCoverageSelection(selection) {
    selectedMaterial = selection?.material || null;
    if (selection) selectedConcern = selection.concern;
    rack.focus(selectedMaterial, world.capture);
    reaction = lastTime;
    if (!selection && panel === 'sample') setPanel('overview');
    world.invalidate?.();
  }
  function openMaterial(material, concern = selectedConcern) {
    if (!db.materials[material] || !CONCERNS.includes(concern)) return;
    selectedMaterial = material; selectedConcern = concern;
    setPanel('sample'); wall.update(currentQ); wall.selectQuestion(material, concern);
  }
  function setDisplay(next) {
    sceneMode = next; root.dataset.evidenceDisplay = next;
    rack.setVisible(active && next === 'rack'); rackFill.visible = active && next === 'rack';
    field.setVisible(active && next === 'chart');
    if (active) world.vesta.group.visible = next === 'rack';
    world.invalidate?.();
  }
  function toggleConditions() {
    const next = sceneMode === 'chart' ? 'rack' : 'chart'; setPanel(null); setDisplay(next);
  }
  function setPanel(next) {
    if (next) setDisplay('rack');
    consoleHandle.set({ phoneRatio: next === 'sample' ? .37 : next === 'overview' || next === 'gaps' ? .70 : .62 });
    panel = next; if (next) fieldMode = next;
    if (!next || next === 'overview') wall.clearSelection(false);
    if (panel) { paintPanel(); if (!consoleHandle.target) consoleHandle.toggle ? consoleHandle.toggle() : consoleHandle.open(); } else consoleHandle.close();
    lastKey = ''; world.invalidate?.();
    if (panel === 'ask') consoleEl.querySelector('input')?.focus({ preventScroll: true });
  }
  const outside = event => { if (active && panel && !consoleEl.contains(event.target) && !tools.contains(event.target) && !event.target.closest('.world-marker,.world-guide,.field-instrument')) setPanel(null); };
  const escape = event => { if (active && event.key === 'Escape') { if (panel) { event.stopPropagation(); setPanel(null); } else if (sceneMode === 'chart') { event.stopPropagation(); setDisplay('rack'); } } };
  const citation = event => { if (active && event.detail?.open) setPanel(null); };
  root.addEventListener('pointerdown', outside); window.addEventListener('keydown', escape); window.addEventListener('vesta:cite', citation);
  const panelObserver = new MutationObserver(() => { if (active && panel && !consoleHandle.target) setPanel(null); else if (active && !panel && consoleHandle.target) setPanel('overview'); });
  panelObserver.observe(consoleEl, { attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  const pickRay = new T.Raycaster();
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
    reaction = lastTime; guideRow = null; world.setQ(patch, { render: false }); currentQ = world.q;
    refreshAnswer(); refreshDials(); lastKey = ''; world.invalidate?.();
  }
  function refreshAnswer() {
    const s = evidenceState(db, core, currentQ, investigation);
    world.answer?.(wall.headline(currentQ)); rack.setCells(s.cells);
    root.dataset.rackProven = String(s.tally.PROVEN);
    root.dataset.rackExtrapolated = String(s.tally.EXTRAPOLATED);
    root.dataset.rackMissing = String(s.tally.NEVER_TESTED);
    if (fieldMode === 'ask' && search.trim()) {
      const matches = activeFinding ? results.filter(r => r.finding.id === activeFinding) : results;
      highlightedMaterials = new Set(matches.flatMap(r => r.finding.n?.material_ids || []).filter(id => db.materials[id]));
    } else if (fieldMode === 'compare' && (investigation || comparison)) {
      const ids = new Set([investigation, comparison].filter(Boolean));
      highlightedMaterials = new Set(Object.keys(db.materials).filter(id => (db.rowsByMaterial[id] || []).some(row => ids.has(row.psi_id))));
    } else highlightedMaterials = null;
    rack.highlight(highlightedMaterials === null ? null : [...highlightedMaterials]);
    const count = consoleEl.querySelector('[data-cabin-count]');
    if (count) count.textContent = s.matches.length ? `${format(s.matches.length)} counting source-table rows within tolerance. This is coverage, not a safety certification.` : 'No counting source-table rows match this cabin. That is a gap in this collection, not proof of safety.';
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
    if (!search.trim()) { container.append(node('p', 'Search verified findings using a topic or a condition. Try one of the questions above.', 'evidence-note')); return; }
    container.append(node('p', results.length ? `${results.length} verified ${results.length === 1 ? 'finding' : 'findings'}` : NO_MATCH));
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
    const title = { overview: 'Cabin evidence', sample: 'Material evidence', ask: 'Search the evidence', cabin: 'Configure your cabin', compare: 'Compare investigations', receipt: 'Keep the evidence', gaps: 'Research gaps' }[panel];
    const close = node('button', '×', 'evidence-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close evidence console'); close.onclick = () => setPanel(null);
    consoleEl.replaceChildren(node('h2', title), close); consoleEl.dataset.evidencePanel = panel || '';
    if (panel === 'overview') {
      consoleEl.querySelector('h2').remove(); wall.update(currentQ); consoleEl.append(wall.element);
    }
    if (panel === 'sample') {
      consoleEl.querySelector('h2').remove();
      const choices = node('nav', null, 'evidence-sample-concerns'); choices.setAttribute('aria-label', 'Material evidence question');
      for (const concern of CONCERNS) {
        const button = node('button', core.text.concern(concern)); button.type = 'button';
        button.dataset.sampleConcern = concern; button.setAttribute('aria-pressed', String(concern === selectedConcern));
        button.onclick = () => openMaterial(selectedMaterial, concern); choices.append(button);
      }
      wall.update(currentQ); consoleEl.append(choices, wall.element);
      const model = node('details', null, 'evidence-sample-note');
      model.append(node('summary', 'Illustrative sample: representation and source'));
      const note = SAMPLE_NOTES[selectedMaterial] || SAMPLE_NOTES.unknown;
      const url = note.match(/https:\/\/\S+$/)?.[0];
      model.append(node('p', url ? note.slice(0, -url.length).trim() : note, 'evidence-note'));
      if (url) { const source = node('a', 'NASA description of this material'); source.href = url; source.target = '_blank'; source.rel = 'noopener noreferrer'; model.append(source); }
      consoleEl.append(model);
    }
    if (panel === 'gaps') { consoleEl.querySelector('h2').remove(); gaps.update(currentQ); consoleEl.append(gaps.element); }
    if (panel === 'ask') {
      const input = node('input'); input.type = 'search'; input.placeholder = 'ventilation, oxygen 34, cool flame'; input.value = search; input.setAttribute('aria-label', 'Ask the evidence'); input.maxLength = 240;
      input.oninput = () => { search = input.value; activeFinding = null; renderResults(); world.invalidate?.(); };
      const resultList = node('div'); resultList.dataset.searchResults = ''; resultList.setAttribute('aria-live', 'polite');
      const suggestions = node('div', null, 'evidence-quick-actions');
      for (const [label, query] of [['Ventilation', 'ventilation'], ['34% oxygen', 'oxygen 34'], ['Cool flames', 'cool flame']]) {
        const button = node('button', label); button.type = 'button'; button.onclick = () => { search = query; input.value = query; activeFinding = null; renderResults(); world.invalidate?.(); }; suggestions.append(button);
      }
      consoleEl.append(node('p', 'Choose a topic or type your own. Each result opens its source and limits.', 'evidence-note'), input, suggestions, resultList); renderResults();
    }
    if (panel === 'cabin') {
      consoleEl.append(selector('Cabin preset', 'preset', [['custom', 'Custom cabin'], ...db.presets.map(p => [p.id, p.short || p.label])], currentQ.preset, preset => { applyQ({ preset }); paintPanel(); }), dial('Oxygen', 'o2', 0, 100, .1), dial('Pressure', 'p', 1, 550, .1), dial('Gravity', 'g', 0, Object.keys(G).length - 1, 1));
      const count = node('p'); count.dataset.cabinCount = ''; count.setAttribute('aria-live', 'polite'); consoleEl.append(count);
      const details = node('details'); details.append(node('summary', 'Match rules and material coverage'));
      const s = evidenceState(db, core, currentQ);
      details.append(node('p', `Same gravity class, oxygen ±${TOL.o2} percentage point, pressure ±${TOL.p} kPa. Includes facility-inferred pressure; excludes non-counting rows.`, 'evidence-note'));
      details.append(selector('Question', 'concern', CONCERNS.map(id => [id, words(id)]), currentQ.concern, concern => { applyQ({ concern }); paintPanel(); }), selector('Material', 'material', [['', 'Choose a material'], ...Object.entries(db.materials).map(([id, m]) => [id, m.label])], currentQ.material, material => { applyQ({ material }); paintPanel(); }));
      const sentence = node('p'); sentence.append(phrase(core.text.cellSentence(s.cell, db.materials[currentQ.material]?.label, db), 'selected-material-coverage')); details.append(sentence);
      const receipt = node('button', 'Save or recheck this cabin'); receipt.type = 'button'; receipt.onclick = () => setPanel('receipt');
      consoleEl.append(details, receipt); refreshDials();
    }
    if (panel === 'receipt') consoleEl.append(receiptControls({ db, getQuery: () => currentQ, onReplay: q => { applyQ({ ...q, preset: 'custom' }); setPanel('cabin'); } }));
    if (panel === 'compare') {
      const options = [['', 'Choose an investigation'], ...db.investigations.map(i => [i.psi_id, i.name || i.full_name])];
      const pick = (side, value) => { if (side === 'a') { investigation = value || null; if (comparison === investigation) comparison = null; } else comparison = value || null; activeFinding = null; resultPsi = []; paintPanel(); refreshAnswer(); world.invalidate?.(); };
      consoleEl.append(selector('Amber investigation', 'investigation', options, investigation, value => pick('a', value), 'evidence-compare-a'), selector('Blue investigation', 'comparison', options.filter(([id]) => !id || id !== investigation), comparison, value => pick('b', value), 'evidence-compare-b'));
      const pair = compareInvestigations(db, investigation, comparison);
      if (pair) {
        const line = node('p', pair.line); line.dataset.evidenceComparison = ''; consoleEl.append(line);
        const table = node('table', null, 'evidence-comparison-table'), caption = node('caption', 'Recorded conditions, not a performance ranking'), head = node('thead'), header = node('tr');
        for (const label of ['Recorded', db.invById[investigation].name, db.invById[comparison].name]) { const cell = node('th', label); cell.scope = 'col'; header.append(cell); }
        head.append(header); const body = node('tbody');
        for (const [label, read] of [['Rows', s => s.rows], ['Oxygen', s => axisText(s.o2)], ['Pressure', s => axisText(s.p)], ['Gravity', s => s.gravity.items.map(x => words(x.value)).join(', ') || 'Not recorded'], ['Fuels', s => s.fuels.items.map(x => x.value).join(', ') || 'Not recorded']]) {
          const row = node('tr'), heading = node('th', label); heading.scope = 'row'; row.append(heading, node('td', String(read(pair.left))), node('td', String(read(pair.right)))); body.append(row);
        }
        table.append(caption, head, body); consoleEl.append(table);
        for (const [id, summary, cls] of [[investigation, pair.left, 'evidence-compare-a'], [comparison, pair.right, 'evidence-compare-b']]) {
          const line = node('p', null, cls); line.append(phrase(`${db.invById[id].name}: ${summary.rows} source-table rows, ${plotted.filter(p => p.row.psi_id === id).length} plotted.`, id)); const pictures = media.button(id, { world }); pictures.addEventListener('click', () => setPanel(null));
          consoleEl.append(line, pictures);
        }
      } else consoleEl.append(node('p', 'Choose two different investigations.', 'evidence-note'));
    }
    const scope = node('details'); scope.hidden = panel === 'overview'; scope.append(node('summary', 'Evidence scope'), node('p', core.text.STATUS_LINE, 'evidence-note'), node('p', `${plotted.length} source-table rows have a single ambient oxygen value. A row can represent a day, series or dataset. Research samples are illustrative; a coverage lamp does not certify a material or a cabin.`, 'evidence-note'));
    const link = node('a', 'Instrument view'); link.href = `#/design?view=details&preset=custom&o2=${currentQ.o2}&p=${currentQ.p}&g=${currentQ.g}&concern=${currentQ.concern}&mat=${currentQ.material || ''}`; scope.append(link); consoleEl.append(scope);
    refreshAnswer();
  }
  function layout() {
    const { width, height } = stage.size(), camera = stage.camera;
    camera.updateMatrixWorld(); group.updateMatrixWorld(true);
    const positions = new Map();
    for (const id of rack.materialIds) {
      projected.copy(rack.anchor(id)); projected.y += phone() ? 1.1 : 1.55;
      rack.group.localToWorld(projected); projected.project(camera);
      positions.set(id, { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2,
        hidden: projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 });
    }
    rackUI.update({ positions, visible: active && sceneMode === 'rack' && root.dataset.cinema !== 'true' && !world.filmActive,
      selected: selectedMaterial, dimmed: highlightedMaterials, panelOpen: !!panel });
  }
  function cameraPose() {
    if (sceneMode === 'chart') return { position: [0, 0, 24], target: [0, 0, 0], fov: 40, aperture: 0, focusDistance: 24, exposure: .85 };
    const { width, height } = stage.size();
    return rack.camera({ aspect: width / height, width, height, panel: !!panel,
      ...(height < 550 ? { insets: { top: 100, bottom: 90, left: 30, right: 80 } } : width < 760 ? { insets: { top: 160, bottom: 225 } } : {}) });
  }
  field.setVisible(false); rack.setVisible(false); group.visible = false; refreshAnswer();
  return {
    group,
    actions: () => [...[['overview', 'Coverage'], ['cabin', 'Cabin'], ['ask', 'Search'], ['compare', 'Compare'], ['gaps', 'Research gaps'], ['receipt', 'Save JSON']].map(([id, label]) => ({ id, label, primary: id === 'overview', expanded: () => panel === id && consoleHandle.target > 0, run: () => setPanel(panel === id && consoleHandle.target > 0 ? null : id) })),
      { id: 'conditions', label: 'Tested conditions', expanded: () => sceneMode === 'chart', run: toggleConditions }],
    ready() { setPanel(null); setDisplay('rack'); },
    search(query) { search = query; activeFinding = null; setPanel('ask'); },
    camera: cameraPose,
    enter() {
      if (!active) { savedAperture = stage.camera.userData.aperture; savedExposure = stage.renderer.toneMappingExposure; }
      active = true; balanceLight(true); currentQ = world.q; group.visible = true; tools.hidden = false; companion.hidden = false;
      guideRow = null; reaction = -100; host.classList.add('evidence-world-active'); panel = null; consoleHandle.close();
      wall.clearSelection(false); setDisplay('rack'); lastKey = ''; refreshAnswer();
    },
    leave() {
      delete stage.camera.userData.focusDistance;
      if (savedAperture == null) delete stage.camera.userData.aperture; else stage.camera.userData.aperture = savedAperture;
      stage.renderer.toneMappingExposure = savedExposure ?? .85; balanceLight(false);
      active = false; group.visible = false; tools.hidden = true; companion.hidden = true; rackUI.element.hidden = true;
      rack.setVisible(false); field.setVisible(false); world.vesta.group.visible = true;
      host.classList.remove('evidence-world-active'); delete root.dataset.evidenceDisplay; setPanel(null);
    },
    update(t, state = {}) {
      if (!active || state.active === false) return;
      lastTime = t; currentQ = state.q || world.q;
      const key = JSON.stringify([currentQ, panel, fieldMode, investigation, comparison, search, activeFinding]);
      if (key !== lastKey) {
        lastKey = key; refreshAnswer(); refreshDials();
        if (panel === 'overview' || panel === 'sample') wall.update(currentQ);
        if (panel === 'gaps') gaps.update(currentQ);
      }
      const fixed = state.capture || state.reduced || stage.mode === 'still', lens = cameraPose();
      world.vesta.group.visible = sceneMode === 'rack';
      // Project labels and the chart with the same station lens used for rendering.
      // The shared world applies its phone flight lens before calling this update.
      if (root.dataset.flying !== 'true') {
        stage.camera.position.fromArray(lens.position).add(origin);
        stage.camera.lookAt(cameraTarget.fromArray(lens.target).add(origin));
        stage.camera.fov = lens.fov; stage.camera.updateProjectionMatrix();
      }
      stage.camera.userData.focusDistance = lens.focusDistance;
      stage.camera.userData.aperture = lens.aperture;
      stage.renderer.toneMappingExposure = lens.exposure;
      rack.update(t, { capture: state.capture, reduced: state.reduced });
      layout();
      const compare = fieldMode === 'compare';
      if (sceneMode === 'chart') field.update(t, {
        db, q: currentQ, capture: state.capture, reduced: state.reduced,
        investigation: compare ? investigation : null, comparison: compare ? comparison : null,
        highlightInvestigations: fieldMode === 'ask' && search.trim() ? resultPsi : null,
        highlightEmpty: fieldMode === 'ask' && !!search.trim() && !resultPsi.length, labels: true,
        pointerX: state.pointerX, pointerY: state.pointerY
      });
      const attended = hoveredMaterial || selectedMaterial;
      if (attended) guideTarget.copy(rack.anchor(attended)); else guideTarget.set(0, 0, 0);
      const pose = evidenceGuidePose({ elapsed: t - reaction, target: guideTarget, compact: phone(), still: fixed });
      Object.assign(pose, { x: phone() ? 2.6 : 4.15, y: phone() ? -4 : -2.3, z: 1, scale: phone() ? .7 : .85 });
      pose.lookX = Math.max(-1, Math.min(1, (guideTarget.x - pose.x) / 3));
      pose.lookY = Math.max(-.6, Math.min(.6, (guideTarget.y - pose.y) / 3));
      world.vesta?.update?.(fixed ? 2 : t, { ...world.vesta.defaults, ...pose,
        blink: fixed ? 0 : Math.max(0, 1 - Math.abs(t % 4.7 - 3.9) / .085) });
      guideScreen.set(pose.x, pose.y - pose.scale * .85, pose.z).applyMatrix4(group.matrixWorld).project(stage.camera);
      guideHead.set(pose.x, pose.y + pose.scale * 1.1, pose.z).applyMatrix4(group.matrixWorld).project(stage.camera);
      companion.style.left = Math.max(64, Math.min(host.clientWidth - 64, (guideScreen.x + 1) * host.clientWidth / 2)) + 'px';
      companion.style.top = (1 - guideHead.y) * host.clientHeight / 2 + 'px';
      companion.style.paddingTop = Math.max(0, (guideHead.y - guideScreen.y) * host.clientHeight / 2) + 'px';
      const caption = attended ? db.materials[attended].label : 'Your evidence guide';
      if (companion.lastChild.textContent !== caption) companion.lastChild.textContent = caption;
      companion.hidden = sceneMode === 'chart' || !!panel || state.capture && world.filmActive
        || root.dataset.cinema === 'true' || root.dataset.flying === 'true';
      host.dataset.evidenceActive = 'true'; host.dataset.evidenceInvestigation = investigation || '';
      host.dataset.evidenceComparison = comparison || ''; host.dataset.evidenceFinding = activeFinding || '';
      host.dataset.evidenceSelectedRows = String(plotted.filter(p => compare
        ? p.row.psi_id === investigation || p.row.psi_id === comparison
        : fieldMode === 'ask' && search.trim() ? resultPsi.includes(p.row.psi_id) : true).length);
    },
    pick(x, y) {
      if (!active) return null;
      if (sceneMode === 'chart') return field.pick(x, y);
      pickRay.setFromCamera({ x, y }, stage.camera);
      const hit = rack.pick(pickRay); hoveredMaterial = hit?.material || null;
      return hit ? { ...hit, kind: 'material' } : null;
    },
    select(hit) {
      if (hit?.kind === 'material') { openMaterial(hit.material, hit.concern || selectedConcern); return true; }
      if (hit?.kind === 'test') { guideRow = hit.id; reaction = lastTime; world.invalidate?.(); }
      return false;
    },
    holograms() { return []; },
    dispose() {
      active = false; balanceLight(false); panelObserver.disconnect();
      root.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape);
      window.removeEventListener('vesta:cite', citation);
      wall.dispose(); gaps.dispose(); field.dispose(); rack.dispose(); rackUI.dispose(); consoleHandle.dispose();
      tools.remove(); companion.remove(); style.remove(); host.classList.remove('evidence-world-active'); delete root.dataset.evidenceDisplay;
      const seen = new Set();
      group.traverse(o => { for (const resource of [o.geometry, ...[o.material].flat()]) if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose?.(); } });
      group.removeFromParent();
    }
  };
}
