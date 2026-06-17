import * as THREE from "three";
import { createPBRMaterial } from "./materials";

const texLoader = new THREE.TextureLoader();
/** Load a tiling ground map: repeats across the large ground, with mip + anisotropy so it
 *  holds up at grazing/distant angles. (~5.4 m per tile across the 520 m diameter.) */
function groundTex(url: string): THREE.Texture {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(96, 96);
  t.anisotropy = 8;
  return t;
}

/** Large flat ground with tiling PBR grass. (Scene fog is owned by the environment module.) */
export function createTerrain(scene: THREE.Scene): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 72),
    createPBRMaterial(
      { roughness: 1, metalness: 0, normalScale: 1, envMapIntensity: 1.0 },
      {
        albedo: groundTex("/assets/textures/pbr/grass_albedo.jpg"),
        normal: groundTex("/assets/textures/pbr/grass_normal.jpg"),
        roughness: groundTex("/assets/textures/pbr/grass_roughness.jpg"),
      },
    ),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
