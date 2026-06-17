import * as THREE from "three";
import type { Quality } from "../engine/quality";

/** Large flat ground; tunes scene fog to the world scale + quality. */
export function createTerrain(scene: THREE.Scene, quality: Quality): THREE.Mesh {
  scene.fog = new THREE.Fog(0xe7decb, 60, quality.drawDistance);
  // TODO: swap to tiling PBR grass/dirt/rock KTX2 maps when art lands
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 72),
    new THREE.MeshStandardMaterial({ color: 0x5a4f2e, roughness: 1, envMapIntensity: 1.0 }), // dry earth tone so any gaps read as soil under the grass, not green lawn
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
