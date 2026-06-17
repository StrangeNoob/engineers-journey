import { STOP_PLACEMENTS, ARGONATH } from "./world";

export interface RegionFog { color: number; near: number; far: number }

export interface RegionProfile {
  id: string;          // stop id or "argonath"; "" for the default/travel mood
  radius: number;      // full-mood radius (m) around the center
  falloff: number;     // band (m) over which the mood fades to DEFAULT
  lut: string | null;  // LUT filename in /assets/luts/; null → use the default LUT
  fog: RegionFog;
  exposure: number;
}

export interface Region extends RegionProfile { center: { x: number; z: number } }

/** Travel / Shire / Bywater: the warm lush-green base grade (matches the M1 default). */
export const DEFAULT_PROFILE: RegionProfile = {
  id: "", radius: 0, falloff: 0,
  lut: "golden-hour.cube",
  fog: { color: 0xe7decb, near: 60, far: 360 },
  exposure: 1.05,
};

// Per-area moods (starting values; tunable in-browser via the debug overlay).
const RAW: RegionProfile[] = [
  { id: "bree",     radius: 22, falloff: 14, lut: "bree.cube",         fog: { color: 0xe0cda0, near: 50, far: 300 }, exposure: 0.95 },
  { id: "edoras",   radius: 24, falloff: 16, lut: "edoras.cube",       fog: { color: 0xe8dcc0, near: 60, far: 360 }, exposure: 1.10 },
  { id: "isengard", radius: 24, falloff: 16, lut: "isengard.cube",     fog: { color: 0x9a9a96, near: 30, far: 180 }, exposure: 0.85 },
  { id: "minas",    radius: 28, falloff: 18, lut: "minas-tirith.cube", fog: { color: 0xdfe7ec, near: 80, far: 360 }, exposure: 1.20 },
  { id: "argonath", radius: 20, falloff: 14, lut: "minas-tirith.cube", fog: { color: 0xc8d0d4, near: 50, far: 300 }, exposure: 1.00 },
];

const PLACE = new Map([...STOP_PLACEMENTS, ARGONATH].map((p) => [p.id, p]));

export const REGIONS: Region[] = RAW.map((r) => {
  const p = PLACE.get(r.id);
  if (!p) throw new Error(`region "${r.id}" has no placement in world.ts`);
  return { ...r, center: { x: p.x, z: p.z } };
});
