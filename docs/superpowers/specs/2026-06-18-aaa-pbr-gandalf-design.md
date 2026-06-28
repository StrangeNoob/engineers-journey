# AAA New PBR Gandalf — Design Spec (Milestone 3)

**Date:** 2026-06-18
**Status:** Approved (design)
**Milestone:** 3 of the AAA visual refactor (builds on M1 + M2, both in `dev`)

## Background

The player character is Gandalf. Milestones 1–2 re-textured the *existing* low-fidelity Gandalf geometry to PBR (via `applyPBR`) as a deliberate stand-in. Milestone 3 replaces that geometry with a **new, high-quality PBR character model**, while preserving the proven animation system, the pose-aware auto-scale, and all gameplay/collision.

The current character is loaded from **five separate GLBs** (`gandalf-walk/run/idle/listening/one-hand-wave`): the `walk` GLB supplies the skinned mesh, and all five share one skeleton so each file's `animations[0]` retargets onto a single `AnimationMixer`. The mixer crossfades idle/walk/run by gait and blends two gestures (wave, listening).

### Production context

`main` is production and stays frozen until M3–M5 are done; then one `dev → main` push. M3 merges to `dev` only. All tuning/polish (LUT strength, ground-texture perf, unused `bricks`) is deferred to a single pass after M5.

### Decisions locked during brainstorming

- **Asset form:** the user provides **multiple GLBs** (character + animations on **one shared skeleton**); the milestone **merges them offline into a single `gandalf.glb`** with named clips.
- **Animation set:** unknown which clips the model will ship with → design for **all five ideal, with graceful per-clip fallback to `idle`**.
- **Merge approach:** offline build script (`gltf-transform`), not runtime multi-load.
- **Materials:** preserve the model's own PBR maps (normal/roughness/metalness) where present, rather than dropping all but the albedo.

## Goal & Success Criteria

Done means:
- The new Gandalf renders in-game, PBR-shaded, at the correct ~1.9m scale, facing the correct direction.
- idle/walk/run blend by gait; wave plays on the intro; listening (or its fallback) plays on tale-recall.
- Any animation the model lacks falls back to `idle` without crashing.
- The merge is reproducible via one command from the user's dropped GLBs.
- Collision, movement, camera, interaction, and journal behave exactly as before.
- Pure clip-resolution logic is unit-tested; existing Gandalf unit tests stay green; the result is browser-verified.

## Scope

**In scope**
- A merge build script: the user's multiple GLBs → one `public/assets/models/gandalf.glb` with named clips, validating the shared skeleton.
- A loader rewrite in `gandalf.ts`: load one GLB, resolve clips by name with idle fallback, preserve mixer/blend/scale/sole-drop.
- A facing-orientation offset (`MODEL_FACING_OFFSET`) calibrated in-browser.
- Material handling that preserves the model's PBR maps (extends/augments `materials.ts`).
- Removing the orphaned five `gandalf-*.glb` files once the merged model is in.

**Out of scope (later)**
- M4 traversal/parkour, M5 Animus HUD.
- The deferred polish pass (LUT strength, ground-texture perf, `bricks`).
- New animations beyond what the model/merge provides (future).

## Architecture — New / Changed Modules

| File | Status | Responsibility |
|---|---|---|
| `scripts/merge-gandalf.mjs` *(new)* | create | `@gltf-transform/core` script. Reads the GLBs in `assets-src/gandalf/` (named by role keyword), picks one as the base skinned mesh, grafts every other file's animation clips onto that skeleton by **bone-name match**, names each clip by role, and writes `public/assets/models/gandalf.glb` (optionally Draco-compressed). Validates the shared skeleton and aborts with a clear error on mismatch. Wired as `npm run merge:gandalf`. |
| `src/player/gandalf.ts` *(modify)* | `load()` reads the single `gandalf.glb`; builds a name→clip map; uses the pure `resolveClips` for role→clip with idle fallback; applies the PBR-preserving material path; applies `MODEL_FACING_OFFSET`; keeps the mixer, gait crossfade, gesture blend, and pose-aware 1.9m auto-scale unchanged. |
| `src/player/gandalf.test.ts` *(modify)* | add tests for the pure `resolveClips`. |
| `src/world/materials.ts` *(extend)* | add a "preserve existing PBR" path used for the character: keep `MeshStandardMaterial` maps (normal/roughness/metalness/ao) when the source already has them, set cast/receiveShadow + `envMapIntensity` + correct color spaces; fall back to the re-texturing `applyPBR` for toon/basic source materials. |
| `package.json` *(modify)* | add the `merge:gandalf` script and `@gltf-transform/core` (+ functions) as a devDependency. |
| `public/assets/models/gandalf.glb` *(new)* | the merged character. |
| `public/assets/models/gandalf-*.glb` *(delete)* | the five orphaned source files, removed once the merged model loads. |

