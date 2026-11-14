import { hardware } from './materials.js';

export function buildDeck({ THREE: T }) {
  const group = new T.Group(); group.name = 'fabricated-deck';
  const steel = hardware(T, 'metal', { color: 0x657078, roughness: .76, metalness: .58, bumpScale: .004 });
  const edge = hardware(T, 'metal', { color: 0x252d32, roughness: .87, metalness: .16 });
  const fastener = hardware(T, 'metal', { color: 0x9da5a4, roughness: .48 });
  const backing = new T.Mesh(new T.BoxGeometry(15.9, .025, 12), edge); backing.position.set(0, -3.095, -1); backing.receiveShadow = true; group.add(backing);
  const w = 1.28, h = 1.7, radius = .035;
  const shape = new T.Shape(); shape.moveTo(-w / 2 + radius, -h / 2); shape.lineTo(w / 2 - radius, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius); shape.lineTo(w / 2, h / 2 - radius); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2); shape.lineTo(-w / 2 + radius, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius); shape.lineTo(-w / 2, -h / 2 + radius); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
  const geometry = new T.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSize: .008, bevelThickness: .006, bevelSegments: 1, steps: 1, curveSegments: 3 }); geometry.rotateX(-Math.PI / 2);
  const cols = 12, rows = 7, plates = new T.InstancedMesh(geometry, steel, cols * rows), bolts = new T.InstancedMesh(new T.CylinderGeometry(.017, .017, .006, 8), fastener, cols * rows * 4), slots = new T.InstancedMesh(new T.BoxGeometry(.018, .002, .004), edge, cols * rows * 4);
  const transform = new T.Object3D(); let k = 0, b = 0;
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const px = (x - (cols - 1) / 2) * (w + .028), pz = -6 + z * (h + .028);
    transform.position.set(px, -3.078, pz); transform.rotation.set(0, 0, 0); transform.updateMatrix(); plates.setMatrixAt(k++, transform.matrix);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      transform.position.set(px + sx * (w / 2 - .08), -3.046, pz + sz * (h / 2 - .08)); transform.updateMatrix(); bolts.setMatrixAt(b, transform.matrix);
      transform.position.y += .003; transform.rotation.y = Math.sin(b * 12.71) * Math.PI; transform.updateMatrix(); slots.setMatrixAt(b++, transform.matrix); transform.rotation.y = 0;
    }
  }
  for (const mesh of [plates, bolts, slots]) { mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); }
  return { group };
}
