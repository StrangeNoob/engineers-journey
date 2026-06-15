// World placement data: where each landmark/prop sits, and the road/river control points.
// Coordinate convention: +x east, -z north. Mirrors the illustrated map.

export interface Placement {
  id: string;       // matches a STOP id, or "argonath"
  x: number; z: number;
  facingDeg: number; // yaw in degrees (0 faces +z/south)
  height: number;    // real-world height in metres (1 unit = 1 m; Gandalf ≈ 1.9 m) — controls visual scale
  footprint: number; // approx ground width in metres — used for the proximity collider + prompt anchor
  sink: number;      // tuck base under ground (metres)
}

// Heights are human-relative: a hobbit-hole is a touch over twice Gandalf's height; Edoras a
// great hall; Isengard a tower; Minas Tirith a tiered citadel climbing a peak.
// footprint = the building's ~visual ground width in metres (height × the model's aspect),
// used for the clearing it gets, the prompt anchor, and the proximity collider.
export const STOP_PLACEMENTS: Placement[] = [
  { id: "shire",    x: -60, z: 55,  facingDeg: 30,  height: 5,  footprint: 11, sink: 0.15 },
  { id: "bywater",  x: -52, z: 12,  facingDeg: 80,  height: 7,  footprint: 11, sink: 0.15 },
  { id: "bree",     x: -8,  z: 4,   facingDeg: 120, height: 9,  footprint: 13, sink: 0.15 },
  { id: "edoras",   x: 6,   z: -44, facingDeg: 160, height: 13, footprint: 18, sink: 0.15 },
  { id: "isengard", x: 56,  z: 16,  facingDeg: 230, height: 28, footprint: 25, sink: 0.2 },
  { id: "minas",    x: 74,  z: -52, facingDeg: 200, height: 45, footprint: 48, sink: 0.5 },
];

export const ARGONATH: Placement = { id: "argonath", x: 34, z: -8, facingDeg: 180, height: 34, footprint: 28, sink: 0 };

/** Road control points, in journey order (Argonath is a waypoint the road passes). */
export const ROAD_POINTS: [number, number][] = [
  [-60, 55], [-52, 12], [-8, 4], [6, -44], [34, -8], [56, 16], [74, -52],
];

/** River control points (a stream the road crosses near the Argonath). */
export const RIVER_POINTS: [number, number][] = [
  [12, -82], [26, -40], [34, -8], [44, 24], [58, 52],
];

/** Where the bridge sits (road × river crossing, near the Argonath). */
export const BRIDGE_AT: [number, number] = [34, -8];
