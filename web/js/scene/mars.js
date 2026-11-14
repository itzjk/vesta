import { photoPlanet } from './imagery.js';

export async function build({ THREE, mode, camera }) {
  const group = new THREE.Group(), planet = await photoPlanet(THREE, 'mars', mode); group.add(planet);
  return { group, update(t) { if (camera) { planet.quaternion.copy(camera.quaternion); planet.rotateZ(Math.sin(t * .009) * .025); } else planet.rotation.z = Math.sin(t * .009) * .025; } };
}
