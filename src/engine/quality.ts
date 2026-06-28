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
    // render at native retina (2.0): on a 2× display, anything below it is upscaled and softens the
    // whole frame. DoF (a convolution pass) is now off, which buys back the GPU this costs.
    : { tier, pixelRatio: Math.min(devicePixelRatio, 2), drawDistance: 380, treeCount: 220, grassCount: 2600, shadows: true };
}

export type QualityLevel = "high" | "medium" | "low";

/** Pure: map a device tier to a default render quality level. */
export function pickQualityLevel(tier: Tier): QualityLevel {
  return tier === "desktop" ? "high" : "low";
}

export interface EffectFlags {
  ssao: boolean;
  bloom: boolean;
  dof: boolean;
  lut: boolean;
  vignette: boolean;
  grain: boolean;
  chromaticAberration: boolean;
  smaa: boolean;
  csm: boolean;
}

/** Pure: which post-processing effects are active at a given level. */
export function effectFlags(level: QualityLevel): EffectFlags {
  const high = level === "high";
  const midUp = level !== "low";
  return {
    ssao: high,
    dof: false, // full-frame haze on the third-person cam (focal plane sits in front of the visible scene); off until refocused

    chromaticAberration: high,
    grain: midUp,
    vignette: midUp,
    csm: midUp,
    bloom: true,
    lut: false, // grade off — "production clarity": neutral tone-map, no golden-hour LUT cast
    smaa: true,
  };
}
