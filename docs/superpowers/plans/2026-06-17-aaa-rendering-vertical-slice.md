# AAA Rendering Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toon render path with a reusable AAA pipeline (ACES tone mapping, HDRI/IBL, post-processing stack, cascaded shadows) and prove it on one hero scene — the Shire at golden hour with a re-textured Gandalf.

**Architecture:** Keep the existing Three.js engine/world/player/systems intact. Add four focused modules — `engine/environment.ts` (lighting/IBL/CSM/fog), `engine/postfx.ts` (post-processing composer), `world/materials.ts` (PBR material factory), `ui/debugOverlay.ts` (tuning) — and extend `engine/quality.ts` + `engine/renderer.ts`. The frame loop swaps `renderer.render(...)` for `postfx.render(dt)` and `followSun(...)` for `environment.update(...)`. Each module separates *pure config logic* (unit-tested) from *GPU instantiation* (manually verified).

**Tech Stack:** TypeScript, Three.js `0.160`, `postprocessing` (pmndrs), Three.js examples `CSM` + `RGBELoader` + `KTX2Loader`, Vitest, Vite.

## Global Constraints

- **Three.js version floor:** `three@^0.160.0` (already pinned); do not upgrade it in this milestone.
- **New runtime dependency:** exactly one — `postprocessing` (pmndrs), pinned to a 6.x release compatible with three 0.160. All other effects come from `three/examples/jsm/*`.
- **Color management:** linear working space; `renderer.outputColorSpace = SRGBColorSpace`; albedo/emissive/LUT textures = `SRGBColorSpace`; normal/roughness/metalness/AO textures = `NoColorSpace` (linear).
- **Tone mapping lives in post:** when the post stack is active, set `renderer.toneMapping = NoToneMapping` and tone-map via the `ToneMappingEffect` to avoid double tone mapping.
- **Platform:** desktop-first; mobile must still load and run via the LOW level (post stack stripped to tonemap+bloom+SMAA, single-sun shadows, no CSM/SSAO/DoF). The existing toon path remains the emergency fallback and must not be deleted.
- **Asset budget:** total new slice download (GLB + KTX2 textures + 1 HDRI + 1 LUT) under ~10 MB. Textures KTX2/Basis at 1–2K; HDRI 2K half-float.
- **No gameplay regression:** movement, follow camera, interaction/tale panel, journal, map, audio behave exactly as before.
- **Tests are pure/node:** new unit tests must not require a WebGL context or jsdom DOM — test pure functions and plain Three objects (materials/textures construct fine without a GL context).
- **Tier vocabulary:** keep the existing device `Tier = "desktop" | "mobile"`. Add an orthogonal render `QualityLevel = "high" | "medium" | "low"`. Default mapping: desktop→high, mobile→low; `"medium"` is reachable only by manual/debug override.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/engine/quality.ts` | modify | Add `QualityLevel`, `pickQualityLevel`, `EffectFlags`, `effectFlags()`. |
| `src/engine/quality.test.ts` | modify | Add tests for the new pure functions. |
| `src/engine/renderer.ts` | modify | Extract pure `configureRenderer(r, opts)`; ACES + color space + exposure. |
| `src/engine/renderer.test.ts` | create | Test `configureRenderer` against a stub renderer. |
| `src/world/materials.ts` | create | PBR material factory: `colorSpaceForSlot`, `buildStandardMaterialParams`, `createPBRMaterial`, `applyPBR`, texture-set loader, KTX2 loader. |
| `src/world/materials.test.ts` | create | Test the pure config/colorspace functions + material params. |
| `src/engine/postfx.ts` | create | `buildEffectChain` (pure) + `createPostFX` (composer assembly + `render`/`setSize`/`setFocus`). |
| `src/engine/postfx.test.ts` | create | Test `buildEffectChain` ordering/enablement. |
| `src/engine/environment.ts` | create | `sunDirection`, `fogConfig` (pure) + `createEnvironment` (HDRI/IBL, sun, CSM, fog; `update`/`dispose`). |
| `src/engine/environment.test.ts` | create | Test the pure helpers. |
| `src/ui/debugOverlay.ts` | create | `FrameMeter` (pure rolling average) + DOM overlay (FPS, level switch, effect toggles). |
| `src/ui/debugOverlay.test.ts` | create | Test `FrameMeter`. |
| `src/engine/scene.ts` | modify | Keep sky sphere + hemisphere/ambient fill; remove the hard-coded directional sun (moves to `environment.ts`). |
| `src/main.ts` | modify | Wire renderer config + environment + postfx + overlay; swap render & sun-follow calls; extend resize. |
| `src/world/assets.ts` | modify | Export a shared KTX2 loader getter for the material factory (reuse renderer for `detectSupport`). |
| `public/basis/` | create | Vendored Basis transcoder (`basis_transcoder.js` + `.wasm`) for `KTX2Loader`. |
| `public/assets/env/golden_hour_2k.hdr` | create | Golden-hour HDRI (Poly Haven, CC0). |
| `public/assets/luts/golden-hour.cube` | create | Teal-orange grade LUT (`.cube`). |
| `public/assets/models/shire-home-pbr.glb` | create | New PBR Shire landmark (KTX2 textures embedded). |
| `public/assets/textures/pbr/` | create | Tiling terrain PBR maps (grass/dirt/rock) + Gandalf PBR maps, KTX2. |

---

## Task 1: Quality levels & effect flags (pure)

**Files:**
- Modify: `src/engine/quality.ts`
- Test: `src/engine/quality.test.ts`

**Interfaces:**
- Consumes: existing `Tier`, `pickTier`.
- Produces: `type QualityLevel = "high" | "medium" | "low"`; `pickQualityLevel(tier: Tier): QualityLevel`; `interface EffectFlags { ssao: boolean; bloom: boolean; dof: boolean; lut: boolean; vignette: boolean; grain: boolean; chromaticAberration: boolean; smaa: boolean; csm: boolean }`; `effectFlags(level: QualityLevel): EffectFlags`.

- [ ] **Step 1: Write the failing test** — append to `src/engine/quality.test.ts`:

```typescript
import { pickQualityLevel, effectFlags } from "./quality";

