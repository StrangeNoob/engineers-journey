import * as THREE from "three";
export function createGround(): THREE.Mesh {
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(140, 64),
    new THREE.MeshStandardMaterial({ color: 0x8a9c57, roughness: 1 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}
