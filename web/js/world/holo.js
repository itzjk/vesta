import { CSS3DRenderer, CSS3DObject } from '../../vendor/three/CSS3DRenderer.js';

export function createHolograms({ THREE, host, camera, scene, size, reduced = false, capture = false, projector, viewSize = size, onChange }) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'world-holograms';
  host.append(renderer.domElement);
  const layer = new THREE.Scene(), handles = [], open = [], markers = [];
  const markerLayer = document.createElement('div'); markerLayer.className = 'world-markers'; host.append(markerLayer);
  let activeStation, cinema = false, locked = false;
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
        if (disposed || cinema || (options.station && options.station !== activeStation && !options.source) || (options.onDemand && locked && !handle.requested)) return handle;
        if (!open.includes(handle)) { while (open.length >= 1) open[0].close(); open.push(handle); }
        handle.target = 1; object.visible = true; element.hidden = false;
        handle.marker?.element.setAttribute('aria-expanded', 'true');
        element.inert = false; element.setAttribute('aria-hidden', 'false');
        if (!element.isConnected) { const box = size(); renderer.setSize(box.width, box.height); renderer.render(layer, camera); }
        onChange?.();
        return handle;
      },
      close() {
        handle.target = 0; handle.progress = 0; object.visible = false; element.hidden = true; handle.requested = false;
        handle.marker?.element.setAttribute('aria-expanded', 'false'); element.inert = true; element.setAttribute('aria-hidden', 'true');
        const i = open.indexOf(handle); if (i >= 0) open.splice(i, 1); if (i >= 0) onChange?.();
        return handle;
      },
      toggle() { if (handle.target) return handle.close(); handle.requested = true; return handle.open(); },
      set(patch = {}) { Object.assign(options, patch); if (patch.at) at.fromArray(patch.at); return handle; },
      dispose() { handle.close(); handle.marker?.dispose(); layer.remove(object); scene.remove(beam); element.remove(); geometry.dispose(); material.dispose(); const i = handles.indexOf(handle); if (i >= 0) handles.splice(i, 1); },
      beam, positions, geometry, material
    };
    if (!options.source && !element.querySelector('[aria-label^="Close"],.evidence-close,.drill-dismiss')) {
      element.classList.add('world-has-dismiss');
      const dismiss = document.createElement('button'); dismiss.className = 'world-panel-close'; dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Close hologram'); dismiss.textContent = '×'; dismiss.onclick = () => handle.close(); element.append(dismiss);
    }
    element.hidden = true;
    let pullStart;
    element.addEventListener('pointerdown', event => { if (width < 760 && event.clientY - element.getBoundingClientRect().top < 32) pullStart = event.clientY; });
    element.addEventListener('pointerup', event => { if (pullStart != null && event.clientY - pullStart > 50) handle.close(); pullStart = null; });
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
      const phone = width < 760;
      const phoneBottom = Number.isFinite(h.options.phoneBottom) ? Math.max(0, h.options.phoneBottom) : 180;
      const maxHeight = phone ? Math.min(height - phoneBottom, height * (h.options.phoneRatio || .42)) : height - 170;
      const panelWidth = phone ? width - 24 : Math.min(h.options.width || 440, width * .31);
      el.style.setProperty('width', `${panelWidth}px`, 'important');
      el.style.setProperty('max-width', `${panelWidth}px`, 'important');
      el.style.setProperty('max-height', `${maxHeight}px`, 'important');
      el.dataset.dock = phone ? 'bottom' : h.options.dock || 'right';
      const distance = 6, scale = distance / focal;
      const panelHeight = Math.min(el.offsetHeight || 200, maxHeight);
      const x = phone ? width / 2 : el.dataset.dock === 'left' ? 24 + panelWidth / 2 : width - 76 - panelWidth / 2;
      const y = phone ? height - phoneBottom - panelHeight / 2 : 76 + panelHeight / 2;
      v.set((x / width * 2 - 1) * distance * width / height / (focal / height * 2), (1 - y / height * 2) * distance / (focal / height * 2), -distance);
      h.object.quaternion.copy(camera.quaternion);
      h.object.position.copy(v.applyQuaternion(camera.quaternion).add(camera.position));
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
    const occupied = [];
    for (const m of markers) {
      const visible = !cinema && (!m.options.station || m.options.station === activeStation);
      const point = typeof m.options.at === 'function' ? m.options.at() : m.options.at || m.handle?.at || [0, 0, 0];
      if (point?.isVector3) v.copy(point); else v.fromArray(point);
      v.project(camera);
      const viewport = viewSize();
      let x = (viewport.left || 0) + (v.x + 1) * viewport.width / 2, y = (viewport.top || 0) + (1 - v.y) * viewport.height / 2;
      const clipped = v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
      x = Math.max(28, Math.min(width - 28, x)); y = Math.max(70, Math.min(height * (width < 760 ? .66 : .82), y));
      for (let n = 0; n < 8 && occupied.some(p => Math.hypot(p.x - x, p.y - y) < 48); n++) y += 48;
      m.element.setAttribute('aria-expanded', String(Boolean(m.handle?.target)));
      m.element.hidden = !visible || clipped || y > height - 140;
      m.element.style.transform = `translate(${x - 22}px,${y - 22}px)`;
      if (!m.element.hidden) occupied.push({ x, y });
      if (open.some(h => { const r = h.element.getBoundingClientRect(); return x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24; })) m.element.hidden = true;
    }
    host.dataset.hologramOpen = String(open.length > 0);
    if (open[0]) { host.dataset.dockSide = open[0].options.dock || 'right'; host.style.setProperty('--world-dock-width', `${Math.min(open[0].options.width || 440, width * .31)}px`); }
    renderer.render(layer, camera);
  }
  function marker(handle, options = {}) {
    const element = document.createElement('button'); element.type = 'button'; element.className = 'world-marker'; element.hidden = true;
    element.setAttribute('aria-label', options.label || handle?.element.getAttribute('aria-label') || 'Open hologram');
    element.setAttribute('aria-expanded', 'false'); element.innerHTML = '<span aria-hidden="true"></span>';
    element.onclick = event => { event.stopPropagation(); if (options.onClick) options.onClick(event); else handle?.toggle(); };
    markerLayer.append(element);
    const item = { element, handle, options, set(patch) { Object.assign(options, patch); return item; }, dispose() { element.remove(); const i = markers.indexOf(item); if (i >= 0) markers.splice(i, 1); } };
    markers.push(item); if (handle) handle.marker = item; return item;
  }
  function closeAll() { [...open].forEach(h => h.close()); }
  return { hologram, marker, update, renderer, handles, openStation() { const candidates = handles.filter(h => h.options.station === activeStation && !h.options.source); const h = candidates.find(h => h.element.querySelector('input,select,[data-drill=run]')) || candidates.at(-1); h?.toggle(); }, lock(value) { locked = value; }, setStation(station) { activeStation = station; closeAll(); }, setCinema(value) { cinema = value; if (value) closeAll(); }, closeAll, dispose() { disposed = true; [...handles].forEach(h => h.dispose()); markers.slice().forEach(m => m.dispose()); markerLayer.remove(); renderer.domElement.remove(); } };
}

export function hologram(element, options = {}) {
  if (!options.world?.hologram) throw new Error('A world hologram needs its world context');
  return options.world.hologram(element, options);
}
