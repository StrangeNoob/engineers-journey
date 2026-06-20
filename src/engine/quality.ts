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
    // cap the retina pixel ratio at 1.75 (from 2.0): the postFX chain + scene shade per pixel,
    // so this is the single biggest FPS lever on hi-dpi displays, with minimal softening (SMAA).
    : { tier, pixelRatio: Math.min(devicePixelRatio, 1.75), drawDistance: 380, treeCount: 220, grassCount: 2600, shadows: true };
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
    dof: high,
    chromaticAberration: high,
    grain: midUp,
    vignette: midUp,
    csm: midUp,
    bloom: true,
    lut: true,
    smaa: true,
  };
}
