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
        float coc=clamp(abs(z-focus)/max(z,.1)*5.,0.,3.2)*aperture;
        vec3 col=texture2D(image,vUv).rgb; float weight=1.;
        if(aperture>.5&&coc>.1){
        for(int i=0;i<8;i++){
          float a=float(i)*2.399963;
          vec2 uv=vUv+vec2(cos(a),sin(a))*pixel*coc*(.5+float(i)/8.);
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
        float grain=(noise(gl_FragCoord.xy+floor(time*24.))- .5)*.012;
        gl_FragColor.rgb+=grain;
      }` });
  const screen = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); screen.add(quad);
  const size = new THREE.Vector2(), position = new THREE.Vector3(), savedClear = new THREE.Color();
  return {
    resize() { renderer.getDrawingBufferSize(size); target.setSize(size.x, size.y); glow.setSize(Math.max(1, Math.round(size.x / 4)), Math.max(1, Math.round(size.y / 4))); uniforms.pixel.value.set(1 / size.x, 1 / size.y); },
    render(scene, view, t, quality) {
      uniforms.time.value = t; uniforms.near.value = view.near; uniforms.far.value = view.far;
      const officer = scene.getObjectByName('world-officer') || scene.getObjectByName('incident-officer') || scene.getObjectByName('vesta-character');
      if (officer?.visible) { officer.getWorldPosition(position); position.applyMatrix4(view.matrixWorldInverse); uniforms.focus.value = Math.max(.3, -position.z); }
      else uniforms.focus.value = view.userData.focusDistance || 18;
      uniforms.aperture.value = quality === 'high' ? 1 : 0;
      renderer.resetState(); renderer.setRenderTarget(target); renderer.render(scene, view);
      const mask = view.layers.mask, background = scene.background, alpha = renderer.getClearAlpha(); renderer.getClearColor(savedClear);
      view.layers.set(1); scene.background = null; renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(glow); renderer.render(scene, view);
      view.layers.mask = mask; scene.background = background; renderer.setClearColor(savedClear, alpha);
      renderer.setRenderTarget(null); renderer.render(screen, camera);
    },
    dispose() { target.depthTexture.dispose(); target.dispose(); glow.dispose(); quad.geometry.dispose(); material.dispose(); }
  };
}
