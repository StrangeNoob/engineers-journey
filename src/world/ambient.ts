import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";

type Collider = { x: number; z: number; r: number; low?: boolean };

// props sized by real-world HEIGHT (metres; Gandalf ≈ 1.9 m) for human scale
async function prop(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0, colliders?: Collider[], low?: boolean): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  const size = fitToHeight(m, height); // grounds the base at y=0 (sets position.y); returns world size
  m.position.x = x; m.position.z = z; // keep the grounding offset — don't clobber y
  m.rotation.y = ry;
  scene.add(m);
  // a solid footprint from the prop's own ground extent, so the player can't walk through it
  if (colliders) colliders.push({ x, z, r: Math.max(size.x, size.z) * 0.45, ...(low ? { low: true } : {}) });
}

/** Static ambient props that dress the world (no animation in 2a). */
export async function buildAmbient(scene: THREE.Scene, colliders: Collider[] = []): Promise<void> {
  // positions chosen to sit beside the road (not on it) and clear of the river,
  // the village footprints, and each other — see the clearance pass in world.ts notes.
  await prop(scene, "covered-wagon", -46, 18, 2.6, 0.6, colliders);           // resting by Bywater
  await prop(scene, "campfire", -40, 28, 1.2, 0, colliders, true);            // low: jumpable
  await prop(scene, "market-stall", -16, -4, 3, -0.5, colliders);             // Bree market
  await prop(scene, "signpost", -59, 16, 2.6, 0.3, colliders);                // the journey's first waymark
  await prop(scene, "route-marker", 18, -22, 1.6, 0, colliders, true);        // beside the road to the crossing — low: jumpable
  await prop(scene, "route-marker", 51, 4, 1.6, 0, colliders, true);          // beside the road to Isengard — low: jumpable
}
