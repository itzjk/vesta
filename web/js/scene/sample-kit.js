const BASS = 'https://www.nasa.gov/wp-content/uploads/2025/07/burning-and-suppression-of-solids-bass.pdf';
const SAME = 'https://ntrs.nasa.gov/citations/20170007283';
const SAFFIRE = 'https://ntrs.nasa.gov/citations/20180004258';
export const SAMPLE_NOTES = Object.freeze({
  pmma: `Clear acrylic coupon, illustrating the flat PMMA fuel used in BASS. ${BASS}`,
  sibal: `Cotton/fiberglass swatch, the thin SIBAL fuel described by BASS; weave is illustrative. ${BASS}`,
  kapton: `Amber polyimide film, illustrating the Kapton sheet used in SAME; curl is illustrative. ${SAME}`,
  silicone: `Flexible silicone sheet, following the Saffire-II sheet samples; color is illustrative. ${SAFFIRE}`,
  teflon: `White fluoropolymer insulation, illustrating the wire-insulation use described for SAME; cut lengths are illustrative. ${SAME}`,
  lampwick: `Braided cotton wick, illustrating SAME's cellulose fuel; braid is illustrative. ${SAME}`,
  pyrell: `Gray porous polyurethane foam, illustrating SAME's payload-cushioning Pyrell; pore pattern is illustrative. ${SAME}`,
  'japan-wax': `Japan-wax model fuel in a ceramic sleeve, following BASS tube candles; color is illustrative. ${BASS}`,
  nomex: `Aramid fabric swatch, following BASS's thin Nomex fuel; tan weave is illustrative. ${BASS}`,
  'paraffin-wax': `Paraffin model-fuel candle in a ceramic sleeve, following BASS; proportions are illustrative. ${BASS}`,
  wax: `Wax-wetted fiberglass coupon, illustrating BASS's wax-saturated fabric; wax formulation is unspecified. ${BASS}`,
  ultem: `Amber engineering-polymer coupon, illustrating BASS's thin Ultem fuel; tint is illustrative. ${BASS}`,
  'dibutyl-phthalate': 'Illustrative vial and wetted wick: SAME tested DBP on a wick, not in this vial. https://ntrs.nasa.gov/citations/20120012884',
  'pmma-nomex': `Nomex with a clear acrylic leading-edge strip, following Saffire-II's PMMA igniter; assembly is illustrative. ${SAFFIRE}`,
  'silicone-rubber': `Rubber gasket strip, illustrating the gasket use described for SAME silicone rubber; shape is illustrative. ${SAME}`,
  unknown: 'Illustrative unidentified material coupon; composition and test geometry are not established.'
});

const textureCache = new WeakMap();
function texture(THREE, kind) {
  let cache = textureCache.get(THREE);
  if (!cache) { cache = new Map(); textureCache.set(THREE, cache); }
  if (cache.has(kind)) return cache.get(kind);
  const n = 128, pixels = new Uint8Array(n * n * 4);
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7 + 19.4) * 43758.5453; return h - Math.floor(h); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const noise = hash(x, y);
    let v = 205 + noise * 24;
    if (kind === 'weave' || kind === 'twill') {
      const warp = Math.cos(x * Math.PI / 2), weft = Math.cos(y * Math.PI / 2);
      const over = kind === 'twill' ? (Math.floor(x / 4) + Math.floor(y / 4)) % 4 < 2 : (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
      v = 164 + 30 * (over ? warp : weft) + 18 * (warp + weft) + noise * 24;
    }
    if (kind === 'foam') {
      const cx = Math.floor(x / 11), cy = Math.floor(y / 11); let first = 1e6, second = 1e6;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const px = (cx + i) * 11 + hash(cx + i, cy + j) * 10, py = (cy + j) * 11 + hash(cy + j + 31, cx + i) * 10;
        const d = Math.hypot(x - px, y - py);
        if (d < first) { second = first; first = d; } else if (d < second) second = d;
      }
      v = second - first < 1.15 ? 168 + noise * 53 : 45 + noise * 45;
    }
    if (kind === 'scuff') v = noise > .986 && x % 9 < 2 ? 92 : 221 + noise * 23;
    const i = (y * n + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = v; pixels[i + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, n, n); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.anisotropy = 4; map.needsUpdate = true;
  cache.set(kind, map); return map;
}

