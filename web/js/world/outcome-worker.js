import { validate, predict } from '../core/outcome-model.js?v=flex-frame-20261115-1';

let tests = null, evaluation = null;
const estimates = new Map();
self.onmessage = event => {
  const { id, rows, query } = event.data || {};
  try {
    if (rows) { tests = rows; evaluation = null; estimates.clear(); }
    if (!Array.isArray(tests)) throw new Error('Source rows have not been loaded in the table worker.');
    if (!evaluation) evaluation = validate(tests);
    // A request without a query asks only for the held-out evaluation.
    if (query == null) { self.postMessage({ id, evaluation, estimate: null }); return; }
    const key = JSON.stringify(query);
    let estimate = estimates.get(key);
    if (!estimate) {
      estimate = predict(tests, query);
      if (estimates.size >= 24) estimates.delete(estimates.keys().next().value);
      estimates.set(key, estimate);
    }
    self.postMessage({ id, evaluation, estimate });
  } catch (error) { self.postMessage({ id, error: error?.message || 'The table calculation failed.' }); }
};
