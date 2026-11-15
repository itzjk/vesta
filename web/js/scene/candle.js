export async function build({ THREE: T, mode = 'high' }) {
  const group = new T.Group();
  group.name = 'candle-observation';
  const low = mode === 'low';
  const uniforms = { steps: { value: low ? 28 : 44 }, time: { value: 0 }, space: { value: 1 }, eye: { value: new T.Vector3() } };
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true, side: T.BackSide, blending: T.AdditiveBlending,
    vertexShader: 'varying vec3 local;void main(){local=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec3 local;
      uniform vec3 eye;
      uniform mat4 projectionMatrix,modelViewMatrix;
      uniform float time,space,steps;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(a),hash(a+vec3(1,0,0)),f.x),mix(hash(a+vec3(0,1,0)),hash(a+vec3(1,1,0)),f.x),f.y),mix(mix(hash(a+vec3(0,0,1)),hash(a+vec3(1,0,1)),f.x),mix(hash(a+vec3(0,1,1)),hash(a+vec3(1,1,1)),f.x),f.y),f.z);}
      float pulse(float t){return sin(t*7.1)*sin(t*11.3+.7)*.55+sin(t*3.7+1.2)*.3;}
      void main(){
        vec3 ray=normalize(local-eye), inv=1./ray;
        vec3 a=(vec3(-.36,-.015,-.36)-eye)*inv,b=(vec3(.36,.9,.36)-eye)*inv;
        vec3 lo=min(a,b),hi=max(a,b);
        float begin=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
        if(end<=begin)discard;
        float stepSize=(end-begin)/steps;
        float jitter=hash(vec3(gl_FragCoord.xy,0.));
        vec3 emission=vec3(0.);
        float weightedDepth=0.,totalEnergy=0.;
        float height=mix(.69,.245,space)*(1.+pulse(time)*mix(.035,.008,space));
        for(int i=0;i<${low ? 28 : 44};i++){
          if(float(i)>=steps)break;
          vec3 p=eye+ray*(begin+(float(i)+jitter)*stepSize);
          float h=(p.y-.012)/height;
          float wickX=mix(.001,.010,smoothstep(.035,.105,p.y))-smoothstep(.11,.16,p.y)*.005;
          if(p.y>.009&&p.y<.16&&length(p.xz-vec2(wickX,0.))<.0135)break;
          float trail=(p.y-.64)/.25;
          if(trail>0.&&trail<1.){
            float wispX=sin(trail*8.-time*2.1)*.012+sin(time*3.7+1.2)*.007;
            float wisp=exp(-pow((p.x-wispX)/(.008+trail*.012),2.)-pow(p.z/.016,2.))*sin(trail*3.14159);
            emission+=vec3(.12,.045,.018)*wisp*stepSize*(1.-space)*.6;
          }
          if(h<0.||h>1.08)continue;
          float lift=time*mix(1.9,.16,space);
          float n=noise(p*vec3(29.,19.,29.)-vec3(0.,lift,0.));
          float fine=noise(p*97.-vec3(0.,lift*3.,time*.2));
          float sway=(sin(time*3.7+1.2)*.007+sin(time*7.1)*sin(time*11.3+.7)*.005)*pow(max(h,0.),1.7)*(1.-space);
          vec2 q=p.xz-vec2(sway,sway*.38);
          float radius=length(q);
          float earthWidth=.108*pow(max(0.,1.-h),.68)*smoothstep(-.15,.13,h);
          float domeWidth=.218*sqrt(max(0.,1.-pow(max(h-.015,0.),2.35)));
          float width=mix(earthWidth,domeWidth,space);
          width+=(n-.5)*mix(.008,.015,space)+(fine-.5)*.002;
          float edge=1.-smoothstep(width-.008,width+.012,radius);
          float inside=1.-smoothstep(0.,max(width,.001),radius);
          float vertical=smoothstep(0.,.038,h)*(1.-smoothstep(.97,1.055,h));
          float dark=1.-exp(-pow(radius/.052,2.))* (1.-smoothstep(.15,.57,h));
          float yellow=pow(smoothstep(.17,.55,h),1.4)*(1.-smoothstep(.83,1.04,h));
          float mantle=edge*vertical*dark;
          float luminous=mantle*yellow*(.48+inside*.9)*(.68+n*.48+fine*.24);
          vec3 warm=mix(vec3(2.7,.37,.025),vec3(5.8,3.9,1.65),smoothstep(.25,.72,h));
          warm=mix(warm,vec3(1.55,.19,.012),smoothstep(.79,1.03,h));
          float blueSkin=exp(-pow((radius-width+.006)/.012,2.))*vertical*(1.-smoothstep(.10,.29,h));
          float sideLight=pow(clamp(abs(q.x*ray.z-q.y*ray.x)/max(width*length(ray.xz),.001),0.,1.),3.);
          blueSkin*=mix(.12,1.,sideLight);
          vec3 earth=warm*luminous*5.3+vec3(.015,.065,1.4)*blueSkin*1.35;
          earth+=vec3(.3,.058,.012)*mantle*(1.-yellow)*2.;
          float skin=exp(-pow((radius-width+.009)/.024,2.));
          float lower=1.-smoothstep(.10,.9,h);
          float softEdge=1.-smoothstep(width-.018,width+.027,radius);
          float front=1.-smoothstep(-.025,.035,dot(p.xz,ray.xz));
          float tangent=abs(q.x*ray.z-q.y*ray.x)/max(width*length(ray.xz),.001);
          float opening=mix(smoothstep(.48,.88,tangent),1.,smoothstep(.08,.4,h));
          float skirt=mix(front,1.,smoothstep(.05,.38,h))*opening;
          float dome=softEdge*vertical*(.028+skin*(1.1+lower*.7))*(.7+n*.46+fine*.12)*skirt;
          vec3 blue=mix(vec3(.008,.025,.25),vec3(.014,.42,1.75),skin*.65);
          vec3 cold=blue*dome*1.15;
          float core=exp(-pow(radius/.115,2.)-pow((h-.64)/.22,2.))*vertical;
          cold+=vec3(.68,.085,.23)*core*.32;
          cold*=1.-exp(-pow(radius/.024,2.))*(1.-smoothstep(.13,.6,h))*.88;
          vec3 sampleColor=mix(earth,cold,space)*stepSize;
          float energy=max(sampleColor.r,max(sampleColor.g,sampleColor.b));
          weightedDepth+=(begin+(float(i)+jitter)*stepSize)*energy;totalEnergy+=energy;
          emission+=sampleColor;
        }
        vec3 color=emission;
        float alpha=clamp(max(color.r,max(color.g,color.b)),0.,1.);
        if(alpha<.001)discard;
        gl_FragColor=vec4(color/max(alpha,.001),alpha);
        float rayDepth=totalEnergy>.00001?weightedDepth/totalEnergy:(begin+end)*.5;
        vec4 clip=projectionMatrix*modelViewMatrix*vec4(eye+ray*rayDepth,1.);
        gl_FragDepth=clip.z/clip.w*.5+.5;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const bounds = new T.BoxGeometry(.72, .915, .72); bounds.translate(0, .4425, 0);
  const volume = new T.Mesh(bounds, material); volume.name = 'candle-emission'; volume.renderOrder = 8; volume.layers.enable(1);
  const eye = new T.Vector3();
  volume.onBeforeRender = (renderer, scene, camera) => { uniforms.steps.value = low || !renderer.shadowMap.enabled ? 28 : 44; camera.getWorldPosition(eye); volume.worldToLocal(eye); uniforms.eye.value.copy(eye); };
  group.add(volume);
  const metal = new T.MeshStandardMaterial({ color: 0x777b7c, metalness: .87, roughness: .34 });
  const darkMetal = new T.MeshStandardMaterial({ color: 0x596064, metalness: .65, roughness: .52 });
  const ceramic = new T.MeshStandardMaterial({ color: 0xb6aca0, roughness: .76, metalness: 0 });
  const char = new T.MeshStandardMaterial({ color: 0x0d0907, roughness: 1 });
  const fibre = new T.MeshStandardMaterial({ color: 0x31201a, roughness: .98 });
  const ember = new T.MeshStandardMaterial({ color: 0x4c1207, roughness: 1, emissive: 0xd02c08, emissiveIntensity: .4 });
  const add = (geometry, mat, y) => { const m = new T.Mesh(geometry, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const profile = [[0,-.255],[.067,-.255],[.082,-.242],[.084,-.225],[.075,-.214],[.075,-.095],[.067,-.075],[.065,-.055],[0,-.055]].map(([r,y])=>new T.Vector2(r,y));
  const body = add(new T.LatheGeometry(profile, low ? 32 : 64), darkMetal, 0); body.name = 'candle-burner';
  add(new T.CylinderGeometry(.066,.071,.027,40), metal, -.06);
  add(new T.CylinderGeometry(.052,.052,.065,40), ceramic, -.026);
  add(new T.TorusGeometry(.056,.004,8,48), metal, .007).rotation.x = Math.PI/2;
  const wickPath = new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.001,.048,0),new T.Vector3(.012,.105,-.002),new T.Vector3(.005,.158,.001)]);
  add(new T.TubeGeometry(wickPath,20,.0115,9,false),char,0);
  for(let i=0;i<7;i++){
    const points=[];
    for(let j=0;j<19;j++){
      const u=j/18, p=wickPath.getPoint(u), a=u*18+i*Math.PI*2/7;
      p.x+=Math.cos(a)*.010; p.z+=Math.sin(a)*.010; points.push(p);
    }
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.0023,4,false),i%3?char:fibre,0);
  }
  const coal=add(new T.SphereGeometry(.0105,10,8),ember,.151); coal.position.x=.006; coal.scale.set(.74,.37,.8); coal.layers.enable(1);
  const scratchMat = new T.MeshStandardMaterial({ color: 0x95958b, metalness: .7, roughness: .55 });
  for(let i=0;i<9;i++){
    const angle=i*2.399963, y=-.21+i*.013;
    const scratch=add(new T.BoxGeometry(.0007,.017+(i%3)*.007,.0005),scratchMat,y);
    scratch.position.x=Math.sin(angle)*.0753; scratch.position.z=Math.cos(angle)*.0753; scratch.rotation.y=angle;
  }
  const light=new T.PointLight(0x4f75ff,.15,0,2); light.name='candle-key'; light.position.set(0,.25,.015); group.add(light);
  const warm=new T.Color(0xffb25e),cool=new T.Color(0x497dff);
  const count=low?3:6, positions=new Float32Array(count*3), phases=new Float32Array(count);
  for(let i=0;i<count;i++)phases[i]=i/count;
  const dustGeo=new T.BufferGeometry(); dustGeo.setAttribute('position',new T.BufferAttribute(positions,3)); dustGeo.setAttribute('phase',new T.BufferAttribute(phases,1));
  const dustMat=new T.ShaderMaterial({uniforms:{time:uniforms.time,space:uniforms.space},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'attribute float phase;uniform float time,space;varying float alpha;void main(){float age=fract(phase+time*.087);alpha=pow(max(0.,sin(age*3.14159)),9.)*space*.4;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=2.2;}',
    fragmentShader:'varying float alpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.65,.29,.12,exp(-d*d*20.)*alpha);}' });
  const specks=new T.Points(dustGeo,dustMat); specks.renderOrder=9; specks.layers.enable(1); specks.frustumCulled=false;group.add(specks);
  group.userData.flameBounds = { earthHeight: .69, spaceHeight: .245, spaceRadius: .218, wickHeight: .158, origin: 'wick base', burnerBottom: -.255 };
  group.userData.illustration = 'Illustration of NASA candle observations, not a simulation. Low-momentum flames only.';
  return {group,defaults:{space:1},update(t,state={}){
    const time=Number.isFinite(t)?t:0,raw=state.space??1,space=Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):1;
    uniforms.time.value=time;uniforms.space.value=space;
    const pulse=Math.sin(time*7.1)*Math.sin(time*11.3+.7)*.55+Math.sin(time*3.7+1.2)*.3;
    light.color.copy(warm).lerp(cool,space);light.intensity=(1.5*(1-space)+.15*space)*(1+pulse*(.18-.16*space));
    light.position.y=.25-.1*space;light.position.x=Math.sin(time*3.7+1.2)*.007*(1-space);
    ember.emissiveIntensity=(.42-.35*space)*(1+pulse*.15);
    for(let i=0;i<count;i++){
      const age=((phases[i]+time*.087)%1+1)%1,angle=i*2.399963;
      positions.set([Math.cos(angle+age*.2)*(.035+age*.15),.065+age*.18,Math.sin(angle)*(.035+age*.13)],i*3);
    }
    dustGeo.attributes.position.needsUpdate=true;
  }};
}
