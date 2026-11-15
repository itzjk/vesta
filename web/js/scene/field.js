import { TOL, match } from '../core/match.js';
import { cells } from '../core/status.js';
import { plottedSummary, markGroups } from '../core/field-inspect.js';
import { css } from '../ui/el.js';
import { openSource } from '../store.js';
import { cite } from '../world/cite.js?v=sebas-20261115-1';
export const still = 'assets/scene/field.jpg';
const planes = [{ key: '0g', label: '0 g · microgravity', z: 4.5 }, { key: 'moon', label: '1/6 g · Moon', z: 1.5 }, { key: 'mars', label: '3/8 g · Mars', z: -1.5 }, { key: '1g', label: '1 g · Earth', z: -4.5 }];
const KPA_PER_PSI = 6.894757293;
const PICK_RADIUS_PX = 44 / 2;
export function fieldRows(db) {
  return db.tests.filter(r => r.n?.o2 != null).map(r => ({ row: r, p: r.n.p ?? r.n.p_inferred ?? null, o2: r.n.o2,
    plane: r.n.gclass === 'micro' ? '0g' : r.n.gclass === 'normal' ? '1g' : r.gravity === '1/6 g' ? 'moon' : r.gravity === '3/8 g' ? 'mars' : 'unknown',
    layer: r.n.cabin ? 'solid' : r.n.fuel_class === 'liquid_droplet' ? 'droplet' : 'gas' }));
}
export function nearestSolid(db, q) {
  if (!Number.isFinite(q.p) || !Number.isFinite(q.o2)) return null;
  return fieldRows(db).filter(p => p.layer === 'solid' && p.p != null && p.plane !== 'unknown').sort((a, b) => {
    const score = p => ((p.p - q.p) / TOL.p) ** 2 + ((p.o2 - q.o2) / TOL.o2) ** 2;
    return score(a) - score(b) || a.row.id.localeCompare(b.row.id);
  })[0] || null;
}
export async function build(ctx) {
  await css('css/field-inspect.css?v=1');
  const { THREE: T, camera, renderer } = ctx;
  const group = new T.Group(), instrument = new T.Group(), host = renderer.domElement.parentElement;
  group.name = 'tested-conditions'; group.add(instrument);
  const make = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const overlay = make('section', 'field-labels field-instrument');
  const embedded = host.classList.contains('design-field-viewport');
  overlay.dataset.embedded = String(embedded);
  overlay.setAttribute('aria-label', 'Tested conditions');
  const style = make('style', '');
  style.textContent = `
.field-instrument.field-labels{position:absolute!important;inset:80px 100px 140px 32px!important;max-width:1100px;margin:auto;z-index:8!important;pointer-events:none!important;overflow:visible!important;display:flex;flex-direction:column;color:#f0e8d9;font:16px/1.35 var(--font-body,'Source Sans 3',sans-serif);box-shadow:0 12px 40px #0007;isolation:isolate}
.field-instrument[hidden]{display:none!important}.field-instrument *{box-sizing:border-box}.field-heading,.field-gravities,.field-caption,.field-key{background:#172126}.field-heading{padding:16px 22px 12px;border-top:2px solid #b98564;display:flex;align-items:center;justify-content:space-between;gap:16px}.field-heading h2{font:500 26px/1.15 var(--font-body,'Source Sans 3',sans-serif);margin:0}.field-cabin-readout{color:#eeb38d;font-size:15px;text-align:right}.field-gravities{padding:0 18px 12px;display:flex;gap:6px;pointer-events:auto}.field-gravities button{flex:1;min-height:48px;padding:6px 8px;border:1px solid #65727a;background:#172126;color:#d0d9dc;font:inherit;cursor:pointer;touch-action:manipulation}.field-gravities button[aria-pressed=true]{border-color:#f0b68e;background:#65402d;color:#fff2df}.field-gravities button small{display:block;font-size:13px;color:inherit}.field-instrument button:focus-visible{outline:2px solid #fff;outline-offset:2px}.field-chart{position:relative;flex:1;min-height:150px}.field-plot{position:absolute;inset:34px 72px 56px 64px;border-left:1px solid #9aa7aa;border-bottom:1px solid #9aa7aa}.field-grid{position:absolute;background:#a6b8c01b;pointer-events:none}.field-grid-x{top:0;bottom:0;width:1px}.field-grid-y{left:0;right:0;height:1px}.field-axis-text{position:absolute;font-size:14px;color:#dbe0dc;white-space:nowrap}.field-x-title{bottom:5px;left:64px}.field-y-title{left:20px;top:7px}.field-tick-text{position:absolute;font:13px/1 var(--font-body,'Source Sans 3',sans-serif);color:#bac7cd}.field-tick-x{top:calc(100% + 10px);transform:translateX(-50%)}.field-tick-y{right:calc(100% + 10px);transform:translateY(50%)}.field-unknown-pressure{position:absolute;top:0;bottom:0;right:-38px;width:1px;background:#94a5b25c}.field-unknown-pressure span{position:absolute;top:-22px;left:-27px;padding-top:0;font-size:11px;color:#bac7cd;white-space:nowrap}.field-empty{position:absolute;inset:10px 12px;display:flex;align-items:center;justify-content:center;text-align:center;flex-direction:column;gap:10px;color:#dbe0dc;font-size:18px;line-height:1.35}.field-empty[hidden]{display:none}.field-empty strong{font-size:24px;font-weight:500}.field-empty button{pointer-events:auto;min-height:44px;padding:8px 12px;border:1px solid #a17d60;background:#263238;color:#f0e8d9;font:inherit;cursor:pointer}.field-cabin-tag{position:absolute;max-width:200px;padding:5px 8px;background:#10191ef0;color:#ffc69c;font-size:14px;border-left:2px solid #ffc69c;white-space:normal;transform:translate(12px,-100%)}.field-cabin-tag[data-other=true]{border-left-style:dashed;color:#d8c2aa}.field-caption{margin:0;padding:12px 22px 6px;font-size:18px;line-height:1.3}.field-caption strong{color:#efb087;font-weight:500}.field-key{display:flex;flex-wrap:wrap;gap:5px 18px;padding:8px 22px 16px;font-size:13px;color:#b6c3c9}.field-key span:first-child{color:#efb087}.field-row-readout{position:absolute;left:18px;right:18px;bottom:4px;max-width:650px;padding:10px 14px;background:#172126f5;border-left:2px solid #efb087;color:#ede4d4;font-size:15px;pointer-events:none}.field-row-readout[hidden]{display:none}
@media(max-width:759px){.field-instrument.field-labels{inset:74px 12px 158px!important;max-width:none}.field-heading{padding:12px 12px 10px;display:block}.field-heading h2{font-size:22px}.field-cabin-readout{text-align:left;font-size:13px;margin-top:4px}.field-gravities{padding:0 10px 10px;gap:4px}.field-gravities button{font-size:14px;padding:5px 2px;min-height:48px}.field-gravities button small{font-size:11px}.field-plot{inset:32px 50px 51px 45px}.field-y-title{left:10px}.field-x-title{left:45px;font-size:12px}.field-axis-text{font-size:13px}.field-tick-text{font-size:12px}.field-unknown-pressure{right:-23px}.field-unknown-pressure span{left:-22px;font-size:10px}.field-caption{font-size:16px;padding:10px 12px 5px}.field-key{padding:7px 12px 12px;font-size:11px;gap:4px 12px}.field-cabin-tag{font-size:12px;max-width:150px}.field-empty{font-size:14px;inset:10px 0}.field-empty strong{font-size:20px}.field-empty button{font-size:14px}.field-row-readout{left:8px;right:8px;font-size:13px}}
@media(max-height:580px){.field-instrument.field-labels{inset:52px 72px 64px 12px!important}.field-heading{padding:6px 12px;display:flex}.field-heading h2{font-size:18px}.field-gravities{padding-bottom:4px}.field-gravities button{min-height:44px}.field-gravities button small{display:block}.field-chart{min-height:90px}.field-caption{font-size:14px;padding:6px 12px}.field-key{padding:3px 12px 6px;font-size:11px}}

.field-instrument :is(.field-heading,.field-gravities,.field-caption,.field-key){flex-shrink:0}
.design-field-viewport:has(>.field-instrument[data-embedded=true]){height:auto!important;min-height:680px!important;flex:none!important}
.field-instrument.field-labels[data-embedded=true]{position:relative!important;inset:auto!important;margin:0;max-width:none;width:100%;min-height:680px}
.field-instrument[data-embedded=true] .field-chart{min-height:340px}
.field-instrument[data-embedded=true] .field-empty button{min-height:calc(45px / var(--stage-scale,1))}
.design-layout:has(.field-instrument){height:auto;grid-template-rows:40px auto minmax(850px,auto) 220px 30px}
#view.design-view:has(.field-instrument){overflow-y:auto!important}
.design-envelope:has(.field-instrument){min-height:850px}
.design-map-body:has(.field-instrument){overflow:visible!important}
@media(max-width:759px){.field-instrument[data-embedded=true] .field-chart{min-height:484px}.field-instrument[data-embedded=true] .field-gravities button{min-width:0}.field-instrument[data-embedded=true] .field-empty{gap:10px}.field-instrument[data-embedded=true] .field-empty button{min-height:44px}}
@media(max-width:759px){
html[data-view-mode=details] #view .field-instrument :is(.field-tick-text,.field-axis-text,.field-unknown-pressure span){font-size:16px;line-height:1.2;overflow-wrap:normal;white-space:nowrap;max-width:none}
html[data-view-mode=details] #view .field-instrument .field-tick-text{line-height:1}
html[data-view-mode=details] #view .field-instrument .field-gravities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
html[data-view-mode=details] #view .field-instrument .field-gravities button{font-size:16px;line-height:1.25;padding:8px 4px;min-height:64px;white-space:nowrap;overflow-wrap:normal}
html[data-view-mode=details] #view .field-instrument .field-gravities small{font-size:16px;line-height:1.25;white-space:nowrap;overflow-wrap:normal}
html[data-view-mode=details] #view .field-instrument .field-plot{inset:48px 50px 76px 45px}
html[data-view-mode=details] #view .field-instrument .field-unknown-pressure span{left:auto;right:0;top:-30px}
html[data-view-mode=details] #view .field-instrument .field-x-title{bottom:8px;left:12px}
html[data-view-mode=details] #view .field-instrument .field-cabin-tag{font-size:16px;line-height:1.25;overflow-wrap:normal}
html[data-view-mode=details] #view .field-instrument .field-empty{font-size:16px;line-height:1.35}
html[data-view-mode=details] #view .field-instrument .field-empty strong{font-size:20px;line-height:1.2}
html[data-view-mode=details] #view .field-instrument .field-key{font-size:16px;line-height:1.35}
}

`;
  const heading = make('header', 'field-heading'), title = make('h2', '', 'Tested conditions');
  const readout = make('div', 'field-cabin-readout'); heading.append(title, readout);
  const tabs = make('nav', 'field-gravities'); tabs.setAttribute('aria-label', 'Gravity level');
  const chart = make('div', 'field-chart'), plot = make('div', 'field-plot');
  const xTitle = make('div', 'field-axis-text field-x-title', 'Air pressure (psia), log scale');
  chart.append(make('div', 'field-axis-text field-y-title', 'Oxygen (% by volume)'), plot, xTitle);
  const rail = make('div', 'field-unknown-pressure'); rail.append(make('span', '', 'Not stated')); plot.append(rail);
  const cabinLabel = make('div', 'field-cabin-tag'); plot.append(cabinLabel);
  const empty = make('div', 'field-empty'), emptyTitle = make('strong', ''), emptyText = make('span', ''), available = make('button', '');
  available.type = 'button'; empty.append(emptyTitle, emptyText, available); plot.append(empty);
  const caption = make('p', 'field-caption'); caption.setAttribute('aria-live', 'polite');
  const legend = make('div', 'field-key');
  for (const text of [`◆ Your cabin · rust = matching rows (±${TOL.o2} pp O₂, ±${TOL.p} kPa)`, '● Cabin materials · ◇ Model fuels', 'Hollow = inferred / absent pressure', 'Source-table rows; overlaps share a mark', 'Coverage, not safety']) legend.append(make('span', '', text));
  const hover = make('div', 'field-row-readout'); hover.hidden = true;
  const inspectTools = make('div', 'field-inspect-tools');
  const aboutButton = make('button', '', 'What is plotted?'), browseButton = make('button', '', 'Choose a mark');
  for (const button of [aboutButton, browseButton]) { button.type = 'button'; button.setAttribute('aria-expanded', 'false'); }
  inspectTools.append(aboutButton, browseButton);
  const inspectPanel = make('section', 'field-inspect-panel'); inspectPanel.hidden = true;
  inspectPanel.setAttribute('aria-label', 'Inspect plotted rows');
  const inspectClose = make('button', 'field-inspect-close', 'Back to plot'), inspectTitle = make('h3', '');
  inspectClose.type = 'button'; inspectTitle.tabIndex = -1;
  const inspectBody = make('div', 'field-inspect-body'); inspectPanel.append(inspectClose, inspectTitle, inspectBody);
  overlay.append(style, heading, tabs, chart, caption, legend, hover, inspectTools, inspectPanel); host.append(overlay);
  for (const element of [inspectTools, inspectPanel]) for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'keydown']) element.addEventListener(type, event => {
    event.stopPropagation();
    if (type === 'keydown' && event.key === 'Escape' && !inspectPanel.hidden) { event.preventDefault(); closeInspection(); }
  });
  for (const type of ['pointerdown', 'pointerup', 'wheel', 'keydown']) tabs.addEventListener(type, e => { if (type !== 'keydown' || e.key !== 'Escape') e.stopPropagation(); });
  available.addEventListener('pointerdown', e => e.stopPropagation());
  const invalidate = () => ctx.invalidate ? ctx.invalidate() : ctx.set?.({});
  let externalLayersKey = null, localLayers = null, inspectMode = null, inspectReturn = null, selectedMark = null, pointerStart = null;
  let selectedGravity = null, gravity = '0g', stateNow, data = [], visibleRows = [], priorDb, cacheKey = '', layoutKey = '', active = true;
  let marks, hitRows = new Set(), selectedIds = [], highlightEmpty = false, shown = [], hovered = null, bounds;
  let oMin = 10, oMax = 42, pMin = 2, pMax = 80;
  const buttons = new Map(), tickNodes = [], disposed = new Set(), matrix = new T.Matrix4(), local = new T.Matrix4(), inverse = new T.Matrix4();
  const rotation = new T.Quaternion();
  const flat = color => new T.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false });
  const plate = new T.Mesh(new T.PlaneGeometry(1, 1), flat(0x1c2a32)); plate.renderOrder = 1000; plate.frustumCulled = false; instrument.add(plate);
  const tolerance = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xad7859, transparent: true, opacity: .17, depthTest: false, depthWrite: false, toneMapped: false })); tolerance.renderOrder = 1001; tolerance.frustumCulled = false; instrument.add(tolerance);
  const cabin = new T.Mesh(new T.RingGeometry(.34, .5, 4), flat(0xffc498)); cabin.rotation.z = 0; cabin.renderOrder = 1004; cabin.frustumCulled = false; instrument.add(cabin);
  const core = new T.Mesh(new T.CircleGeometry(.22, 4), flat(0xffc498)); core.rotation.z = 0; core.renderOrder = 1004; core.frustumCulled = false; instrument.add(core);
  const x = p => Math.log(p / pMin) / Math.log(pMax / pMin);
  const y = o => (o - oMin) / (oMax - oMin);
  const point = p => ({ x: p.p != null && p.p > 0 ? x(p.p / KPA_PER_PSI) : 1, y: y(p.o2) });
  function selectGravity(key) {
    if (!buttons.has(key)) return;
    selectedGravity = key; cacheKey = ''; clearHover();
    if (stateNow) update(lastTime, stateNow);
    invalidate();
  }
  function clearHover() { hovered = null; hover.hidden = true; }
  const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
  const groupLabel = entry => {
    const p = entry.rows[0];
    return `${number(p.o2)}% O₂ · ${p.p > 0 ? `${number(p.p / KPA_PER_PSI)} psia` : 'pressure not stated'} · ${entry.rows.length} row${entry.rows.length === 1 ? '' : 's'}`;
  };
  const selectableRows = () => visibleRows.filter(p => !highlightEmpty && (!selectedIds.length || selectedIds.includes(p.row.psi_id)));
  function closeInspection(focus = true) {
    inspectMode = null; inspectPanel.hidden = true; delete overlay.dataset.inspectOpen;
    aboutButton.setAttribute('aria-expanded', 'false'); browseButton.setAttribute('aria-expanded', 'false');
    if (focus) (inspectReturn || browseButton).focus({ preventScroll: true });
    invalidate();
  }
  function openInspection(mode, entry = null, trigger = null) {
    inspectMode = mode; selectedMark = entry?.key || selectedMark; inspectReturn = trigger || browseButton;
    inspectPanel.hidden = false; overlay.dataset.inspectOpen = 'true'; aboutButton.setAttribute('aria-expanded', String(mode === 'about')); browseButton.setAttribute('aria-expanded', String(mode === 'rows'));
    paintInspection(); inspectTitle.focus({ preventScroll: true }); invalidate();
  }
  function paintInspection() {
    if (!inspectMode || !stateNow) return;
    inspectBody.replaceChildren();
    if (inspectMode === 'about') {
      inspectTitle.textContent = 'What is plotted?';
      const summary = plottedSummary(stateNow.db, data), micro = summary.gravity['0g'] || 0;
      inspectBody.append(make('p', '', `${number(summary.plotted)} of ${number(summary.loaded)} source-table rows have normalized ambient O₂; ${number(summary.excluded)} are outside this plot. Rows are not replicates.`),
        make('p', '', `${number(micro)} plotted rows are microgravity. Pressure: ${number(summary.reported)} reported, ${number(summary.inferred)} facility-inferred, ${number(summary.missing)} not stated.`),
);
      const filters = make('fieldset', 'field-layer-filters'); filters.append(make('legend', '', 'Visible layers'));
      for (const [key, label] of [['solid', 'Solid'], ['droplet', 'Droplet'], ['gas', 'Gas']]) {
        const button = make('button', '', label); button.type = 'button'; button.dataset.fieldLayer = key;
        button.setAttribute('aria-pressed', String(shown.includes(key)));
        button.onclick = () => {
          localLayers = shown.includes(key) ? shown.filter(layer => layer !== key) : [...shown, key];
          cacheKey = ''; update(lastTime, stateNow); paintInspection(); inspectBody.querySelector(`[data-field-layer=${key}]`)?.focus({ preventScroll: true }); invalidate();
        };
        filters.append(button);
      }
      inspectBody.append(filters, make('p', '', readout.textContent), make('p', '', 'Circles: solid cabin materials. Diamonds: model fuels. Hollow marks: inferred or absent pressure. Source-table rows may overlap.'), make('p', '', 'Empty gravity tabs are collection gaps, not a broken plot or proof of safety. Rows are table records, not independent experiments; replicate counts and uncertainty are not established. Overlapping rows share a mark.'), make('p', '', `${number(visibleRows.length)} rows currently visible at ${planes.find(p => p.key === gravity)?.label || gravity}. Counts above describe the whole plotted subset before layer filters.`));
      return;
    }
    inspectTitle.textContent = 'Rows at this mark';
    const groups = markGroups(selectableRows()), select = make('select', 'field-mark-select'), label = make('label', '', `Choose a mark (${number(groups.length)} positions)`);
    select.setAttribute('aria-label', 'Plotted mark');
    for (const entry of groups) { const option = make('option', '', groupLabel(entry)); option.value = entry.key; select.append(option); }
    const entry = groups.find(g => g.key === selectedMark) || groups[0]; selectedMark = entry?.key || null;
    if (entry) select.value = entry.key;
    select.onchange = () => { selectedMark = select.value; paintInspection(); inspectBody.querySelector('select')?.focus({ preventScroll: true }); };
    label.append(select); inspectBody.append(label);
    if (!entry) { inspectBody.append(make('p', '', 'No plotted rows in the current gravity, layer and investigation selection.')); return; }
    inspectBody.append(make('p', 'field-mark-context', 'Shared coordinates do not make these rows replicates. Inspect fuels, flow and outcomes.'));
    const list = make('ol', 'field-mark-rows');
    for (const p of entry.rows) {
      const row = p.row, li = make('li', ''); li.dataset.fieldRow = row.id;
      const text = `${row.investigation} · ${row.fuel || 'fuel not stated'} · ${row.test_label || row.id}`;
      const source = ctx.world ? cite('Inspect recorded row', row.id) : make('button', '', 'Inspect recorded row');
      if (!ctx.world) { source.type = 'button'; source.onclick = () => openSource(row.id); }
      source.dataset.fieldSource = row.id; source.setAttribute('aria-label', `Inspect row ${row.id}: ${text}`);
      li.append(make('p', '', text), make('small', '', `${row.table_file} · row ${row.row} · ${row.n.p == null ? row.n.p_inferred == null ? 'pressure not stated' : 'pressure inferred' : 'pressure reported'}`), source);
      const url = stateNow.db.invById[row.psi_id]?.psi_url;
      if (/^https:\/\//i.test(url || '')) { const link = make('a', '', 'Original PSI record ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `Original PSI record for ${row.id}`); li.append(link); }
      list.append(li);
    }
    inspectBody.append(list);
  }
  aboutButton.onclick = () => openInspection('about', null, aboutButton);
  browseButton.onclick = () => openInspection('rows', null, browseButton);
  inspectClose.onclick = () => closeInspection();
  function pointerDown(event) { pointerStart = [event.clientX, event.clientY]; }
  function pointerUp(event) {
    if (!active || !group.visible || !bounds || !pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
    pointerStart = null;
    const rect = renderer.domElement.getBoundingClientRect(), hit = pick((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    if (!hit) return;
    const entry = markGroups(selectableRows()).find(g => g.rows.some(p => p.row.id === hit.id));
    if (entry?.rows.length > 1) { event.stopImmediatePropagation(); event.preventDefault(); openInspection('rows', entry); }
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown, true);
  renderer.domElement.addEventListener('pointerup', pointerUp, true);
  function populate(db) {
    data = fieldRows(db); priorDb = db; cacheKey = ''; layoutKey = '';
    const definitions = [...planes, ...(data.some(p => p.plane === 'unknown') ? [{ key: 'unknown', label: 'Unknown gravity' }] : [])];
    tabs.replaceChildren(); buttons.clear();
    for (const def of definitions) {
      const count = data.filter(p => p.plane === def.key).length;
      const button = make('button', '', def.key === '0g' ? 'Microgravity' : def.key === 'moon' ? 'Moon' : def.key === 'mars' ? 'Mars' : def.key === '1g' ? 'Earth' : 'Unknown');
      button.type = 'button'; button.dataset.fieldGravity = def.key;
      button.append(make('small', '', `${def.label.split(' · ')[0]} · ${count} rows`));
      button.setAttribute('aria-label', `${def.label}: ${count} rows`); button.onclick = () => selectGravity(def.key);
      buttons.set(def.key, button); tabs.append(button);
    }
    if (selectedGravity && !buttons.has(selectedGravity)) selectedGravity = null;
    if (marks) { instrument.remove(marks); marks.geometry.dispose(); marks.material.dispose(); }
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.setAttribute('shade', new T.InstancedBufferAttribute(new Float32Array(Math.max(1, data.length) * 3), 3));
    geometry.setAttribute('shape', new T.InstancedBufferAttribute(new Float32Array(Math.max(1, data.length)), 1));
    geometry.setAttribute('hollow', new T.InstancedBufferAttribute(new Float32Array(Math.max(1, data.length)), 1));
    const material = new T.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'attribute vec3 shade; attribute float shape; attribute float hollow; varying vec2 markUV; varying vec3 markColor; varying float markShape; varying float markHollow; void main(){markUV=uv-.5;markColor=shade;markShape=shape;markHollow=hollow;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 markUV; varying vec3 markColor; varying float markShape; varying float markHollow; void main(){float d=markShape>.5?abs(markUV.x)+abs(markUV.y):length(markUV);float a=1.-smoothstep(.43,.5,d);if(markHollow>.5)a*=smoothstep(.24,.31,d);if(a<.01)discard;gl_FragColor=vec4(markColor,a);#include <colorspace_fragment>\n}'.replace('#include', '\n#include')
    });
    marks = new T.InstancedMesh(geometry, material, Math.max(1, data.length)); marks.name = 'tested-row-marks'; marks.count = 0; marks.renderOrder = 1002; marks.frustumCulled = false; instrument.add(marks);
  }
  function axes(q) {
    const pressures = data.map(p => p.p / KPA_PER_PSI).filter(p => Number.isFinite(p) && p > 0);
    const oxygens = data.map(p => p.o2).filter(Number.isFinite);
    pMin = Math.min(2, ...pressures, Number.isFinite(q.p) && q.p > 0 ? q.p / KPA_PER_PSI : 2); pMax = Math.max(80, ...pressures, Number.isFinite(q.p) && q.p > 0 ? q.p / KPA_PER_PSI : 80);
    oMin = Math.min(10, ...oxygens, Number.isFinite(q.o2) ? q.o2 : 10); oMax = Math.max(42, ...oxygens, Number.isFinite(q.o2) ? q.o2 : 42);
    tickNodes.forEach(el => el.remove()); tickNodes.length = 0;
    const addTick = (value, horizontal) => {
      const percent = (horizontal ? x(value) : y(value)) * 100;
      const grid = make('i', `field-grid field-grid-${horizontal ? 'x' : 'y'}`), tick = make('span', `field-tick-text field-tick-${horizontal ? 'x' : 'y'}`, String(value));
      grid.style[horizontal ? 'left' : 'bottom'] = tick.style[horizontal ? 'left' : 'bottom'] = `${percent}%`;
      plot.append(grid, tick); tickNodes.push(grid, tick);
    };
    for (const p of [2, 5, 10, 20, 40, 80]) if (p >= pMin && p <= pMax) addTick(p, true);
    const step = oMax - oMin > 60 ? 20 : 10;
    for (let o = Math.ceil(oMin / step) * step; o <= oMax; o += step) addTick(o, false);
  }
  function refresh(state) {
    const q = state.q; gravity = selectedGravity || (buttons.has(q.g) ? q.g : '0g');
    shown = localLayers || state.show || ['solid', 'droplet', 'gas']; selectedIds = state.highlightInvestigations || [state.investigation, state.comparison].filter(Boolean); highlightEmpty = !!state.highlightEmpty;
    hitRows = new Set(data.filter(p => p.row.n.counts && match(p.row.n, q, state.db.base).fail.length === 0).map(p => p.row.id));
    visibleRows = data.filter(p => p.plane === gravity && shown.includes(p.layer));
    const selected = p => !selectedIds.length && !highlightEmpty || selectedIds.includes(p.row.psi_id);
    const matching = visibleRows.filter(p => selected(p) && hitRows.has(p.row.id)).length;
    const represented = visibleRows.filter(selected).length;
    const level = planes.find(p => p.key === gravity)?.label || 'Unknown gravity';
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === gravity));
    readout.textContent = `Your cabin: ${Number.isFinite(q.o2) ? `${q.o2}% O₂` : 'oxygen not set'} · ${Number.isFinite(q.p) ? `${(q.p / KPA_PER_PSI).toFixed(1)} psia` : 'pressure not set'} · ${q.g_label || q.g || 'gravity not set'}`;
    const coverage = cells(q, state.db), proven = coverage.filter(c => c.status === 'PROVEN').length;
    caption.replaceChildren(document.createTextNode(`${level}: ${visibleRows.length} rows shown${selectedIds.length || highlightEmpty ? `, ${represented} in the selection` : ''}. `), make('strong', '', `${matching} counting rows within cabin tolerance.`));
    legend.firstChild.textContent = ctx.world && innerWidth < 760 && innerHeight <= 700 ? `Rust: gravity + O₂ ±${TOL.o2} pp + pressure ±${TOL.p} kPa` : `◆ Your cabin · rust = matching rows (±${TOL.o2} pp O₂, ±${TOL.p} kPa)`;
    legend.lastChild.textContent = `${proven} of ${coverage.length} material questions nearby. Coverage, not safety.`;
    empty.hidden = represented > 0;
    emptyTitle.textContent = visibleRows.length ? 'No rows in this selection' : `No plotted rows at ${level.split(' · ')[0]}`;
    emptyText.textContent = 'This is a gap in this collection, not proof of safety.';
    const populated = [...buttons.keys()].filter(key => data.some(p => p.plane === key && shown.includes(p.layer))).sort((a, b) => data.filter(p => p.plane === b).length - data.filter(p => p.plane === a).length)[0];
    available.hidden = !populated || populated === gravity;
    available.textContent = `View ${populated === '0g' ? 'microgravity' : planes.find(p => p.key === populated)?.label || populated} rows`;
    available.onclick = () => selectGravity(populated);
    axes(q); clearHover(); layoutKey = '';
    if (inspectMode) paintInspection();
    host.dataset.fieldRows = String(data.length); host.dataset.fieldVisibleRows = String(visibleRows.length); host.dataset.fieldMatches = String(matching); host.dataset.fieldGravity = gravity; host.dataset.fieldMinPointPx = '9';
  }
  function fitCabin(at) {
    empty.style.justifyContent = '';
    const rect = plot.getBoundingClientRect();
    const marker = { left: rect.left + at.x * rect.width - 12, right: rect.left + at.x * rect.width + 12, top: rect.bottom - at.y * rect.height - 12, bottom: rect.bottom - at.y * rect.height + 12 };
    const intersects = (a, b, gap = 6) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
    const messageRects = () => empty.hidden ? [] : [...empty.children].filter(el => !el.hidden).map(el => el.getBoundingClientRect());
    if (messageRects().some(r => intersects(marker, r))) {
      for (const alignment of ['flex-start', 'flex-end']) {
        empty.style.justifyContent = alignment;
        if (!messageRects().some(r => intersects(marker, r))) break;
      }
    }
    const message = messageRects();
    const markerFits = marker.left >= rect.left && marker.right <= rect.right && marker.top >= rect.top && marker.bottom <= rect.bottom && !message.some(r => intersects(marker, r));
    cabin.visible = markerFits; core.visible = markerFits && cabinLabel.dataset.other !== 'true';
    tolerance.visible = markerFits && cabinLabel.dataset.other !== 'true';
    host.dataset.fieldCabinMarker = markerFits ? 'visible' : 'hidden-for-text';
    const label = cabinLabel.getBoundingClientRect();
    const obstacles = [...message, ...chart.querySelectorAll('.field-axis-text,.field-tick-text,.field-unknown-pressure span')].map(el => el.getBoundingClientRect ? el.getBoundingClientRect() : el);
    const fits = r => r.left >= rect.left + 3 && r.right <= rect.right - 3 && r.top >= rect.top + 3 && r.bottom <= rect.bottom - 3 && !obstacles.some(o => intersects(r, o));
    if (fits(label)) return;
    const lefts = [marker.right + 12, marker.left - label.width - 12, rect.left + 6, rect.right - label.width - 6];
    const tops = [marker.top - label.height - 4, marker.bottom + 4, rect.top + 6, rect.bottom - label.height - 6];
    const candidates = lefts.flatMap(left => tops.map(top => ({ left, top, right: left + label.width, bottom: top + label.height }))).filter(fits);
    candidates.sort((a, b) => Math.hypot(a.left - label.left, a.top - label.top) - Math.hypot(b.left - label.left, b.top - label.top));
    if (candidates.length) {
      const next = candidates[0];
      cabinLabel.style.left = `${(next.left - rect.left) / rect.width * 100}%`;
      cabinLabel.style.bottom = `${(rect.bottom - next.bottom) / rect.height * 100}%`;
      cabinLabel.style.transform = 'none';
    }
  }
  let lastTime = 0;
  function update(t, state) {
    if (!state.db || !state.q) return;
    lastTime = t; stateNow = state;
    const nextLayersKey = JSON.stringify(state.show || null);
    if (nextLayersKey !== externalLayersKey) { localLayers = null; externalLayersKey = nextLayersKey; }
    if (priorDb !== state.db) populate(state.db);
    const key = JSON.stringify([state.q, selectedGravity, state.show, state.investigation, state.comparison, state.highlightInvestigations, state.highlightEmpty]);
    if (key !== cacheKey) { refresh(state); cacheKey = key; }
    if (!active || !group.visible) return;
    const hostRect = host.getBoundingClientRect(), rect = plot.getBoundingClientRect(); bounds = { left: rect.left - hostRect.left, top: rect.top - hostRect.top, width: rect.width, height: rect.height, hostWidth: hostRect.width, hostHeight: hostRect.height };
    camera.updateMatrixWorld(); group.updateWorldMatrix(true, false);
    const depth = 2, height = 2 * depth * Math.tan(camera.fov * Math.PI / 360), width = height * camera.aspect;
    local.makeTranslation(((bounds.left + rect.width / 2) / hostRect.width - .5) * width, (.5 - (bounds.top + rect.height / 2) / hostRect.height) * height, -depth);
    matrix.multiplyMatrices(camera.matrixWorld, local); inverse.copy(group.matrixWorld).invert(); instrument.matrixAutoUpdate = false; instrument.matrix.multiplyMatrices(inverse, matrix);
    instrument.matrixWorldNeedsUpdate = true;
    const sx = width / hostRect.width, sy = height / hostRect.height, w = rect.width * sx, h = rect.height * sy;
    const layout = `${rect.width}|${rect.height}|${sx}|${sy}`;
    if (layoutKey !== layout) {
      layoutKey = layout; plate.scale.set(w + 130 * sx, h + 94 * sy, 1);
      const counts = new Map(); for (const p of visibleRows) { const key = `${p.p}|${p.o2}|${p.layer}|${p.row.n.p == null}`; counts.set(key, (counts.get(key) || 0) + 1); }
      const shade = marks.geometry.attributes.shade, shape = marks.geometry.attributes.shape, hollow = marks.geometry.attributes.hollow;
      visibleRows.forEach((p, i) => {
        const at = point(p), selected = !selectedIds.length && !highlightEmpty || selectedIds.includes(p.row.psi_id);
        const duplicate = counts.get(`${p.p}|${p.o2}|${p.layer}|${p.row.n.p == null}`);
        const size = Math.min(23, 9 + Math.log2(duplicate) * 1.4 + (hitRows.has(p.row.id) && selected ? 4 : 0)), railX = rect.width + (hostRect.width < 760 ? 23 : 38);
        const px = p.p != null && p.p > 0 ? at.x * rect.width : railX;
        const position = new T.Vector3((px - rect.width / 2) * sx, (at.y - .5) * h, 0);
        matrix.compose(position, rotation, new T.Vector3(size * sx, size * sy, 1)); marks.setMatrixAt(i, matrix);
        const color = new T.Color(hitRows.has(p.row.id) && selected ? 0xefae86 : state.comparison === p.row.psi_id ? 0x80c8d5 : state.investigation === p.row.psi_id ? 0xe0a458 : p.layer === 'solid' ? 0xe1ded0 : 0x92b8c9);
        if (!selected) color.multiplyScalar(.24);
        shade.setXYZ(i, color.r, color.g, color.b); shape.setX(i, p.layer === 'solid' ? 0 : 1); hollow.setX(i, p.row.n.p == null ? 1 : 0);
      });
      marks.count = visibleRows.length; marks.instanceMatrix.needsUpdate = true; shade.needsUpdate = shape.needsUpdate = hollow.needsUpdate = true;
      const q = state.q, valid = Number.isFinite(q.p) && q.p > 0 && Number.isFinite(q.o2);
      cabin.visible = core.visible = valid; cabinLabel.hidden = !valid;
      if (valid) {
        const at = { x: x(q.p / KPA_PER_PSI), y: y(q.o2) }, other = q.g !== gravity;
        cabin.position.set((at.x - .5) * w, (at.y - .5) * h, 0); core.position.copy(cabin.position);
        cabin.scale.set(23 * sx, 23 * sy, 1); core.scale.set(23 * sx, 23 * sy, 1); core.visible = !other;
        cabinLabel.dataset.other = String(other); cabinLabel.textContent = other ? `Cabin atmosphere (${q.g_label || q.g})` : 'Your cabin';
        cabinLabel.style.left = `${at.x * 100}%`; cabinLabel.style.bottom = `${at.y * 100}%`;
        if (at.x > .62) cabinLabel.style.transform = 'translate(calc(-100% - 12px),-10px)'; else cabinLabel.style.transform = 'translate(12px,-10px)';
        tolerance.visible = !other;
        const l = x(Math.max(pMin, (q.p - TOL.p) / KPA_PER_PSI)), r = x(Math.max(pMin, (q.p + TOL.p) / KPA_PER_PSI));
        const b = y(Math.max(oMin, q.o2 - TOL.o2)), top = y(Math.min(oMax, q.o2 + TOL.o2));
        tolerance.position.set(((l + r) / 2 - .5) * w, ((b + top) / 2 - .5) * h, 0); tolerance.scale.set((r - l) * w, (top - b) * h, 1);
        fitCabin(at);
      } else { tolerance.visible = false; host.dataset.fieldCabinMarker = 'hidden-invalid'; }
    }
    instrument.updateWorldMatrix(false, true);
    host.dataset.fieldCabin = cabin.position.toArray().map(n => n.toFixed(3)).join(','); host.dataset.fieldCamera = camera.position.toArray().map(n => n.toFixed(3)).join(',');
  }
  function pick(nx, ny) {
      if (!active || !group.visible || !bounds) return null;
      const px = (nx + 1) * bounds.hostWidth / 2 - bounds.left, py = (1 - ny) * bounds.hostHeight / 2 - bounds.top;
      let best = null, distance = PICK_RADIUS_PX;
      for (const p of visibleRows) {
        if (highlightEmpty || selectedIds.length && !selectedIds.includes(p.row.psi_id)) continue;
        const at = point(p), x = p.p != null && p.p > 0 ? at.x * bounds.width : bounds.width + (bounds.hostWidth < 760 ? 23 : 38);
        const d = Math.hypot(px - x, py - (1 - at.y) * bounds.height);
        if (d < distance) { best = p; distance = d; }
      }
      if (!best) { clearHover(); return null; }
      hovered = best; hover.hidden = false;
      const duplicates = visibleRows.filter(p => p.p === best.p && p.o2 === best.o2 && p.layer === best.layer && (p.row.n.p == null) === (best.row.n.p == null)).length;
      hover.textContent = `${best.row.investigation} · ${best.row.fuel || 'fuel not stated'} · ${best.o2}% O₂ · ${best.p == null ? 'pressure not stated' : `${(best.p / KPA_PER_PSI).toFixed(1)} psia${best.row.n.p == null ? ', inferred' : ''}`} · ${duplicates} overlapping row${duplicates === 1 ? '' : 's'}`;
      return { id: best.row.id, kind: 'test', row: best.row };
    }
  return { group, still, update, selectGravity,
    get gravity() { return gravity; },
    pick,
    setVisible(value) { active = value; group.visible = value; overlay.hidden = !value; if (!value) { clearHover(); closeInspection(false); } },
    focusPosition(out, rowId = null) {
      const row = rowId && data.find(p => p.row.id === rowId);
      if (row && bounds) {
        const at = point(row), sx = plate.scale.x / (bounds.width + 130), sy = plate.scale.y / (bounds.height + 94);
        out.set((at.x - .5) * bounds.width * sx, (at.y - .5) * bounds.height * sy, 0);
      } else out.copy(cabin.position);
      instrument.updateWorldMatrix(true, false); return out.applyMatrix4(instrument.matrixWorld).applyMatrix4(group.parent ? group.parent.matrixWorld.clone().invert() : new T.Matrix4());
    },
    get rows() { return data; },
    dispose() {
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointerup', pointerUp, true);
      overlay.remove(); instrument.traverse(object => { for (const item of [object.geometry, ...[object.material].flat()]) if (item && !disposed.has(item)) { item.dispose(); disposed.add(item); } });
    }
  };
}
