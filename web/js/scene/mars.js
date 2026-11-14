export async function build({ THREE, mode }) {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vP, vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP, vN;
      float hash(vec3 p){ p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      float noise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float terrain = noise(vP*4.0)*.55 + noise(vP*13.0)*.27 + noise(vP*39.0)*.18;
        vec3 col = mix(vec3(.13,.055,.028),vec3(.63,.29,.12),smoothstep(.25,.8,terrain));
        col = mix(col,vec3(.75,.62,.46),smoothstep(.91,.99,abs(vP.y))*.6);
        float sun=max(0.0,dot(normalize(vN),normalize(vec3(-.8,.5,.65))));
        gl_FragColor=vec4(col*(.09+sun*1.55),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, mode === 'low' ? 32 : 48, 32), material);
  group.add(planet);
  return { group, update(t) { planet.rotation.y = .42 + t * .008; } };
}
