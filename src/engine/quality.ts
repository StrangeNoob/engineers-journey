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
  // fall back to a conservative core count so browsers without hardwareConcurrency
  // (very old) default to the lighter mobile tier rather than desktop.
  const tier = pickTier(matchMedia("(pointer:coarse)").matches, navigator.hardwareConcurrency || 4);
  return tier === "mobile"
    ? { tier, pixelRatio: Math.min(devicePixelRatio, 1.6), drawDistance: 140, treeCount: 80, grassCount: 800, shadows: false }
    : { tier, pixelRatio: Math.min(devicePixelRatio, 2), drawDistance: 380, treeCount: 220, grassCount: 2600, shadows: true };
}
