# AAA Per-Area Atmosphere — Design Spec (Milestone 2)

**Date:** 2026-06-18
**Status:** Approved (design)
**Milestone:** 2 of the AAA visual refactor (builds on Milestone 1, merged to `dev` via PR #12)

## Background

Milestone 1 delivered a reusable AAA rendering pipeline (PBR materials, HDRI/IBL, cascaded shadows, a post-processing stack with a single global color grade) proven on one hero scene (the Shire). Milestone 2 rolls that look out to the rest of the world and gives each location its own **distinct atmosphere** — the "Assassin's Creed biomes" feel — so walking from the Shire to Isengard to Minas Tirith feels like moving through different moods, not one uniform scene.

### Production context

`main` is production (Cloudflare Pages deploys from it). Per the agreed strategy, `main` stays frozen until the whole refactor (M2–M5) is complete on `dev`; then a single `dev → main` push. M2 merges to `dev` only.

### Decisions locked during brainstorming

- **Per-area look:** full per-area atmosphere — per-region color grade **plus** tuned fog and exposure, crossfading as Gandalf moves between areas.
- **Grade method:** per-region `.cube` LUT files (user provides ~4), crossfaded via a custom **dual-LUT mix** post-processing effect.
- **Landmark models:** reused — existing geometry re-textured to PBR (like the Shire), not new GLBs.
- **Tree polish:** green the autumn tree canopies as part of this milestone.

## Goal & Success Criteria

Done means:
- All 6 landmarks (+ Argonath) render with PBR materials under the M1 pipeline.
- Each region has a distinct, recognizable mood (cold/grim Isengard, bright clean Minas Tirith, golden Edoras, cozy Bree) via its own LUT + fog + exposure.
- The atmosphere **crossfades smoothly** as the player crosses region boundaries — no hard cuts or flicker.
- The world reads green/lush in the default/travel areas (trees no longer heavy-orange).
- Region blend math is unit-tested; the look is browser-verified per region.
- Existing tests stay green; zero gameplay regression.

## Scope

**In scope**
- PBR materials for the 5 remaining landmarks + Argonath (extend the M1 `applyPBR` pattern).
- A per-region atmosphere system: region data model, per-frame blending of LUT (dual-LUT mix) + fog + exposure by player position.
- A custom `DualLUTEffect` for crossfading two 3D LUTs in one pass.
- World-wide tree-canopy greening.
- Wiring into the frame loop.

**Out of scope (later milestones)**
- A new PBR Gandalf character (M3).
- Traversal / parkour (M4).
- Animus-style HUD (M5).
- New high-fidelity landmark GLBs (optional future upgrade).

## Architecture — New / Changed Modules

| Module | Responsibility |
|---|---|
| `src/data/regions.ts` *(new)* | One `RegionProfile` per area + a `DEFAULT`. Pure data. Centers are read from the existing `STOP_PLACEMENTS` (no duplicated coordinates). Adds per-area `radius`, `falloff`, `lut` (filename), `fog{color,near,far}`, `exposure`. |
| `src/engine/atmosphere.ts` *(new)* | Per frame: `nearestRegion(x,z)`, `regionWeight(distance, radius, falloff)` (smoothstep), `lerpProfile(DEFAULT, region, t)` — all pure/unit-tested. The thin GPU side lerps `scene.fog`, sets exposure, and drives the dual-LUT mix. Exposes `update(x,z)` and `dispose()`. |
| `src/engine/postfx.ts` *(extend)* | Add `DualLUTEffect` (uniforms: `lutA`, `lutB`, `mix`) that samples both 3D LUTs and blends by `mix`. Expose `setRegionLUT(tex)` and `setLutMix(t)` on the `PostFX` interface. Replaces the single `LUT3DEffect` in the chain. |
| `src/world/landmarks.ts` *(extend)* | Replace the `shire`-only branch with a `MATERIAL_BY_ID` map; every landmark (+ Argonath) gets a tuned PBR config via `applyPBR`. |
| `src/world/nature.ts` (or the tree builder) *(extend)* | Green the tree canopies via the cheapest reliable lever found on inspection (tint or texture swap), mirroring the M1 grass fix. |
| `src/main.ts` *(extend)* | Instantiate `atmosphere`; call `atmosphere.update(playerPos.x, playerPos.z)` in the loop before `environment.update` / `postfx.render`. |

**Per-frame flow:** loop → `atmosphere.update(x,z)` (lerps fog + exposure, sets dual-LUT mix) → `environment.update(x,z)` → `postfx.render(dt)`.

## Region Profiles

`RegionProfile = { id, radius, falloff, lut, fog: { color, near, far }, exposure }`. Centers from `STOP_PLACEMENTS[id]`. Starting values (tunable in-browser via the debug overlay):

| Region | Mood | Fog | Exposure | LUT file |
|---|---|---|---|---|
| DEFAULT (travel / Shire / Bywater) | warm, lush green | warm haze, far | 1.05 | `golden-hour.cube` (existing warm-natural) |
| Bree | cozy dusk amber | warmer, mid | 0.95 | `bree.cube` |
| Edoras | golden-hour gold | warm, far | 1.10 | `edoras.cube` |
| Isengard | cold, desaturated, grim | grey, denser | 0.85 | `isengard.cube` |
| Minas Tirith | bright white-stone, clean | cool, thin | 1.20 | `minas-tirith.cube` |
| Argonath | epic cool stone | cool, mid | 1.00 | reuse `minas-tirith.cube` |

Shire and Bywater map to DEFAULT (no dedicated LUT). The crossfade is region↔DEFAULT (regions are spatially separated by travel space), so the dual-LUT mix blends each region's LUT against the default grade by proximity weight `t`.

## Dual-LUT Crossfade

`DualLUTEffect` holds two `Data3DTexture` LUTs (`lutA` = DEFAULT, `lutB` = active region) and a `mix` uniform. Fragment: `color = mix(sampleLUT(lutA, color), sampleLUT(lutB, color), mix)`. Per frame, `atmosphere` sets `lutB` to the nearest region's LUT (swapped while `mix ≈ 0` in travel space) and `mix = t`. This yields a true single-pass crossfade. The effect remains a convolution-free effect that can sit in the merged non-convolution `EffectPass` from M1.

## Per-Landmark Materials

`MATERIAL_BY_ID: Record<string, PBRConfig>` with a default. Starting configs (tunable):
- shire: `{ roughness: 0.9 }`
- bywater: `{ roughness: 0.9 }` (mill timber/stone)
- bree: `{ roughness: 0.85 }` (timber inn)
- edoras: `{ roughness: 0.8 }` (golden timber hall)
- isengard: `{ roughness: 0.7, metalness: 0.1 }` (dark stone/iron)
- minas: `{ roughness: 0.6 }` (bright white stone)
- argonath: `{ roughness: 0.85 }` (weathered stone)

`landmarks.ts` applies `applyPBR(root, MATERIAL_BY_ID[id] ?? DEFAULT_CFG)` for every landmark, removing the `toonify` branch for landmarks. (`toonify` remains exported in `assets.ts` as the documented fallback.)

## Tree Polish

Inspect how tree canopies are built (`nature.ts` / instanced foliage / GLB textures). Apply the cheapest reliable greening: a green material tint if canopies are texture-mapped and tinting reads well, or a green canopy texture swap otherwise. Verify in-browser. If tinting falls short, a green tree-canopy texture is the one optional art asset for this milestone.

## Assets the User Provides

1. **~4 region LUTs** → `public/assets/luts/`: `bree.cube`, `edoras.cube`, `isengard.cube`, `minas-tirith.cube`. The cold/desaturated Isengard and bright cool Minas Tirith are the priority moods. All are 3D `.cube` LUTs (any standard `LUT_3D_SIZE`, e.g. 33).
2. **Optional:** a greener tree-canopy texture, only if tinting the existing canopies isn't sufficient.

Everything else (fog colors, near/far, exposure, material roughness/metalness, region radii/falloff) is tuned data — no files. Landmark models are reused.

## Performance & Risks

| Risk | Mitigation |
|---|---|
| Dual-LUT sampling cost | One extra 3D-LUT sample per pixel; negligible. Stays in the merged EffectPass. |
| LUT swap mid-transition flicker | Swap `lutB` only while `mix` is near 0 (player in travel space between regions). |
| Region boundaries cause popping | `smoothstep` falloff bands; tune radius/falloff per region; debug overlay shows current region + weight. |
| Tree greening is fiddly (like grass) | Treat as its own task with in-browser verification; fall back to a provided green texture if tint insufficient. |
| Missing region LUT files at dev time | `atmosphere` falls back to DEFAULT for any region whose LUT fails to load (graceful, mirrors the M1 HDRI/LUT fallbacks). |

## Testing

- **Unit (Vitest):** `nearestRegion`, `regionWeight` (smoothstep edges: at center → 1, beyond radius+falloff → 0), `lerpProfile` (fog color/near/far + exposure interpolation). All pure.
- **Manual/visual:** walk to each landmark; confirm its grade/fog/exposure mood and a smooth crossfade at boundaries; confirm trees read green in default areas; confirm no regression to gameplay/interaction/journal/map.
- **Gate:** existing 58 tests stay green; typecheck clean; `npm run build` warning-free; CodeRabbit clean before merge.

## Validation / Done

- All landmarks PBR; each region visibly distinct; crossfades smooth; trees green; unit tests for region math pass; browser-verified per region; merged to `dev`.
