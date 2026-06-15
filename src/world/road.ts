import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { ROAD_POINTS, BRIDGE_AT } from "../data/world";

type Pt = [number, number];
type Collider = { x: number; z: number; r: number };

// the road spline, shared by the bridge-axis calc and the tile layout
const roadCurve = new THREE.CatmullRomCurve3(ROAD_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));

// deck axis = the road's direction at the crossing (nearest curve sample to the bridge)
function bridgeAxis(): { ux: number; uz: number } {
  let bu = 0, best = Infinity;
  for (let i = 0; i <= 200; i++) { const u = i / 200; const q = roadCurve.getPointAt(u); const d = Math.hypot(q.x - BRIDGE_AT[0], q.z - BRIDGE_AT[1]); if (d < best) { best = d; bu = u; } }
  const t = roadCurve.getTangentAt(bu);
  return { ux: t.x, uz: t.z };
}

// The arched stone bridge over the stream. Its deck floor rises to ~2.6 m at the
// centre, so the player has to climb up and over it instead of walking through.
// Fully computed at module load — bridgeHeight() has no dependency on build order.
const BRIDGE = { cx: BRIDGE_AT[0], cz: BRIDGE_AT[1], ...bridgeAxis(), peak: 2.55, halfLen: 4.2, halfWidth: 1.6 };

/** Deck height of the bridge at (x,z) — a parabolic arch along the road; 0 off the deck. */
export function bridgeHeight(x: number, z: number): number {
  const dx = x - BRIDGE.cx, dz = z - BRIDGE.cz;
  const along = dx * BRIDGE.ux + dz * BRIDGE.uz;       // distance along the deck
  const across = dx * BRIDGE.uz - dz * BRIDGE.ux;      // distance to either side
  if (Math.abs(along) >= BRIDGE.halfLen || Math.abs(across) >= BRIDGE.halfWidth) return 0;
  const t = along / BRIDGE.halfLen;
  return BRIDGE.peak * (1 - t * t);
}

// is (x,z) on the bridge footprint? (used to skip flat road tiles there)
function onBridge(x: number, z: number): boolean {
  const dx = x - BRIDGE.cx, dz = z - BRIDGE.cz;
  return Math.abs(dx * BRIDGE.ux + dz * BRIDGE.uz) < BRIDGE.halfLen + 0.5
      && Math.abs(dx * BRIDGE.uz - dz * BRIDGE.ux) < BRIDGE.halfWidth + 0.5;
}

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
export async function buildRoad(scene: THREE.Scene, colliders: Collider[] = []): Promise<void> {
  const curve = roadCurve;
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
    if (onBridge(p.x, p.z)) continue;  // the raised bridge deck is the surface here, not a flat tile
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
  bm.rotation.y = Math.atan2(-BRIDGE.uz, BRIDGE.ux); // bridge deck runs along the road
  scene.add(bm);

  // parapet colliders down both sides of the deck so the player stays on the bridge
  const px = BRIDGE.uz, pz = -BRIDGE.ux;             // perpendicular (across) direction
  for (let a = -BRIDGE.halfLen; a <= BRIDGE.halfLen; a += 1.1) {
    for (const side of [-1, 1]) {
      const off = side * 1.45;
      colliders.push({ x: BRIDGE.cx + BRIDGE.ux * a + px * off, z: BRIDGE.cz + BRIDGE.uz * a + pz * off, r: 0.35 });
    }
  }
}
