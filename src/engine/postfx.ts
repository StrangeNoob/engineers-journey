import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, NormalPass,
  ToneMappingEffect, ToneMappingMode, BloomEffect, SMAAEffect,
  VignetteEffect, NoiseEffect, ChromaticAberrationEffect, DepthOfFieldEffect,
  SSAOEffect, Effect, BlendFunction,
} from "postprocessing";
import type { EffectFlags } from "./quality";

// A LUT3D crossfade: samples two 3D LUTs (base + region) and mixes by `lutMix`.
// scale/offset replicate postprocessing's LUT3DEffect sampling so edges don't clip.
const dualLutFrag = /* glsl */ `
uniform lowp sampler3D lutA;
uniform lowp sampler3D lutB;
uniform float lutMix;
uniform vec2 lutDomain; // x = scale, y = offset
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = clamp(inputColor.rgb, 0.0, 1.0) * lutDomain.x + lutDomain.y;
  vec3 a = texture(lutA, c).rgb;
  vec3 b = texture(lutB, c).rgb;
  outputColor = vec4(mix(a, b, lutMix), inputColor.a);
}`;

class DualLUTEffect extends Effect {
  constructor(base: THREE.Texture, size: number) {
    super("DualLUTEffect", dualLutFrag, {
      uniforms: new Map<string, THREE.Uniform<unknown>>([
        ["lutA", new THREE.Uniform(base)],
        ["lutB", new THREE.Uniform(base)],
        ["lutMix", new THREE.Uniform(0)],
        ["lutDomain", new THREE.Uniform(new THREE.Vector2((size - 1) / size, 1 / (2 * size)))],
      ]),
    });
  }
  set regionLUT(t: THREE.Texture) { (this.uniforms.get("lutB") as THREE.Uniform<THREE.Texture>).value = t; }
  set mix(v: number) { (this.uniforms.get("lutMix") as THREE.Uniform<number>).value = v; }
}

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
  setRegionLUT(tex: THREE.Texture): void;
  setLutMix(v: number): void;
  setExposure(v: number): void;
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
  let dualLut: DualLUTEffect | null = null;
  const make = (step: EffectStep) => {
    switch (step.id) {
      case "ssao": return new SSAOEffect(camera, normalPass!.texture, { samples: 16, radius: 0.25, intensity: 2.0, resolutionScale: 0.5 });
      case "bloom": return new BloomEffect({ luminanceThreshold: 0.75, intensity: 0.6, mipmapBlur: true });
      case "dof": return dof;
      case "tonemap": return new ToneMappingEffect({ mode: ToneMappingMode.AGX });
      case "lut": {
        if (!lut) return null;
        // LUTCubeLoader yields a Data3DTexture; its image.width is the LUT size.
        const size = (lut as unknown as THREE.Data3DTexture).image?.width ?? 33;
        dualLut = new DualLUTEffect(lut, size);
        return dualLut;
      }
      case "vignette": return new VignetteEffect({ darkness: 0.5, offset: 0.35 });
      case "grain": return new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
      case "smaa": return new SMAAEffect();
      case "chromaticAberration": return new ChromaticAberrationEffect();
      default: return null;
    }
  };

  // postprocessing allows at most ONE convolution effect per EffectPass. Give each
  // convolution effect its own pass and merge consecutive non-convolution effects
  // (tonemap/lut/vignette/grain) into a single pass — preserving the chain order.
  const CONVOLUTION = new Set<EffectId>(["ssao", "bloom", "dof", "chromaticAberration", "smaa"]);
  let buffer: NonNullable<ReturnType<typeof make>>[] = [];
  const flush = () => {
    if (buffer.length) { composer.addPass(new EffectPass(camera, ...buffer)); buffer = []; }
  };
  for (const step of buildEffectChain(flags).filter((s) => s.enabled)) {
    const effect = make(step);
    if (!effect) continue;
    if (CONVOLUTION.has(step.id)) { flush(); composer.addPass(new EffectPass(camera, effect)); }
    else buffer.push(effect);
  }
  flush();

  return {
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h),
    // Use cocMaterial.focusRange (the typed property accessor) to control
    // depth-of-field intensity. Widening focusRange deepens the blur when
    // a tale panel is open.
    setFocus: (active) => { if (flags.dof) dof.cocMaterial.focusRange = active ? 8.0 : 2.0; },
    setRegionLUT: (tex) => { if (dualLut) dualLut.regionLUT = tex; },
    setLutMix: (v) => { if (dualLut) dualLut.mix = v; },
    setExposure: (v) => { renderer.toneMappingExposure = v; },
    dispose: () => composer.dispose(),
  };
}
