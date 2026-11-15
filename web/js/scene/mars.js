import { photoPlanet } from './imagery.js';

export async function build({ THREE, mode, camera, sunDirection = [6, 8, 8] }) {
  const group = new THREE.Group(), planet = await photoPlanet(THREE, 'mars', mode); group.add(planet);
  const worldSun = new THREE.Vector3(...sunDirection).normalize(), localSun = worldSun.clone(), orientation = new THREE.Quaternion();
  const compile = planet.material.onBeforeCompile;
  planet.material.onBeforeCompile = shader => {
    compile(shader);
    shader.uniforms.daylightSun = { value: localSun };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 daylightNormal;').replace('#include <begin_vertex>', '#include <begin_vertex>\ndaylightNormal=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 daylightNormal;\nuniform vec3 daylightSun;').replace('#include <opaque_fragment>', `
      float incidence=dot(normalize(daylightNormal),daylightSun);
      float daylight=smoothstep(-.025,.045,incidence);
      outgoingLight*=mix(.0015, .2+.8*sqrt(max(0.,incidence)),daylight);
      #include <opaque_fragment>
    `);
  };
  planet.material.customProgramCacheKey = () => 'vesta-mars-day-night-2';
  return { group, update(t) {
    if (camera) { planet.quaternion.copy(camera.quaternion); planet.rotateZ(Math.sin(t * .009) * .025); }
    else planet.rotation.z = Math.sin(t * .009) * .025;
    planet.getWorldQuaternion(orientation).invert(); localSun.copy(worldSun).applyQuaternion(orientation).normalize();
  } };
}
