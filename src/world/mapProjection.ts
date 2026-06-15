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
