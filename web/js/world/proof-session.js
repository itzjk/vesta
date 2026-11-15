import { validateCases } from './proof.js';

// Actual evaluated cases, retained until an explicit rerun. Timers yield to the UI;
// elapsed time is not presented as a measurement or simulated processing progress.
export function createProofSession({ load, evaluate, onChange = () => {}, onError = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, loadTimeoutMs = 12000, setLoadTimer = setTimeout, clearLoadTimer = clearTimeout }) {
  let runNumber = 0;
  let phase = 'idle', file = null, results = [], error = null, generation = 0, disposed = false, timer = null, resume = null;
  const snapshot = () => ({ runNumber, phase, file, results: [...results], error,
    total: file?.cases.length ?? 10, completed: results.length,
    passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length });
  let cancelLoad = null;
  const publish = () => {
    if (disposed) return;
    try { onChange(snapshot()); }
    catch (cause) { throw new Error('The check results could not be displayed. Retry checks.', { cause }); }
  };
  // A canceled or timed-out fetch must settle this run, even when its loader
  // ignores AbortSignal. Its eventual response cannot replace a newer run.
  function fetchFile() {
    const abort = new AbortController();
    return new Promise((resolve, reject) => {
      let settled = false, timeout;
      const finish = (cause, value) => {
        if (settled) return; settled = true; clearLoadTimer(timeout); cancelLoad = null;
        if (cause) reject(cause); else resolve(value);
      };
      cancelLoad = () => { abort.abort(); finish(null, null); };
      timeout = setLoadTimer(() => { abort.abort(); finish(new Error('Loading the reviewed cases timed out. Retry checks.')); }, loadTimeoutMs);
      try { Promise.resolve(load({ signal: abort.signal })).then(value => finish(null, value), cause => finish(cause)); }
      catch (cause) { finish(cause); }
    });
  }
  const release = () => { if (timer != null) clearTimer(timer); timer = null; const finish = resume; resume = null; finish?.(); };
  const yieldTurn = () => new Promise(resolve => { resume = resolve; timer = setTimer(() => { timer = null; resume = null; resolve(); }, 0); });
  async function run() {
    if (disposed || phase === 'loading' || phase === 'running') return false;
    const id = ++generation; runNumber++; results = []; error = null; phase = file ? 'running' : 'loading';
    try {
      publish();
      const loaded = file ?? await fetchFile();
      if (disposed || id !== generation) return false;
      const cases = validateCases(loaded);
      file = loaded; phase = 'running'; publish();
      for (const c of cases) {
        await yieldTurn(); if (disposed || id !== generation) return false;
        let result;
        try { result = evaluate(c); }
        catch (cause) { result = { id: c.id, machine: c.machine, question: c.question, expected: c.expected,
          actual: { status: 'UNAVAILABLE' }, answer: cause.message || 'This case could not be evaluated.', result: {}, refs: [], pass: false, mismatches: ['execution'] }; }
        results.push(result); publish();
      }
      phase = 'complete'; publish(); return true;
    } catch (cause) {
      if (disposed || id !== generation) return false;
      phase = 'error'; error = cause?.message || 'The reviewed cases could not be loaded.';
      // Rendering is allowed to fail without stranding the session in a busy
      // state or recursively throwing while publishing the error itself.
      try { publish(); } catch { /* onError supplies an independent fallback. */ }
      try { onError(snapshot(), cause); } catch { /* Retry remains available in state. */ }
      return false;
    }
  }
  function stop() {
    if (disposed || !['loading', 'running'].includes(phase)) return false;
    generation++; cancelLoad?.(); release(); phase = 'stopped';
    try { publish(); } catch (cause) {
      error = cause.message; try { onError(snapshot(), cause); } catch { /* Keep cancellation effective. */ }
    }
    return true;
  }
  return { run, stop, snapshot, dispose() { if (disposed) return; disposed = true; generation++; cancelLoad?.(); release(); } };
}

export function proofComparisons(result) {
  return Object.entries(result.expected).map(([key, expected]) => ({ key, expected,
    actual: result.actual[key], pass: !result.mismatches.includes(key) && !result.mismatches.includes('execution'),
    comparison: Array.isArray(expected) ? 'Includes every expected reason; additional reasons are allowed.' : 'Exact value match.' }));
}
