export async function build({ THREE, mode }) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, mode === 'low' ? 32 : 48, mode === 'low' ? 24 : 32);
  const earth = geometry.clone(), p = earth.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = (p.getY(i) + 1) / 2, taper = .93 - .72 * h;
    p.setXYZ(i, p.getX(i) * taper, p.getY(i) * 1.28 + .3 * h * h, p.getZ(i) * taper);
  }
  earth.computeVertexNormals();
  geometry.setAttribute('earthPosition', earth.attributes.position.clone());
  geometry.setAttribute('earthNormal', earth.attributes.normal.clone());
  earth.dispose();
  const uniforms = { uTime: { value: 0 }, uSpace: { value: 1 }, uHalo: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 earthPosition; attribute vec3 earthNormal;
      uniform float uSpace, uTime; varying vec3 vN, vV, vP;
      void main() {
        vec3 p = mix(earthPosition, position, uSpace);
        vec3 n = normalize(mix(earthNormal, normal, uSpace));
        float w = sin(p.y * 5.0 - uTime * 2.1) * sin(p.z * 4.0 + uTime * 1.6);
        p += n * w * mix(.018, .003, uSpace);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * n); vV = -mv.xyz; vP = p;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uSpace, uTime, uHalo; varying vec3 vN, vV, vP;
      void main() {
        float d = abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(1.0 - d, 3.4) * smoothstep(0.0, .14, d);
        float drift = .95 + .05 * sin(vP.x * 5.0 + uTime * .9) * sin(vP.y * 6.0 - uTime * .7);
        vec3 blue = mix(vec3(.025,.13,.66), vec3(.20,.63,1.0), min(1.0, rim * 2.8));
        vec3 sphere = blue * (.28 * d + rim * 3.1) * drift;
        float core = pow(d, 75.0);
        sphere += vec3(1.0,.35,.07) * core * .85;
        vec3 yellow = mix(vec3(1.0,.23,.015), vec3(1.0,.83,.34), pow(d,.55));
        float base = 1.0 - smoothstep(-1.0,-.55,vP.y);
        vec3 tear = mix(yellow * (.6 + d * .85), vec3(.08,.22,.95), base * .9);
        vec3 col = mix(tear, sphere, uSpace);
        float alpha = smoothstep(0.0, .08, d);
        if(uHalo > .5) { col = mix(vec3(1.0,.35,.06),vec3(.025,.18,.85),uSpace) * rim * .22; alpha *= .5; }
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const shell = new THREE.Mesh(geometry, material);
  shell.renderOrder = 5;
  const haloMaterial = material.clone();
  haloMaterial.uniforms.uHalo.value = 1;
  const halo = new THREE.Mesh(geometry, haloMaterial);
  halo.scale.setScalar(1.07); halo.renderOrder = 4;
  const light = new THREE.PointLight(0x8fa3b5, 1, 5, 2);
  group.add(shell, halo, light);
  const warm = new THREE.Color(0xe0a458), cool = new THREE.Color(0x709ccc);
  return {
    group, defaults: { space: 1 },
    update(t, state = {}) {
      const space = Math.max(0, Math.min(1, state.space ?? 1));
      for (const m of [material, haloMaterial]) { m.uniforms.uTime.value = t; m.uniforms.uSpace.value = space; }
      light.color.copy(warm).lerp(cool, space); light.intensity = 2;
    }
  };
}
