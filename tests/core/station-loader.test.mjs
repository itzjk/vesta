import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStationLoader } from '../../web/js/world/station-loader.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('entry builds alone, background yields and latest requested station takes priority', async () => {
  const order = [], turns = [];
  const loader = createStationLoader({ count: 6, build: async i => { order.push(i); }, yieldTurn: async () => { turns.push(order.length); } });
  await loader.ensure(3);
  assert.deepEqual(order, [3]);
  assert.equal(loader.complete, false);
  loader.request(5);
  await loader.prepare();
  assert.deepEqual(order, [3, 5, 0, 1, 2, 4]);
  assert.equal(turns.length, 5);
  assert.equal(loader.complete, true);
});

test('capture barrier waits for every build and reuses in-flight builds', async () => {
  const gate = deferred(), order = [];
  const loader = createStationLoader({ count: 3, build: async i => { order.push(i); if (i === 1) await gate.promise; } });
  await loader.ensure(0);
  const pending = loader.ensure(1);
  assert.equal(loader.ensure(1), pending);
  let finished = false;
  const all = loader.prepare().then(() => { finished = true; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(finished, false);
  gate.resolve(); await all;
  assert.equal(loader.complete, true);
  assert.deepEqual(order, [0, 1, 2]);
});

test('failed stations settle honestly and do not block remaining stations', async () => {
  const failures = [];
  const loader = createStationLoader({ count: 3, build: async i => { if (i === 1) throw new Error('offline'); }, changed: (i, state, error) => { if (error) failures.push([i, state, error.message]); } });
  await loader.prepare();
  assert.deepEqual(failures, [[1, 'unavailable', 'offline']]);
  assert.deepEqual(loader.states, ['ready', 'unavailable', 'ready']);
  assert.equal(loader.settled, true);
  assert.equal(loader.complete, false);
});

test('abort during a build prevents later builds and ready notifications', async () => {
  const gate = deferred(), ready = [], built = [];
  let stopped = false;
  const loader = createStationLoader({ count: 3, stopped: () => stopped, build: async i => { built.push(i); await gate.promise; }, changed: (i, state) => { if (state === 'ready') ready.push(i); } });
  const pending = loader.prepare();
  await new Promise(resolve => setTimeout(resolve, 10));
  stopped = true; gate.resolve(); await pending;
  assert.deepEqual(built, [0]);
  assert.deepEqual(ready, []);
  assert.equal(loader.complete, false);
});
