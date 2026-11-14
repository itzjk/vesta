
export const KPA_PER_PSI = 6.89476;
export const AXIS = { p: [20, 110], o2: [10, 100] };

export const LAYERS = [
  { id: 'solid',   label: 'solid cabin materials', short: 'solids',   model: false },
  { id: 'droplet', label: 'liquid droplets',       short: 'droplets', model: true, fuel_class: 'liquid_droplet' },
  { id: 'gas',     label: 'gas burners',           short: 'gas',      model: true, fuel_class: 'gas' },
];
export const MODEL_NOTE = 'model fuels: a different fuel class from cabin materials';

const r1 = x => Math.round(x * 10) / 10;
const uniq = a => [...new Set(a)];

export function mapData(db, show = ['solid']) {
  const layers = {}, points = [];
  for (const L of LAYERS) {
    const pool = L.model ? db.tests.filter(r => r.n.counts && !r.n.cabin && r.n.fuel_class === L.fuel_class) : db.cabinRows;
    const withO2 = pool.filter(r => r.n.o2 != null);
    const st = layers[L.id] = { id: L.id, on: show.includes(L.id), rows: pool.length, with_o2: withO2.length, without_o2: pool.length - withO2.length, off_axis: 0, plotted: 0, points: 0 };
    if (!st.on) continue;
    const by = new Map();
    for (const r of withO2) {
      const p = r.n.p ?? r.n.p_inferred ?? null, inferred = r.n.p == null && r.n.p_inferred != null;
      if (p != null && (p < AXIS.p[0] || p > AXIS.p[1])) { st.off_axis++; continue; }
      const key = `${r.n.o2}|${p == null ? 'rail' : p}|${inferred ? 'i' : 'r'}`;
      let pt = by.get(key);
      if (!pt) by.set(key, pt = { layer: L.id, o2: r.n.o2, p, inferred, rail: p == null, n: 0, rows: [] });
      pt.n++; pt.rows.push(r); st.plotted++;
    }
    st.points = by.size;
    points.push(...by.values());
  }
  points.sort((a, b) => b.n - a.n);
  const burner = db.tests.filter(r => r.o2_basis === 'burner_stream');
  const burnerValues = burner.map(r => r.o2_percent).filter(v => typeof v === 'number');
  const multi = db.tests.filter(r => r.multi && r.multi.o2_percent);
  return { layers, points,
    burner: { n: burner.length, max: burnerValues.length ? Math.max(...burnerValues) : null, names: uniq(burner.map(r => r.investigation)) },
    multi: { n: multi.length, names: uniq(multi.map(r => r.investigation)) } };
}

