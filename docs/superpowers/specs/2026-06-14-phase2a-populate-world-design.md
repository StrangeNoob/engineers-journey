# Design Spec — Phase 2a: Populate the World

**Date:** 2026-06-14
**Project:** An Engineer's Journey (engineers-journey)
**Status:** Design — awaiting review
**Builds on:** Phase 1 vertical slice (merged, deployed to engineers-journey.pages.dev)

---

## 1. Goal

Turn the single-landmark test patch into a **full, explorable Middle-earth** laid out like the
illustrated map: all six career landmarks (+ the Argonath gateway) placed along a winding road
through open country, with forests, mountains, water, and ambient props — every one of the six
tales recallable. Same playable Gandalf, same controls; just a real world to roam.

Phase 2b (journal/map overlay) and 2c (scroll unfurl, camera, idle, audio) build on top of this.

---

## 2. Key design decisions (flagged — veto any at review)

| Decision | Choice | Why |
|---|---|---|
| **Terrain** | **Flat walkable ground** + distant **mountain-backdrop** scenery (non-walkable) | A heightmapped walkable terrain complicates the kinematic controller (ground raycast), collisions, and mobile perf for marginal gain. Flat ground + backdrop mountains reads like the map from eye level. Rolling hills = a Phase-2c polish if wanted. |
| **World scale** | **Compact**, mirroring the map's relative layout (Shire SW → Minas Tirith NE), stops ~35–55 units apart | Walkable in 1–2 min between stops; not tedious; keeps draw distance manageable. |
| **Landmark loading** | **Lazy-load by distance** (load a landmark's GLB when Gandalf is within ~90 u; keep loaded once seen) | The optimized organic buildings are still ~100–150k tris each; loading all six + Argonath up front is heavy on mobile. |
| **Vegetation** | **InstancedMesh** for trees + grass (one draw call per kind) | Hundreds of trees/grass tufts must not be hundreds of draw calls. |
| **Water** | Static generated models (`stream-*`, `the-fountain`) placed as scenery — **no procedural shader** | Per the earlier decision; static painted water fits the storybook look. |
| **Asset format** | All raw GLBs optimized via `scripts/optimize-glb.sh` → committed under `public/assets/models/` | Raw assets are 14–79 MB; must be Draco'd to ~0.3–2 MB. |

---

## 3. Assets (already generated; this phase optimizes + places them)

Source (raw) in `../new_portfolio/designs/assets/gen/middle-earth/`:

- **Landmarks:** `argonath`, `bree-inn`, `bywater-mill`, `edoras-hall`, `isengard-tower`,
  `minas-tirith` (raw 16–79 MB). `shire-home` already optimized.
- **Nature:** `mallorn-tree-1/2/3`, `grass-tuft`, `mountain-backdrop`, `mountain-backdrop_square`.
- **Water:** `stream-straight`, `stream-curve`, `the-fountain`, `well`.
- **Road:** `stone-road-straight/curve/crossing/fork/end` (straight+curve already optimized), `stone-bridge` (done).
- **Ambient:** `covered-wagon`, `campfire-rest-point`, `market-stall`, `signpost`, `route-marker-red`, `map-table`, `portfolio-scroll`.

> The heaviest buildings (`minas-tirith` 79 MB, `bree-inn`/`bywater-mill` ~66 MB) may floor at
> ~100–150k tris even after optimize (organic shells). If runtime perf suffers with several
> on-screen, the mitigation is re-exporting those few from Meshy with Remesh→low-poly. Tracked
> as a risk, not a blocker.

---

## 4. World layout (mirrors the map)

A flat ground plane (~radius 220). Coordinate convention: `+x` east, `−z` north (matches the map's
N-up). Approximate stop positions (tunable at build), in journey order, with **Argonath** as a
non-stop gateway mid-route:

| Stop | id | world (x, z) | corner |
|------|----|-------------|--------|
| The Shire | shire | (−60, 55) | SW (start) |
| Bywater Mill | bywater | (−52, 12) | W |
| Bree | bree | (−8, 4) | center crossroads |
| Edoras | edoras | (6, −44) | N-center |
| *Argonath (gateway)* | — | (34, −8) | by the river |
| Isengard | isengard | (56, 16) | E |
| Minas Tirith | minas | (74, −52) | NE (summit, at the mountains) |

A **winding road** (Catmull-Rom spline through the stops, in order) carries the route; `stone-road-*`
tiles are laid along it, with `stone-bridge` at the river crossing and `fork`/`crossing` tiles where
appropriate. A **river** (a long `stream-*` ribbon of placed tiles) runs past the Argonath. The
mountain backdrops ring the NE behind Minas Tirith and the far edges.

---

## 5. Architecture (extends Phase 1; small, focused modules)

```text
src/
  data/
    world.ts            # NEW: stop world-placements (pos, facing, footprint, scrollPos) + prop layout
    career.ts           # extend Stop usage; content unchanged
  world/
    assets.ts           # (exists) loader+toonify+fit; add lazy helpers if needed
    terrain.ts          # NEW: large ground + fog tuning (replaces inline ground)
    road.ts             # NEW: spline → placed road tiles + bridge
    water.ts            # NEW: river (stream tiles along a spline) + fountain + well placement
    landmarks.ts        # REWRITE: registry that places all stops; lazy-load by distance; colliders
    nature.ts           # NEW: InstancedMesh forests (mallorn) + grass + scattered rocks + backdrops
    ambient.ts          # NEW: wagon, campfire, market, well, signposts, route markers (placed props)
  systems/
    interaction.ts      # generalize: nearest-of-N stops → prompt/panel (was single Shire)
  engine/
    quality.ts          # NEW: device tier (desktop/mobile) → draw distance, instance counts, shadows
  main.ts               # compose the populated world
```

Each module exposes a small interface, e.g. `buildRoad(scene): void`, `placeLandmarks(scene,
getPlayerPos): { update(dt): void }` (drives lazy-load), `scatterNature(scene, quality): void`.

---

## 6. Subsystem designs

### 6.1 Asset optimization (prerequisite)
A batch script run (`scripts/optimize-all.sh` or inline loop) over the raw `middle-earth/` assets →
`public/assets/models/`. Landmarks at gentle ratio (preserve form); props/nature at standard ratio;
textures ≤1 K; Draco. Verify each output loads + size. Commit the optimized GLBs.

### 6.2 Terrain (`terrain.ts`)
Large flat ground (toon green), receive shadows; fog tuned to the world scale (start ~70, end
~220 desktop / shorter on mobile). A subtly darker "meadow" disc under the central village area.

### 6.3 Road (`road.ts`)
Catmull-Rom spline through the ordered stop positions → sample points → lay `road-straight`/`road-curve`
tiles oriented to the path tangent (Chaikin-smooth to avoid kinks, reusing the Phase-1-proven approach
in spirit). `stone-bridge` placed where the road crosses the river; `fork`/`crossing` at junctions.

### 6.4 Landmarks (`landmarks.ts` registry + lazy-load)
`data/world.ts` holds each stop's `{ id, pos, facingDeg, footprint, sink, scrollOffset }`. The registry
creates a placeholder/collider immediately and **lazy-loads** the GLB when the player is within range,
toonify + fit-to-footprint + sink, add collider (cylinder) for push-out. Argonath placed as scenery
(collider but no tale). Returns an `update(dt)` that checks distance and triggers loads.

### 6.5 Nature (`nature.ts`)
- **Forests:** `mallorn-tree-1/2/3` as **InstancedMesh** (per variant), scattered by seeded RNG in
  belts away from the road/stops; count scaled by quality tier.
- **Grass:** `grass-tuft` instanced, denser near the road/village, thinned far out; capped on mobile.
- **Rocks:** scattered (reuse existing rock approach) + `mountain-backdrop`/`_square` up-scaled on the
  horizon (NE behind Minas Tirith, and ringing far edges).

### 6.6 Water (`water.ts`)
`stream-straight`/`stream-curve` tiles laid along a river spline past the Argonath (the road's
`stone-bridge` crosses it); `the-fountain` in the Bree market square; `well` as a village prop.
Static; no animation.

### 6.7 Ambient (`ambient.ts`)
`covered-wagon` parked on the road near a stop; `campfire-rest-point` at a layby; `market-stall`(s) +
`well` + `the-fountain` cluster at Bree; `signpost`/`route-marker-red` along the road at junctions.

### 6.8 Interaction (generalize `interaction.ts`)
Replace the single-Shire interaction with a manager over **all six stops**: each frame, find the nearest
stop within trigger range → show its prompt at its `scrollPos` → on E/tap, open that stop's tale + mark
journal. Reuses the existing `Prompt`, `TalePanel`, `Journal`, `withinRadius`.

### 6.9 Quality tiers (`quality.ts`)
Detect `pointer:coarse`/low cores → **mobile tier**: pixelRatio ≤1.6, shorter fog/draw distance, fewer
tree/grass instances, smaller shadow map (or shadows off for distant). **Desktop tier**: full. One
`Quality` object read by terrain/nature/landmarks.

---

## 7. Performance budget & targets
- 60 fps desktop; ≥30 fps mid mobile.
- Landmarks lazy-loaded; at most ~3–4 detailed buildings near the player at once.
- Vegetation instanced (≤ a handful of draw calls); frustum culling on; fog hides the far field.
- Total committed asset payload target ≲ 25 MB (optimized); first paint gated on terrain + spawn-area
  only, the rest streams in.
- No console errors.

## 8. Acceptance criteria
- All six landmarks appear at their map positions with correct scale/facing, each tale recallable via
  proximity → prompt → panel; journal counts up to 6/6.
- Road visibly threads all stops; bridge over the river; Argonath present as a gateway.
- Forests, grass, mountains, and ambient props populate the world cohesively (one art style).
- Plays on desktop **and** a real phone; 60 fps desktop / smooth mobile; no console errors.
- Deployable to Cloudflare Pages (same pipeline).

## 9. Build order (for the plan)
1. Asset optimization (batch) + commit.
2. `quality.ts` + `terrain.ts` (bigger ground/fog) + wire into main.
3. `data/world.ts` placements + `landmarks.ts` registry with lazy-load (all six + Argonath).
4. Generalize `interaction.ts` to N stops; verify all six tales.
5. `road.ts` (spline + tiles + bridge + river).
6. `nature.ts` (instanced trees/grass/rocks/backdrops).
7. `ambient.ts` (wagon/campfire/market/well/signposts).
8. Perf pass (quality tiers, lazy-load tuning) + runtime verify (headless) + deploy.

## 10. Risks & mitigations
- **Building tri-count** (~100–150k each) → lazy-load + fog cull + few-on-screen; re-export heaviest from
  Meshy remeshed if needed.
- **Draw calls / instancing correctness** → InstancedMesh per variant; verify counts.
- **Road spline kinks** → Chaikin smoothing (Phase-1-proven).
- **Mobile perf** → quality tiers from the start; test on a real device in the perf pass.

## 11. Out of scope (later sub-phases)
- **2b:** illustrated-map journal overlay (press M), visited markers, fast-travel.
- **2c:** 3D `portfolio-scroll` unfurl on recall, camera framing/collision, proper idle clip, moving
  ambient (driving wagon, birds), audio, rolling-hills terrain.