export function buildSample({ THREE, id, mode = 'high' }) {
  const group = new THREE.Group(), body = new THREE.Group(), low = mode === 'low'; group.add(body);
  group.name = `sample-${id || 'unknown'}`;
  group.userData.sampleId = id || 'unknown'; group.userData.sampleNote = SAMPLE_NOTES[id] || SAMPLE_NOTES.unknown;
  group.userData.illustration = true;
  const physical = (color, roughness = .6, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, ...extra });
  const scuff = texture(THREE, 'scuff');
  const clear = (color = 0xf1f3ee, opacity = .20) => physical(color, .14, { transparent: true, opacity: low ? opacity : opacity * .8, depthWrite: false, side: THREE.DoubleSide, ior: 1.49, specularIntensity: 1, clearcoat: .85, roughnessMap: scuff, envMapIntensity: 1.1 });
  const mesh = (geometry, material, x = 0, y = 0, z = 0, parent = body) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = !material.transmission && !material.transparent; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, material, x = 0, y = h / 2, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const rounded = (w, h, d, material, x = 0, y = h / 2, z = 0, r = .025) => {
    const shape = new THREE.Shape(), a = -w / 2, b = -h / 2;
    shape.moveTo(a + r, b); shape.lineTo(a + w - r, b); shape.quadraticCurveTo(a + w, b, a + w, b + r);
    shape.lineTo(a + w, b + h - r); shape.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    shape.lineTo(a + r, b + h); shape.quadraticCurveTo(a, b + h, a, b + h - r);
    shape.lineTo(a, b + r); shape.quadraticCurveTo(a, b, a + r, b);
    return mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: low ? 1 : 2, steps: 1, curveSegments: low ? 3 : 5 }).translate(0, 0, -d / 2), material, x, y, z);
  };
  const tube = (points, radius, material, segments = 32) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, low ? 6 : 10, false), material);
  const instances = (geometry, material, transforms) => {
    const batch = new THREE.InstancedMesh(geometry, material, transforms.length), dummy = new THREE.Object3D();
    transforms.forEach((t, i) => { dummy.position.set(...t.p); dummy.rotation.set(...(t.r || [0, 0, 0])); dummy.scale.set(...(t.s || [1, 1, 1])); dummy.updateMatrix(); batch.setMatrixAt(i, dummy.matrix); });
    batch.instanceMatrix.needsUpdate = true; batch.castShadow = batch.receiveShadow = true; body.add(batch); return batch;
  };
  const cloth = (color, kind = 'weave', w = .68, h = 1.05, z = 0) => {
    const map = texture(THREE, kind), mat = physical(color, .97, { map, bumpMap: map, bumpScale: .014, side: THREE.DoubleSide, sheen: .22, sheenRoughness: .9 });
    const geo = new THREE.PlaneGeometry(w, h, low ? 8 : 18, low ? 12 : 24), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), edge = Math.abs(x) / (w / 2);
      p.setXYZ(i, x + Math.sin(y * 39 + x * 51) * .003 * edge, y + Math.sin(x * 49) * .006, Math.sin(x * 8 + y * 6) * .027 + Math.pow(edge, 7) * .024);
    }
    geo.computeVertexNormals(); mesh(geo, mat, 0, h / 2 + .03, z);
    const frays = [];
    for (let i = 0; i < (low ? 15 : 27); i++) frays.push({ p: [-w / 2 + w * i / (low ? 14 : 26), .02 + .007 * Math.sin(i * 2), z], r: [0, .2, Math.sin(i * 1.7) * .25], s: [1, .65 + .3 * Math.sin(i), 1] });
    instances(new THREE.CylinderGeometry(.002, .002, .055, 3), mat, frays);
    return mat;
  };
  const wick = (x, y, z, length = .16) => {
    tube([[x, y, z], [x + .012, y + length / 2, z], [x - .006, y + length, z]], .012, physical(0xd8c7a0, .97), 12);
  };
  if (id === 'pmma') {
    rounded(.60, 1.08, .105, clear(), 0, .55, 0, .012).rotation.y = -.11;
    const edge = physical(0xc6e5e5, .25, { transparent: true, opacity: .56 });
    box(.013, 1.06, .095, edge, -.302, .55, .014); box(.60, .012, .09, edge, 0, .018, .01);
    const marks = Array.from({ length: 4 }, (_, i) => ({ p: [.08 + i * .022, .13 + i * .014, .059], r: [0, 0, -.5], s: [1, 1, 1] }));
    instances(new THREE.BoxGeometry(.0015, .12, .001), physical(0xc7d2d0, .7, { transparent: true, opacity: .22 }), marks);
  } else if (id === 'sibal') {
    cloth(0xe7dfc6); body.rotation.z = -.045;
  } else if (id === 'nomex') {
    cloth(0xb5a178, 'twill', .79, .87); body.rotation.z = .045;
    box(.78, .018, .022, physical(0x99845f, .99), 0, .85, -.007);
  } else if (id === 'kapton') {
    const geo = new THREE.PlaneGeometry(.66, 1.02, low ? 12 : 26, low ? 12 : 26), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, .065 * Math.sin(x * 5 + y * 4) + .075 * Math.pow((y + .51) / 1.02, 8)); }
    geo.computeVertexNormals(); mesh(geo, physical(0xc57613, .26, { side: THREE.DoubleSide, transparent: true, opacity: .77, clearcoat: .7, metalness: .05 }), 0, .55, 0);
    body.rotation.z = -.08;
  } else if (id === 'silicone') {
    rounded(.74, .82, .06, physical(0xbe7770, .73, { bumpMap: scuff, bumpScale: .002 }), 0, .44, 0, .018);
    tube([[-.35, .06, .01], [-.32, .12, .10], [-.25, .19, .12], [-.14, .17, .09]], .027, physical(0xc48c83, .79), 18);
    body.rotation.z = .065;
  } else if (id === 'teflon') {
    const white = physical(0xe4e5df, .55, { clearcoat: .14 });
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * .18, y = i * .065;
      const points = [[x, .04 + y, 0], [x - .035, .3 + y, .035], [x + .025, .66 + y, .01], [x + .04, .99 - y, 0]];
      tube(points, .052, white);
      mesh(new THREE.RingGeometry(.024, .052, 16), white, x + .04, .99 - y, 0).rotation.x = -Math.PI / 2;
      mesh(new THREE.CircleGeometry(.023, 12), physical(0x525757, .8), x + .04, .99 - y - .003, 0).rotation.x = -Math.PI / 2;
    }
  } else if (id === 'lampwick') {
    rounded(.24, .98, .04, physical(0xb9ad8e, 1), 0, .51, 0, .014);
    const strands = [], count = low ? 42 : 70;
    for (let i = 0; i < count; i++) { const y = .045 + i * .93 / count; strands.push({ p: [0, y, .032], r: [0, 0, i % 2 ? .82 : -.82] }); }
    instances(new THREE.CapsuleGeometry(.012, .23, 2, 5), physical(0xe6d9b5, .99, { bumpMap: texture(THREE, 'weave'), bumpScale: .005 }), strands);
    body.rotation.z = -.10;
  } else if (id === 'pyrell') {
    const foam = texture(THREE, 'foam');
    rounded(.76, .70, .25, physical(0x666b69, .99, { map: foam, bumpMap: foam, bumpScale: .025 }), 0, .37, 0, .012);
    const pores = [];
    for (let i = 0; i < (low ? 35 : 76); i++) { const x = Math.sin(i * 29.7) * .34, y = .07 + (.5 + .5 * Math.sin(i * 17.1)) * .60; pores.push({ p: [x, y, .127], s: [1, .7 + .4 * Math.sin(i), .24] }); }
    instances(new THREE.IcosahedronGeometry(.010, 0), physical(0x303736, 1), pores);
    body.rotation.z = .04;
  } else if (id === 'japan-wax' || id === 'paraffin-wax') {
    const japan = id === 'japan-wax', radius = japan ? .145 : .115, h = japan ? .57 : .93;
    const ceramic = physical(0xb9b4a5, .84), waxMat = physical(japan ? 0xddd0a0 : 0xeee9d6, .46, { clearcoat: .12, bumpMap: scuff, bumpScale: .003 });
    mesh(new THREE.CylinderGeometry(radius + .018, radius + .018, h * .71, 28), ceramic, 0, h * .355, 0);
    mesh(new THREE.CylinderGeometry(radius, radius, h, 32), waxMat, 0, h / 2 + .012, 0);
    mesh(new THREE.TorusGeometry(radius * .59, .019, 6, 28), waxMat, 0, h + .016, 0).rotation.x = Math.PI / 2;
    wick(0, h + .008, 0, .10);
  } else if (id === 'wax') {
    cloth(0xc7b16e, 'weave', .75, .66);
    rounded(.75, .63, .045, physical(0xe1c98c, .36, { transparent: true, opacity: .34, clearcoat: .34 }), 0, .35, .027, .012);
    tube([[-.34, .07, .05], [-.23, .035, .064], [0, .047, .065], [.22, .04, .05], [.34, .08, .05]], .018, physical(0xc7a969, .42), 24);
  } else if (id === 'ultem') {
    const mat = physical(0x98621e, .30, { transparent: true, opacity: .90, clearcoat: .4, side: THREE.DoubleSide, roughnessMap: scuff });
    const shape = new THREE.Shape(); shape.moveTo(-.30, 0); shape.lineTo(.30, 0); shape.lineTo(.30, .89); shape.lineTo(.18, 1.03); shape.lineTo(-.30, 1.03); shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape, { depth: .028, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, steps: 1 }), mat);
    body.rotation.y = -.14; body.rotation.z = .065;
  } else if (id === 'dibutyl-phthalate') {
    const glass = clear(0xf2f3ef, .22), fluid = physical(0xf2e9cd, .13, { transparent: true, opacity: .30, side: THREE.DoubleSide });
    mesh(new THREE.CylinderGeometry(.15, .15, .67, 28, 1, true), glass, -.06, .39, 0);
    mesh(new THREE.CylinderGeometry(.15, .13, .055, 28), glass, -.06, .06, 0);
    mesh(new THREE.CylinderGeometry(.127, .127, .35, 28), fluid, -.06, .26, 0);
    mesh(new THREE.CylinderGeometry(.17, .17, .13, 24), physical(0x70777a, .46, { metalness: .65 }), -.06, .78, 0);
    const ribs = Array.from({ length: 24 }, (_, i) => ({ p: [-.06 + .17 * Math.cos(i * Math.PI / 12), .78, .17 * Math.sin(i * Math.PI / 12)] }));
    instances(new THREE.BoxGeometry(.009, .10, .009), physical(0x969d9e, .51, { metalness: .65 }), ribs);
    wick(.20, .07, .03, .50);
    mesh(new THREE.TorusGeometry(.125, .005, 4, 28), physical(0xeeeadd, .16, { transparent: true, opacity: .60 }), -.06, .437, 0).rotation.x = Math.PI / 2;
  } else if (id === 'pmma-nomex') {
    cloth(0xc3b18a, 'twill', .72, .91, -.02);
    rounded(.72, .20, .09, clear(), 0, .14, .063, .009);
    box(.72, .009, .1, physical(0xb4d0ce, .30, { transparent: true, opacity: .65 }), 0, .245, .063);
    body.rotation.z = -.045;
  } else if (id === 'silicone-rubber') {
    const shape = new THREE.Shape(); shape.moveTo(-.31, 0); shape.lineTo(.31, 0); shape.lineTo(.31, .94); shape.lineTo(-.31, .94); shape.closePath();
    for (const y of [.20, .73]) { const hole = new THREE.Path(); hole.absellipse(0, y, .13, .11, 0, Math.PI * 2, true, 0); shape.holes.push(hole); }
    mesh(new THREE.ExtrudeGeometry(shape, { depth: .075, bevelEnabled: true, bevelSize: .015, bevelThickness: .012, bevelSegments: low ? 1 : 3, steps: 1, curveSegments: 24 }), physical(0x696965, .88, { bumpMap: scuff, bumpScale: .004 }));
    body.rotation.z = -.08;
  } else {
    rounded(.64, .83, .08, physical(0x92928a, .85, { bumpMap: scuff, bumpScale: .003 }));
  }
  body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body), size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1, .94 / size.x, 1.18 / size.y, .34 / size.z);
  body.scale.setScalar(scale); body.updateMatrixWorld(true); bounds.setFromObject(body);
  const center = bounds.getCenter(new THREE.Vector3()); body.position.set(-center.x, -bounds.min.y, -center.z);
  group.updateMatrixWorld(true);
  return { group };
}
