import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";

// props sized by real-world HEIGHT (metres; Gandalf ≈ 1.9 m) for human scale
async function prop(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToHeight(m, height);
  m.position.set(x, 0, z);
  m.rotation.y = ry;
  scene.add(m);
}

/** Static ambient props that dress the world (no animation in 2a). */
export async function buildAmbient(scene: THREE.Scene): Promise<void> {
  await prop(scene, "covered-wagon", -16, 8, 2.6, 0.6);
  await prop(scene, "campfire", -34, 30, 1.2, 0);
  await prop(scene, "market-stall", -4, 11, 3, -0.5);
  await prop(scene, "signpost", -22, 6, 2.6, 0.3);
  await prop(scene, "route-marker", 24, -22, 1.6, 0);
  await prop(scene, "route-marker", 48, 4, 1.6, 0);
}
