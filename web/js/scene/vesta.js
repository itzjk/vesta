import { surface } from './materials.js';


import * as THREE from '../../vendor/three/three.module.js';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const DEG = Math.PI / 180;

const YW = -0.08; 
const RW = 0.338; 
const YT = 0.5; 
const YB = -0.385; 
function bodyR(y) {
  if (y >= YW) {
    const u = clamp((y - YW) / (YT - YW));
    return RW * Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.3)));
  }
  const u = clamp((YW - y) / (YW - YB));
  return RW * Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.5)));
}
function surf(az, y, pos, nrm) {
  const r = bodyR(y);
  const dr = (bodyR(y + 1e-3) - bodyR(y - 1e-3)) / 2e-3;
  pos.set(r * Math.sin(az), y, r * Math.cos(az));
  if (nrm) nrm.set(Math.sin(az), -dr, Math.cos(az)).normalize();
  return pos;
}

function revolve(pts, segs, mod) {
  const P = pts.length;
  const N = segs;
  const pos = new Float32Array((N + 1) * P * 3);
  const uv = new Float32Array((N + 1) * P * 2);
  const o = { r: 0, y: 0 };
  for (let i = 0; i <= N; i++) {
    const az = Math.PI + (i / N) * Math.PI * 2;
    const sa = Math.sin(az);
    const ca = Math.cos(az);
    for (let j = 0; j < P; j++) {
      o.r = pts[j][0];
      o.y = pts[j][1];
      if (mod) mod(o, az, j / (P - 1));
      const k = i * P + j;
      pos[k * 3] = o.r * sa;
      pos[k * 3 + 1] = o.y;
      pos[k * 3 + 2] = o.r * ca;
      uv[k * 2] = i / N;
      uv[k * 2 + 1] = j / (P - 1);
    }
  }
  const idx = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j;
      const b = (i + 1) * P + j;
      const c = a + 1;
      const d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  const v = new THREE.Vector3();
  for (let j = 0; j < P; j++) {
    const a = j;
    const b = N * P + j;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

function spline(ctrl, n) {
  const c = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(p[0], p[1], 0)), false, 'centripetal');
  return c.getPoints(n).map((p) => [Math.max(0.0015, p.x), p.y]);
}

function orient(obj, n, up) {
  const z = n.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up || new THREE.Vector3(0, 1, 0), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const a = Math.exp(-u * u * 5.0) * (1 - u * u);
    g.addColorStop(u, `rgba(255,255,255,${a.toFixed(4)})`);
  }
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.LinearSRGBColorSpace;
  return t;
}

const FLAME_VERT = `
uniform float uTime; uniform float uWobble;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  vec3 p = position;
  float w = sin(p.x * 5.0 + uTime * 3.1) * sin(p.y * 4.0 - uTime * 2.3) + sin(p.z * 6.0 + uTime * 2.7 + p.x * 3.0) * 0.6;
  p += normal * w * uWobble;
  vP = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FRAG = `
