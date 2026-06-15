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
// Every building stays clearly taller than Gandalf (~1.9 m) — the smallest (Shire, 5 m) is
// still ~2.6× him. The giants are trimmed so they fit the compact world without the road
// running into them, while remaining monumental (Minas the tallest at 24 m).
// The ROAD_POINTS below trace a smooth continuous arc; every building sits just OFF
// that arc (offset to the open side) so the road passes BESIDE each village rather
// than running through it. x/z here are the offset (beside-the-road) positions.
export const STOP_PLACEMENTS: Placement[] = [
  { id: "shire",    x: -68.8, z: 53.4, facingDeg: 110, height: 5,  footprint: 11, sink: 0.15 },
  { id: "bywater",  x: -59.4, z: 4.5,  facingDeg: 75,  height: 7,  footprint: 11, sink: 0.15 },
  { id: "bree",     x: 0,     z: 12.3, facingDeg: 254, height: 9,  footprint: 13, sink: 0.15 },
  { id: "edoras",   x: 2.2,   z: -57.4,facingDeg: 46,  height: 13, footprint: 18, sink: 0.15 },
  { id: "isengard", x: 65.6,  z: 24.7, facingDeg: 258, height: 18, footprint: 16, sink: 0.2 },
  { id: "minas",    x: 91.5,  z: -47.3,facingDeg: 285, height: 24, footprint: 26, sink: 0.3 },
];

// The Pillars of the Kings stand astride the river just off the road, beside the bridge.
export const ARGONATH: Placement = { id: "argonath", x: 31.1, z: 5.7, facingDeg: 180, height: 20, footprint: 17, sink: 0 };

/** Road control points: a smooth continuous arc threading the journey. Buildings sit beside it. */
export const ROAD_POINTS: [number, number][] = [
  [-60, 55], [-52, 12], [-8, 4], [6, -44], [34, -8], [56, 16], [74, -52],
];

/** River control points — crosses the road once, cleanly, on the Argonath→Isengard leg. */
export const RIVER_POINTS: [number, number][] = [
  [18, 26], [30, 8], [40, -10], [48, -28], [56, -46],
];

/** Where the bridge sits (the single road × river crossing). */
export const BRIDGE_AT: [number, number] = [37, -4.7];
