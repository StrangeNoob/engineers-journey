# AAA Per-Area Atmosphere Implementation Plan (Milestone 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each landmark region its own atmosphere (crossfading LUT grade + fog + exposure), PBR-shade all remaining landmarks, and green the tree canopies — building on the Milestone 1 pipeline.

**Architecture:** A pure region data model (`data/regions.ts`, centers read from `STOP_PLACEMENTS`) feeds a per-frame `engine/atmosphere.ts` that blends fog/exposure between a DEFAULT profile and the nearest region by a smoothstep distance weight, and drives a new `DualLUTEffect` (two 3D LUTs + a `mix` uniform) added to the existing post stack. Landmarks extend the M1 `applyPBR` pattern via a per-id material map; trees green via a material tint.

**Tech Stack:** TypeScript, Three.js `0.160`, `postprocessing@6.38.3` (existing), Vitest, Vite.

## Global Constraints

- **No new runtime dependency:** use the existing `postprocessing` + `three`. The `DualLUTEffect` is a custom subclass of `postprocessing`'s `Effect`.
- **Tone mapping stays in post (AgX)**; the renderer stays `NoToneMapping`. Do not re-introduce ACES.
- **Region centers come from `STOP_PLACEMENTS`/`ARGONATH`** (`src/data/world.ts`) — never duplicate coordinates.
- **Crossfade is region↔DEFAULT** (regions are spatially separated); swap the region LUT only while `mix ≈ 0`.
- **Graceful asset fallback:** a region whose `.cube` LUT fails to load falls back to the DEFAULT LUT (mirrors M1's HDRI/LUT fallbacks). The milestone must build and run before all 4 region LUTs exist.
- **Tests are pure/node:** unit-test only pure functions (region math, profile lerp, material config); GPU/DOM code is validated by `npm run typecheck` + `npm run build` + in-browser verification.
- **Existing suite stays green** (58 tests as of M1) and `npm run build` stays warning-free.
- **Stop ids:** `shire, bywater, bree, edoras, isengard, minas` (+ `argonath`). Note the Minas id is `minas` (model is `minas-tirith`).
- **Region LUT files (user-provided)** live in `public/assets/luts/`: `bree.cube`, `edoras.cube`, `isengard.cube`, `minas-tirith.cube`; DEFAULT reuses the existing `golden-hour.cube`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/data/regions.ts` | create | `RegionProfile` type; `DEFAULT_PROFILE`; `REGIONS` (per-area profiles with centers resolved from `STOP_PLACEMENTS`/`ARGONATH`). Pure data. |
| `src/data/regions.test.ts` | create | Validate centers resolve and profiles are well-formed. |
| `src/engine/atmosphere.ts` | create | Pure: `regionWeight`, `nearestRegion`, `lerpProfile`. Runtime: `createAtmosphere` (loads LUTs, per-frame blend → fog/exposure/dual-LUT mix). |
| `src/engine/atmosphere.test.ts` | create | TDD the three pure functions. |
| `src/engine/postfx.ts` | modify | Add `DualLUTEffect`; swap the single `LUT3DEffect` for it; expose `setRegionLUT`/`setLutMix`/`setExposure` on `PostFX`. |
| `src/world/landmarks.ts` | modify | `MATERIAL_BY_ID` map; `applyPBR` for every landmark (remove the toonify branch for landmarks). |
| `src/world/landmarks.test.ts` | modify | Add a test for the pure `materialFor(id)` helper. |
| `src/world/nature.ts` | modify | Green the tree-canopy material (tint in `toonOf`). |
| `src/main.ts` | modify | Instantiate `createAtmosphere`; call `atmosphere.update(x,z)` in the loop; pass region LUTs. |

---

## Task 1: Region data model

**Files:**
- Create: `src/data/regions.ts`
- Test: `src/data/regions.test.ts`

**Interfaces:**
- Consumes: `STOP_PLACEMENTS`, `ARGONATH` from `../data/world`.
- Produces:
  - `interface RegionFog { color: number; near: number; far: number }`
  - `interface RegionProfile { id: string; radius: number; falloff: number; lut: string | null; fog: RegionFog; exposure: number }`
  - `interface Region extends RegionProfile { center: { x: number; z: number } }`
  - `const DEFAULT_PROFILE: RegionProfile` (id `""`, `lut: "golden-hour.cube"`)
  - `const REGIONS: Region[]` (bree, edoras, isengard, minas, argonath — each with center resolved from world data)

- [ ] **Step 1: Write the failing test** — create `src/data/regions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { REGIONS, DEFAULT_PROFILE } from "./regions";
import { STOP_PLACEMENTS } from "./world";

describe("REGIONS", () => {
  it("resolves each region's center from STOP_PLACEMENTS / ARGONATH", () => {
    const isengard = REGIONS.find((r) => r.id === "isengard")!;
    const place = STOP_PLACEMENTS.find((p) => p.id === "isengard")!;
    expect(isengard.center.x).toBeCloseTo(place.x);
    expect(isengard.center.z).toBeCloseTo(place.z);
  });
  it("covers the four graded regions + argonath", () => {
    expect(REGIONS.map((r) => r.id).sort()).toEqual(["argonath", "bree", "edoras", "isengard", "minas"]);
  });
  it("every region has positive radius/falloff and a fog band with near < far", () => {
    for (const r of REGIONS) {
      expect(r.radius).toBeGreaterThan(0);
      expect(r.falloff).toBeGreaterThan(0);
      expect(r.fog.near).toBeLessThan(r.fog.far);
    }
  });
  it("default profile uses the existing golden-hour LUT", () => {
    expect(DEFAULT_PROFILE.lut).toBe("golden-hour.cube");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/regions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — create `src/data/regions.ts`:

```typescript
import { STOP_PLACEMENTS, ARGONATH } from "./world";

export interface RegionFog { color: number; near: number; far: number }

export interface RegionProfile {
  id: string;          // stop id or "argonath"; "" for the default/travel mood
  radius: number;      // full-mood radius (m) around the center
  falloff: number;     // band (m) over which the mood fades to DEFAULT
  lut: string | null;  // LUT filename in /assets/luts/; null → use the default LUT
  fog: RegionFog;
  exposure: number;
}

export interface Region extends RegionProfile { center: { x: number; z: number } }

/** Travel / Shire / Bywater: the warm lush-green base grade (matches the M1 default). */
export const DEFAULT_PROFILE: RegionProfile = {
  id: "", radius: 0, falloff: 0,
  lut: "golden-hour.cube",
  fog: { color: 0xe7decb, near: 60, far: 360 },
  exposure: 1.05,
};

// Per-area moods (starting values; tunable in-browser via the debug overlay).
const RAW: RegionProfile[] = [
  { id: "bree",     radius: 22, falloff: 14, lut: "bree.cube",         fog: { color: 0xe0cda0, near: 50, far: 300 }, exposure: 0.95 },
  { id: "edoras",   radius: 24, falloff: 16, lut: "edoras.cube",       fog: { color: 0xe8dcc0, near: 60, far: 360 }, exposure: 1.10 },
  { id: "isengard", radius: 24, falloff: 16, lut: "isengard.cube",     fog: { color: 0x9a9a96, near: 30, far: 180 }, exposure: 0.85 },
  { id: "minas",    radius: 28, falloff: 18, lut: "minas-tirith.cube", fog: { color: 0xdfe7ec, near: 80, far: 360 }, exposure: 1.20 },
  { id: "argonath", radius: 20, falloff: 14, lut: "minas-tirith.cube", fog: { color: 0xc8d0d4, near: 50, far: 300 }, exposure: 1.00 },
];

const PLACE = new Map([...STOP_PLACEMENTS, ARGONATH].map((p) => [p.id, p]));

export const REGIONS: Region[] = RAW.map((r) => {
  const p = PLACE.get(r.id);
  if (!p) throw new Error(`region "${r.id}" has no placement in world.ts`);
  return { ...r, center: { x: p.x, z: p.z } };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/regions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/regions.ts src/data/regions.test.ts
git commit -m "feat(regions): per-area atmosphere data model"
```

---

## Task 2: Region blend math (pure)

**Files:**
- Create: `src/engine/atmosphere.ts` (pure functions only this task)
- Test: `src/engine/atmosphere.test.ts`

**Interfaces:**
- Consumes: `Region`, `RegionProfile`, `RegionFog`, `REGIONS` from `../data/regions`; `THREE`.
- Produces:
  - `regionWeight(dist: number, radius: number, falloff: number): number` — 1 inside radius, smoothstep to 0 across falloff.
  - `nearestRegion(x: number, z: number, regions?: Region[]): { region: Region; dist: number } | null`
  - `interface BlendedProfile { fog: RegionFog; exposure: number }`
  - `lerpProfile(base: RegionProfile, region: RegionProfile, t: number): BlendedProfile` — lerps fog color/near/far + exposure.

- [ ] **Step 1: Write the failing test** — create `src/engine/atmosphere.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { regionWeight, nearestRegion, lerpProfile } from "./atmosphere";
import { REGIONS, DEFAULT_PROFILE } from "../data/regions";

describe("regionWeight", () => {
  it("is 1 at/inside the radius and 0 beyond radius+falloff", () => {
    expect(regionWeight(0, 20, 10)).toBe(1);
    expect(regionWeight(20, 20, 10)).toBe(1);
    expect(regionWeight(30, 20, 10)).toBe(0);
    expect(regionWeight(40, 20, 10)).toBe(0);
  });
  it("is monotonic between radius and radius+falloff", () => {
    const a = regionWeight(23, 20, 10), b = regionWeight(27, 20, 10);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(0);
  });
});

describe("nearestRegion", () => {
  it("returns the closest region to a point near its center", () => {
    const isengard = REGIONS.find((r) => r.id === "isengard")!;
    const got = nearestRegion(isengard.center.x + 1, isengard.center.z - 1);
    expect(got?.region.id).toBe("isengard");
    expect(got?.dist).toBeLessThan(3);
  });
});

describe("lerpProfile", () => {
  const region = REGIONS.find((r) => r.id === "isengard")!;
  it("t=0 yields the base, t=1 yields the region", () => {
    expect(lerpProfile(DEFAULT_PROFILE, region, 0).exposure).toBeCloseTo(DEFAULT_PROFILE.exposure);
    expect(lerpProfile(DEFAULT_PROFILE, region, 1).exposure).toBeCloseTo(region.exposure);
  });
  it("t=0.5 blends exposure and fog color halfway", () => {
    const b = lerpProfile(DEFAULT_PROFILE, region, 0.5);
    expect(b.exposure).toBeCloseTo((DEFAULT_PROFILE.exposure + region.exposure) / 2);
    const mid = new THREE.Color(DEFAULT_PROFILE.fog.color).lerp(new THREE.Color(region.fog.color), 0.5);
    expect(b.fog.color).toBe(mid.getHex());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/atmosphere.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation** — create `src/engine/atmosphere.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/atmosphere.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/atmosphere.ts src/engine/atmosphere.test.ts
git commit -m "feat(atmosphere): pure region blend math (weight, nearest, lerp)"
```

---

## Task 3: DualLUTEffect in the post stack

**Files:**
- Modify: `src/engine/postfx.ts`

**Interfaces:**
- Consumes: `postprocessing` (`Effect`, `Uniform`), `THREE`.
- Produces:
  - `class DualLUTEffect extends Effect` with `set regionLUT(t: THREE.Texture)` and `set mix(v: number)`.
  - `createPostFX(...)` now builds a `DualLUTEffect` for the `lut` step (base LUT in both slots initially) and the returned `PostFX` gains `setRegionLUT(tex: THREE.Texture)`, `setLutMix(v: number)`, and `setExposure(v: number)`.

- [ ] **Step 1: Add the DualLUTEffect class** — at the top of `src/engine/postfx.ts` (after the imports), add `Uniform` to the `postprocessing` import and define the effect:

```typescript
import { /* ...existing..., */ Uniform } from "postprocessing";

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
      uniforms: new Map<string, Uniform<unknown>>([
        ["lutA", new Uniform(base)],
        ["lutB", new Uniform(base)],
        ["lutMix", new Uniform(0)],
        ["lutDomain", new Uniform(new THREE.Vector2((size - 1) / size, 1 / (2 * size)))],
      ]),
    });
  }
  set regionLUT(t: THREE.Texture) { (this.uniforms.get("lutB") as Uniform<THREE.Texture>).value = t; }
  set mix(v: number) { (this.uniforms.get("lutMix") as Uniform<number>).value = v; }
}
```

- [ ] **Step 2: Use it for the `lut` step** — in `createPostFX`'s `make` switch, replace the `case "lut"` body so it builds the dual-LUT effect and captures it in an outer `let`:

```typescript
  // declared before `make`, alongside the `dof` handle:
  let dualLut: DualLUTEffect | null = null;
  // ...
      case "lut": {
        if (!lut) return null;
        // LUTCubeLoader yields a Data3DTexture; its image.width is the LUT size.
        const size = (lut as unknown as THREE.Data3DTexture).image?.width ?? 33;
        dualLut = new DualLUTEffect(lut, size);
        return dualLut;
      }
```

- [ ] **Step 3: Expose the handles on the returned PostFX** — extend the `PostFX` interface and the returned object:

```typescript
export interface PostFX {
  render(dt: number): void;
  setSize(w: number, h: number): void;
  setFocus(active: boolean): void;
  setRegionLUT(tex: THREE.Texture): void;
  setLutMix(v: number): void;
  setExposure(v: number): void;
  dispose(): void;
}
```

In the returned object add (the renderer is in scope in `createPostFX`):

```typescript
    setRegionLUT: (tex) => { if (dualLut) dualLut.regionLUT = tex; },
    setLutMix: (v) => { if (dualLut) dualLut.mix = v; },
    setExposure: (v) => { renderer.toneMappingExposure = v; },
```

(`setFocus`, `render`, `setSize`, `dispose` stay as they are.)

- [ ] **Step 4: Verify typecheck + existing tests**

Run: `npm run typecheck && npx vitest run src/engine/postfx.test.ts`
Expected: typecheck clean; `buildEffectChain` tests still PASS (the chain order is unchanged — only the `lut` effect's class changed). If the `Uniform<unknown>` generic fights TypeScript, type the map as `Map<string, Uniform<any>>` and keep the typed setters.

- [ ] **Step 5: Commit**

```bash
git add src/engine/postfx.ts
git commit -m "feat(postfx): DualLUTEffect for per-region LUT crossfade"
```

---

## Task 4: Atmosphere runtime + loop wiring

**Files:**
- Modify: `src/engine/atmosphere.ts` (add `createAtmosphere`)
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `regionWeight`, `nearestRegion`, `lerpProfile` (Task 2); `REGIONS`, `DEFAULT_PROFILE`; `PostFX` (Task 3); `LUTCubeLoader` from `postprocessing`; `THREE`.
- Produces: `interface Atmosphere { update(x: number, z: number): void; dispose(): void }`; `createAtmosphere(scene, postfx, drawDistance): Promise<Atmosphere>`.

- [ ] **Step 1: Add `createAtmosphere`** — append to `src/engine/atmosphere.ts`:

```typescript
import { LUTCubeLoader } from "postprocessing";
import type { PostFX } from "./postfx";

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
```

- [ ] **Step 2: Wire into `main.ts`** — after `postfx` is created (and before `startLoop`), add:

```typescript
import { createAtmosphere } from "./engine/atmosphere";
// ...
const atmosphere = await createAtmosphere(scene, postfx, quality.drawDistance);
```

In the loop, immediately before `environment.update(...)`, add:

```typescript
      atmosphere.update(gandalf.root.position.x, gandalf.root.position.z);
```

(Atmosphere owns fog now; `environment` still owns IBL/sun/CSM. The `environment.ts` initial `scene.fog` assignment stays as a pre-atmosphere default and is harmless — atmosphere overwrites it each frame.)

- [ ] **Step 3: Verify build + run**

Run: `npm test && npm run build`
Expected: all tests PASS; typecheck clean; build succeeds.
Then `npm run dev` and walk toward Isengard and Minas Tirith: confirm the grade/fog/exposure shift and crossfade smoothly. With region `.cube` files absent, each region falls back to the default grade but fog/exposure still shift — that confirms the runtime works before the LUTs arrive.

- [ ] **Step 4: Commit**

```bash
git add src/engine/atmosphere.ts src/main.ts
git commit -m "feat(atmosphere): per-frame region blend + loop wiring"
```

---

## Task 5: Per-landmark PBR materials

**Files:**
- Modify: `src/world/landmarks.ts`
- Test: `src/world/landmarks.test.ts`

**Interfaces:**
- Consumes: `applyPBR`, `PBRConfig` from `./materials`.
- Produces: `materialFor(id: string): PBRConfig` (pure); `landmarks.ts` applies `applyPBR(root, materialFor(p.id))` to every landmark.

- [ ] **Step 1: Write the failing test** — append to `src/world/landmarks.test.ts`:

```typescript
import { materialFor } from "./landmarks";

describe("materialFor", () => {
  it("isengard is darker/rougher with slight metalness", () => {
    const m = materialFor("isengard");
    expect(m.metalness).toBeGreaterThan(0);
    expect(m.roughness).toBeLessThanOrEqual(0.8);
  });
  it("minas is low-roughness bright stone", () => {
    expect(materialFor("minas").roughness).toBeLessThanOrEqual(0.65);
  });
  it("unknown ids fall back to a sensible default", () => {
    expect(materialFor("nope").roughness).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/landmarks.test.ts`
Expected: FAIL — `materialFor` not exported.

- [ ] **Step 3: Implement** — in `src/world/landmarks.ts`: add the import + map + helper, and replace the per-id branch in `load`:

```typescript
import { applyPBR, type PBRConfig } from "./materials";

const DEFAULT_MAT: PBRConfig = { roughness: 0.9, metalness: 0.0 };
const MATERIAL_BY_ID: Record<string, PBRConfig> = {
  shire:    { roughness: 0.9 },
  bywater:  { roughness: 0.9 },
  bree:     { roughness: 0.85 },
  edoras:   { roughness: 0.8 },
  isengard: { roughness: 0.7, metalness: 0.1 },
  minas:    { roughness: 0.6 },
  argonath: { roughness: 0.85 },
};

/** Pure: the PBR material config for a landmark id (default for unknowns). */
export function materialFor(id: string): PBRConfig {
  return MATERIAL_BY_ID[id] ?? DEFAULT_MAT;
}
```

Then in `load`, replace:

```typescript
        if (p.id === "shire") applyPBR(root, { roughness: 0.9, metalness: 0.0 });
        else toonify(root);
```

with:

```typescript
        applyPBR(root, materialFor(p.id));
```

Remove the now-unused `toonify` import from `landmarks.ts` (it remains exported from `assets.ts` as the documented fallback).

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/world/landmarks.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Verify in-browser**

Run: `npm run dev`, walk to each landmark. Expected: all render PBR-shaded and respond to lighting/region grade; no black/broken materials.

- [ ] **Step 6: Commit**

```bash
git add src/world/landmarks.ts src/world/landmarks.test.ts
git commit -m "feat(landmarks): PBR materials for all landmarks via materialFor map"
```

---

## Task 6: Green the tree canopies

**Files:**
- Modify: `src/world/nature.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: tree instances whose canopy material reads green (a tunable tint in `toonOf`).

The mallorn trees are instanced via `toonOf(src)` (a `MeshToonMaterial` built from the model's `map` + `color`). Several mallorn variants are autumn-toned. Green them by multiplying the toon material by a green tint — but only for the foliage models, not props.

- [ ] **Step 1: Add a green tint to the tree material** — in `src/world/nature.ts`, change `toonOf` to accept a tint and apply it, and pass a green tint for mallorn trees:

```typescript
function toonOf(src: THREE.Mesh, tint?: number): THREE.MeshToonMaterial {
  const mat = src.material as THREE.MeshStandardMaterial;
  const base = mat.color?.clone() ?? new THREE.Color(0x6f8147);
  if (tint !== undefined) base.multiply(new THREE.Color(tint));
  return new THREE.MeshToonMaterial({ map: mat.map ?? null, color: base, gradientMap: ramp });
}
```

In `instance(...)`, thread an optional `tint` through `opts` and use it:

```typescript
  opts: { sink?: number; cullable?: boolean; tint?: number; collide?: { list: Collider[]; factor: number } } = {}
  // ...
  const inst = new THREE.InstancedMesh(src.geometry, toonOf(src, opts.tint), count);
```

In `scatterNature`, pass a green tint for the mallorn loop (keep mountain backdrops untinted):

```typescript
    }, { sink: 0.7, cullable: true, tint: 0x8fb45a, collide: { list: colliders, factor: 0.7 } });
```

(Keep `0x8fb45a` as a light green so foliage greens without going dark — a dark tint crushes values, as learned with the grass. Tune in-browser.)

- [ ] **Step 2: Verify typecheck + browser**

Run: `npm run typecheck && npm run build`
Expected: clean / succeeds.
Then `npm run dev`: tree canopies read green (lush, not autumn-orange); trunks still fine; no over-dark foliage. Tune the tint hex if needed. If tinting can't green them acceptably (e.g. the texture is fully baked orange), fall back to swapping the mallorn canopy texture for a green one (provided asset) — note this in the report.

- [ ] **Step 3: Commit**

```bash
git add src/world/nature.ts
git commit -m "feat(nature): green the tree canopies (tunable tint)"
```

---

## Self-Review

**Spec coverage**
- PBR for all landmarks + Argonath → Task 5. ✓
- Per-region atmosphere (LUT + fog + exposure, crossfade) → region data (T1) + blend math (T2) + DualLUTEffect (T3) + runtime/wiring (T4). ✓
- Dual-LUT crossfade effect → Task 3. ✓
- Tree-canopy greening → Task 6. ✓
- Region centers from `STOP_PLACEMENTS` (DRY) → Task 1. ✓
- Graceful missing-LUT fallback → Task 4 (`load` → DEFAULT). ✓
- Tone mapping stays AgX / renderer NoToneMapping → unchanged; `setExposure` only writes `toneMappingExposure`. ✓
- Unit tests for region math/profile/material → Tasks 1,2,5. ✓
- No new dependency → Task 3 uses `postprocessing`'s `Effect`/`Uniform`. ✓

**Placeholder scan:** none — every code step shows complete code; the tree-greening fallback (provided texture) is a genuine, bounded contingency, not a vague placeholder.

**Type consistency:** `RegionProfile`/`Region`/`RegionFog`/`DEFAULT_PROFILE`/`REGIONS` (T1) used verbatim in T2/T4. `regionWeight`/`nearestRegion`/`lerpProfile`/`BlendedProfile` (T2) used in T4. `DualLUTEffect`/`setRegionLUT`/`setLutMix`/`setExposure` (T3) used in T4. `materialFor`/`PBRConfig` (T5) consistent. `createAtmosphere`/`Atmosphere` (T4) consistent.

**Known judgment calls (flagged for the implementer):**
- DualLUT sampling uses a `lowp sampler3D` with scale/offset matching postprocessing's LUT3DEffect; if the installed version's LUT textures need a different sampling setup, mirror `LUT3DEffect`'s shader and adjust (verify via typecheck + the in-browser grade looking correct).
- All region moods, fog bands, exposures, radii/falloffs, material configs, and the tree tint are starting values — final values are tuned in-browser (debug overlay) during execution.
