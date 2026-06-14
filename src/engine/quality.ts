export type Tier = "desktop" | "mobile";

/** Pure: choose a tier from input capabilities. */
export function pickTier(coarsePointer: boolean, cores: number): Tier {
  return coarsePointer || cores <= 4 ? "mobile" : "desktop";
}

export interface Quality {
  tier: Tier;
  pixelRatio: number;
  drawDistance: number; // fog far
  treeCount: number;
  grassCount: number;
  shadows: boolean;
}

export function detectQuality(): Quality {
  const tier = pickTier(matchMedia("(pointer:coarse)").matches, navigator.hardwareConcurrency || 8);
  return tier === "mobile"
    ? { tier, pixelRatio: Math.min(devicePixelRatio, 1.6), drawDistance: 140, treeCount: 90, grassCount: 1500, shadows: false }
    : { tier, pixelRatio: Math.min(devicePixelRatio, 2), drawDistance: 230, treeCount: 240, grassCount: 6000, shadows: true };
}
