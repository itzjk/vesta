export function createOptics(THREE, renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const glow = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const uniforms = { image: { value: target.texture }, depth: { value: target.depthTexture }, glow: { value: glow.texture }, pixel: { value: new THREE.Vector2(1, 1) }, near: { value: .05 }, far: { value: 500 }, focus: { value: 9 }, aperture: { value: 1 }, time: { value: 0 } };
  const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D image, depth, glow;
      uniform vec2 pixel;
      uniform float near, far, focus, aperture, time;
      float viewDepth(float d){return near*far/(far-d*(far-near));}
      float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        float z=viewDepth(texture2D(depth,vUv).x);
        float coc=clamp(abs(z-focus)/max(z,.1)*5.,0.,4.)*aperture;
        vec3 col=texture2D(image,vUv).rgb; float weight=1.;
        if(aperture>.5&&coc>.1){
        for(int i=0;i<8;i++){
          float a=float(i)*2.399963;
          vec2 uv=vUv+vec2(cos(a),sin(a))*pixel*coc*sqrt((float(i)+.5)/8.);
          float dz=viewDepth(texture2D(depth,uv).x);
          float w=step(z-.5,dz);
          col+=texture2D(image,uv).rgb*w;weight+=w;
        }
        }
        col/=weight;
        vec3 bloom=texture2D(glow,vUv).rgb*.18;
        for(int i=0;i<8;i++){
          float a=float(i)*.785398;
          vec2 offset=vec2(cos(a),sin(a))*pixel*7.;
          bloom+=texture2D(glow,vUv+offset).rgb*.065;
          bloom+=texture2D(glow,vUv+offset*2.7).rgb*.027;
        }
        col+=bloom*.18;
        vec2 q=vUv-.5; col*=1.-dot(q,q)*.23;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float grain=(noise(gl_FragCoord.xy+floor(time*24.))- .5)*.005;
        gl_FragColor.rgb+=grain;
      }` });
  const screen = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); screen.add(quad);
  const size = new THREE.Vector2(), position = new THREE.Vector3(), savedClear = new THREE.Color();
  return {
    resize() { renderer.getDrawingBufferSize(size); target.setSize(size.x, size.y); glow.setSize(Math.max(1, Math.round(size.x / 4)), Math.max(1, Math.round(size.y / 4))); uniforms.pixel.value.set(1 / size.x, 1 / size.y); },
    render(scene, view, t, quality, output = null) {
      if (quality === 'low') { renderer.setRenderTarget(output); renderer.render(scene, view); return; }
      view.updateMatrixWorld();
      uniforms.time.value = t; uniforms.near.value = view.near; uniforms.far.value = view.far;
      const officer = scene.getObjectByName('world-officer') || scene.getObjectByName('incident-officer') || scene.getObjectByName('vesta-character');
      const subject = view.userData.focusObject || officer;
      if (Number.isFinite(view.userData.focusDistance)) uniforms.focus.value = view.userData.focusDistance;
      else if (subject?.visible) {
        subject.updateWorldMatrix(true, false);
        position.fromArray(view.userData.focusOffset || [0, 0, 0]); subject.localToWorld(position); position.applyMatrix4(view.matrixWorldInverse);
        uniforms.focus.value = Math.max(.1, -position.z);
      } else uniforms.focus.value = 18;
      uniforms.aperture.value = (quality === 'high' ? 1 : .6) * (view.userData.aperture ?? 1);
      renderer.resetState(); renderer.setRenderTarget(target); renderer.render(scene, view);
      const mask = view.layers.mask, background = scene.background, alpha = renderer.getClearAlpha(); renderer.getClearColor(savedClear);
      view.layers.set(1); scene.background = null; renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(glow); renderer.render(scene, view);
      view.layers.mask = mask; scene.background = background; renderer.setClearColor(savedClear, alpha);
      renderer.setRenderTarget(output); renderer.render(screen, camera);
    },
    async compile(scene, view, quality) {
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(quality === 'low' ? null : target);
        const visibleScene = Object.create(scene);
        visibleScene.traverse = visit => scene.traverseVisible(visit);
        await renderer.compileAsync(visibleScene, view);
        if (quality === 'high') { renderer.setRenderTarget(null); await renderer.compileAsync(screen, camera); }
      } finally { renderer.setRenderTarget(previous); }
    },
    dispose() { target.depthTexture.dispose(); target.dispose(); glow.dispose(); quad.geometry.dispose(); material.dispose(); }
  };
}
