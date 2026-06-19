import * as THREE from "three";
import { REGIONS, DEFAULT_PROFILE, type Region, type RegionProfile, type RegionFog } from "../data/regions";
import type { PostFX } from "./postfx";

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

/** Pure: blend fog (color/near/far) + exposure from base toward region by t∈[0,1]. */
export function lerpProfile(base: RegionProfile, region: RegionProfile, t: number): BlendedProfile {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const color = new THREE.Color(base.fog.color).lerp(new THREE.Color(region.fog.color), t).getHex();
  return {
    exposure: lerp(base.exposure, region.exposure),
    fog: { color, near: lerp(base.fog.near, region.fog.near), far: lerp(base.fog.far, region.fog.far) },
  };
}

export interface Atmosphere { update(x: number, z: number, dt: number): void; dispose(): void }

/** Per frame, blends fog (colour/near/far) + exposure from the base mood toward the nearest
 *  region by proximity. Colour-grade LUTs were removed — AgX tone mapping carries the look. */
export async function createAtmosphere(
  scene: THREE.Scene, postfx: PostFX, drawDistance: number,
): Promise<Atmosphere> {
  scene.fog = new THREE.Fog(DEFAULT_PROFILE.fog.color, DEFAULT_PROFILE.fog.near, Math.min(DEFAULT_PROFILE.fog.far, drawDistance));
  const fog = scene.fog as THREE.Fog;
  const baseFar = Math.min(DEFAULT_PROFILE.fog.far, drawDistance);

  return {
    update(x, z) {
      const near = nearestRegion(x, z);
      const region = near?.region;
      const spatialT = region ? regionWeight(near.dist, region.radius, region.falloff) : 0;
      const blended = region
        ? lerpProfile(DEFAULT_PROFILE, region, spatialT)
        : { fog: DEFAULT_PROFILE.fog, exposure: DEFAULT_PROFILE.exposure };
      fog.color.setHex(blended.fog.color);
      fog.near = blended.fog.near;
      fog.far = Math.min(blended.fog.far, drawDistance) || baseFar;
      postfx.setExposure(blended.exposure);
    },
    dispose() {},
  };
}
