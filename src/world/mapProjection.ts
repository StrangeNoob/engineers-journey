import { STOP_PLACEMENTS, ARGONATH, ROAD_POINTS, RIVER_POINTS } from "../data/world";

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface MapView { w: number; h: number; pad: number; } // SVG viewBox size + inner padding

/** Bounding box of every feature drawn on the map (villages ∪ Argonath ∪ road ∪ river). */
export function mapBounds(): Bounds {
  const xs: number[] = [], zs: number[] = [];
  for (const p of [...STOP_PLACEMENTS, ARGONATH]) { xs.push(p.x); zs.push(p.z); }
  for (const [x, z] of [...ROAD_POINTS, ...RIVER_POINTS]) { xs.push(x); zs.push(z); }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** World (x,z) → SVG (px,py). East (+x) → right; north (−z) → up. Uniform fit into the
 *  padded view, centered. */
export function worldToMap(x: number, z: number, b: Bounds, v: MapView): { px: number; py: number } {
  const bw = b.maxX - b.minX || 1, bh = b.maxZ - b.minZ || 1;
  const iw = v.w - v.pad * 2, ih = v.h - v.pad * 2;
  const s = Math.min(iw / bw, ih / bh);
  const ox = v.pad + (iw - bw * s) / 2;
  const oy = v.pad + (ih - bh * s) / 2;
  return { px: ox + (x - b.minX) * s, py: oy + (z - b.minZ) * s };
}

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
