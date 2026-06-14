import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { RIVER_POINTS } from "../data/world";

async function placeOnce(scene: THREE.Scene, name: string, x: number, z: number, footprint: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToGround(m, footprint);
  m.position.set(x, 0.02, z);
  m.rotation.y = ry;
  scene.add(m);
}

/** River of stream tiles along the river spline; fountain + well at Bree. */
export async function buildWater(scene: THREE.Scene): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const tile = await loadGLTF("stream-straight");
  const len = curve.getLength();
  const STEP = 4.6;
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), tan = curve.getTangent(t);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, 5);
    m.position.set(p.x, 0.01, p.z);
    m.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(m);
  }
  await placeOnce(scene, "the-fountain", -2, 7, 5);
  await placeOnce(scene, "well", -13, 9, 2.4);
}
