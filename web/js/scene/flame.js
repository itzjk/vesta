export async function build({ THREE, mode }) {
  const group = new THREE.Group(); group.name = 'illustrated-flame';
  const uniforms = { uSteps: { value: mode === 'low' ? 32 : 48 }, uTime: { value: 0 }, uSpace: { value: 1 }, uCamera: { value: new THREE.Vector3() } };
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: true, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec3 vLocal;
      uniform vec3 uCamera;
      uniform float uTime, uSpace, uSteps;
      uniform mat4 projectionMatrix, modelViewMatrix;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 ray=normalize(vLocal-uCamera), inv=1./ray;
        vec3 a=(vec3(-1.35,-1.25,-1.35)-uCamera)*inv,b=(vec3(1.35,2.5,1.35)-uCamera)*inv;
        vec3 lo=min(a,b), hi=max(a,b);
        float start=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
        if(end<=start) discard;
        float stride=(end-start)/uSteps,alpha=0.,hit=-1.;vec3 color=vec3(0.);float jitter=hash(vec3(gl_FragCoord.xy,floor(uTime*24.)));
        for(int i=0;i<48;i++){
          if(float(i)>=uSteps)break;
          vec3 p=uCamera+ray*(start+(float(i)+.3+jitter*.4)*stride);
          float h=clamp((p.y+1.)/3.25,0.,1.);
          vec3 drift=vec3(0.,-uTime*2.,uTime*.17);
          float n=noise(p*5.1+drift)*.65+noise(p*15.1+drift*1.7)*.25+noise(p*31.7+drift*2.1)*.1;
          vec2 warp=vec2(sin(p.y*4.7-uTime*3.),sin(p.y*3.1-uTime*2.3))*.12*h;
          float radius=length(p.xz+warp),width=.57*pow(max(.001,1.-h),.68)*smoothstep(0.,.13,h);
          float earthShell=exp(-pow((radius-width)*12.+(n-.5)*1.8,2.));
          float earthFill=(1.-smoothstep(width*.4,width,radius))*.018;
          earthShell*=.35+n*1.1;
          float earth=(earthShell+earthFill)*smoothstep(-1.,-.8,p.y)*(1.-smoothstep(2.05,2.25,p.y));
          float spherical=length(p),ripple=(noise(p*5.+uTime*.23)-.5)*.045;
          float shell=exp(-pow((spherical-.89+ripple)*12.,2.))*(.72+noise(p*17.+uTime*.4)*.28);
          float impact=length(cross(p,ray));
          float space=shell*.68*mix(.16,1.,smoothstep(.25,.9,impact))+(1.-smoothstep(.55,.86,spherical))*.025*(.65+noise(p*6.+uTime*.7)*.35);
          vec3 yellow=mix(vec3(3.2,.38,.008),vec3(4.2,1.9,.08),n*.62+earthShell*.35);
          yellow=mix(vec3(.025,.19,1.6),yellow,smoothstep(-.94,-.48,p.y));
          yellow*=1.-smoothstep(.58,1.,h)*(.6+n*.3);
          yellow*=1.-(1.-smoothstep(.16,.42,h))*(1.-smoothstep(0.,width*.75,radius))*.88;
          vec3 blue=mix(vec3(.008,.04,.32),vec3(.025,.32,2.3),shell)*(.72+.28*noise(p*8.+uTime*.4));
          float density=mix(earth,space,uSpace),opacity=1.-exp(-density*stride*2.0);
          if(hit<0.&&density>.035)hit=start+(float(i)+.5)*stride;
          color+=(1.-alpha)*mix(yellow,blue,uSpace)*opacity;
          alpha+=(1.-alpha)*opacity;
          if(alpha>.985)break;
        }
        if(alpha<.003)discard;
        gl_FragColor=vec4(color/max(alpha,.001),alpha);
        vec4 clip=projectionMatrix*modelViewMatrix*vec4(uCamera+ray*max(start,hit),1.);
        gl_FragDepth=clip.z/clip.w*.5+.5;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const geometry = new THREE.BoxGeometry(2.7, 3.75, 2.7); geometry.translate(0, .625, 0);
  const volume = new THREE.Mesh(geometry, material); volume.renderOrder = 5; volume.layers.enable(1);
  const eye = new THREE.Vector3();
  volume.onBeforeRender = (renderer, scene, camera) => { uniforms.uSteps.value = renderer.shadowMap.enabled ? 48 : 32; camera.getWorldPosition(eye); volume.worldToLocal(eye); uniforms.uCamera.value.copy(eye); };
  const smokeCount = mode === 'low' ? 16 : 28;
  const smokePositions = new Float32Array(smokeCount * 3), smokePhases = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i++) smokePhases[i] = i / smokeCount;
  const smokeGeometry = new THREE.BufferGeometry(); smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3)); smokeGeometry.setAttribute('phase', new THREE.BufferAttribute(smokePhases, 1));
  const smokeMaterial = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, space: { value: 1 }, pixelRatio: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float phase;uniform float time,space,pixelRatio;varying float age;void main(){age=fract(phase+time*.13);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=min(105.,(25.+age*65.)*pixelRatio/max(1.,-p.z*.32));}`,
    fragmentShader: `varying float age;uniform float space;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float cloud=exp(-d*d*19.)*(1.-smoothstep(.35,.5,d));float wisps=.8+.2*sin(q.x*23.+age*7.)*cos(q.y*17.);float opacity=cloud*wisps*sin(age*3.14159)*mix(.08,.018,space);gl_FragColor=vec4(mix(vec3(.035,.03,.025),vec3(.12,.17,.23),space),opacity);}` });
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial); smoke.renderOrder = 6; smoke.frustumCulled = false;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.018, .028, .22, 8), new THREE.MeshStandardMaterial({ color: 0x171512, roughness: .96 })); tip.position.y = -.91;
  const light = new THREE.PointLight(0x4e8dff, 8, 9, 2); group.add(volume, smoke, light, tip);
  const warm = new THREE.Color(0xffa23c), cool = new THREE.Color(0x447eff);
  return {
    group, defaults: { space: 1 },
    update(t, state = {}) {
      const space = Math.max(0, Math.min(1, state.space ?? 1)); uniforms.uTime.value = t; uniforms.uSpace.value = space;
      light.color.copy(warm).lerp(cool, space); light.intensity = (72 * (1 - space) + 9 * space) * (1 + Math.sin(t * 4.1) * Math.sin(t * 6.7 + .4) * (.16 - space * .13));
      smokeMaterial.uniforms.time.value = t; smokeMaterial.uniforms.space.value = space; smokeMaterial.uniforms.pixelRatio.value = Math.min(1.5, devicePixelRatio || 1);
      for (let i = 0; i < smokeCount; i++) {
        const age = (smokePhases[i] + t * .13) % 1, angle = i * 2.399963, radial = 1.04 + age * 1.5;
        const earthX = Math.sin(i * 1.7 + age * 4.) * (.06 + age * .3), earthY = 1.7 + age * 2., earthZ = Math.cos(angle) * age * .22;
        const y = Math.sin(angle) * radial, x = Math.cos(angle) * radial, z = Math.sin(i * 3.1) * radial * .65;
        smokePositions.set([earthX * (1 - space) + x * space, earthY * (1 - space) + y * space, earthZ * (1 - space) + z * space], i * 3);
      }
      smokeGeometry.attributes.position.needsUpdate = true;
    }
  };
}
