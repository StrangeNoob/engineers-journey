import * as THREE from "three";
import { LUTCubeLoader } from "postprocessing";
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

export interface Atmosphere { update(x: number, z: number): void; dispose(): void }

/** Loads region LUTs (DEFAULT for any that fail) and, per frame, blends fog + exposure
 *  + the dual-LUT mix between DEFAULT and the nearest region by proximity weight. */
export async function createAtmosphere(
  scene: THREE.Scene, postfx: PostFX, drawDistance: number,
): Promise<Atmosphere> {
  const loader = new LUTCubeLoader();
  const load = async (name: string | null): Promise<THREE.Texture | null> => {
    if (!name) return null;
    try { return await loader.loadAsync(`/assets/luts/${name}`) as unknown as THREE.Texture; }
    catch { console.warn(`[atmosphere] LUT ${name} missing — using default grade`); return null; }
  };
  const defaultLut = await load(DEFAULT_PROFILE.lut);
  // cache one texture per region (fall back to the default LUT when a file is absent)
  const lutFor = new Map<string, THREE.Texture | null>();
  for (const r of REGIONS) lutFor.set(r.id, (await load(r.lut)) ?? defaultLut);

  scene.fog = new THREE.Fog(DEFAULT_PROFILE.fog.color, DEFAULT_PROFILE.fog.near, Math.min(DEFAULT_PROFILE.fog.far, drawDistance));
  const fog = scene.fog as THREE.Fog;
  const baseFar = Math.min(DEFAULT_PROFILE.fog.far, drawDistance);
  let activeId = "";

  return {
    update(x, z) {
      const near = nearestRegion(x, z);
      const t = near ? regionWeight(near.dist, near.region.radius, near.region.falloff) : 0;
      const region = near?.region;
      // swap the region LUT while the mix is ~0 (player in travel space)
      if (region && region.id !== activeId && t < 0.02) {
        const tex = lutFor.get(region.id);
        if (tex) postfx.setRegionLUT(tex);
        activeId = region.id;
      }
      const blended = region ? lerpProfile(DEFAULT_PROFILE, region, t) : { fog: DEFAULT_PROFILE.fog, exposure: DEFAULT_PROFILE.exposure };
      fog.color.setHex(blended.fog.color);
      fog.near = blended.fog.near;
      fog.far = Math.min(blended.fog.far, drawDistance) || baseFar;
      postfx.setExposure(blended.exposure);
      postfx.setLutMix(t);
    },
    dispose() {
      defaultLut?.dispose();
      for (const t of lutFor.values()) t?.dispose();
    },
  };
}
