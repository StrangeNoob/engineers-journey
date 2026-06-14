import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { ROAD_POINTS, BRIDGE_AT } from "../data/world";

type Pt = [number, number];

/** Pure: Chaikin corner-cutting smoothing; pins endpoints. */
export function chaikin(points: Pt[], iterations: number): Pt[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Lay road tiles along the smoothed spline + a bridge at the river crossing. */
export async function buildRoad(scene: THREE.Scene): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(
    ROAD_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  );
  const len = curve.getLength();
  const tile = await loadGLTF("road-straight");
  const TILE_LEN = 6;     // fit the tile's long (X) axis to 6 m
  const STEP = 5.2;       // < TILE_LEN so consecutive tiles overlap into a continuous road
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, TILE_LEN);
    m.position.set(p.x, 0.03, p.z);
    m.rotation.y = Math.atan2(-tan.z, tan.x); // align the tile's +X (its length) with the path
    scene.add(m);
  }
  const bridge = await loadGLTF("stone-bridge");
  const bm = (bridge.scene as unknown as THREE.Group).clone(true);
  toonify(bm);
  fitToGround(bm, 7);
  bm.position.set(BRIDGE_AT[0], 0.1, BRIDGE_AT[1]);
  const ct = curve.getTangent(0.65);
  bm.rotation.y = Math.atan2(-ct.z, ct.x); // bridge deck runs along the road
  scene.add(bm);
}