describe("pickQualityLevel", () => {
  it("desktop → high", () => { expect(pickQualityLevel("desktop")).toBe("high"); });
  it("mobile → low", () => { expect(pickQualityLevel("mobile")).toBe("low"); });
});

describe("effectFlags", () => {
  it("high enables the full stack", () => {
    const f = effectFlags("high");
    expect(f.ssao && f.dof && f.csm && f.lut && f.bloom && f.smaa).toBe(true);
  });
  it("medium drops dof + ssao but keeps lut/bloom/csm", () => {
    const f = effectFlags("medium");
    expect(f.dof).toBe(false);
    expect(f.ssao).toBe(false);
    expect(f.lut && f.bloom && f.csm).toBe(true);
  });
  it("low strips expensive effects and csm", () => {
    const f = effectFlags("low");
    expect(f.dof || f.ssao || f.csm || f.chromaticAberration).toBe(false);
    expect(f.bloom && f.smaa && f.lut).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/quality.test.ts`
Expected: FAIL — `pickQualityLevel`/`effectFlags` are not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/engine/quality.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/quality.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/quality.ts src/engine/quality.test.ts
git commit -m "feat(quality): render quality levels + effect flag table"
```

---

## Task 2: Renderer tone-mapping & color configuration

**Files:**
- Modify: `src/engine/renderer.ts`
- Test: `src/engine/renderer.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface RendererConfig { exposure: number; toneMapInRenderer: boolean }`; `configureRenderer(r: ConfigurableRenderer, cfg: RendererConfig): void` where `ConfigurableRenderer` is the minimal subset of `THREE.WebGLRenderer` the function writes (so it can be tested with a stub). `createRenderer()` keeps its existing signature.

- [ ] **Step 1: Write the failing test** — create `src/engine/renderer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { configureRenderer } from "./renderer";

function stub() {
  return {
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.LinearSRGBColorSpace,
  } as Pick<THREE.WebGLRenderer, "toneMapping" | "toneMappingExposure" | "outputColorSpace">;
}

describe("configureRenderer", () => {
  it("uses ACES filmic when tone mapping in the renderer", () => {
    const r = stub();
    configureRenderer(r, { exposure: 1.1, toneMapInRenderer: true });
    expect(r.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(r.toneMappingExposure).toBeCloseTo(1.1);
    expect(r.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });

  it("disables renderer tone mapping when post handles it", () => {
    const r = stub();
    configureRenderer(r, { exposure: 1.0, toneMapInRenderer: false });
    expect(r.toneMapping).toBe(THREE.NoToneMapping);
    expect(r.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/renderer.test.ts`
Expected: FAIL — `configureRenderer` not exported.

- [ ] **Step 3: Write minimal implementation** — replace `src/engine/renderer.ts` with:

```typescript
import * as THREE from "three";

export type ConfigurableRenderer = Pick<
  THREE.WebGLRenderer,
  "toneMapping" | "toneMappingExposure" | "outputColorSpace"
>;

export interface RendererConfig {
  exposure: number;
  /** true → renderer applies ACES; false → post stack applies tone mapping (renderer stays NoToneMapping). */
  toneMapInRenderer: boolean;
}

/** Pure-ish: apply color + tone-mapping settings to a renderer (or stub). */
export function configureRenderer(r: ConfigurableRenderer, cfg: RendererConfig): void {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = cfg.toneMapInRenderer ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  r.toneMappingExposure = cfg.exposure;
}

export function createRenderer(): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  // Post stack owns tone mapping by default; main.ts may override for the no-post fallback.
  configureRenderer(r, { exposure: 1.0, toneMapInRenderer: false });
  return r;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/renderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderer.ts src/engine/renderer.test.ts
git commit -m "feat(renderer): extract configureRenderer with ACES + color space"
```

---

## Task 3: PBR material factory

**Files:**
- Create: `src/world/materials.ts`
- Test: `src/world/materials.test.ts`
- Modify: `src/world/assets.ts` (add a shared KTX2 loader getter)
- Create: `public/basis/basis_transcoder.js`, `public/basis/basis_transcoder.wasm` (vendored)

**Interfaces:**
- Consumes: `THREE` only.
- Produces:
  - `type TexSlot = "albedo" | "normal" | "roughness" | "metalness" | "ao" | "emissive"`
  - `colorSpaceForSlot(slot: TexSlot): THREE.ColorSpace`
  - `interface PBRConfig { roughness?: number; metalness?: number; envMapIntensity?: number; normalScale?: number; color?: number }`
  - `buildStandardMaterialParams(cfg: PBRConfig): THREE.MeshStandardMaterialParameters`
  - `createPBRMaterial(cfg: PBRConfig, maps: Partial<Record<TexSlot, THREE.Texture>>): THREE.MeshStandardMaterial`
  - `applyPBR(root: THREE.Object3D, cfg: PBRConfig): THREE.Object3D` (re-textures an existing toon/standard tree in place, preserving each mesh's existing `.map`)
  - in `assets.ts`: `getKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader`

- [ ] **Step 1: Vendor the Basis transcoder** (manual setup folded into this task)

```bash
mkdir -p public/basis
cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.js public/basis/
cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm public/basis/
```

Expected: two files present under `public/basis/` (~0.5 MB combined — `basis_transcoder.wasm` ≈ 0.5 MB, `.js` ≈ 60 KB). These are decoder *infrastructure*, not scene art, so they are tracked separately from the ~10 MB asset budget in the spec (which covers GLBs/textures/HDRI/LUT).

- [ ] **Step 2: Write the failing test** — create `src/world/materials.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { colorSpaceForSlot, buildStandardMaterialParams, createPBRMaterial } from "./materials";

describe("colorSpaceForSlot", () => {
  it("albedo + emissive are sRGB", () => {
    expect(colorSpaceForSlot("albedo")).toBe(THREE.SRGBColorSpace);
    expect(colorSpaceForSlot("emissive")).toBe(THREE.SRGBColorSpace);
  });
  it("data maps are linear", () => {
    for (const s of ["normal", "roughness", "metalness", "ao"] as const) {
      expect(colorSpaceForSlot(s)).toBe(THREE.NoColorSpace);
    }
  });
});

describe("buildStandardMaterialParams", () => {
  it("applies defaults and overrides", () => {
    const p = buildStandardMaterialParams({ roughness: 0.8, metalness: 0.1, envMapIntensity: 1.2 });
    expect(p.roughness).toBeCloseTo(0.8);
    expect(p.metalness).toBeCloseTo(0.1);
    expect(p.envMapIntensity).toBeCloseTo(1.2);
  });
});

describe("createPBRMaterial", () => {
  it("assigns maps with correct color spaces", () => {
    const albedo = new THREE.Texture();
    const normal = new THREE.Texture();
    const mat = createPBRMaterial({ roughness: 0.9 }, { albedo, normal });
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).toBe(albedo);
    expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mat.normalMap).toBe(normal);
    expect(mat.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/world/materials.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation** — create `src/world/materials.ts`:

```typescript
import * as THREE from "three";

export type TexSlot = "albedo" | "normal" | "roughness" | "metalness" | "ao" | "emissive";

/** Pure: correct color space per texture slot (color maps sRGB, data maps linear). */
export function colorSpaceForSlot(slot: TexSlot): THREE.ColorSpace {
  return slot === "albedo" || slot === "emissive" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
}

export interface PBRConfig {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  normalScale?: number;
  color?: number;
}

/** Pure: resolve a PBRConfig into MeshStandardMaterial parameters with sensible defaults. */
export function buildStandardMaterialParams(cfg: PBRConfig): THREE.MeshStandardMaterialParameters {
  return {
    color: new THREE.Color(cfg.color ?? 0xffffff),
    roughness: cfg.roughness ?? 1.0,
    metalness: cfg.metalness ?? 0.0,
    envMapIntensity: cfg.envMapIntensity ?? 1.0,
  };
}

export function createPBRMaterial(
  cfg: PBRConfig,
  maps: Partial<Record<TexSlot, THREE.Texture>>,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(buildStandardMaterialParams(cfg));
  const assign = (slot: TexSlot, set: (t: THREE.Texture) => void) => {
    const tex = maps[slot];
    if (!tex) return;
    tex.colorSpace = colorSpaceForSlot(slot);
    set(tex);
  };
  assign("albedo", (t) => (mat.map = t));
  assign("normal", (t) => { mat.normalMap = t; if (cfg.normalScale) mat.normalScale.set(cfg.normalScale, cfg.normalScale); });
  assign("roughness", (t) => (mat.roughnessMap = t));
  assign("metalness", (t) => (mat.metalnessMap = t));
  assign("ao", (t) => (mat.aoMap = t));
  assign("emissive", (t) => { mat.emissiveMap = t; mat.emissive = new THREE.Color(0xffffff); });
  mat.needsUpdate = true;
  return mat;
}

/**
 * Re-texture an existing model tree to PBR in place, preserving each mesh's albedo map and
 * vertex color. Mirrors `toonify` in assets.ts but produces grounded MeshStandardMaterial.
 */
export function applyPBR(root: THREE.Object3D, cfg: PBRConfig): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    m.castShadow = m.receiveShadow = true;
    const prev = m.material as THREE.MeshStandardMaterial;
    const albedo = prev.map ?? undefined;
    if (albedo) albedo.colorSpace = THREE.SRGBColorSpace;
    m.material = new THREE.MeshStandardMaterial({
      ...buildStandardMaterialParams({ ...cfg, color: cfg.color ?? prev.color?.getHex() }),
      map: albedo ?? null,
    });
    (m.material as THREE.Material).needsUpdate = true;
  });
  return root;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/world/materials.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the shared KTX2 loader** — append to `src/world/assets.ts`:

```typescript
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

let ktx2: KTX2Loader | null = null;
/** Shared KTX2 loader; needs the renderer once to detect GPU transcoder support. */
export function getKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
  }
  return ktx2;
}
```

- [ ] **Step 7: Verify the project still type-checks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/world/materials.ts src/world/materials.test.ts src/world/assets.ts public/basis
git commit -m "feat(materials): PBR material factory + KTX2 loader"
```

---

## Task 4: Post-FX effect chain + composer

**Files:**
- Create: `src/engine/postfx.ts`
- Test: `src/engine/postfx.test.ts`
- Modify: `package.json` (add `postprocessing`)

**Interfaces:**
- Consumes: `EffectFlags` from `quality.ts`; `THREE`; `postprocessing`.
- Produces:
  - `type EffectId = "ssao" | "bloom" | "dof" | "tonemap" | "lut" | "vignette" | "grain" | "chromaticAberration" | "smaa"`
  - `interface EffectStep { id: EffectId; enabled: boolean }`
  - `buildEffectChain(flags: EffectFlags): EffectStep[]` — returns the ordered chain (disabled effects included with `enabled: false` so the order is stable/testable)
  - `interface PostFX { render(dt: number): void; setSize(w: number, h: number): void; setFocus(active: boolean): void; dispose(): void }`
  - `createPostFX(renderer, scene, camera, flags, lut): Promise<PostFX>`

- [ ] **Step 1: Add the dependency** (folded setup)

```bash
npm install postprocessing@^6.35.0
npm run typecheck
```

Expected: install succeeds; `npm ls postprocessing` shows a single 6.x version; typecheck passes. If peer-dep warnings against three 0.160 appear, pin the highest 6.x its peer range allows and note the version in the commit.

- [ ] **Step 2: Write the failing test** — create `src/engine/postfx.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildEffectChain, type EffectId } from "./postfx";
import { effectFlags } from "./quality";

const ids = (steps: { id: EffectId; enabled: boolean }[]) => steps.map((s) => s.id);
const enabled = (steps: { id: EffectId; enabled: boolean }[]) =>
  steps.filter((s) => s.enabled).map((s) => s.id);

describe("buildEffectChain", () => {
  it("orders AO → bloom → dof → tonemap → lut → vignette → grain → CA → smaa", () => {
    expect(ids(buildEffectChain(effectFlags("high")))).toEqual([
      "ssao", "bloom", "dof", "tonemap", "lut", "vignette", "grain", "chromaticAberration", "smaa",
    ]);
  });
  it("tonemap, lut, bloom, smaa are always enabled", () => {
    for (const lvl of ["high", "medium", "low"] as const) {
      const on = enabled(buildEffectChain(effectFlags(lvl)));
      expect(on).toEqual(expect.arrayContaining(["tonemap", "lut", "bloom", "smaa"]));
    }
  });
  it("low disables ssao, dof, chromaticAberration", () => {
    const on = enabled(buildEffectChain(effectFlags("low")));
    expect(on).not.toContain("ssao");
    expect(on).not.toContain("dof");
    expect(on).not.toContain("chromaticAberration");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/postfx.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation** — create `src/engine/postfx.ts`:

```typescript
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

  const normalPass = new NormalPass(scene, camera);
  if (flags.ssao) composer.addPass(normalPass);

  const dof = new DepthOfFieldEffect(camera, { focusDistance: 0.02, focalLength: 0.05, bokehScale: 2.0 });
  const make = (step: EffectStep) => {
    switch (step.id) {
      case "ssao": return new SSAOEffect(camera, normalPass.texture, { samples: 16, radius: 0.25, intensity: 2.0, resolutionScale: 0.5 });
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
    setFocus: (active) => { dof.cocMaterial.uniforms.focalLength.value = active ? 0.09 : 0.05; },
    dispose: () => composer.dispose(),
  };
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/engine/postfx.test.ts && npm run typecheck`
Expected: tests PASS; typecheck clean. (Note: `cocMaterial.uniforms.focalLength` is the DoF focus hook — if the installed `postprocessing` version names it differently, adjust `setFocus` and re-run typecheck.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/postfx.ts src/engine/postfx.test.ts package.json package-lock.json
git commit -m "feat(postfx): effect chain builder + EffectComposer assembly"
```

---

## Task 5: Environment & lighting (HDRI/IBL + CSM + fog)

**Files:**
- Create: `src/engine/environment.ts`
- Test: `src/engine/environment.test.ts`
- Modify: `src/engine/scene.ts` (remove the hard-coded directional sun; keep sky/fill)
- Create: `public/assets/env/golden_hour_2k.hdr` (manual asset)

**Interfaces:**
- Consumes: `EffectFlags`, `THREE`, `RGBELoader`, `CSM`.
- Produces:
  - `interface FogCfg { color: number; near: number; far: number }`
  - `fogConfig(drawDistance: number): FogCfg`
  - `sunDirection(): THREE.Vector3` (normalized, matches the HDRI sun + old `SUN_OFFSET`)
  - `interface Environment { update(x: number, z: number): void; dispose(): void }`
  - `createEnvironment(renderer, scene, camera, flags, drawDistance): Promise<Environment>`

- [ ] **Step 1: Obtain the HDRI** (manual)

Download a golden-hour outdoor HDRI from Poly Haven (CC0, 2K, `.hdr`), e.g. "kloofendal_48d_partly_cloudy" or "spruit_sunrise". Save as `public/assets/env/golden_hour_2k.hdr`. Confirm file < ~5 MB.

- [ ] **Step 2: Write the failing test** — create `src/engine/environment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fogConfig, sunDirection } from "./environment";

describe("fogConfig", () => {
  it("scales far with draw distance and keeps near < far", () => {
    const f = fogConfig(380);
    expect(f.far).toBeGreaterThan(f.near);
    expect(f.far).toBeLessThanOrEqual(380);
  });
});

describe("sunDirection", () => {
  it("returns a normalized vector pointing down from above", () => {
    const d = sunDirection();
    expect(d.length()).toBeCloseTo(1, 5);
    expect(d.y).toBeLessThan(0); // light travels downward
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/environment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation** — create `src/engine/environment.ts`:

```typescript
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import type { EffectFlags } from "./quality";

/** Sun position offset (matches the previous scene.ts SUN_OFFSET) → light direction. */
const SUN_OFFSET = new THREE.Vector3(-40, 70, 28);
export function sunDirection(): THREE.Vector3 {
  return SUN_OFFSET.clone().multiplyScalar(-1).normalize();
}

/** Pure: fog band derived from the tier's draw distance. */
export function fogConfig(drawDistance: number): FogCfg {
  return { color: 0xe7decb, near: Math.max(30, drawDistance * 0.25), far: drawDistance };
}
export interface FogCfg { color: number; near: number; far: number }

export interface Environment {
  update(x: number, z: number): void;
  dispose(): void;
}

export async function createEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  flags: EffectFlags,
  drawDistance: number,
): Promise<Environment> {
  // 1. Image-based lighting from the HDRI.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const hdr = await new RGBELoader().loadAsync("/assets/env/golden_hour_2k.hdr");
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const envRT = pmrem.fromEquirectangular(hdr);
  scene.environment = envRT.texture;
  hdr.dispose();
  pmrem.dispose();

  // 2. Fog.
  const f = fogConfig(drawDistance);
  scene.fog = new THREE.Fog(f.color, f.near, f.far);

  // 3. Sun + shadows. CSM on medium/high; single directional fallback on low.
  const dir = sunDirection();
  let csm: CSM | null = null;
  let sun: THREE.DirectionalLight | null = null;

  if (flags.csm) {
    csm = new CSM({
      maxFar: Math.min(drawDistance, 400),
      cascades: 3,
      mode: "practical",
      parent: scene,
      shadowMapSize: 2048,
      lightDirection: dir.clone(),
      camera,
    });
    csm.fade = true;
    // Every shadow-receiving material must be registered with CSM.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) csm!.setupMaterial(m);
    });
  } else {
    sun = new THREE.DirectionalLight(0xffe7bf, 2.0);
    sun.position.copy(SUN_OFFSET);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
  }

  return {
    update(x: number, z: number) {
      if (csm) {
        csm.update();
      } else if (sun) {
        sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
        sun.target.position.set(x, 0, z);
        sun.target.updateMatrixWorld();
      }
    },
    dispose() {
      csm?.dispose();
      if (sun) { scene.remove(sun, sun.target); sun.dispose(); }
      envRT.dispose();
      scene.environment = null;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/environment.test.ts`
Expected: PASS.

- [ ] **Step 6: Remove the duplicate sun from scene.ts** — in `src/engine/scene.ts`, delete the `DirectionalLight` named `"sun"` (lines creating `sun`, its shadow config, and adding it) and the exported `followSun` function + `SUN_OFFSET`. Keep the sky sphere, `HemisphereLight`, `AmbientLight`, and `Fog` default (the environment overrides fog after load). Result `createScene` adds only: sky sphere, hemisphere, ambient.

- [ ] **Step 7: Verify nothing else imports followSun yet**

Run: `npm run typecheck`
Expected: errors ONLY in `src/main.ts` (still importing `followSun`). That import is fixed in Task 7. If errors appear elsewhere, address them. (To keep this task self-contained and green, temporarily leave `followSun` exported as a no-op shim if you prefer to typecheck clean now; Task 7 removes the call.)

- [ ] **Step 8: Commit**

```bash
git add src/engine/environment.ts src/engine/environment.test.ts src/engine/scene.ts public/assets/env
git commit -m "feat(environment): HDRI/IBL + CSM + fog; move sun out of scene.ts"
```

---

## Task 6: Debug overlay

**Files:**
- Create: `src/ui/debugOverlay.ts`
- Test: `src/ui/debugOverlay.test.ts`

**Interfaces:**
- Consumes: `QualityLevel`, `EffectFlags`.
- Produces:
  - `class FrameMeter { push(dtMs: number): void; get fps(): number; get avgMs(): number }` (rolling average over the last N frames)
  - `interface DebugOverlay { tick(dtSeconds: number): void; destroy(): void }`
  - `mountDebugOverlay(opts: { level: QualityLevel; onLevel(l: QualityLevel): void }): DebugOverlay`

- [ ] **Step 1: Write the failing test** — create `src/ui/debugOverlay.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { FrameMeter } from "./debugOverlay";

describe("FrameMeter", () => {
  it("averages frame times and reports fps", () => {
    const m = new FrameMeter(4);
    [16, 16, 16, 16].forEach((x) => m.push(x));
    expect(m.avgMs).toBeCloseTo(16, 1);
    expect(m.fps).toBeGreaterThan(58);
    expect(m.fps).toBeLessThan(64);
  });
  it("windows to the last N samples", () => {
    const m = new FrameMeter(2);
    m.push(100); m.push(10); m.push(10);
    expect(m.avgMs).toBeCloseTo(10, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/debugOverlay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — create `src/ui/debugOverlay.ts`:

```typescript
import type { QualityLevel } from "../engine/quality";

/** Pure: rolling frame-time average over a fixed window. */
export class FrameMeter {
  private buf: number[] = [];
  constructor(private size = 60) {}
  push(dtMs: number): void {
    this.buf.push(dtMs);
    if (this.buf.length > this.size) this.buf.shift();
  }
  get avgMs(): number {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  get fps(): number {
    const a = this.avgMs;
    return a > 0 ? 1000 / a : 0;
  }
}

export interface DebugOverlay { tick(dtSeconds: number): void; destroy(): void }

/** Toggle with `?debug` in the URL or the backtick key. Shown only when enabled. */
export function mountDebugOverlay(opts: { level: QualityLevel; onLevel(l: QualityLevel): void }): DebugOverlay {
  const meter = new FrameMeter(60);
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:9999;font:12px monospace;background:rgba(0,0,0,.6);color:#9f9;padding:6px 8px;border-radius:6px;pointer-events:auto";
  const fps = document.createElement("div");
  const sel = document.createElement("select");
  (["high", "medium", "low"] as QualityLevel[]).forEach((l) => {
    const o = document.createElement("option"); o.value = l; o.textContent = l; if (l === opts.level) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => opts.onLevel(sel.value as QualityLevel);
  el.append(fps, sel);

  const enabled = location.search.includes("debug");
  if (enabled) document.body.appendChild(el);
  const key = (e: KeyboardEvent) => { if (e.code === "Backquote") el.parentElement ? el.remove() : document.body.appendChild(el); };
  addEventListener("keydown", key);

  return {
    tick(dtSeconds: number) {
      meter.push(dtSeconds * 1000);
      if (el.parentElement) fps.textContent = `${meter.fps.toFixed(0)} fps · ${meter.avgMs.toFixed(1)} ms`;
    },
    destroy() { removeEventListener("keydown", key); el.remove(); },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/debugOverlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/debugOverlay.ts src/ui/debugOverlay.test.ts
git commit -m "feat(debug): frame meter + tuning overlay"
```

---

## Task 7: Integrate the pipeline into the frame loop

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `pickQualityLevel`, `effectFlags` (quality), `configureRenderer` (renderer), `createEnvironment` (environment), `createPostFX` (postfx), `mountDebugOverlay` (debugOverlay), `getKTX2Loader` (assets), `LUTCubeLoader` (postprocessing).
- Produces: a running app where `postfx.render(dt)` replaces `renderer.render(...)` and `environment.update(...)` replaces `followSun(...)`.

This task is integration; verification is build + run + on-screen, plus the existing unit suite staying green.

- [ ] **Step 1: Load the LUT asset** (manual)

Place a teal-orange `.cube` LUT at `public/assets/luts/golden-hour.cube`. (Source a free cinematic `.cube`, or export one from any grading tool. A neutral identity LUT is an acceptable placeholder to start — grading is tunable later.)

- [ ] **Step 2: Update imports in `src/main.ts`**

Replace the quality/renderer/scene imports:

```typescript
import { createRenderer, configureRenderer } from "./engine/renderer";
import { createScene } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { detectQuality, pickQualityLevel, effectFlags } from "./engine/quality";
import { createEnvironment } from "./engine/environment";
import { createPostFX } from "./engine/postfx";
import { getKTX2Loader } from "./world/assets";
import { mountDebugOverlay } from "./ui/debugOverlay";
import { LUT3dlLoader } from "postprocessing"; // see note in Step 4 for the exact .cube loader
```

(Remove the `followSun` import.)

- [ ] **Step 3: Replace renderer/quality bootstrap** — change the block around `main.ts:32-45`:

```typescript
const quality = detectQuality();
const level = pickQualityLevel(quality.tier);
const flags = effectFlags(level);

const renderer = createRenderer();
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows || flags.csm;
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";
renderer.domElement.setAttribute("role", "img");
renderer.domElement.setAttribute("aria-label",
  "Interactive 3D Middle-earth. Walk Gandalf between six villages, each recalling a career chapter. Press M to open an accessible map and jump to any chapter.");

const scene = createScene();
createTerrain(scene, quality);
```

- [ ] **Step 4: Build environment + post stack inside the async bootstrap** — after `scene.add(gandalf.root)` (~`main.ts:70`) and after landmarks are placed, before `startLoop`, add:

```typescript
// Cinematic environment (HDRI/IBL + CSM + fog) and the post-processing stack.
const environment = await createEnvironment(renderer, scene, cam.camera, flags, quality.drawDistance);

let lut: THREE.Texture | null = null;
if (flags.lut) {
  // postprocessing ships LUTCubeLoader for .cube files; import it alongside createPostFX usage.
  const { LUTCubeLoader } = await import("postprocessing");
  lut = await new LUTCubeLoader().loadAsync("/assets/luts/golden-hour.cube") as unknown as THREE.Texture;
}
configureRenderer(renderer, { exposure: 1.05, toneMapInRenderer: false });
const postfx = createPostFX(renderer, scene, cam.camera, flags, lut);

const overlay = mountDebugOverlay({
  level,
  onLevel: () => location.reload(), // simplest correct path: re-bootstrap at the new level
});
```

(`THREE` is already imported transitively; add `import * as THREE from "three";` at the top of main.ts if not present.)

- [ ] **Step 5: Swap the per-frame render + sun calls** — in the `startLoop` callback:
  - Replace `followSun(scene, gandalf.root.position.x, gandalf.root.position.z);` with `environment.update(gandalf.root.position.x, gandalf.root.position.z);`
  - Replace the final `renderer.render(scene, cam.camera);` with:

```typescript
    postfx.setFocus(stops.isPanelOpen); // intensify DoF during a tale
    postfx.render(dt);
    overlay.tick(dt);
```

- [ ] **Step 6: Extend the resize handler** (`main.ts:150`):

```typescript
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  postfx.setSize(innerWidth, innerHeight);
  cam.resize();
});
```

(Move/duplicate the resize wiring so `postfx` is in scope, or assign `postfx` to an outer-scope `let` declared before the async IIFE.)

- [ ] **Step 7: Verify the whole suite + build**

Run: `npm test && npm run build`
Expected: all unit tests PASS; `tsc --noEmit` clean; `vite build` succeeds.

- [ ] **Step 8: Run and eyeball it**

Run: `npm run dev`, open the app. Expected: the world loads with HDRI lighting, ACES tone mapping, bloom on highlights, vignette/grain; opening a tale deepens depth-of-field. Append `?debug` to the URL to see the FPS overlay and switch levels. Confirm movement, camera, tale panel, map (M), and audio all still work.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts public/assets/luts
git commit -m "feat(render): wire environment + post stack into the frame loop"
```

---

## Task 8: PBR assets for the Shire hero scene

**Files:**
- Create: `public/assets/models/shire-home-pbr.glb`, `public/assets/textures/pbr/*` (manual assets)
- Modify: `src/world/landmarks.ts` (use the PBR Shire model + `applyPBR` for the hero stop)
- Modify: `src/world/terrain.ts` (PBR ground material with tiling maps)
- Modify: `src/player/gandalf.ts` (apply `applyPBR` instead of `toonify` to the character)

**Interfaces:**
- Consumes: `applyPBR`, `createPBRMaterial`, `getKTX2Loader` from `world/materials.ts` + `world/assets.ts`.
- Produces: the Shire landmark, terrain, and Gandalf rendered with PBR materials under the new lighting.

This task is asset + wiring; verification is visual + suite-green.

- [ ] **Step 1: Source the Shire PBR model** (manual)

Obtain/produce a PBR-textured Shire dwelling GLB (Meshy export with PBR, or a CC-licensed model). Run it through KTX2 texture compression and Draco geometry compression (extend `scripts/optimize-glb.sh` with a `--texture-compress ktx2` step via `gltf-transform`). Save as `public/assets/models/shire-home-pbr.glb`. Confirm the asset (geometry + textures) is within the ~10 MB slice budget.

- [ ] **Step 2: Source tiling terrain PBR maps** (manual)

Download CC0 grass/dirt/rock PBR sets (Poly Haven / ambientCG), 1–2K, convert to KTX2, place under `public/assets/textures/pbr/` (`grass_albedo.ktx2`, `grass_normal.ktx2`, `grass_rough.ktx2`, etc.).

- [ ] **Step 3: Re-texture Gandalf with PBR** — in `src/player/gandalf.ts`, where the loaded model is currently passed through `toonify(...)`, switch to `applyPBR(root, { roughness: 0.85, metalness: 0.0 })`. Keep `toonify` imported and available behind a `level === "low"` branch if the character should stay toon on mobile (optional; default to PBR everywhere).

- [ ] **Step 4: Apply a PBR ground material** — in `src/world/terrain.ts`, replace the ground's material with `createPBRMaterial({ roughness: 1, metalness: 0 }, { albedo, normal, roughness })` using the tiling maps loaded via `getKTX2Loader(renderer)`. Set each map's `wrapS=wrapT=RepeatWrapping` and a sensible `repeat` (e.g. 40×40 across the ground plane). Pass the renderer into `createTerrain` if it isn't already available.

- [ ] **Step 5: Use the PBR Shire model for the hero stop** — in `src/world/landmarks.ts`, for the Shire stop, load `shire-home-pbr` and run `applyPBR` (or rely on its embedded PBR materials, only calling `applyPBR` for shadow flags). Leave the other five landmarks on their existing toon assets (out of scope for this slice — they still render, just stylized).

- [ ] **Step 6: Re-register new materials with CSM** — because `createEnvironment` registers shadow materials at load time, ensure landmark/terrain/Gandalf PBR materials created *after* environment init are registered. Simplest: in `main.ts`, after the world builders settle, if CSM is active call a re-register pass. Add to `environment.ts` a method `registerShadows(root: THREE.Object3D): void` that calls `csm.setupMaterial` on each `MeshStandardMaterial` (no-op when CSM is off), and call `environment.registerShadows(scene)` once after `Promise.allSettled(builders)` resolves.

```typescript
// environment.ts — add to the returned Environment object:
registerShadows(root: THREE.Object3D) {
  if (!csm) return;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) csm!.setupMaterial(m);
  });
}
```

(Add `registerShadows(root: THREE.Object3D): void` to the `Environment` interface.)

- [ ] **Step 7: Verify suite + build + visual**

Run: `npm test && npm run build`
Expected: PASS / clean.
Then `npm run dev`: the Shire dwelling, ground, and Gandalf show PBR shading with correct HDRI reflections and crisp CSM shadows; no z-fighting or black materials; FPS overlay (`?debug`) holds ~60 on desktop. Capture before/after screenshots.

- [ ] **Step 8: Mobile sanity pass**

Throttle to the LOW level (debug switcher or a mobile device/emulation). Expected: loads and runs with the reduced stack (no SSAO/DoF/CSM), single-sun shadows, acceptable framerate.

- [ ] **Step 9: Commit**

```bash
git add public/assets/models/shire-home-pbr.glb public/assets/textures/pbr \
  src/world/landmarks.ts src/world/terrain.ts src/player/gandalf.ts src/engine/environment.ts src/main.ts
git commit -m "feat(assets): PBR Shire, terrain, and Gandalf for the hero scene"
```

---

## Self-Review

**Spec coverage**
- New rendering pipeline modules → Tasks 2,4,5,6 + integration Task 7. ✓
- HDRI/IBL + sky + fog → Task 5. ✓
- Cascaded Shadow Maps → Task 5 (+ material registration in Task 8). ✓
- Post stack (ACES, SSAO, bloom, DoF, LUT, vignette, grain, CA, SMAA) → Task 4. ✓
- New PBR assets (Shire + terrain + re-textured Gandalf) → Task 8. ✓
- KTX2/Basis texture compression → Task 3 (loader) + Task 8 (assets). ✓
- Extended quality tiers controlling effects → Task 1, consumed in 4/5/7. ✓
- Debug overlay (FPS/tier switch/effect toggles) → Task 6. ✓
- Graceful mobile degradation → LOW flags (Task 1) + single-sun fallback (Task 5) + mobile pass (Task 8 Step 8). ✓
- Keep toon path as fallback → `toonify` retained in `assets.ts` (Task 8 Step 3 keeps it importable). ✓
- No gameplay regression → Task 7 Step 8 + suite-green gates. ✓
- Unit tests for material config, tier selection, color-space helpers → Tasks 1,2,3. ✓

**Known judgment calls (acceptable for the slice, flagged for the implementer):**
- AO uses postprocessing's `SSAOEffect` to honor the one-dependency constraint; `N8AO`/GTAO is a documented future upgrade.
- DoF focus hook (`setFocus`) touches a `postprocessing` internal uniform name; verify against the installed version (Task 4 Step 5).
- The `.cube` LUT may start as identity; grading is tunable without code changes.
- Asset-sourcing steps (HDRI, LUT, Shire GLB, terrain maps) are genuine manual actions, not code — they are explicit and bounded by the asset budget.

**Type consistency:** `QualityLevel`/`EffectFlags`/`effectFlags` (Task 1) are used verbatim in Tasks 4/5/7. `EffectStep`/`EffectId` (Task 4) match the test. `Environment` interface gains `registerShadows` in Task 8 (interface update noted). `createPBRMaterial`/`applyPBR`/`getKTX2Loader` signatures match across Tasks 3/8.
