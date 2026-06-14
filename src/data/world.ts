// World placement data: where each landmark/prop sits, and the road/river control points.
// Coordinate convention: +x east, -z north. Mirrors the illustrated map.

export interface Placement {
  id: string;       // matches a STOP id, or "argonath"
  x: number; z: number;
  facingDeg: number; // yaw in degrees (0 faces +z/south)
  footprint: number; // fit width in world units
  sink: number;      // tuck base under ground
}

export const STOP_PLACEMENTS: Placement[] = [
  { id: "shire",    x: -60, z: 55,  facingDeg: 30,  footprint: 11, sink: 0.1 },
  { id: "bywater",  x: -52, z: 12,  facingDeg: 80,  footprint: 11, sink: 0.1 },
  { id: "bree",     x: -8,  z: 4,   facingDeg: 120, footprint: 12, sink: 0.1 },
  { id: "edoras",   x: 6,   z: -44, facingDeg: 160, footprint: 13, sink: 0.1 },
  { id: "isengard", x: 56,  z: 16,  facingDeg: 230, footprint: 12, sink: 0.2 },
  { id: "minas",    x: 74,  z: -52, facingDeg: 200, footprint: 16, sink: 0.4 },
];

export const ARGONATH: Placement = { id: "argonath", x: 34, z: -8, facingDeg: 180, footprint: 14, sink: 0 };

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
