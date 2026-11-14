// A telemetry channel as a step line (the player holds the last frame: no interpolation) with a marker at the current time.
import { svg } from './el.js';

/** spark([[t, v], ...] | [{ t, v }] | [v, ...], t, { width, height, min, max, threshold, from, to }) -> <svg class="spark"> */
export function spark(values, t, opts = {}) {
  const pts = (values || []).map((x, i) => Array.isArray(x) ? [x[0], x[1]] : x && typeof x === 'object' ? [x.t, x.v ?? x.value] : [i, x]).filter(p => typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[1]));
  const w = opts.width || 220, h = opts.height || 44, pad = 4;
  const s = svg('svg.spark', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'aria-label': opts.label || 'telemetry channel', preserveAspectRatio: 'none' });
  if (!pts.length) return s;
  const t0 = opts.from ?? pts[0][0], t1 = opts.to ?? pts[pts.length - 1][0];
  const vs = pts.map(p => p[1]);
  let lo = opts.min ?? Math.min(...vs), hi = opts.max ?? Math.max(...vs, opts.threshold ?? -Infinity);
  if (hi === lo) { hi = lo + 1; }
  const X = x => pad + (t1 === t0 ? 0 : (x - t0) / (t1 - t0)) * (w - 2 * pad), Y = v => h - pad - (v - lo) / (hi - lo) * (h - 2 * pad);
  const path = upto => { let d = '', last = null; for (const [x, v] of pts) { if (upto != null && x > upto) break; d += last == null ? `M${X(x).toFixed(1)} ${Y(v).toFixed(1)}` : `H${X(x).toFixed(1)}V${Y(v).toFixed(1)}`; last = v; }
    if (last != null) d += `H${X(upto != null ? Math.min(Math.max(upto, t0), t1) : t1).toFixed(1)}`; return d; };
  if (typeof opts.threshold === 'number') s.append(svg('line.spark-threshold', { x1: pad, x2: w - pad, y1: Y(opts.threshold).toFixed(1), y2: Y(opts.threshold).toFixed(1) }));
  s.append(svg('path.spark-all', { d: path(null), fill: 'none' }));
  if (typeof t === 'number') {
    const seen = pts.filter(p => p[0] <= t);
    if (seen.length) {
      const cur = seen[seen.length - 1][1], cx = X(Math.min(Math.max(t, t0), t1));
      s.append(svg('path.spark-seen', { d: path(t), fill: 'none' }), svg('line.spark-now', { x1: cx.toFixed(1), x2: cx.toFixed(1), y1: 2, y2: h - 2 }), svg('circle.spark-dot', { cx: cx.toFixed(1), cy: Y(cur).toFixed(1), r: 3.4 }));
      s.dataset.value = String(cur);
    }
  }
  return s;
}
