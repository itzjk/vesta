export function createStationLoader({ count, build, yieldTurn = () => new Promise(resolve => setTimeout(resolve, 0)), stopped = () => false, changed = () => {} }) {
  const states = Array(count).fill('pending'), promises = new Map();
  let priority = 0, running;
  function ensure(i) {
    if (stopped() || i < 0 || i >= count) return Promise.resolve();
    if (promises.has(i)) return promises.get(i);
    states[i] = 'loading'; changed(i, states[i]);
    const promise = Promise.resolve().then(() => stopped() ? undefined : build(i)).then(value => {
      if (!stopped()) { states[i] = 'ready'; changed(i, states[i]); }
      return value;
    }, error => {
      if (!stopped()) { states[i] = 'unavailable'; changed(i, states[i], error); }
    });
    promises.set(i, promise);
    return promise;
  }
  return {
    states, ensure,
    request(i) { priority = i; },
    get complete() { return states.every(state => state === 'ready'); },
    get settled() { return states.every(state => state === 'ready' || state === 'unavailable'); },
    prepare() {
      running ??= (async () => {
        while (!stopped() && states.includes('pending')) {
          await yieldTurn();
          if (stopped()) break;
          const i = states[priority] === 'pending' ? priority : states.indexOf('pending');
          if (i >= 0) await ensure(i);
        }
        await Promise.all(promises.values());
      })();
      return running;
    }
  };
}

export function afterPaint() {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(finish, 100);
    requestAnimationFrame(() => requestAnimationFrame(finish));
  });
}