export function drawMap(ui, host, m) {
  const s = ui.svg, T = m.text;
  const W = Math.max(560, Math.round(host.clientWidth) || 860), H = Math.max(230, Math.round(host.clientHeight) || 330);
  const L = 60, RAIL = 44, R = RAIL + 34, TOP = 20, B = 48;
  const PW = W - L - R, PH = H - TOP - B, [p0, p1] = AXIS.p, [o0, o1] = AXIS.o2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const x = p => L + (p - p0) / (p1 - p0) * PW, y = o => TOP + (o1 - o) / (o1 - o0) * PH;
  const railX = L + PW + 14 + RAIL / 2;
  const psia = kpa => r1(kpa / KPA_PER_PSI);
  const pText = kpa => (T && T.pressure ? T.pressure(kpa) : `${psia(kpa)} psia (${r1(kpa)} kPa)`);

  const root = s('svg.dzm', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': 'Tested envelope: oxygen percent by volume against pressure, one mark per distinct point of the PSI test rows, with the design point of the cabin' });
  root.append(s('defs',
    s('pattern', { id: 'dzm-hatch', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 9, class: 'dzm-hatch-line' }))));

  const grid = s('g.dzm-grid');
  grid.append(s('rect.dzm-plot', { x: L, y: TOP, width: PW, height: PH, rx: 6 }));
  for (const o of [20, 40, 60, 80, 100]) grid.append(s('line.dzm-gridline', { x1: L, x2: L + PW, y1: y(o), y2: y(o) }), s('text.dzm-tick', { x: L - 10, y: y(o) + 5, 'text-anchor': 'end' }, String(o)));
  for (const p of [20, 40, 60, 80, 100]) grid.append(s('line.dzm-gridline', { x1: x(p), x2: x(p), y1: TOP, y2: TOP + PH }), s('text.dzm-tick', { x: x(p), y: TOP + PH + 18, 'text-anchor': 'middle' }, String(p)));
  for (const ps of [4, 6, 8, 10, 12, 14]) { const px = x(ps * KPA_PER_PSI);
    grid.append(s('line.dzm-minor', { x1: px, x2: px, y1: TOP + PH, y2: TOP + PH + 5 }), s('text.dzm-tick.dzm-tick-dim', { x: px, y: TOP + PH + 37, 'text-anchor': 'middle' }, String(ps))); }
  grid.append(s('text.dzm-axis', { x: L - 10, y: TOP + PH + 18, 'text-anchor': 'end' }, 'kPa'), s('text.dzm-axis', { x: L - 10, y: TOP + PH + 37, 'text-anchor': 'end' }, 'psia'),
    s('text.dzm-axis', { x: 16, y: TOP + PH / 2, 'text-anchor': 'middle', transform: `rotate(-90 16 ${TOP + PH / 2})` }, 'oxygen % by volume'));
  root.append(grid);

  const info = rec => () => m.onInfo && m.onInfo(rec);
  const hover = (node, rec) => { node.addEventListener('mouseenter', info(rec)); node.addEventListener('focus', info(rec)); node.addEventListener('mouseleave', info(null)); node.addEventListener('blur', info(null)); node.addEventListener('click', () => { info(rec)(); if (m.onOpen) m.onOpen(rec.id); }); node.setAttribute('role', 'button'); node.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (m.onOpen) m.onOpen(rec.id); } }); return node; };
  const titleOf = rec => { const src = rec.sources && rec.sources[0]; return src ? `${rec.label}: "${src.quote}"` : rec.label; };

  for (const b of m.bands || []) {
    if (b.o2_min == null || b.p_max_kpa == null) continue;
    const bx = x(p0), bw = x(clamp(b.p_max_kpa, p0, p1)) - bx, by = y(o1), bh = y(clamp(b.o2_min, o0, o1)) - by;
    root.append(hover(s('g.dzm-band', { tabindex: 0, data: { marker: b.id, claim: b.id, cite: b.id } }, s('title', titleOf(b)),
      s('rect.dzm-band-fill', { x: bx, y: by, width: bw, height: bh }), s('rect', { x: bx, y: by, width: bw, height: bh, fill: 'url(#dzm-hatch)' }),
      s('path.dzm-band-edge', { d: `M${bx} ${by + bh}H${bx + bw}V${by}` }),
      s('text.dzm-band-label', { x: bx + 14, y: by + 60 }, 'CHALLENGE-PAGE BAND'), s('text.dzm-note', { x: bx + 14, y: by + 79 }, b.label || '')), b));
  }

  for (const k of m.markers || []) {
    if (k.p_kpa == null || k.p_kpa < p0 || k.p_kpa > p1) continue;
    const mx = x(k.p_kpa), g = s('g.dzm-marker', { tabindex: 0, data: { marker: k.id, claim: k.id, cite: k.id } }, s('title', titleOf(k)));
    if (Array.isArray(k.o2_range)) {
      const [a, b] = k.o2_range, ya = y(a), yb = y(b);
      g.append(s('path.dzm-marker-line', { d: `M${mx} ${ya}V${yb}M${mx - 5} ${ya}h10M${mx - 5} ${yb}h10` }),
        s('text.dzm-marker-label', { x: mx + 12, y: yb - 65 }, `${k.label} ${a} to ${b} %, ${k.p_display}`));
    } else if (k.o2 != null) {
      const my = y(k.o2), right = mx < L + PW * 0.3;
      g.append(s('path.dzm-marker-x', { d: `M${mx - 5} ${my - 5}l10 10M${mx + 5} ${my - 5}l-10 10` }),
        s('text.dzm-marker-label', { x: right ? mx + 12 : mx - 12, y: my + (k.o2 >= o1 ? 16 : k.id === 'shuttle' ? 27 : 5), 'text-anchor': right ? 'start' : 'end' }, `${k.label} ${k.o2} %, ${k.p_display}`));
    } else {
      g.append(s('line.dzm-marker-rule', { x1: mx, x2: mx, y1: TOP, y2: TOP + PH }), s('text.dzm-marker-label', { x: mx - 8, y: TOP + 16, 'text-anchor': 'end' }, `${k.label} ${k.p_display}`));
    }
    root.append(hover(g, k));
  }

  const railRows = m.data.points.filter(pt => pt.rail).reduce((a, pt) => a + pt.n, 0);
  root.append(s('g.dzm-rail', s('title', `${railRows} plotted rows state an oxygen value and no pressure: pressure is not in the table`),
    s('rect.dzm-rail-bg', { x: railX - RAIL / 2, y: TOP, width: RAIL, height: PH, rx: 6 }),
    s('text.dzm-tick', { x: railX, y: TOP + PH + 18, 'text-anchor': 'middle' }, 'n.r.'), s('text.dzm-tick.dzm-tick-dim', { x: railX, y: TOP + PH + 37, 'text-anchor': 'middle' }, 'n.r.')));

  const pos = pt => [pt.rail ? railX : x(pt.p), y(pt.o2)];
  const dots = s('g.dzm-dots');
  const sel = m.sel && m.sel.material ? m.sel : null;
  const isSel = pt => !!sel && pt.rows.some(r => r.n.material_id === sel.material && (r.n.pillars || []).includes(sel.concern));
  let drawn = 0;
  for (const pt of m.data.points) {
    const [cx, cy] = pos(pt), rr = Math.min(10, 3 + 1.7 * Math.sqrt(pt.n)), picked = isSel(pt);
    const names = uniq(pt.rows.map(r => r.investigation)).join(', '), fuels = uniq(pt.rows.map(r => r.fuel).filter(Boolean)).slice(0, 4).join(', ');
    const where = pt.rail ? 'pressure not in the table' : pt.inferred ? `${pText(pt.p)}, inferred from the facility` : pText(pt.p);
    const cls = `dzm-dot dzm-${pt.layer}${pt.inferred || pt.rail ? ' is-hollow' : ''}${picked ? ' is-sel' : sel && pt.layer === 'solid' ? ' is-other' : ''}`;
    const attrs = { class: cls, tabindex: 0, role: 'button', data: { cite: pt.rows[0].id, claim: pt.rows[0].id, n: pt.n, layer: pt.layer } };
    const shape = pt.layer === 'droplet' ? s('path', { ...attrs, d: `M${cx} ${cy - rr}L${cx + rr} ${cy}L${cx} ${cy + rr}L${cx - rr} ${cy}Z` })
                : pt.layer === 'gas' ? s('rect', { ...attrs, x: cx - rr * 0.8, y: cy - rr * 0.8, width: rr * 1.6, height: rr * 1.6, rx: 1.5 })
                : s('circle', { ...attrs, cx, cy, r: rr });
    shape.append(s('title', `${names}${fuels ? ' · ' + fuels : ''} · ${pt.o2} % O2 · ${where} · ${pt.n} ${pt.n === 1 ? 'row' : 'rows'} (click: first row)`));
    shape.addEventListener('click', () => m.onOpen && m.onOpen(pt.rows[0].id));
    shape.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (m.onOpen) m.onOpen(pt.rows[0].id); } });
    dots.append(shape); drawn++;
  }
  root.append(dots);
  if (!drawn) {
    const on = LAYERS.filter(l => m.data.layers[l.id].on), without = on.reduce((a, l) => a + m.data.layers[l.id].without_o2, 0), off = on.reduce((a, l) => a + m.data.layers[l.id].off_axis, 0);
    root.append(s('g.dzm-empty', { data: { empty: 'map' } },
      s('text.dzm-empty-text', { x: L + PW / 2, y: TOP + PH / 2 + 60, 'text-anchor': 'middle' }, 'No row with an oxygen value for this selection.'),
      s('text.dzm-note', { x: L + PW / 2, y: TOP + PH / 2 + 82, 'text-anchor': 'middle' },
        on.length ? `${without} rows of the selected layers state no oxygen value${off ? `; ${off} lie outside this pressure axis` : ''}.` : 'No layer is selected.')));
  }

  const tol = m.tol || { o2: 1, p: 5 };
  const link = s('line.dzm-link'), ring = s('circle.dzm-nearest', { r: 13 });
  const hx = s('line.dzm-hair'), hy = s('line.dzm-hair'), box = s('rect.dzm-tol', { rx: 2 });
  const core = s('g.dzm-core', s('circle.dzm-core-ring', { r: 11 }), s('circle.dzm-core-dot', { r: 4.5 }));
  const label = s('text.dzm-point-label'), sub = s('text.dzm-point-sub');
  const point = s('g.dzm-point', { data: { point: 'cabin' } }, s('title', 'The design point of your cabin, with the tolerance box of the PROVEN test'), link, ring, hx, hy, box, core, label, sub);
  root.append(point);

  function setPoint(q, nearest) {
    const ok = q && q.o2 != null && q.p != null;
    point.style.display = ok ? '' : 'none';
    if (!ok) return;
    const px = x(clamp(q.p, p0, p1)), py = y(clamp(q.o2, o0, o1));
    hx.setAttribute('x1', L); hx.setAttribute('x2', L + PW); hx.setAttribute('y1', py); hx.setAttribute('y2', py);
    hy.setAttribute('y1', TOP); hy.setAttribute('y2', TOP + PH); hy.setAttribute('x1', px); hy.setAttribute('x2', px);
    const bx0 = x(clamp(q.p - tol.p, p0, p1)), bx1 = x(clamp(q.p + tol.p, p0, p1)), by0 = y(clamp(q.o2 + tol.o2, o0, o1)), by1 = y(clamp(q.o2 - tol.o2, o0, o1));
    box.setAttribute('x', bx0); box.setAttribute('y', by0); box.setAttribute('width', Math.max(0, bx1 - bx0)); box.setAttribute('height', Math.max(0, by1 - by0));
    core.setAttribute('transform', `translate(${px} ${py})`);
    const left = px > L + PW * 0.62, up = py > TOP + 64;
    const lx = left ? px - 18 : px + 18, ly = up ? py - 32 : py + 30;
    label.setAttribute('x', lx); label.setAttribute('y', ly); label.setAttribute('text-anchor', left ? 'end' : 'start'); label.textContent = 'YOUR CABIN';
    sub.setAttribute('x', lx); sub.setAttribute('y', ly + 17); sub.setAttribute('text-anchor', left ? 'end' : 'start');
    sub.textContent = `${r1(q.o2)} % O2 · ${psia(q.p)} psia${q.g_label ? ' · ' + q.g_label : ''}`;
    const n = nearest && nearest.n, np = n ? (n.p ?? n.p_inferred ?? null) : null;
    const show = !!(n && n.o2 != null && (np == null || (np >= p0 && np <= p1)));
    link.style.display = ring.style.display = show ? '' : 'none';
    if (show) { const nx = np == null ? railX : x(np), ny = y(n.o2);
      link.setAttribute('x1', px); link.setAttribute('y1', py); link.setAttribute('x2', nx); link.setAttribute('y2', ny);
      ring.setAttribute('cx', nx); ring.setAttribute('cy', ny); }
  }
  setPoint(m.q, m.nearest);
  return { node: root, setPoint, size: { W, H } };
}