precision highp float;
uniform float uTime; uniform float uGain; uniform float uShell; uniform float uFill; uniform float uWarm; uniform float uPow;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float edge = smoothstep(0.0, 0.2, ndv);
  float rim = pow(1.0 - ndv, uPow) * edge;
  float sh = 0.82 + 0.18 * sin(vP.x * 7.0 + uTime * 2.1) * sin(vP.y * 9.0 - uTime * 1.6) * sin(vP.z * 8.0 + uTime * 2.6);
  vec3 deep = vec3(0.05, 0.22, 1.0);
  vec3 ice = vec3(0.42, 0.78, 1.0);
  vec3 col = mix(deep, ice, clamp(rim * 1.5, 0.0, 1.0)) * (rim * uShell * sh + uFill * edge);
  float core = pow(ndv, 7.0);
  col += vec3(1.0, 0.52, 0.2) * core * uWarm;
  col += vec3(0.5, 0.75, 1.0) * pow(ndv, 3.0) * uFill * 0.6;
  gl_FragColor = vec4(col * uGain, 1.0);
}`;

export async function build(ctx) {
  const group = new THREE.Group(); group.name = 'vesta-character';
  const root = new THREE.Group(); 
  const squash = new THREE.Group(); 
  const model = new THREE.Group(); 
  group.add(root);
  root.add(squash);
  squash.add(model);

  const TOP = 0.572; 
  const BOT = -0.462; 
  const K = 1 / (TOP - BOT);
  const OFF = -((TOP + BOT) / 2) * K;
  model.scale.setScalar(K);
  model.position.y = OFF;

  const uni = {
    uCheekL: { value: new THREE.Vector3() },
    uCheekR: { value: new THREE.Vector3() },
    uBlush: { value: 1 },
    uMouth: { value: 0 },
    uMouthOpen: { value: 0 },
    uMouthC: { value: new THREE.Vector2(0, -0.172) },
    uFace: { value: 1 },
    uSmile: { value: new THREE.Vector3(1.05, 0.052, 0.0092) }, 
    uFaceFill: { value: 0.12 }, 
  };
  const ceramicProps = {
    color: 0xf1ece2,
    roughness: 0.42,
    roughnessMap: surface(THREE, 'ceramic'),
    bumpMap: surface(THREE, 'ceramic'),
    bumpScale: .00035,
    metalness: 0,
    clearcoat: .6,
    clearcoatRoughness: 0.2,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffd9b0),
    sheenRoughness: 0.5,
    envMapIntensity: 1.0,
  };
  const ceramic = new THREE.MeshPhysicalMaterial(ceramicProps);
  const bodyMat = new THREE.MeshPhysicalMaterial(ceramicProps);
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vOP;
        uniform vec3 uCheekL; uniform vec3 uCheekR; uniform float uBlush; uniform float uMouth; uniform float uMouthOpen; uniform vec2 uMouthC; uniform float uFace; uniform vec3 uSmile; uniform float uFaceFill;
        float sdArcDown(vec2 p, vec2 sc, float ra, float rb){
          p.y = -p.y; p.x = abs(p.x);
          return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          
          vec3 dl = vOP - uCheekL; dl.y *= 1.45;
          vec3 dr = vOP - uCheekR; dr.y *= 1.45;
          float bl = 1.0 - smoothstep(0.012, 0.098, min(length(dl), length(dr)));
          bl *= bl;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.30, 0.25), bl * 0.74 * uBlush * uFace);
          
          float ao = smoothstep(0.100, 0.156, vOP.y);
          diffuseColor.rgb *= 1.0 - 0.42 * ao * ao;
          
          vec2 p = vOP.xy - uMouthC;
          float dSmile = sdArcDown(p - vec2(0.0, uSmile.y - 0.018), vec2(sin(uSmile.x), cos(uSmile.x)), uSmile.y, uSmile.z);
          vec2 q = p - vec2(0.0, 0.014);
          float dOpen = max(length(q) - 0.049, q.y - 0.004) - 0.008;
          vec2 e = (p + vec2(0.0, 0.006)) / vec2(0.034, 0.042);
          float dO = (length(e) - 1.0) * 0.034;
          float d = mix(mix(dSmile, dOpen, uMouthOpen), dO, uMouth);
          float aa = max(fwidth(d), 1e-5);
          float m = (1.0 - smoothstep(-aa, aa, d)) * step(0.1, vOP.z) * uFace;
          vec3 mc = vec3(0.075, 0.018, 0.014);
          float openK = max(uMouthOpen * (1.0 - uMouth), uMouth * 0.85);
          vec2 tq = (p - vec2(0.0, -0.041)) / vec2(0.034, 0.024);
          float tongue = (1.0 - smoothstep(0.8, 1.05, length(tq))) * smoothstep(0.004, 0.011, -d) * openK;
          mc = mix(mc, vec3(0.85, 0.16, 0.14), tongue);
          diffuseColor.rgb = mix(diffuseColor.rgb, mc, m);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uFaceFill * smoothstep(0.0, 0.22, vOP.z) * smoothstep(-0.30, -0.22, vOP.y) * uFace;`
      );
  };
  
  const lidMat = new THREE.MeshPhysicalMaterial({ ...ceramicProps, emissive: 0xf1ece2, emissiveIntensity: 0.12 });
  const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xc8553d, roughness: 0.38, roughnessMap: surface(THREE), bumpMap: surface(THREE), bumpScale: .00055, metalness: 0.22, clearcoat: .72, clearcoatRoughness: 0.16, envMapIntensity: 1.15 });
  const orangeMat = new THREE.MeshPhysicalMaterial({ color: 0xc86442, roughness: 0.48, roughnessMap: surface(THREE), bumpMap: surface(THREE), bumpScale: .0004, metalness: .08, clearcoat: 0.45, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe0a93a, roughness: 0.24, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 1.5 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x24262d, roughness: 0.36, metalness: 0.85, clearcoat: 0.3, envMapIntensity: 1.2 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1f100b, roughness: 0.6 });
  const lashMat = new THREE.MeshBasicMaterial({ color: 0x1a0d09 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0607, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.7 });
  const eyeUni = { uHi: { value: 1 } };
  eyeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, eyeUni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform float uHi;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 ed = normalize(vOP);
        float iris = smoothstep(0.25, -0.85, ed.y) * smoothstep(0.0, 0.5, ed.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.16, 0.42), iris * 0.9);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float aa = fwidth(ed.x) * 1.2 + 0.004;
          float h1 = 1.0 - smoothstep(0.250 - aa, 0.250 + aa, distance(ed, normalize(vec3(-0.36, 0.44, 0.82))));
          float h2 = 1.0 - smoothstep(0.125 - aa, 0.125 + aa, distance(ed, normalize(vec3(0.34, -0.36, 0.86))));
          float glow = smoothstep(0.1, -0.9, ed.y) * smoothstep(0.1, 0.7, ed.z);
          totalEmissiveRadiance += vec3(1.35) * max(h1, h2 * 0.9) * uHi + vec3(0.035, 0.11, 0.3) * glow * uHi;
        }`
      );
  };

  const shadow = (m, cast = true, recv = true) => {
    m.castShadow = cast;
    m.receiveShadow = recv;
    return m;
  };

  const bodyPts = [];
  for (let i = 0; i <= 24; i++) {
    const u = Math.cos((i / 24) * Math.PI * 0.5); 
    const y = YW - (YW - YB) * Math.min(u, 0.9995);
    bodyPts.push([Math.max(0.004, bodyR(y)), y]);
  }
  for (let i = 1; i <= 20; i++) {
    const y = YW + (0.3 - YW) * (i / 20);
    bodyPts.push([bodyR(y), y]);
  }
  const body = shadow(new THREE.Mesh(revolve(bodyPts, 40), bodyMat));
  model.add(body);

  const bandPts = [];
  const B0 = -0.292;
  const B1 = -0.252;
  bandPts.push([bodyR(B0) - 0.004, B0 - 0.001]);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const y = lerp(B0, B1, u);
    const lift = 0.0075 * Math.pow(Math.sin(Math.PI * clamp(u * 0.9 + 0.05)), 0.35);
    bandPts.push([bodyR(y) + lift, y]);
  }
  bandPts.push([bodyR(B1) - 0.004, B1 + 0.001]);
  model.add(shadow(new THREE.Mesh(revolve(bandPts, 48), goldMat), false, true));

  const HB = 0.17;
  const hc = [
    [bodyR(HB - 0.012) - 0.01, HB - 0.012],
    [0.35, HB - 0.019],
    [0.392, HB - 0.016],
    [0.409, HB - 0.006],
    [0.407, HB + 0.006],
    [0.39, HB + 0.013],
    [0.356, HB + 0.02],
    [0.336, HB + 0.031],
    [bodyR(HB + 0.05) + 0.02, HB + 0.052],
  ];
  for (let i = 1; i <= 9; i++) {
    const y = lerp(HB + 0.052, 0.468, i / 9);
    hc.push([bodyR(y) + 0.02, y]);
  }
  hc.push([0.118, 0.488], [0.07, 0.4975], [0.02, 0.501]);
  const helmetPts = spline(hc, 32);
  const helmetGeo = revolve(helmetPts, 48, (o, az) => {
    
    const rin = bodyR(Math.min(o.y, 0.3)) + 0.022;
    if (o.y < HB + 0.03 && o.r > rin) {
      const ext = o.r - rin;
      const back = Math.pow(Math.max(0, -Math.cos(az)), 1.4);
      const front = Math.pow(Math.max(0, Math.cos(az)), 2.0);
      o.r += ext * (0.75 * back + 0.12 * front);
      o.y -= ext * (0.42 * back - 0.1 * front);
    }
    
    const k = smooth(HB + 0.045, HB + 0.11, o.y) * (1 - smooth(0.4, 0.475, o.y));
    if (k > 0) o.r += 0.0085 * k * Math.pow(0.5 + 0.5 * Math.cos(8 * az + Math.PI), 5);
  });
  const helmet = shadow(new THREE.Mesh(helmetGeo, helmetMat), false, true); 
  model.add(helmet);

  const collar = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.02, 16, 48), goldMat), true, true);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.499;
  model.add(collar);
  const beaconMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(0, 0, 0), envMapIntensity: 1.2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), beaconMat);
  bulb.position.y = 0.522;
  model.add(bulb);
  const glowTex = glowTexture();
  const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  beaconHalo.position.copy(bulb.position);
  beaconHalo.renderOrder = 12;
  model.add(beaconHalo); beaconHalo.layers.enable(1); bulb.layers.enable(1);
  const beaconLight = new THREE.PointLight(0xffffff, 0, 3.5, 2);
  beaconLight.position.set(0, 0.6, 0.02);
  model.add(beaconLight);

  const badgeGeo = new THREE.CylinderGeometry(.048, .048, .014, 32);
  badgeGeo.rotateX(Math.PI / 2);
  const badge = new THREE.Group();
  const badgeMesh = shadow(new THREE.Mesh(badgeGeo, goldMat), true, true);
  badge.add(badgeMesh);
  const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.35, 1.0, 2.4) });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.023, 24, 16), dotMat);
  dot.scale.z = 0.55;
  dot.position.set(0, -0.002, 0.011);
  const dotRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0045, 8, 32), goldMat);
  dotRing.position.set(0, -0.002, 0.011);
  badge.add(dot, dotRing); dot.layers.enable(1);
  {
    const yb = 0.305;
    const r = bodyR(yb) + 0.021;
    const dr = (bodyR(yb + 1e-3) - bodyR(yb - 1e-3)) / 2e-3;
    badge.position.set(0, yb, r + 0.006);
    orient(badge, new THREE.Vector3(0, -dr, 1));
  }
  model.add(badge);

  const EX = 0.088;
  const EY = 0.11;
  const EZ = 0.062;
  const EYE_AZ = 0.415;
  const EYE_Y = -0.03;
  const ballGeo = new THREE.SphereGeometry(1, 24, 16);
  const lidUpGeo = new THREE.SphereGeometry(1.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const lidLoGeo = new THREE.SphereGeometry(1.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const lashGeo = new THREE.TorusGeometry(1.075, 0.07, 8, 48, Math.PI);
  lashGeo.rotateX(Math.PI / 2);
  const eyes = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    const sc = new THREE.Group();
    sc.scale.set(EX, EY, EZ);
    g.add(sc);
    const ball = new THREE.Mesh(ballGeo, eyeMat);
    const up = new THREE.Group();
    up.add(shadow(new THREE.Mesh(lidUpGeo, lidMat), false, false), new THREE.Mesh(lashGeo, lashMat));
    const lo = new THREE.Group();
    lo.add(shadow(new THREE.Mesh(lidLoGeo, lidMat), false, false));
    sc.add(ball, up, lo);
    model.add(g);
    return { sd, g, sc, ball, up, lo };
  });

  const browGeo = new THREE.CapsuleGeometry(0.0175, 0.072, 8, 16);
  browGeo.rotateZ(Math.PI / 2);
  const brows = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(browGeo, browMat);
    m.scale.z = 0.6;
    g.add(m);
    model.add(g);
    return { sd, g, m };
  });

  const ARM = 0.168; 
  const ARM_R = 0.041;
  const segGeo = new THREE.CylinderGeometry(ARM_R, ARM_R, 1, 24, 1, true);
  segGeo.translate(0, -0.5, 0);
  const jointGeo = new THREE.SphereGeometry(ARM_R, 24, 16);
  const mittGeo = new THREE.SphereGeometry(0.072, 24, 16);
  const thumbGeo = new THREE.SphereGeometry(0.033, 20, 16);
  const cuffGeo = new THREE.TorusGeometry(0.047, 0.017, 12, 32);
  cuffGeo.rotateX(Math.PI / 2);
  const fingerGeo = new THREE.CapsuleGeometry(0.026, 0.09, 8, 16); 
  fingerGeo.translate(0, -0.097, 0);
  const arms = [-1, 1].map((sd) => {
    const upper = new THREE.Group(); 
    const upSeg = shadow(new THREE.Mesh(segGeo, ceramic));
    const shJoint = shadow(new THREE.Mesh(jointGeo, ceramic));
    upper.add(upSeg, shJoint);
    const fore = new THREE.Group(); 
    const foSeg = shadow(new THREE.Mesh(segGeo, ceramic));
    const elJoint = shadow(new THREE.Mesh(jointGeo, ceramic));
    const hand = new THREE.Group();
    const mitt = shadow(new THREE.Mesh(mittGeo, orangeMat));
    const thumb = shadow(new THREE.Mesh(thumbGeo, orangeMat));
    thumb.position.set(-sd * 0.03, 0.022, 0.05);
    const cuff = shadow(new THREE.Mesh(cuffGeo, orangeMat));
    cuff.position.y = 0.062;
    const finger = shadow(new THREE.Mesh(fingerGeo, orangeMat));
    hand.add(mitt, thumb, cuff, finger);
    fore.add(foSeg, elJoint, hand);
    model.add(upper, fore);
    return { sd, upper, upSeg, shJoint, fore, foSeg, elJoint, hand, mitt, thumb, finger };
  });

  const fs = new THREE.Shape();
  fs.moveTo(-0.07, 0.035);
  fs.bezierCurveTo(0.02, 0.05, 0.1, -0.02, 0.135, -0.14);
  fs.bezierCurveTo(0.155, -0.22, 0.16, -0.285, 0.13, -0.31);
  fs.bezierCurveTo(0.1, -0.33, 0.04, -0.3, -0.03, -0.255);
  fs.bezierCurveTo(-0.1, -0.22, -0.2, -0.2, -0.22, -0.16);
  fs.lineTo(-0.07, 0.035);
  const finGeo = new THREE.ExtrudeGeometry(fs, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.021, bevelSize: 0.021, bevelSegments: 3, curveSegments: 14 });
  finGeo.translate(0, 0, -0.011);
  const FIN_Y = -0.15;
  const fins = [60 * DEG, 180 * DEG, -60 * DEG].map((az) => {
    const holder = new THREE.Group();
    holder.position.set(bodyR(FIN_Y) * Math.sin(az), FIN_Y, bodyR(FIN_Y) * Math.cos(az));
    holder.rotation.y = az - Math.PI / 2; 
    const hinge = new THREE.Group();
    hinge.add(shadow(new THREE.Mesh(finGeo, orangeMat)));
    holder.add(hinge);
    model.add(holder);
    return { az, hinge };
  });

  const nozzlePts = spline(
    [
      [0.02, -0.352],
      [0.07, -0.372],
      [0.105, -0.42],
      [0.126, -0.455],
      [0.134, -0.462],
      [0.142, -0.455],
      [0.132, -0.418],
      [0.112, -0.378],
      [0.105, -0.34],
    ],
    48
  );
  const nozzle = shadow(new THREE.Mesh(revolve(nozzlePts, 64), darkMat));
  model.add(nozzle);
  const nozRing = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 12, 48), goldMat), false, true);
  nozRing.rotation.x = Math.PI / 2;
  nozRing.position.y = -0.36;
  model.add(nozRing);

  const flame = new THREE.Group();
  model.add(flame);
  const mkFlame = (o) =>
    new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      uniforms: { uTime: { value: 0 }, uGain: { value: 1 }, uWobble: { value: o.wobble }, uShell: { value: o.shell }, uFill: { value: o.fill }, uWarm: { value: o.warm }, uPow: { value: o.pow } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  const flameGeo = new THREE.SphereGeometry(1, 32, 20);
  const flameShellMat = mkFlame({ wobble: 0.022, shell: 3.4, fill: 0.2, warm: 0.26, pow: 2.3 });
  const flameOuterMat = mkFlame({ wobble: 0.04, shell: 0.55, fill: 0.0, warm: 0, pow: 3.2 });
  const flameShell = new THREE.Mesh(flameGeo, flameShellMat);
  const flameOuter = new THREE.Mesh(flameGeo, flameOuterMat);
  flameOuter.scale.setScalar(1.3);
  flameShell.renderOrder = 10;
  flameOuter.renderOrder = 11;
  const flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flameHalo.renderOrder = 9;
  flame.add(flameHalo, flameShell, flameOuter);
  const thrustLight = new THREE.PointLight(new THREE.Color().setRGB(0.3, 0.62, 1.0), 0, 4, 2);
  model.add(thrustLight);
  const nozGlowMat = new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const nozGlow = new THREE.Mesh(new THREE.CircleGeometry(0.118, 32), nozGlowMat);
  nozGlow.rotation.x = Math.PI / 2;
  nozGlow.position.y = -0.44;
  model.add(nozGlow);

  const mk = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const marks = {
    beacon: mk(model, 0, 0.522, 0),
    thruster: flame,
    badge: mk(badge, 0, 0, 0.02),
    face: mk(model, 0, EYE_Y - 0.03, bodyR(EYE_Y) + 0.02),
    mittR: mk(arms[1].hand, 0, 0, 0), 
    mittL: mk(arms[0].hand, 0, 0, 0), 
    top: mk(model, 0, TOP, 0),
    bottom: mk(model, 0, BOT, 0),
  };

  const defaults = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1,
    squash: 0,
    blink: 0, eyeWide: 0, lookX: 0, lookY: 0,
    browY: 0, browTilt: 0,
    mouth: 0, mouthOpen: 0, squint: 0, blush: 1,
    armL: 0, armR: 0, armFwd: 0, armFwdL: 0, armFwdR: 0, salute: 0,
    fins: 0.6,
    thrust: 0.8, beacon: 0.5, beaconWarm: 0,
    sleep: 0,
    idle: 1,
  };

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const DOWN = new THREE.Vector3(0, -1, 0);
  const S0 = new THREE.Vector3();
  const M0 = new THREE.Vector3();
  const M1 = new THREE.Vector3();
  const E0 = new THREE.Vector3();
  const E1 = new THREE.Vector3();
  const D = new THREE.Vector3();
  const SAL_ELBOW = new THREE.Vector3(-0.485, -0.085, 0.19); 
  const SAL_ROLL = 0.0; 
  const SAL_TIP = new THREE.Vector3(-0.29, 0.152, 0.372); 
  const ICE = new THREE.Color().setRGB(0.22, 0.6, 1.0);
  const AMBER = new THREE.Color().setRGB(1.0, 0.42, 0.06);
  const C = new THREE.Color();

  function update(t, s) {
    const sl = clamp(s.sleep);
    const awake = 1 - sl;
    const idle = s.idle;

    root.position.set(s.x, s.y + Math.sin(t * 1.9) * 0.012 * idle * (1 - 0.7 * sl), s.z);
    root.rotation.set(s.pitch + Math.sin(t * 1.15 + 2.0) * 0.012 * idle * awake, s.yaw, s.roll + Math.sin(t * 1.3 + 0.7) * 0.016 * idle * awake, 'YXZ');
    root.scale.setScalar(s.scale);

    const breathe = Math.sin(t * lerp(2.6, 1.5, sl)) * lerp(0.006, 0.02, sl) * idle;
    const sq = clamp(s.squash, -0.45, 0.45) + breathe;
    const sy = 1 + sq;
    const sxz = 1 / Math.sqrt(sy);
    squash.scale.set(sxz, sy, sxz);

    const blink = clamp(Math.max(s.blink, sl));
    const wide = clamp(s.eyeWide) * (1 - blink);
    const tilt = clamp(s.browTilt, -1, 1);
    const lookX = clamp(s.lookX, -1, 1) * awake;
    const lookY = clamp(s.lookY, -1, 1) * awake;
    const squint = clamp(s.squint) * awake;
    const det = Math.max(0, -tilt); 
    const lidDrop = Math.max(blink, (0.24 * det + 0.1 * Math.max(0, tilt)) * (1 - 0.8 * wide));
    eyes.forEach((e) => {
      const az = e.sd * EYE_AZ + lookX * 0.06;
      const y = EYE_Y + lookY * 0.02;
      surf(az, y, P, N);
      N.lerp(Z, 0.28).normalize();
      e.g.position.copy(P).addScaledVector(N, -0.03);
      orient(e.g, N);
      const ws = 1 + wide * 0.16;
      e.sc.scale.set(EX * ws, EY * ws, EZ);
      e.ball.rotation.set(-lookY * 0.3, lookX * 0.34, 0);
      
      const a = lerp(-90, 64, lidDrop) * DEG;
      e.up.rotation.set(a, 0, e.sd * tilt * 0.4 * (1 - blink), 'ZXY');
      
      const b = lerp(90, 4, Math.max(squint * 0.82, blink * 0.25)) * DEG;
      e.lo.rotation.set(b, 0, 0, 'ZXY');
    });
    eyeUni.uHi.value = 1 - 0.5 * sl;
    const fill = 0.12 * (1 - 0.6 * sl);
    uni.uFaceFill.value = fill;
    lidMat.emissiveIntensity = fill;

    brows.forEach((b) => {
      
      const by = 0.114 + clamp(s.browY, -1, 1) * 0.02 - 0.014 * sl - 0.02 * det * awake;
      surf(b.sd * (EYE_AZ + 0.012 - 0.03 * det), by, P, N);
      b.g.position.copy(P).addScaledVector(N, 0.005 + 0.012 * det);
      orient(b.g, N);
      b.m.rotation.z = b.sd * -tilt * 0.5;
      b.m.position.y = -Math.abs(tilt) * 0.004;
    });

    const firm = det * awake;
    uni.uSmile.value.set(lerp(1.05, 0.5, firm), lerp(0.052, 0.078, firm), lerp(0.0092, 0.0086, firm));
    uni.uMouth.value = clamp(s.mouth) * awake;
    uni.uMouthOpen.value = clamp(s.mouthOpen) * awake;
    uni.uBlush.value = s.blush;

    const sal = clamp(s.salute) * awake;
    const salE = sal * sal * (3 - 2 * sal);
    arms.forEach((a) => {
      const sd = a.sd;
      const raise = clamp(sd > 0 ? s.armR : s.armL) * awake;
      const other = clamp(sd > 0 ? s.armL : s.armR) * awake;
      
      const share = (raise + 0.05) / (Math.max(raise, other) + 0.05);
      const fwd = clamp(s.armFwd * share * share + (sd > 0 ? s.armFwdR : s.armFwdL)) * awake;
      const k = sd < 0 ? salE : 0;
      const sy0 = -0.13 + 0.035 * raise + 0.04 * k;
      surf(sd * (82 - 10 * k) * DEG, sy0, S0, N);
      S0.addScaledVector(N, -0.022);
      const th = lerp(lerp(0.5, 0.16, sl), 2.5, raise);
      D.set(sd * Math.sin(th), -Math.cos(th), 0.14);
      M1.set(sd * 0.5, 0.1, 1).normalize(); 
      D.lerp(M1, fwd).normalize();
      const reach = ARM * (1 + 0.2 * raise + 0.6 * fwd); 
      M0.copy(S0).addScaledVector(D, reach);
      E0.copy(S0).addScaledVector(D, reach * 0.5);
      if (k > 0) {
        
        E1.copy(SAL_TIP).sub(SAL_ELBOW).normalize();
        M1.copy(SAL_TIP).addScaledVector(E1, -0.1);
        M0.lerp(M1, k);
        E0.lerp(SAL_ELBOW, k);
        const out = Math.sin(Math.PI * k) * 0.05;
        M0.x -= out * 0.8;
        M0.z += out * 0.5;
      }
      D.copy(E0).sub(S0);
      const l1 = D.length();
      a.upper.position.copy(S0);
      a.upper.quaternion.setFromUnitVectors(DOWN, D.multiplyScalar(1 / l1));
      D.copy(M0).sub(E0);
      const l2 = D.length();
      a.fore.position.copy(E0);
      a.fore.quaternion.setFromUnitVectors(DOWN, D.multiplyScalar(1 / l2));
      const rs = clamp(Math.sqrt(ARM / (l1 + l2)), 0.84, 1); 
      a.upSeg.scale.set(rs, l1, rs);
      a.shJoint.scale.setScalar(rs);
      a.foSeg.scale.set(rs, l2, rs);
      a.elJoint.scale.setScalar(rs);
      a.hand.position.set(0, -l2, 0);
      a.hand.rotation.set(0, sd * SAL_ROLL * k, 0);
      a.mitt.scale.set(1, lerp(1.1, 1.5, k), lerp(0.86, 0.62, k));
      a.thumb.scale.set(0.9, 1.25, 0.9).multiplyScalar(1 - 0.5 * k);
      a.finger.scale.set(1, lerp(0.45, 1, smooth(0.1, 0.75, fwd)), 1);
    });

    const fin = clamp(s.fins) * (1 - 0.85 * sl);
    fins.forEach((f, i) => {
      f.hinge.rotation.z = lerp(-0.3, 0.42, fin) + Math.sin(t * 2.1 + i * 2.1) * 0.012 * idle * awake;
    });

    const th = clamp(s.thrust, 0, 1.5) * awake;
    const flick = 1 + Math.sin(t * 9.0) * 0.035 + Math.sin(t * 5.3 + 1.0) * 0.04 + Math.sin(t * 23.0 + 2.0) * 0.02; 
    const R = 0.118 * (0.42 + 0.58 * th) * smooth(0, 0.12, th);
    flame.visible = th > 0.004;
    flame.position.set(0, BOT + 0.012 - R * 0.62, 0);
    flameShell.scale.setScalar(Math.max(1e-4, R));
    flameOuter.scale.setScalar(Math.max(1e-4, R * 1.32));
    const gain = Math.pow(th, 0.7) * flick;
    flameShellMat.uniforms.uTime.value = t;
    flameOuterMat.uniforms.uTime.value = t + 3.0;
    flameShellMat.uniforms.uGain.value = gain;
    flameOuterMat.uniforms.uGain.value = gain;
    flameHalo.scale.setScalar(Math.max(1e-4, R * 6.5));
    flameHalo.material.color.setRGB(0.1 * gain, 0.3 * gain, 0.85 * gain);
    thrustLight.position.copy(flame.position);
    thrustLight.intensity = 0.42 * th * flick;
    nozGlowMat.color.setRGB(0.12 * gain, 0.4 * gain, 1.1 * gain);
    nozGlow.visible = flame.visible;

    const warm = clamp(s.beaconWarm);
    
    const bk = clamp(s.beacon, 0, 2) * awake * (1 + 0.05 * Math.sin(t * 4.1) + 0.28 * warm * Math.sin(t * 8.4823)) + sl * (0.1 + 0.08 * Math.sin(t * 1.5));
    C.copy(ICE).lerp(AMBER, warm);
    beaconMat.emissive.setRGB(C.r * bk * 3.2 + 0.02, C.g * bk * 3.2 + 0.03, C.b * bk * 3.2 + 0.05);
    beaconHalo.scale.setScalar(0.2 + 0.2 * Math.min(bk, 2));
    beaconHalo.material.color.setRGB(C.r * bk * 0.9, C.g * bk * 0.9, C.b * bk * 0.9);
    beaconHalo.visible = bk > 0.004;
    beaconLight.color.copy(C);
    beaconLight.intensity = 0.16 * bk;
    const dk = lerp(1, 0.25, sl) * (0.92 + 0.08 * Math.sin(t * 2.4));
    dotMat.color.setRGB(0.3 * dk, 0.9 * dk, 2.3 * dk);
  }

  surf(0.78, -0.128, uni.uCheekL.value);
  surf(-0.78, -0.128, uni.uCheekR.value);

  const anchors = {};
  const api = {
    group,
    defaults,
    update,
    anchors,
    
    locate(name, s, t = 0, out = new THREE.Vector3()) {
      update(t, { ...defaults, ...s });
      group.updateMatrixWorld(true);
      return marks[name].getWorldPosition(out);
    },
    demo: [
      {
        name: 'neutral-3q',
        t: 1,
        cam: { pos: [0, 0.12, 3.5], target: [0, 0.0, 0], fov: 32, aperture: 0.02 },
        state: { yaw: 0.55, lookX: -0.5, lookY: 0.1 },
      },
      {
        name: 'alarmed',
        t: 1,
        cam: { pos: [0, 0.12, 3.5], target: [0, 0.02, 0], fov: 32, aperture: 0.02 },
        state: { yaw: -0.25, eyeWide: 1, mouth: 1, browY: 1, browTilt: 0.7, beacon: 2, beaconWarm: 1, armL: 0.8, armR: 0.8, squash: 0.1, fins: 1, thrust: 1.2, lookX: 0.6 },
      },
      {
        name: 'determined-pointing',
        t: 1,
        cam: { pos: [0.2, 0.12, 3.6], target: [0.15, 0.0, 0], fov: 32, aperture: 0.02 },
        state: { yaw: 0.6, roll: -0.05, browTilt: -0.9, armL: 0.2, armR: 0.75, armFwd: 0.7, lookX: 0.5, lookY: 0.1, thrust: 1.0, beacon: 1.2, fins: 0.6 },
      },
      {
        name: 'happy-salute',
        t: 1,
        cam: { pos: [0, 0.12, 3.5], target: [0, 0.02, 0], fov: 32, aperture: 0.02 },
        state: { yaw: 0.18, roll: 0.07, salute: 1, squint: 0.85, mouthOpen: 1, browY: 0.5, armL: 0.15, squash: 0.04, beacon: 1 },
      },
      {
        name: 'face-closeup',
        t: 1,
        cam: { pos: [0.5, 0.05, 1.55], target: [0.0, 0.03, 0.2], fov: 30, aperture: 0.03, focus: 1.3 },
        state: { yaw: 0.2, lookX: 0.4, lookY: 0.2, mouth: 0, browY: 0.3 },
      },
      {
        name: 'asleep',
        t: 1,
        cam: { pos: [0.4, 0.1, 3.4], target: [0, -0.02, 0], fov: 32, aperture: 0.02 },
        state: { sleep: 1, yaw: 0.3, roll: 0.12, pitch: 0.08 },
      },
      {
        name: 'turnaround',
        t: 0,
        cam: { pos: [0, 0.12, 3.5], target: [0, 0.0, 0], fov: 32, aperture: 0.012 },
        state: (t) => ({ yaw: t * (Math.PI / 4) }),
      },
      {
        name: 'film-distance',
        t: 1,
        cam: { pos: [0, 0.2, 7], target: [0, 0, -1], fov: 32, aperture: 0.02, focus: 7 },
        state: { yaw: 0.3, lookX: -0.3 },
      },
    ],
  };

  update(0, { ...defaults, idle: 0 });
  group.updateMatrixWorld(true);
  Object.keys(marks).forEach((k) => {
    const v = marks[k].getWorldPosition(new THREE.Vector3());
    anchors[k] = [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
  });
  return api;
}