## Merge Script Behavior

Input: GLBs in `assets-src/gandalf/`, each filename containing a role keyword (`idle`, `walk`, `run`, `wave`, `listening`). One file (idle, or a `--base` arg) provides the skinned mesh + skeleton.

For each input file:
1. Read with `@gltf-transform/core` `NodeIO`.
2. Verify its skeleton's bone-name set matches the base's; abort with a listed diff if not.
3. Extract its animation(s); graft onto the base document, rebinding each channel's target node to the base node with the matching name; rename the resulting clip to the file's role.

Output: one `public/assets/models/gandalf.glb` containing the base mesh + the five (or fewer) named clips. Geometry may be Draco-compressed (hero asset — **not** decimated like the buildings). Re-runnable any time the source GLBs change.

## Loader & Fallback (`gandalf.ts`)

- `const gltf = await loadGLTF("gandalf");` → `clipsByName: Map<string, AnimationClip>` from `gltf.animations`.
- Pure: `resolveClips(roles: Role[], clipsByName): Record<Role, AnimationClip>` where `Role = "idle" | "walk" | "run" | "wave" | "listening"`. Each role resolves to its same-named clip, else to the `idle` clip. A missing `idle` clip throws (it is the required floor).
- Build `loco` (idle/walk/run) + `gestures` (wave/listening) actions from the resolved clips; the mixer, gait weights, gesture blend, timeScale tuning, the pose-aware 1.9m scale, and sole-drop are unchanged from the current implementation.
- `MODEL_FACING_OFFSET` (a Y-rotation constant applied to the mesh) aligns the new rig's forward with the movement/`atan2` convention; calibrated in-browser.

## Material Handling (`materials.ts`)

A new exported function (e.g. `usePBRMaterials(root)`) for the character:
- For each mesh with a `MeshStandardMaterial` that already carries maps (the GLB shipped PBR): keep the material, set `castShadow`/`receiveShadow`, `envMapIntensity`, and ensure albedo/emissive = sRGB and data maps = linear.
- For meshes whose source material is toon/basic (no PBR): fall back to the existing `applyPBR(root, cfg)`.

This preserves a good model's normal/roughness maps instead of discarding them.

## Testing

- **Unit (Vitest):** `resolveClips` — every role maps to its clip; a missing role falls back to `idle`; a missing `idle` throws. Existing pure Gandalf tests stay green.
- **Manual/browser:** new Gandalf loads PBR-shaded at ~1.9m, faces correctly, idle/walk/run blend on movement, wave on intro, listening (or fallback) on tale-recall, casts shadows; collision/camera/interaction/journal unchanged; 0 console errors.
- **Gate:** existing suite stays green; typecheck clean; `npm run build` warning-free; CodeRabbit clean before merge.

## Performance & Risks

| Risk | Mitigation |
|---|---|
| Provided GLBs don't share a skeleton | Merge script validates bone-name sets and aborts with a diff — those clips couldn't retarget anyway. |
| New rig faces the wrong way | `MODEL_FACING_OFFSET` Y-rotation, calibrated in-browser. |
| Wrong scale | Existing pose-aware 1.9m auto-scale measures the animated idle bounds — rig-agnostic. |
| Missing animations | `resolveClips` falls back to `idle`; only a missing `idle` is fatal (and is the documented requirement). |
| Model too heavy (geometry/textures) | Draco-compress geometry in the merge; textures can ride the deferred perf pass; this is a single hero asset. |
| `gltf-transform/core` animation-merge API nuances | The plan resolves the exact API; behavior is specified here (graft clips by bone-name onto one base). |

## Validation / Done

New PBR Gandalf merged from the user's GLBs, loading with correct scale/facing, all locomotion + gestures working (with idle fallback for any missing clip), PBR maps preserved, gameplay unchanged, `resolveClips` unit-tested, browser-verified, merged to `dev`.
