import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, NormalPass,
  ToneMappingEffect, ToneMappingMode, BloomEffect, SMAAEffect,
  VignetteEffect, NoiseEffect, ChromaticAberrationEffect, DepthOfFieldEffect,
  SSAOEffect, LUT3DEffect, BlendFunction,
} from "postprocessing";
import type { EffectFlags } from "./quality";

export type EffectId =
  | "ssao" | "bloom" | "dof" | "tonemap" | "lut" | "vignette" | "grain" | "chromaticAberration" | "smaa";

export interface EffectStep { id: EffectId; enabled: boolean }

/** Pure: the stable, ordered effect chain. Tone mapping precedes the grade/finishing effects. */
export function buildEffectChain(flags: EffectFlags): EffectStep[] {
  return [
    { id: "ssao", enabled: flags.ssao },
    { id: "bloom", enabled: flags.bloom },
    { id: "dof", enabled: flags.dof },
    { id: "tonemap", enabled: true },
    { id: "lut", enabled: flags.lut },
    { id: "vignette", enabled: flags.vignette },
    { id: "grain", enabled: flags.grain },
    { id: "chromaticAberration", enabled: flags.chromaticAberration },
    { id: "smaa", enabled: flags.smaa },
  ];
}

export interface PostFX {
  render(dt: number): void;
  setSize(w: number, h: number): void;
  setFocus(active: boolean): void;
  dispose(): void;
}

/**
 * Assemble the EffectComposer from the active chain. `lut` is a preloaded LUT3D texture
 * (see materials/loader); pass null on LOW to skip grading gracefully.
 */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  flags: EffectFlags,
  lut: THREE.Texture | null,
): PostFX {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  let normalPass: NormalPass | null = null;
  if (flags.ssao) {
    normalPass = new NormalPass(scene, camera);
    composer.addPass(normalPass);
  }

  // focusRange controls the depth-of-field blur range (world units).
  // When a tale panel is open (active=true) we widen the range to deepen DoF.
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 3.0, focusRange: 2.0, bokehScale: 2.0 });
  const make = (step: EffectStep) => {
    switch (step.id) {
      case "ssao": return new SSAOEffect(camera, normalPass!.texture, { samples: 16, radius: 0.25, intensity: 2.0, resolutionScale: 0.5 });
      case "bloom": return new BloomEffect({ luminanceThreshold: 0.75, intensity: 0.6, mipmapBlur: true });
      case "dof": return dof;
      case "tonemap": return new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
      case "lut": return lut ? new LUT3DEffect(lut) : null;
      case "vignette": return new VignetteEffect({ darkness: 0.5, offset: 0.35 });
      case "grain": return new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
      case "smaa": return new SMAAEffect();
      case "chromaticAberration": return new ChromaticAberrationEffect();
      default: return null;
    }
  };

  const effects = buildEffectChain(flags)
    .filter((s) => s.enabled)
    .map(make)
    .filter((e): e is NonNullable<typeof e> => e !== null);
  composer.addPass(new EffectPass(camera, ...effects));

  return {
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h),
    // Use cocMaterial.focusRange (the typed property accessor) to control
    // depth-of-field intensity. Widening focusRange deepens the blur when
    // a tale panel is open.
    setFocus: (active) => { if (flags.dof) dof.cocMaterial.focusRange = active ? 8.0 : 2.0; },
    dispose: () => composer.dispose(),
  };
}
