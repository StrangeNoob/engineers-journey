import * as THREE from "three";
import { REGIONS, type Region, type RegionProfile, type RegionFog } from "../data/regions";

/** Pure: 1 inside `radius`, smoothstep down to 0 across `falloff`, 0 beyond. */
export function regionWeight(dist: number, radius: number, falloff: number): number {
  const t = Math.max(0, Math.min(1, (radius + falloff - dist) / falloff));
  return t * t * (3 - 2 * t);
}

/** Pure: the region whose center is closest to (x,z), with that distance. */
export function nearestRegion(x: number, z: number, regions: Region[] = REGIONS):
  { region: Region; dist: number } | null {
  let best: { region: Region; dist: number } | null = null;
  for (const r of regions) {
    const d = Math.hypot(x - r.center.x, z - r.center.z);
    if (!best || d < best.dist) best = { region: r, dist: d };
  }
  return best;
}

export interface BlendedProfile { fog: RegionFog; exposure: number }

const _a = new THREE.Color(), _b = new THREE.Color();
/** Pure: blend fog (color/near/far) + exposure from base toward region by t∈[0,1]. */
export function lerpProfile(base: RegionProfile, region: RegionProfile, t: number): BlendedProfile {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const color = _a.setHex(base.fog.color).lerp(_b.setHex(region.fog.color), t).getHex();
  return {
    exposure: lerp(base.exposure, region.exposure),
    fog: { color, near: lerp(base.fog.near, region.fog.near), far: lerp(base.fog.far, region.fog.far) },
  };
}
