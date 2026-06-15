import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";

// props sized by real-world HEIGHT (metres; Gandalf ≈ 1.9 m) for human scale
async function prop(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToHeight(m, height);          // grounds the base at y=0 (sets position.y)
  m.position.x = x; m.position.z = z; // keep the grounding offset — don't clobber y
  m.rotation.y = ry;
  scene.add(m);
}

/** Static ambient props that dress the world (no animation in 2a). */
export async function buildAmbient(scene: THREE.Scene): Promise<void> {
  // positions chosen to sit beside the road (not on it) and clear of the river,
  // the village footprints, and each other — see the clearance pass in world.ts notes.
  await prop(scene, "covered-wagon", -46, 18, 2.6, 0.6);  // resting by Bywater
  await prop(scene, "campfire", -40, 28, 1.2, 0);
  await prop(scene, "market-stall", -16, -4, 3, -0.5);    // Bree market
  await prop(scene, "signpost", -59, 16, 2.6, 0.3);       // the journey's first waymark
  await prop(scene, "route-marker", 18, -22, 1.6, 0);     // beside the road to the crossing
  await prop(scene, "route-marker", 51, 4, 1.6, 0);       // beside the road to Isengard
}
