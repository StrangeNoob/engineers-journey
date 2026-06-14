import * as THREE from "three";
import { loadGLTF, toonify, fitToGround, fitToHeight } from "./assets";
import { RIVER_POINTS } from "../data/world";

// fountain/well are sized by real-world HEIGHT (metres) for human scale
async function placeOnce(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToHeight(m, height);
  m.position.set(x, 0.02, z);
  m.rotation.y = ry;
  scene.add(m);
}

/** River of stream tiles along the river spline; fountain + well at Bree. */
export async function buildWater(scene: THREE.Scene): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const tile = await loadGLTF("stream-straight");
  const len = curve.getLength();
  const TILE_LEN = 5;     // fit the tile's long (X) axis to 5 m
  const STEP = 4.3;       // < TILE_LEN so consecutive tiles overlap into a continuous brook
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), tan = curve.getTangent(t);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, TILE_LEN);
    m.position.set(p.x, 0.01, p.z);
    m.rotation.y = Math.atan2(-tan.z, tan.x); // align the tile's +X (its length) with the river
    scene.add(m);
  }
  await placeOnce(scene, "the-fountain", -2, 7, 3.2); // ~3 m fountain
  await placeOnce(scene, "well", -13, 9, 3);          // ~3 m well
}
