# AAA Rendering Vertical Slice — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design)
**Milestone:** 1 of a multi-milestone AAA visual refactor

## Background

"An Engineer's Journey" is an interactive 3D portfolio rendered with Three.js, currently using a deliberately **toon-shaded, heavily decimated** art style (`MeshToonMaterial`, models simplified to ~2% of their triangles, Draco-compressed). The goal of this refactor is to move the project toward a **grounded, AAA "Assassin's Creed"-style look and feel** — fidelity-first.

Because "all of it" (fidelity + traversal + HUD + new assets) is too large for one effort, the work is decomposed into milestones. **This spec covers Milestone 1: a rendering vertical slice** — a new AAA rendering pipeline proven on one hero scene. Everything later inherits the look established here.

### Decisions locked during brainstorming

- **Core vibe:** All of it, fidelity-first (lead with visual fidelity).
- **Art direction:** Grounded realism via PBR.
- **Asset reality:** Source new PBR-ready assets (globally); for this slice, re-texture the existing Gandalf rig to de-risk.
- **Platform:** Desktop-first, with graceful mobile degradation.
- **First milestone:** Rendering vertical slice (pipeline + one hero scene).
- **Render stack:** pmndrs `postprocessing` + HDRI/IBL + Cascaded Shadow Maps, inside the existing Three.js codebase.
- **Hero landmark:** The Shire (the journey's first stop), at golden hour.
- **Gandalf:** Re-texture the existing rig (keep the proven idle/walk/run/wave/listening animations); a fully new PBR character is a deferred later milestone.

## Goal & Success Criteria

Deliver one hero scene at AAA quality that establishes the visual language for the whole project.

Done means:
- Side-by-side, the new Shire scene reads as *grounded, cinematic, AC-like* vs. the current toon look.
- ~60fps on a typical desktop GPU; gracefully degrades to a working mobile tier.
- The pipeline is **reusable** — adding landmark #2 later is "drop in asset + material config," not "re-engineer."
- **Zero regression** to existing gameplay (movement, camera, interaction, journal, audio).

## Scope

**In scope**
- New rendering pipeline modules (environment/lighting, PBR material system, post-FX, extended quality tiers).
- HDRI image-based lighting + atmospheric sky + height/exponential fog.
- Cascaded Shadow Maps.
- Post-processing stack: ACES tone mapping, GTAO/N8AO, threshold bloom, depth of field, LUT color grade, vignette, film grain, subtle chromatic aberration, SMAA.
- New PBR assets for one hero scene: the Shire landmark + terrain/ground materials + re-textured Gandalf.
- Debug overlay (FPS / frame-time / tier switcher / effect toggles).

**Out of scope (later milestones)**
- The other 5 landmarks (+ per-area LUTs).
- A fully new PBR Gandalf character.
- Traversal / parkour mechanics.
- Animus-style HUD.
- Full re-production of all props.

## Architecture — New / Changed Modules

Each module has one job and a clean interface.

| Module | Responsibility |
|---|---|
| `src/engine/postfx.ts` *(new)* | Wraps the pmndrs `EffectComposer`; builds the effect chain per quality tier; exposes `render(dt)`, `setSize()`, and hooks (e.g. intensify DoF during a tale focus). Replaces the direct `renderer.render` call in the loop. |
| `src/engine/environment.ts` *(new, absorbs parts of `scene.ts`)* | Loads the HDRI → `PMREMGenerator` → `scene.environment`; sun directional light matched to the HDRI; CSM setup; sky + height/exponential fog; exposure. Updates the sun + cascades to follow the player each frame. |
| `src/world/materials.ts` *(new, replaces `toonify`)* | PBR material factory: loads texture sets with correct color spaces (albedo = sRGB; normal/rough/metal/AO = linear), sets `envMapIntensity`, anisotropy. A manifest maps each asset → its material config. |
| `src/engine/quality.ts` *(extend)* | HIGH / MEDIUM / LOW tiers controlling pixelRatio, shadow resolution + cascade count, which post effects are active, AA type, draw distance. Auto-detect + manual override + debug toggle. |
| `src/engine/renderer.ts` *(update)* | ACESFilmic (or AgX) tone mapping, correct color space, physically-based lighting, exposure, high-precision buffer. |

**Per-frame data flow:** loop tick → game/player update → `environment.update()` (sun + CSM follow player) → `postfx.render(scene, camera, dt)`.

Existing `engine/loop.ts`, `player/*`, `systems/*`, `ui/*` stay intact — we swap the *render call* and the *materials*, not the game logic.

## The Look — Effect Stack & "AC Grade"

**Color & lighting foundation**
- Linear working space → sRGB output, **ACESFilmic** tone mapping, tuned exposure.
- **HDRI image-based lighting**: a golden-hour `.hdr` (2K, half-float) through `PMREMGenerator` drives ambient + reflections. Sun directional light aimed to match the HDRI sun.
- **Sky**: HDRI backdrop, atmospheric haze blended into fog.
- **Shadows**: Cascaded Shadow Maps (~3 cascades, PCF-soft).
- **Fog**: exponential + subtle height component for depth/scale.

**Post-processing chain (HIGH tier), in order**
1. **GTAO/N8AO** — contact-shadow ambient occlusion (half-res for cost).
2. **Bloom** — threshold-based (only sun/highlights bloom).
3. **Depth of Field** — subtle by default; intensifies during a tale focus (the existing cinematic push-in becomes filmic).
4. **Tone mapping** (ACES).
5. **LUT color grade** — the Assassin's Creed teal-orange grade (warm highlights, cool shadows); `.cube` LUT, swappable per-area later.
6. **Vignette + film grain + slight chromatic aberration** — the "Animus" texture, dialed low.
7. **SMAA** antialiasing (TAA optional if stable with the moving camera).

**Tier degradation (desktop-first, graceful mobile)**
- **MEDIUM**: drop DoF, lighter GTAO; keep bloom/tonemap/LUT/SMAA.
- **LOW (mobile)**: tone mapping + bloom + SMAA + basic shadows only; no GTAO/DoF/CA; lower pixelRatio. Existing toon path remains as an emergency fallback.

## Asset Plan

- **Landmark:** The Shire (hero scene), at golden hour. New PBR-textured GLB, reasonable poly, UVs, KTX2-compressed texture set.
- **Terrain/ground:** PBR tiling materials (grass + dirt + rock) with normal/roughness, slope-blended (triplanar on steep faces); upgraded shading on the existing instanced grass field. No new geometry.
- **Gandalf:** Re-texture the existing rig with PBR materials — keeps the proven animations, gains full PBR/HDRI lighting response.
- **Textures:** all KTX2/Basis compressed, 1–2K. Target total slice download (GLB + textures + 1 HDRI) **under ~10MB**.

## Performance, Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PBR textures bloat download | KTX2/Basis compression, 1–2K maps, reuse tiling materials. Budget < ~10MB for the slice. |
| Post stack too heavy on GPU | Quality tiers; half-res GTAO/bloom; tuned pixelRatio; effects merged into few passes by `postprocessing`. |
| HDRI memory cost | 2K half-float, single env map, disposed after PMREM prefilter. |
| CSM is fiddly to tune | Start with 3 fixed cascades sized to the play area; debug controls; single tuned shadow on LOW. |
| Mobile can't hold framerate | LOW tier strips expensive effects; existing toon path remains as fallback. |
| New deps / color-space regressions | Lock `postprocessing` version; pure-function helpers for color-space + tier selection are unit-tested; keep existing Vitest suite green. |

A **debug overlay** (FPS + frame-time + tier switcher + effect toggles) ships with the slice for tuning on real hardware and live before/after comparison.

## Testing

- **Unit (Vitest):** material-factory config, quality-tier selection logic, color-space helpers — all pure functions. Existing tests stay green.
- **Manual/visual:** before/after screenshots of the Shire scene; verify on 2+ desktop GPUs and at least one phone; confirm gameplay/interaction/journal unaffected.
- **Performance:** frame-time budget check per tier via the debug overlay.

## Roadmap (context for later specs)

1. **This slice** — pipeline + Shire + re-textured Gandalf.
2. Roll the look out to the other 5 landmarks (+ per-area LUTs: cold Isengard, bright Minas Tirith).
3. New PBR Gandalf character (deferred mini-project).
4. Traversal / parkour feel.
5. Animus-style HUD (viewpoints, diegetic markers, sync moments).
