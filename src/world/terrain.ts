import * as THREE from "three";
import type { Quality } from "../engine/quality";

/** Large flat ground; tunes scene fog to the world scale + quality. */
export function createTerrain(scene: THREE.Scene, quality: Quality): THREE.Mesh {
  scene.fog = new THREE.Fog(0xe7decb, 60, quality.drawDistance);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 72),
    new THREE.MeshStandardMaterial({ color: 0x5a4f2e, roughness: 1 }), // dry earth tone so any gaps read as soil under the grass, not green lawn
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
