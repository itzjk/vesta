const STUDY = 'PSI-69';
const AXES = {
  x: { key: 'initialDiameterMm', label: 'Initial droplet diameter', unit: 'mm' },
  y: { key: 'burnTimeS', label: 'Burn time', unit: 's' },
  z: { key: 'oxygenPercent', label: 'Ambient oxygen', unit: '%' }
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
const valueIn = (field, unit) => field?.unit === unit && finite(field.value) ? field.value : null;
const present = value => value != null && value !== '';
const range = values => values.length ? [Math.min(...values), Math.max(...values)] : null;

export function buildObservationModel({ db, investigationId, fuel = null, selectedRowId = null } = {}) {
  if (investigationId !== STUDY) return { supported: false, investigationId, selectedRowId, points: [] };
  const source = Array.isArray(db?.rowsByPsi?.[STUDY]) ? db.rowsByPsi[STUDY]
    : Array.isArray(db?.tests) ? db.tests : Array.isArray(db?.tests?.tests) ? db.tests.tests : [];
  const rows = source.filter(row => row.psi_id === STUDY);
  const points = [];
  for (const row of rows) {
    const xField = row.conditions?.droplet_diameter_mm, yField = row.outcomes?.burn_time_s;
    const x = valueIn(xField, 'mm'), y = valueIn(yField, 's');
    if (x === null || y === null) continue;
    const z = row.o2_basis === 'ambient' && finite(row.o2_percent) ? row.o2_percent : null;
    const pressure = finite(row.pressure_kpa) ? row.pressure_kpa : null;
    points.push({
      id: row.id, fuel: row.fuel ?? null, x, y, z,
      raw: { x: xField.raw ?? null, y: yField.raw ?? null, z: row.o2_raw ?? null, pressure: row.pressure_raw ?? null },
      provenance: { x: 'reported', y: 'reported', z: z === null ? 'missing' : 'reported-normalized', pressure: pressure === null ? 'missing' : 'reported-normalized' },
      pressureKpa: pressure, diluent: row.diluent ?? null,
      termination: row.outcomes?.test_end?.raw ?? row.outcomes?.test_end?.value ?? null,
      tableFile: row.table_file ?? null, sourceRow: row.row ?? null, row
    });
  }
  const filteredRows = rows.filter(row => fuel === null || row.fuel === fuel);
  const filtered = points.filter(point => fuel === null || point.fuel === fuel);
  const eligible3D = points.filter(point => point.z !== null).length;
  const sourceSelected = rows.find(row => row.id === selectedRowId);
  const selected = filtered.find(point => point.id === selectedRowId) || null;
  return {
    supported: true, investigationId, title: 'FLEX: recorded droplet outcomes',
    axes: Object.fromEntries(Object.entries(AXES).map(([key, axis]) => [key, { ...axis }])),
    totals: { sourceRows: rows.length, eligible2D: points.length, eligible3D },
    filtered: { sourceRows: filteredRows.length, eligible2D: filtered.length, eligible3D: filtered.filter(point => point.z !== null).length },
    excluded: { missingDiameterOrTime: rows.length - points.length, missingAmbientOxygen: points.length - eligible3D },
    fuels: [...new Set(rows.map(row => row.fuel).filter(present))], fuel,
    selectedRowId, selected,
    selection: { sourceExists: !!sourceSelected, inFilter: !!sourceSelected && (fuel === null || sourceSelected.fuel === fuel), eligible2D: !!selected, eligible3D: !!selected && selected.z !== null },
    ranges: { x: range(points.map(point => point.x)), y: range(points.map(point => point.y)), z: range(points.filter(point => point.z !== null).map(point => point.z)) },
    points: filtered
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalized = (value, limits) => !limits || limits[0] === limits[1] ? 0 : (value - limits[0]) / (limits[1] - limits[0]) - .5;

export function projectObservationPoints(model, { mode = '2d', yaw = -.6, pitch = .35, width = 320, height = 240, padding = 18 } = {}) {
  if (!model?.supported) return { points: [], axes: [], mode };
  if (!['2d', '3d'].includes(mode)) throw new TypeError('Observation view must be 2d or 3d.');
  if (![yaw, pitch, width, height, padding].every(finite) || padding < 0 || width <= padding * 2 || height <= padding * 2) throw new TypeError('Invalid observation projection.');
  yaw = clamp(yaw, -Math.PI, Math.PI); pitch = clamp(pitch, -Math.PI / 3, Math.PI / 3);
  const scale = Math.min(width, height) - 2 * padding;
  const project = (x, y, z = 0) => {
    if (mode === '2d') return { x: padding + (x + .5) * (width - 2 * padding), y: height - padding - (y + .5) * (height - 2 * padding), depth: 0 };
    const rx = x * Math.cos(yaw) + z * Math.sin(yaw), rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const ry = y * Math.cos(pitch) - rz * Math.sin(pitch), depth = y * Math.sin(pitch) + rz * Math.cos(pitch);
    return { x: width / 2 + rx * scale / 1.8, y: height / 2 - ry * scale / 1.8, depth };
  };
  const points = model.points.filter(point => mode === '2d' || point.z !== null).map(point => ({
    ...project(normalized(point.x, model.ranges.x), normalized(point.y, model.ranges.y), point.z === null ? 0 : normalized(point.z, model.ranges.z)),
    id: point.id, point
  }));
  if (mode === '3d') points.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  const origin = project(-.5, -.5, mode === '3d' ? -.5 : 0);
  const axes = [
    { key: 'x', from: origin, to: project(.5, -.5, mode === '3d' ? -.5 : 0) },
    { key: 'y', from: origin, to: project(-.5, .5, mode === '3d' ? -.5 : 0) }
  ];
  if (mode === '3d') axes.push({ key: 'z', from: origin, to: project(-.5, -.5, .5) });
  return { points, axes, mode, yaw, pitch, width, height, padding };
}

const CSS = `
.wc-source:has(.observation-lens){scroll-padding-top:64px}
.wc-source:has(.observation-lens) .wc-dismiss{position:sticky;top:-24px;z-index:3;width:calc(100% + 60px);margin-left:-30px;padding:12px 30px;text-align:right;background:var(--bg-0,#111718);box-shadow:0 0 0 100vmax var(--bg-0,#111718);clip-path:inset(-40px -100vmax -6px)}
@media(max-width:759px){.wc-source:has(.observation-lens) .wc-dismiss{top:-16px;width:calc(100% + 40px);margin-left:-20px;padding-inline:20px}}
.observation-lens.observation-lens{margin:20px 0;border-block:1px solid #c2b79a40;padding:12px 0;color:#f1e9d8;min-width:0}
.observation-lens.observation-lens.observation-lens :is(p,label,button,select,dt,dd,summary){font:400 16px/1.45 var(--font-body,'Source Sans 3',sans-serif)!important;letter-spacing:normal;box-sizing:border-box}
.observation-lens.observation-lens.observation-lens p{margin:8px 0}
.observation-lens.observation-lens.observation-lens summary{min-height:44px;padding:10px 0;cursor:pointer;color:#f1e9d8}
.observation-lens.observation-lens.observation-lens :is(button,select){min-height:44px;max-width:100%;color:#f1e9d8}
.observation-lens.observation-lens.observation-lens button{padding:8px 10px;background:#232d30;border:1px solid #b9b39c55;border-radius:4px;cursor:pointer}
.observation-lens.observation-lens.observation-lens select{display:block;width:100%;padding:8px;background:#202a2d;border:1px solid #b9b39c77;border-radius:4px}
.observation-lens.observation-lens.observation-lens label{display:block;margin:12px 0 4px}
.observation-lens.observation-lens.observation-lens :focus-visible{outline:2px solid #e0a458;outline-offset:3px}
.observation-lens.observation-lens.observation-lens .ol-muted{color:#c4c0b7}
.observation-lens.observation-lens.observation-lens .ol-small{font-size:14px!important}
.observation-lens .ol-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
.observation-lens.observation-lens.observation-lens button[aria-pressed=true]{border-color:#e0a458;background:#663b2c}
.observation-lens .ol-plot{background:#e9e2d3;border-radius:5px;padding:10px;color:#253135;margin:12px 0}
.observation-lens.observation-lens.observation-lens .ol-plot p{color:#253135;font-size:14px!important;margin:0}
.observation-lens .ol-chart-row{display:grid;grid-template-columns:38px minmax(0,1fr);gap:4px}
.observation-lens .ol-y-range{display:flex;flex-direction:column;justify-content:space-between;padding:14px 0;font:13px/1.3 var(--font-body,'Source Sans 3',sans-serif);color:#253135}
.observation-lens .ol-svg{display:block;width:100%;height:auto;aspect-ratio:4/3;overflow:visible}
.observation-lens[data-mode=3d] .ol-svg{touch-action:none;cursor:grab}
.observation-lens .ol-x-range{display:flex;justify-content:space-between;margin-left:42px;font:13px/1.3 var(--font-body,'Source Sans 3',sans-serif);color:#253135}
.observation-lens .ol-plot .ol-plot-scope{margin-bottom:6px!important}
.observation-lens[data-mode=3d] .ol-svg{width:min(100%,300px);margin-inline:auto}
.observation-lens .ol-legend{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0;font:14px/1.4 var(--font-body,'Source Sans 3',sans-serif)}
.observation-lens .ol-swatch{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:baseline}
.observation-lens .ol-values{display:grid;grid-template-columns:minmax(110px,.9fr) minmax(0,1.1fr);gap:6px 12px;margin:8px 0}
.observation-lens.observation-lens.observation-lens .ol-values :is(dt,dd){margin:0;overflow-wrap:anywhere}
.observation-lens .ol-values dt{color:#c4c0b7}
.observation-lens .ol-readout{border-top:1px solid #c2b79a40;margin-top:16px;padding-top:8px}
.observation-lens .ol-readout strong{display:block;font:600 17px/1.4 var(--font-body,'Source Sans 3',sans-serif);overflow-wrap:anywhere}
.observation-lens.observation-lens.observation-lens .ol-source .world-cite{display:inline-flex;align-items:center;min-height:44px;padding:8px 0;background:none;border:0;border-radius:0;text-decoration:underline;text-underline-offset:4px;text-align:left}
.observation-lens .ol-original{display:inline-flex;align-items:center;min-height:44px;color:#d6be91;text-underline-offset:4px}
.observation-lens.observation-lens [hidden]{display:none!important}
`;

const NS = 'http://www.w3.org/2000/svg';
const rangeNumber = value => Number(value.toFixed(3)).toString();

export function renderObservationLens({ row, db, text = {}, cite } = {}) {
  const initial = buildObservationModel({ db, investigationId: row?.psi_id, selectedRowId: row?.id });
  if (!initial.supported) return null;
  const doc = globalThis.document;
  if (!doc) throw new Error('Observation lens rendering requires a document.');
  const node = (tag, value, cls) => {
    const element = doc.createElement(tag);
    if (value != null) element.textContent = value;
    if (cls) element.className = cls;
    return element;
  };
  const svgNode = (tag, attributes = {}) => {
    const element = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  };
  const root = node('section', null, 'observation-lens'); root.dataset.mode = '2d';
  root.setAttribute('aria-label', 'FLEX recorded outcome exploration');
  const style = node('style', CSS);
  const intro = node('p', `${initial.totals.eligible2D} of ${initial.totals.sourceRows} FLEX liquid-droplet rows have recorded diameter and burn time. This example is excluded from cabin-material coverage.`, 'ol-small ol-muted');
  const explore = node('details'), summary = node('summary', 'Explore the recorded outcomes');
  const content = node('div'); explore.append(summary, content); root.append(style, intro, explore);
  content.append(node('p', 'Liquid-droplet evidence, not cabin-material certification. Recorded outcomes, not a prediction. Other conditions vary.', 'ol-muted'));
  let fuel = null, selectedId = row.id, mode = '2d', yaw = -.6, pitch = .35, model = initial, projection, built = false;
  let drag = null, lastDragPaint = 0;
  const colors = new Map(initial.fuels.map((value, index) => [value, ['#334e5c', '#a65132'][index % 2]]));
  const button = (label, fn, parent) => {
    const element = node('button', label); element.type = 'button'; element.addEventListener('click', fn); parent.append(element); return element;
  };
  const labelSelect = (label, parent) => {
    const wrapper = node('label', label), select = node('select'); wrapper.append(select); parent.append(wrapper); return select;
  };
  const option = (value, label) => { const element = node('option', label); element.value = value; return element; };
  const fuelSelect = labelSelect('Fuel', content);
  fuelSelect.append(option('', 'All recorded fuels'), ...initial.fuels.map(value => option(value, value)));
  const views = node('div', null, 'ol-toolbar'); views.setAttribute('aria-label', 'Observation view'); content.append(views);
  const view2D = button('2D reading', () => changeMode('2d'), views);
  const view3D = button('Explore 3D', () => changeMode('3d'), views);
  const counts = node('p', null, 'ol-small ol-muted'); counts.setAttribute('role', 'status'); content.append(counts);
  const plot = node('div', null, 'ol-plot');
  const axisTitle = node('p'), chartRow = node('div', null, 'ol-chart-row'), yRange = node('div', null, 'ol-y-range');
  const yMax = node('span'), yMin = node('span'); yRange.append(yMax, yMin);
  const svg = svgNode('svg', { viewBox: '0 0 320 240', class: 'ol-svg', role: 'img', tabindex: '0', 'aria-label': 'Recorded FLEX outcomes. Use Choose a record below for exact values and source access.' });
  const grid = svgNode('g'), axes = svgNode('g'), marks = svgNode('g'); svg.append(grid, axes, marks);
  chartRow.append(yRange, svg);
  const xRange = node('div', null, 'ol-x-range'), xMin = node('span'), xMax = node('span'); xRange.append(xMin, xMax);
  const xTitle = node('p'); plot.append(axisTitle, node('p', 'Outside cabin-material coverage.', 'ol-plot-scope'), chartRow, xRange, xTitle); content.append(plot);
  const legend = node('div', null, 'ol-legend');
  for (const value of initial.fuels) { const item = node('span'), swatch = node('i', null, 'ol-swatch'); swatch.style.background = colors.get(value); swatch.setAttribute('aria-hidden', 'true'); item.append(swatch, doc.createTextNode(value)); legend.append(item); }
  content.append(legend);
  const rotate = node('div', null, 'ol-toolbar'); rotate.setAttribute('aria-label', 'Rotate recorded data');
  const rotateBy = (x, y) => { overlap.hidden = true; yaw = clamp(yaw + x, -Math.PI, Math.PI); pitch = clamp(pitch + y, -Math.PI / 3, Math.PI / 3); draw(); };
  button('Rotate left', () => rotateBy(-.18, 0), rotate);
  button('Rotate right', () => rotateBy(.18, 0), rotate);
  button('Tilt up', () => rotateBy(0, .15), rotate);
  button('Tilt down', () => rotateBy(0, -.15), rotate);
  button('Reset view', () => { overlap.hidden = true; yaw = -.6; pitch = .35; draw(); }, rotate);
  content.append(rotate);
  const viewNote = node('p', null, 'ol-small ol-muted'); content.append(viewNote);
  const recordSelect = labelSelect('Choose a record (all overlapping points included)', content);
  const overlap = node('div'), overlapSelect = labelSelect('Records overlapping this mark', overlap); overlap.hidden = true; content.append(overlap);
  const readout = node('div', null, 'ol-readout'); readout.setAttribute('aria-live', 'polite'); content.append(readout);
  const exclusions = node('details'), exclusionTitle = node('summary', 'What is plotted?');
  exclusions.append(exclusionTitle, node('p', `${initial.excluded.missingDiameterOrTime} source rows lack a numeric initial diameter in mm or burn time in s. ${initial.excluded.missingAmbientOxygen} additional plotted rows lack numeric ambient oxygen for 3D.`, 'ol-small ol-muted'),
    node('p', 'Rows are not established independent burns. Axis ranges stay fixed to this study; no curve, causal effect or uncertainty estimate is calculated. Ambient oxygen is an experimental condition. Other conditions vary.', 'ol-small ol-muted'));
  content.append(exclusions);
  const circles = new Map();

  function select(id) { selectedId = id || null; refresh(false); }
  function changeMode(value) { mode = value; root.dataset.mode = mode; overlap.hidden = true; refresh(true); }
  function refresh(rebuildOptions) {
    model = buildObservationModel({ db, investigationId: row.psi_id, fuel, selectedRowId: selectedId });
    const visible = model.points.filter(point => mode === '2d' || point.z !== null);
    if (rebuildOptions) recordSelect.replaceChildren(option('', 'Select a plotted record'), ...visible.map(point => option(point.id, `${point.id} · ${point.fuel || 'Fuel not reported'} · ${point.x} mm / ${point.y} s`)));
    recordSelect.value = visible.some(point => point.id === selectedId) ? selectedId : '';
    counts.textContent = `Showing ${visible.length} ${mode === '3d' ? '3D' : '2D'} rows; ${model.totals.eligible2D} have diameter and burn time from ${model.totals.sourceRows} source rows. Filter: ${fuel || 'all fuels'}.`;
    view2D.setAttribute('aria-pressed', String(mode === '2d')); view3D.setAttribute('aria-pressed', String(mode === '3d'));
    rotate.hidden = mode !== '3d'; yRange.hidden = xRange.hidden = mode === '3d';
    chartRow.style.gridTemplateColumns = mode === '3d' ? 'minmax(0,1fr)' : '';
    axisTitle.textContent = mode === '2d' ? 'FLEX liquid droplets · burn time (s)' : 'FLEX liquid droplets · recorded 3D outcomes';
    xTitle.textContent = mode === '2d' ? 'Initial droplet diameter (mm)' : 'X: diameter (mm) · Y: burn time (s) · Z: ambient oxygen (%)';
    if (model.ranges.x) { xMin.textContent = rangeNumber(model.ranges.x[0]); xMax.textContent = rangeNumber(model.ranges.x[1]); }
    if (model.ranges.y) { yMin.textContent = rangeNumber(model.ranges.y[0]); yMax.textContent = rangeNumber(model.ranges.y[1]); }
    viewNote.textContent = mode === '2d' ? 'Select a point or choose any record below. The readout preserves exact recorded values.'
      : `Drag or use arrow keys and rotation buttons. X ${model.ranges.x?.join('–') || 'unavailable'} mm; Y ${model.ranges.y?.join('–') || 'unavailable'} s; Z ${model.ranges.z?.join('–') || 'unavailable'}%. Scaling is visual, not physical distance. Use 2D for precise reading.`;
    draw(); renderReadout();
  }
  function draw() {
    projection = projectObservationPoints(model, { mode, yaw, pitch });
    grid.replaceChildren(); axes.replaceChildren();
    if (mode === '2d') for (let i = 0; i <= 4; i++) {
      const x = 18 + i * 284 / 4, y = 18 + i * 204 / 4;
      grid.append(svgNode('line', { x1: x, x2: x, y1: 18, y2: 222, stroke: '#25313522' }), svgNode('line', { x1: 18, x2: 302, y1: y, y2: y, stroke: '#25313522' }));
    }
    const labelPositions = [];
    for (const axis of projection.axes) {
      const line = svgNode('line', { x1: axis.from.x, y1: axis.from.y, x2: axis.to.x, y2: axis.to.y, stroke: axis.key === 'z' ? '#a65132' : '#334e5c', 'stroke-width': 1.5 });
      const title = svgNode('title'); title.textContent = `${axis.key.toUpperCase()}: ${AXES[axis.key].label} (${AXES[axis.key].unit})`; line.append(title); axes.append(line);
      for (const endpoint of [axis.from, axis.to]) axes.append(svgNode('circle', { cx: endpoint.x, cy: endpoint.y, r: 2, fill: axis.key === 'z' ? '#a65132' : '#334e5c' }));
      if (mode === '3d') {
        const x = clamp(axis.to.x + 5, 8, 298), preferred = clamp(axis.to.y - 5, 22, 230);
        const y = [0, 28, -28, 56, -56].map(offset => preferred + offset).find(value => value >= 22 && value <= 230 && !labelPositions.some(other => Math.abs(x - other.x) < 24 && Math.abs(value - other.y) < 24)) ?? preferred;
        labelPositions.push({ x, y });
        if (Math.abs(y - preferred) > 1) axes.append(svgNode('line', { x1: axis.to.x, y1: axis.to.y, x2: x, y2: y - 10, stroke: axis.key === 'z' ? '#a65132' : '#334e5c', 'stroke-width': .7 }));
        const label = svgNode('text', { x, y, fill: '#253135', 'font-size': 20, 'font-family': 'sans-serif', 'aria-hidden': 'true' });
        label.textContent = axis.key.toUpperCase(); axes.append(label);
      }
    }
    const current = new Set(projection.points.map(point => point.id));
    for (const [id, circle] of circles) if (!current.has(id)) { circle.remove(); circles.delete(id); }
    for (const position of projection.points) {
      let circle = circles.get(position.id);
      if (!circle) { circle = svgNode('circle', { 'data-row-id': position.id }); circles.set(position.id, circle); }
      const selected = position.id === selectedId;
      circle.setAttribute('cx', position.x); circle.setAttribute('cy', position.y);
      circle.setAttribute('r', selected ? 5 : 3.3);
      circle.setAttribute('fill', colors.get(position.point.fuel) || '#334e5c');
      circle.setAttribute('fill-opacity', selected ? 1 : .72);
      circle.setAttribute('stroke', selected ? '#171c1e' : 'none'); circle.setAttribute('stroke-width', 2);
      marks.append(circle);
    }
    if (circles.has(selectedId)) marks.append(circles.get(selectedId));
  }
  function renderReadout() {
    readout.replaceChildren();
    const point = model.selected;
    if (!point) {
      const reason = !selectedId ? 'Choose a plotted record to read its exact values.' : !model.selection.sourceExists ? 'The selected record is not in this study.'
        : !model.selection.inFilter ? 'The selected source row is outside this fuel filter. Choose a plotted record or restore all fuels.'
        : `${selectedId} is not plotted: initial diameter or burn time is missing or has unsupported units. Its original source details remain in this card.`;
      readout.append(node('p', reason, 'ol-muted')); return;
    }
    readout.append(node('strong', `${point.id} · ${point.fuel || 'Fuel not reported'}`));
    const values = node('dl', null, 'ol-values');
    const field = (label, value) => values.append(node('dt', label), node('dd', value));
    field('Initial diameter', `${point.x} mm`); field('Burn time', `${point.y} s`);
    field('Ambient oxygen', point.z === null ? 'Not reported as a numeric ambient value' : `${point.z}% · normalized from the reported composition`);
    field('Pressure', point.pressureKpa === null ? 'Not reported; not inferred here' : `${point.pressureKpa} kPa · normalized from the reported pressure`);
    field('Diluent', present(point.diluent) ? point.diluent : text.NOT_IN_TABLE || 'Not reported');
    field('Termination', present(point.termination) ? String(point.termination) : text.NOT_IN_TABLE || 'Not reported');
    readout.append(values);
    if (mode === '3d' && point.z === null) readout.append(node('p', 'This selected row remains available in 2D; it has no numeric ambient oxygen and is not drawn in 3D.', 'ol-muted'));
    const raw = node('details'); raw.append(node('summary', 'Reported cells and source row'));
    const rawValues = node('dl', null, 'ol-values');
    for (const [label, value] of [['Diameter cell (mm)', point.raw.x], ['Burn-time cell (s)', point.raw.y], ['Oxygen cell (mole fraction)', point.raw.z], ['Pressure cell (mmHg)', point.raw.pressure], ['Table file', point.tableFile], ['Table row', point.sourceRow]]) rawValues.append(node('dt', label), node('dd', present(value) ? String(value) : 'Empty or unavailable cell'));
    raw.append(rawValues); readout.append(raw);
    if (typeof cite === 'function') { const source = node('div', null, 'ol-source'); source.append(cite(`Open original source row ${point.id}`, point.id)); readout.append(source); }
    const url = db?.invById?.[STUDY]?.psi_url;
    if (typeof url === 'string' && /^https:\/\//i.test(url)) { const link = node('a', 'Open the NASA PSI investigation ↗', 'ol-original'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; readout.append(link); }
  }
  function plotPoint(event) {
    const rect = svg.getBoundingClientRect();
    return rect.width && rect.height ? { x: (event.clientX - rect.left) * 320 / rect.width, y: (event.clientY - rect.top) * 240 / rect.height, rect } : null;
  }
  function chooseAt(event, hitId = null) {
    const point = plotPoint(event); if (!point || !projection.points.length) return;
    const distances = projection.points.map(value => ({ value, distance: Math.hypot(value.x - point.x, value.y - point.y) })).sort((a,b) => a.distance - b.distance);
    const hit = projection.points.find(value => value.id === hitId);
    if (!hit && distances[0].distance > Math.max(12, 18 * 320 / point.rect.width)) return;
    const chosen = hit || distances[0].value;
    const overlapping = projection.points.filter(value => Math.hypot(value.x - chosen.x, value.y - chosen.y) < 7);
    select(chosen.id);
    overlap.hidden = overlapping.length < 2;
    if (!overlap.hidden) { overlapSelect.replaceChildren(...overlapping.map(value => option(value.id, `${value.id} · ${value.point.fuel} · ${value.point.x} mm / ${value.point.y} s`))); overlapSelect.value = chosen.id; }
  }
  fuelSelect.addEventListener('change', () => { fuel = fuelSelect.value || null; overlap.hidden = true; refresh(true); });
  recordSelect.addEventListener('change', () => { overlap.hidden = true; select(recordSelect.value); });
  overlapSelect.addEventListener('change', () => select(overlapSelect.value));
  svg.addEventListener('keydown', event => {
    if (mode !== '3d') return;
    const delta = { ArrowLeft: [-.18,0], ArrowRight: [.18,0], ArrowUp: [0,.15], ArrowDown: [0,-.15] }[event.key];
    if (delta) { event.preventDefault(); event.stopPropagation(); rotateBy(...delta); }
    else if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); overlap.hidden = true; yaw = -.6; pitch = .35; draw(); }
  });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, moved: false, hitId: event.target?.closest?.('[data-row-id]')?.getAttribute('data-row-id') || null };
    if (mode === '3d') svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (mode !== '3d' || !drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx,dy) < 5 && !drag.moved) return;
    drag.moved = true; overlap.hidden = true; yaw = clamp(drag.yaw + dx * .009, -Math.PI, Math.PI); pitch = clamp(drag.pitch - dy * .009, -Math.PI/3, Math.PI/3);
    if (event.timeStamp - lastDragPaint >= 32) { lastDragPaint = event.timeStamp; draw(); }
  });
  svg.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { moved, hitId } = drag; drag = null;
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (moved) draw(); else chooseAt(event, hitId);
  });
  const cancelDrag = () => { drag = null; };
  svg.addEventListener('pointercancel', cancelDrag); svg.addEventListener('lostpointercapture', cancelDrag);
  explore.addEventListener('toggle', () => { if (explore.open && !built) { built = true; refresh(true); } });
  return root;
}
