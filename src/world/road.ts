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
    const u = i / n;
    // sample by ARC LENGTH (getPointAt), not raw curve parameter (getPoint): Catmull-Rom
    // parameter spacing is uneven, which left some tiles bunched and others gapped.
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, TILE_LEN);          // grounds the tile (sets position.y)
    m.position.x = p.x; m.position.z = p.z; m.position.y += 0.03; // keep grounding; lift off terrain
    m.rotation.y = Math.atan2(-tan.z, tan.x); // align the tile's +X (its length) with the path
    scene.add(m);
  }
  const bridge = await loadGLTF("stone-bridge");
  const bm = (bridge.scene as unknown as THREE.Group).clone(true);
  toonify(bm);
  fitToGround(bm, 8);
  bm.position.x = BRIDGE_AT[0]; bm.position.z = BRIDGE_AT[1]; bm.position.y += 0.1;
  // orient the deck along the road at the crossing: find the curve param nearest the bridge
  let bu = 0, bbest = Infinity;
  for (let i = 0; i <= 200; i++) { const u = i / 200; const q = curve.getPointAt(u); const d = Math.hypot(q.x - BRIDGE_AT[0], q.z - BRIDGE_AT[1]); if (d < bbest) { bbest = d; bu = u; } }
  const ct = curve.getTangentAt(bu);
  bm.rotation.y = Math.atan2(-ct.z, ct.x); // bridge deck runs along the road
  scene.add(bm);
}
