import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";

export interface Landmark { id: string; group: THREE.Group; collider: { x: number; z: number; r: number }; scrollPos: THREE.Vector3; }

export async function placeShire(scene: THREE.Scene): Promise<Landmark> {
  const gltf = await loadGLTF("shire-home");
  const group = gltf.scene as unknown as THREE.Group;
  toonify(group);
  fitToGround(group, 9);
  group.position.set(0, group.position.y, -14);
  scene.add(group);
  return {
    id: "shire",
    group,
    collider: { x: 0, z: -14, r: 5.5 },
    scrollPos: new THREE.Vector3(0, 0.5, -8.5), // in front of the door, on the path
  };
}
