import { globePlanet } from './imagery.js';

export async function build({ THREE, mode, sunDirection = [6, 8, 8] }) {
  const group = new THREE.Group(), planet = await globePlanet(THREE, 'mars', mode); group.add(planet);
  const worldSun = new THREE.Vector3(...sunDirection).normalize(), localSun = worldSun.clone(), orientation = new THREE.Quaternion();
  planet.material.onBeforeCompile = shader => {
    shader.uniforms.daylightSun = { value: localSun };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 daylightNormal;').replace('#include <begin_vertex>', '#include <begin_vertex>\ndaylightNormal=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 daylightNormal;\nuniform vec3 daylightSun;').replace('#include <opaque_fragment>', `
      float incidence=dot(normalize(daylightNormal),daylightSun);
      float daylight=smoothstep(-.025,.045,incidence);
      outgoingLight*=mix(.0015, .2+.8*sqrt(max(0.,incidence)),daylight);
      #include <opaque_fragment>
    `);
  };
  planet.material.customProgramCacheKey = () => 'vesta-mars-day-night-3';
  return { group, update(t) {
    planet.userData.spin(t);
    planet.getWorldQuaternion(orientation).invert(); localSun.copy(worldSun).applyQuaternion(orientation).normalize();
  } };
}
