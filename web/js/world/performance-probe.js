// Opt-in developer measurement (?perf=1). No collection or network transmission.
const percentile = (values, p) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length ? +sorted[Math.ceil(sorted.length * p) - 1].toFixed(2) : null;
};
export function createPerformanceProbe({ stage, host, station }) {
  const panel = document.createElement('details');
  panel.style.cssText = 'position:fixed;left:12px;top:78px;z-index:2000;max-width:320px;padding:10px;background:#17191df5;color:#f4e9dc;border:1px solid #99836b;font:13px/1.4 system-ui';
  const summary = document.createElement('summary'); summary.textContent = 'Performance measurement';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const start = document.createElement('button'); start.textContent = 'Measure 12 seconds';
  const save = document.createElement('button'); save.textContent = 'Download measurements'; save.disabled = true;
  const results = [], samples = [], tasks = [];
  let timer, started = 0, previous = null, unsubscribe, observer, recording = false;
  const finish = reason => {
    if (!recording) return;
    recording = false; clearTimeout(timer); unsubscribe?.(); observer?.disconnect();
    const intervals = samples.map(s => s.intervalMs).filter(n => n != null);
    const result = {
      startedAt: new Date(performance.timeOrigin + started).toISOString(), durationMs: +(performance.now() - started).toFixed(2), reason,
      station: station(), quality: stage.mode, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, userAgent: navigator.userAgent,
      frames: samples.length, frameIntervalMs: { median: percentile(intervals, .5), p95: percentile(intervals, .95), max: intervals.length ? +Math.max(...intervals).toFixed(2) : null },
      mainThreadRenderSubmissionMs: { median: percentile(samples.map(s => s.renderMs), .5), p95: percentile(samples.map(s => s.renderMs), .95) },
      intervalsOver50ms: intervals.filter(n => n > 50).length, longTasks: tasks.slice(), loader: { ...host.dataset },
      limits: 'Observed rendered-frame spacing and main-thread submission, not GPU timing, scientific validation or a cross-device benchmark. Hidden-tab capture stops. Cold load occurs before this sample.'
    };
    results.push(result); panel.dataset.performanceResult = JSON.stringify(result);
    status.textContent = `${result.frames} frames; median interval ${result.frameIntervalMs.median} ms; p95 ${result.frameIntervalMs.p95} ms; ${result.intervalsOver50ms} intervals over 50 ms.`;
    start.disabled = false; save.disabled = false;
  };
  start.onclick = () => {
    samples.length = 0; tasks.length = 0; previous = null; started = performance.now(); recording = true;
    start.disabled = true; status.textContent = 'Measuring actual rendered frames for 12 seconds…';
    unsubscribe = stage.on('frame', frame => {
      samples.push({ at: frame.at, intervalMs: previous == null ? null : frame.at - previous, renderMs: frame.renderMs }); previous = frame.at;
    });
    if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ startMs: +e.startTime.toFixed(2), durationMs: +e.duration.toFixed(2) }))));
      observer.observe({ type: 'longtask', buffered: false });
    }
    timer = setTimeout(() => finish('completed'), 12000);
  };
  save.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 'vesta-performance/1', results }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vesta-performance.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const visibility = () => { if (document.hidden) finish('tab-hidden'); };
  document.addEventListener('visibilitychange', visibility);
  panel.append(summary, status, start, save); document.body.append(panel);
  return { dispose() { finish('disposed'); clearTimeout(timer); unsubscribe?.(); observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); panel.remove(); } };
}
