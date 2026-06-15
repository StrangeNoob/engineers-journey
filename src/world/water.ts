import * as THREE from "three";
import { loadGLTF, toonify, fitToGround, fitToHeight } from "./assets";
import { RIVER_POINTS } from "../data/world";

type Collider = { x: number; z: number; r: number };

// fountain/well are sized by real-world HEIGHT (metres) for human scale
async function placeOnce(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0, colliders?: Collider[]): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  const size = fitToHeight(m, height); // grounds the base at y=0 (sets position.y); returns world size
  m.position.x = x; m.position.z = z; m.position.y += 0.02; // keep grounding; tiny lift off the terrain
  m.rotation.y = ry;
  scene.add(m);
  if (colliders) colliders.push({ x, z, r: Math.max(size.x, size.z) * 0.45 });
}

/** River of stream tiles along the river spline; fountain + well at Bree. */
export async function buildWater(scene: THREE.Scene, colliders: Collider[] = []): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const tile = await loadGLTF("stream-straight");
  const len = curve.getLength();
  const TILE_LEN = 5;     // fit the tile's long (X) axis to 5 m
  const STEP = 4.3;       // < TILE_LEN so consecutive tiles overlap into a continuous brook
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // arc-length sampling (getPointAt) for even, continuous tiles — see road.ts
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, TILE_LEN);          // grounds the tile (sets position.y)
    m.position.x = p.x; m.position.z = p.z; m.position.y += 0.01; // keep grounding; lift off terrain
    m.rotation.y = Math.atan2(-tan.z, tan.x); // align the tile's +X (its length) with the river
    scene.add(m);
  }
  await placeOnce(scene, "well", 12, 20, 3, 0, colliders);            // ~3 m well, in Bree's square
  await placeOnce(scene, "the-fountain", 6, 23, 3.2, 0, colliders);  // ~3 m fountain, clear of the well
}
