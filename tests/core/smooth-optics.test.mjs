import { test } from 'node:test';
import assert from 'node:assert/strict';
const path = '../../web/js/scene/optics.js';
const { createOptics } = await import(path);
class Value { constructor() { this.value = {}; this.pixel = {}; } set() {} add() {} }
class Scene { add() {} }
class Mesh { constructor(geometry) { this.geometry = geometry; } }
class Target { constructor() { this.texture = {}; } }
const THREE = { WebGLRenderTarget: Target, DepthTexture: Value, Vector2: Value, Vector3: Value, Color: Value, ShaderMaterial: class { constructor(value) { Object.assign(this, value); } }, Scene, Mesh, OrthographicCamera: Value, PlaneGeometry: Value };
test('light 3D renders the scene directly once, with no offscreen target or glow', () => {
  const calls = [], targets = [];
  const renderer = { resetState() {}, getClearAlpha: () => 1, getClearColor() {}, setClearColor() {}, render: (...args) => calls.push(args), setRenderTarget: target => targets.push(target) };
  const optics = createOptics(THREE, renderer), scene = { getObjectByName() {} }, camera = { updateMatrixWorld() {}, userData: {}, layers: { mask: 1, set() {} } };
  optics.render(scene, camera, 2, 'low');
  assert.deepEqual(calls, [[scene, camera]]);
  assert.deepEqual(targets, [null]);
});

test('warm-up compiles visible branches without touching hidden station materials', async () => {
  const visible = { material: 'requested' }, hidden = { material: 'other-station' }, compiled = [];
  const scene = { traverse(visit) { visit(visible); visit(hidden); }, traverseVisible(visit) { visit(visible); } };
  const previous = {};
  let target = previous;
  const renderer = { getRenderTarget: () => target, setRenderTarget(value) { target = value; }, async compileAsync(value) { value.traverse(object => compiled.push(object.material)); } };
  const optics = createOptics(THREE, renderer);
  await optics.compile(scene, {}, 'low');
  assert.deepEqual(compiled, ['requested']);
  const live = []; scene.traverse(object => live.push(object.material));
  assert.deepEqual(live, ['requested', 'other-station']);
  assert.equal(target, previous);
});
