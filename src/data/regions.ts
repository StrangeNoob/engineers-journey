import { STOP_PLACEMENTS, ARGONATH } from "./world";

export interface RegionFog { color: number; near: number; far: number }

export interface RegionProfile {
  id: string;          // stop id or "argonath"; "" for the default/travel mood
  radius: number;      // full-mood radius (m) around the center
  falloff: number;     // band (m) over which the mood fades to DEFAULT
  lut: string | null;  // LUT filename in /assets/luts/; null → use the default LUT
  ground: string | null; // PBR ground-texture basename in /assets/textures/pbr/; null → base grass
  fog: RegionFog;
  exposure: number;
}

export interface Region extends RegionProfile { center: { x: number; z: number } }

/** Travel / Shire / Bywater: the warm lush-green base grade (matches the M1 default).
 *  radius/falloff are 0 intentionally — DEFAULT is never a REGIONS entry, so its
 *  falloff is never used as a divisor in regionWeight. */
export const DEFAULT_PROFILE: RegionProfile = {
  id: "", radius: 0, falloff: 0,
  lut: "golden-hour.cube",
  ground: null,
  fog: { color: 0xe7decb, near: 60, far: 360 },
  exposure: 1.05, // tuned for the LUT colour-grade (which adds contrast + pulls brightness down)
};

// Per-area moods (starting values; tunable in-browser via the debug overlay).
// `ground` paints a soft-edged PBR floor patch at the region center (null → base grass).
const RAW: RegionProfile[] = [
  { id: "bree",     radius: 22, falloff: 14, lut: "bree.cube",         ground: "paving", fog: { color: 0xe0cda0, near: 50, far: 300 }, exposure: 0.95 },
  { id: "edoras",   radius: 24, falloff: 16, lut: "edoras.cube",       ground: null,     fog: { color: 0xe8dcc0, near: 60, far: 360 }, exposure: 1.10 },
  { id: "isengard", radius: 24, falloff: 16, lut: "isengard.cube",     ground: "snow",   fog: { color: 0xccd6dd, near: 42, far: 220 }, exposure: 1.02 },
  { id: "minas",    radius: 28, falloff: 18, lut: "minas-tirith.cube", ground: "paving", fog: { color: 0xdfe7ec, near: 80, far: 360 }, exposure: 1.20 },
  { id: "argonath", radius: 20, falloff: 14, lut: "minas-tirith.cube", ground: null,     fog: { color: 0xc8d0d4, near: 50, far: 300 }, exposure: 1.00 },
];

const PLACE = new Map([...STOP_PLACEMENTS, ARGONATH].map((p) => [p.id, p]));

export const REGIONS: Region[] = RAW.map((r) => {
  const p = PLACE.get(r.id);
  if (!p) throw new Error(`region "${r.id}" has no placement in world.ts`);
  return { ...r, center: { x: p.x, z: p.z } };
});
