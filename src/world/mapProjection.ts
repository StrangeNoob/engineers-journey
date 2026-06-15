import { ROAD_POINTS } from "../data/world";

/** Closest point on the road polyline to (sx,sz), plus a Y-rotation facing the stop.
 *  Used as the fast-travel landing point — on the road beside the village, within the
 *  ~14 m tale-recall range; collision keeps the player out of the building. */
export function travelTarget(sx: number, sz: number): { x: number; z: number; faceY: number } {
  let bx = ROAD_POINTS[0][0], bz = ROAD_POINTS[0][1], best = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i++) {
    const [ax, az] = ROAD_POINTS[i], [cx, cz] = ROAD_POINTS[i + 1];
    const dx = cx - ax, dz = cz - az;
    const t = Math.max(0, Math.min(1, ((sx - ax) * dx + (sz - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(sx - px, sz - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return { x: bx, z: bz, faceY: Math.atan2(sx - bx, sz - bz) }; // rotation.y convention: atan2(dirX, dirZ)
}

/** Id of the stop nearest (x,z) — drives the map's "you are here" marker. */
export function nearestStop(x: number, z: number, stops: { id: string; x: number; z: number }[]): string {
  let id = stops[0].id, best = Infinity;
  for (const s of stops) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best) { best = d; id = s.id; }
  }
  return id;
}

/** Id of the unvisited stop nearest (x,z); null if all visited (drives the nudge pulse). */
export function nearestUnvisited(
  x: number, z: number,
  stops: { id: string; x: number; z: number }[],
  isVisited: (id: string) => boolean,
): string | null {
  let id: string | null = null, best = Infinity;
  for (const s of stops) {
    if (isVisited(s.id)) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best) { best = d; id = s.id; }
  }
  return id;
}
