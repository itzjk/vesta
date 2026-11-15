import { validateCases } from './proof.js';

// Actual evaluated cases, retained until an explicit rerun. Timers yield to the UI;
// elapsed time is not presented as a measurement or simulated processing progress.
export function createProofSession({ load, evaluate, onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let phase = 'idle', file = null, results = [], error = null, generation = 0, disposed = false, timer = null, resume = null;
  const snapshot = () => ({ phase, file, results: [...results], error,
    total: file?.cases.length ?? 10, completed: results.length,
    passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length });
  const publish = () => { if (!disposed) onChange(snapshot()); };
  const release = () => { if (timer != null) clearTimer(timer); timer = null; const finish = resume; resume = null; finish?.(); };
  const yieldTurn = () => new Promise(resolve => { resume = resolve; timer = setTimer(() => { timer = null; resume = null; resolve(); }, 0); });
  async function run() {
    if (disposed || phase === 'loading' || phase === 'running') return false;
    const id = ++generation; results = []; error = null; phase = file ? 'running' : 'loading'; publish();
    try {
      const loaded = file ?? await load(); const cases = validateCases(loaded);
      if (disposed || id !== generation) return false;
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
      phase = 'error'; error = cause.message || 'The reviewed cases could not be loaded.'; publish(); return false;
    }
  }
  function stop() {
    if (disposed || !['loading', 'running'].includes(phase)) return false;
    generation++; release(); phase = 'stopped'; publish(); return true;
  }
  return { run, stop, snapshot, dispose() { if (disposed) return; disposed = true; generation++; release(); } };
}

export function proofComparisons(result) {
  return Object.entries(result.expected).map(([key, expected]) => ({ key, expected,
    actual: result.actual[key], pass: !result.mismatches.includes(key) && !result.mismatches.includes('execution'),
    comparison: Array.isArray(expected) ? 'Includes every expected reason; additional reasons are allowed.' : 'Exact value match.' }));
}
