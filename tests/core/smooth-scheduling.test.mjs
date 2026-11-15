import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStationLoader } from '../../web/js/world/station-loader.js';

test('background construction does not start while a camera flight owns the frame', async () => {
  let paused = true;
  const built = [];
  let turns = 0;
  const loader = createStationLoader({ count: 3, paused: () => paused, build: async i => built.push(i), yieldTurn: async () => { if (++turns === 2) { assert.deepEqual(built, []); paused = false; } } });
  await loader.prepare();
  assert.deepEqual(built, [0, 1, 2]);
});

test('requested station overtakes idle work without a duplicate build', async () => {
  const built = [];
  let loader, turns = 0;
  loader = createStationLoader({ count: 4, build: async i => built.push(i), yieldTurn: async () => { if (++turns === 1) loader.request(3); } });
  await loader.prepare();
  assert.deepEqual(built, [3, 0, 1, 2]);
});
