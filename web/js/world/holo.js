import { CSS3DRenderer, CSS3DObject } from '../../vendor/three/CSS3DRenderer.js';

export function createHolograms({ THREE, host, camera, scene, size, reduced = false, capture = false, projector }) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'world-holograms';
  host.append(renderer.domElement);
  const layer = new THREE.Scene(), handles = [], open = [];
  const v = new THREE.Vector3(), from = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  let width = 0, height = 0, disposed = false;
  function hologram(element, options = {}) {
    element.classList.add('world-hologram');
    element.style.width = `${options.width || 560}px`;
    element.setAttribute('aria-hidden', 'true');
    element.inert = true;
    const object = new CSS3DObject(element);
    const at = new THREE.Vector3(...(options.at || [0, .3, 0]));
    object.position.copy(at); object.visible = false; layer.add(object);
    const positions = new Float32Array(9), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.MeshBasicMaterial({ color: 0xe0a458, transparent: true, opacity: .035, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(geometry, material); beam.frustumCulled = false; beam.visible = false; scene.add(beam);
    const handle = {
      element, object, at, options, target: 0, progress: 0,
      open() {
        if (disposed) return handle;
        if (!open.includes(handle)) { while (open.length >= 2) open[0].close(); open.push(handle); }
        handle.target = 1; object.visible = true;
        element.inert = false; element.setAttribute('aria-hidden', 'false');
        return handle;
      },
      close() {
        handle.target = 0; element.inert = true; element.setAttribute('aria-hidden', 'true');
        const i = open.indexOf(handle); if (i >= 0) open.splice(i, 1);
        return handle;
      },
      set(patch = {}) { Object.assign(options, patch); if (patch.at) at.fromArray(patch.at); return handle; },
      dispose() { handle.close(); layer.remove(object); scene.remove(beam); element.remove(); geometry.dispose(); material.dispose(); const i = handles.indexOf(handle); if (i >= 0) handles.splice(i, 1); },
      beam, positions, geometry, material
    };
    handles.push(handle);
    return handle;
  }
  function update(t, dt = 1 / 60) {
    if (disposed) return;
    const box = size();
    if (width !== box.width || height !== box.height) { width = box.width; height = box.height; renderer.setSize(width, height); }
    camera.updateMatrixWorld();
    const focal = height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const h of handles) {
      h.progress = capture || reduced ? h.target : h.progress + (h.target - h.progress) * (1 - Math.exp(-dt * 12));
      const p = h.progress;
      if (p < .001) { h.object.visible = h.beam.visible = false; continue; }
      h.object.visible = true;
      const el = h.element;
      el.style.maxWidth = `${Math.max(240, width - (width < 760 ? 36 : 100))}px`;
      el.style.maxHeight = `${Math.max(180, height * (h.options.source ? .84 : width < 760 ? .57 : .72))}px`;
      const distance = Math.max(2, -v.copy(h.at).applyMatrix4(camera.matrixWorldInverse).z);
      const scale = distance / focal;
      h.object.quaternion.copy(camera.quaternion);
      h.object.position.copy(h.at);
      if (width < 760 && !h.options.keepPosition) {
        v.set(0, -distance * .15, -distance).applyQuaternion(camera.quaternion).add(camera.position);
        h.object.position.copy(v);
      } else {
        const projected = h.at.clone().project(camera);
        const halfW = Math.min(el.offsetWidth || 560, width - 64) / width;
        const halfH = Math.min(el.offsetHeight || 200, height * .72) / height;
        const x = Math.max(-.91 + halfW, Math.min(.91 - halfW, projected.x));
        const y = Math.max(-.8 + halfH, Math.min(.8 - halfH, projected.y));
        v.set(x, y, projected.z).unproject(camera); h.object.position.copy(v);
      }
      projector?.(from);
      if (h.options.unfoldFrom) {
        const source = typeof h.options.unfoldFrom === 'function' ? h.options.unfoldFrom() : h.options.unfoldFrom;
        if (source?.isVector3) from.copy(source); else if (Array.isArray(source)) from.fromArray(source);
      }
      h.object.position.lerp(from, (1 - p) * (1 - p));
      h.object.scale.set(scale * Math.max(.001, p), scale * Math.max(.001, p * p), scale);
      el.style.opacity = String(Math.min(1, p * 2));
      right.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar((el.offsetWidth || 560) * scale * .5 * p);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar((el.offsetHeight || 200) * scale * .5 * p);
      const { positions, geometry, material } = h;
      positions.set(from.toArray(), 0);
      v.copy(h.object.position).sub(right).add(up); positions.set(v.toArray(), 3);
      v.copy(h.object.position).add(right).sub(up); positions.set(v.toArray(), 6);
      geometry.attributes.position.needsUpdate = true; material.opacity = .035 * p;
      h.beam.visible = !reduced && p < .98;
    }
    renderer.render(layer, camera);
  }
  return { hologram, update, renderer, handles, closeAll() { [...open].forEach(h => h.close()); }, dispose() { disposed = true; [...handles].forEach(h => h.dispose()); renderer.domElement.remove(); } };
}

export function hologram(element, options = {}) {
  if (!options.world?.hologram) throw new Error('A world hologram needs its world context');
  return options.world.hologram(element, options);
}
