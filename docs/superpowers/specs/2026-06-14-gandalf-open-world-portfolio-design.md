# Design Spec — "An Engineer's Journey": A Playable Middle-earth Portfolio

**Date:** 2026-06-14
**Owner:** Prateek Kumar Mohanty
**Status:** Design — awaiting review

---

## 1. Vision

A browser-based **open-world game portfolio**. The visitor plays **Gandalf the Grey**,
free-roaming a stylized Middle-earth landscape. Six places dot the land — each one a
chapter of Prateek's career. Walking up to a place and "recalling its tale" unfurls a
**scroll** and opens a panel telling that story (role, results, stack, links). A journal
(the illustrated map) tracks which tales you've recalled. No forced order, no win-state —
exploration with light tracking. It works on desktop and mobile.

The tone: warm, storybook, unhurried — "Gandalf remembering his old tales."

---

## 2. Goals & non-goals

**Goals**
- A genuinely playable third-person character (walk/run, free-roam) that feels good.
- Six career "tales" surfaced diegetically via proximity → scroll → panel.
- One cohesive art style (the Kenney + ChatGPT→Meshy assets already produced).
- Fully playable on **desktop and mobile** from v1.
- Fast loading & caching; 60 fps desktop, smooth on a mid phone.
- A non-game **fallback path** (plain résumé) for recruiters who won't play + for SEO/a11y.

**Non-goals (YAGNI)**
- No combat, enemies, health, inventory, or quests beyond "recall the tales."
- No NPCs with dialogue trees (ambient props only: wagon, campfire, birds).
- No multiplayer, no save accounts (local progress only).
- No Next.js / SSR (a canvas game can't be server-rendered; not needed — see §7.10).
- No procedural water shaders (rejected; use generated/flat water — §7.6).

---

## 3. Core experience loop

1. Land on the site → themed loader → spawn as Gandalf near the Shire.
2. Free-roam: **WASD/joystick** to walk, hold to run; **mouse-drag / right-thumb** to look.
3. Approach a landmark → a world-space prompt appears: *"Press E · tap to recall this tale."*
4. Trigger it → the **portfolio-scroll** unfurls and a side **panel** slides in with the chapter.
5. Close → keep roaming. The **journal** marks that tale recalled (n/6); the **map (M)** shows
   visited vs. unvisited with a gentle nudge toward the rest.
6. Any order, no end-gate; recalling all six lights a small "journey complete" flourish +
   a hire-me/contact call-to-action (optional, non-blocking).

---

## 4. Decisions locked in brainstorming

| Topic | Decision |
|---|---|
| Control & camera | Third-person free-roam: WASD + mouse-look (desktop); on-screen joystick + drag-look (mobile) |
| Tale trigger | Proximity prompt → "Press E / tap" → **portfolio-scroll** unfurls → side panel |
| Progression | Light tracking, **no forced arc**; journal + illustrated map track visited; any order |
| Mobile | **Full game on mobile from day one** (joystick + drag-look + responsive HUD) |
| Stack | **Vite + TypeScript + Three.js 0.160**, kinematic controller (no physics engine) |
| Hosting/caching | **Cloudflare Pages** + immutable hashed assets + Workbox service worker |
| Build strategy | **Vertical-slice-first**, then full world |

---

## 5. Tech stack & deployment

- **Vite + TypeScript + Three.js 0.160** (matches existing prototypes/version).
- Loaders: `GLTFLoader`, `DRACOLoader`, `SkeletonUtils` (skinned clone), optional `KTX2Loader`.
- No physics engine — a **kinematic character controller** (raycast ground + simple collider
  push-out) is sufficient for a walking explorer. (Rapier reconsidered only if collisions
  prove inadequate; not in scope for v1.)
- Plain CSS for HUD/panels (no UI framework).
- **Deploy: Cloudflare Pages.** Build output is static; assets served from `/public` (or
  imported via `?url` for content-hashing). Optional Cloudflare **R2** for assets later if
  payload grows — not needed at current ~10–20 MB optimized.

---

## 6. Project structure

```
src/
  main.ts                  # bootstrap: engine + world + player + ui, start loop
  engine/
    renderer.ts  scene.ts  loop.ts  resize.ts  quality.ts   # quality tiers (desktop/mobile)
    input.ts                                                # unified keyboard/mouse/touch state
  world/
    assets.ts              # GLB loader: Draco + cache + toonify + LoadManager/progress
    sky.ts  lights.ts  fog.ts
    terrain.ts             # ground/heightfield mirroring the map layout
    road.ts  water.ts      # winding road; lake/stream (generated or flat toon plane)
    nature.ts              # InstancedMesh forests, rocks, mountain-backdrop
    landmarks.ts           # place the 6 hero buildings + Argonath; build colliders
    ambient.ts             # wagon, campfire, birds, shimmer
  player/
    gandalf.ts             # kinematic controller + animation state machine (idle/walk/run)
    followCamera.ts        # spring-arm third-person camera + collision
  systems/
    interaction.ts         # proximity triggers, prompts, recall-tale flow
    journal.ts             # progress state (visited set), persistence (localStorage)
  ui/
    hud.ts  prompt.ts  talePanel.ts  mapOverlay.ts  contactBar.ts  loader.ts  touchControls.ts
  data/
    career.ts              # the six stops (single source of content)
  pwa/
    sw.ts                  # Workbox precache + runtime caching
public/assets/             # optimized, Draco-compressed GLBs (from optimize-glb.sh)
index.html
```

Each module has one job and a clear interface (e.g., `gandalf.update(dt, input, terrain)`,
`interaction.update(dt, gandalfPos)` → emits `onRecall(stopId)`).

---

## 7. System designs

### 7.1 Asset pipeline & loading
- Batch-run **`scripts/optimize-glb.sh`** over every raw asset in `assets/gen/middle-earth/`
  (buildings 16–79 MB → ~1 MB; road/env already proven 16 MB → 0.25 MB) into `public/assets/`.
  Organic/foliage buildings floor ~100–150 k tris locally; acceptable (pure toon, no ink).
  Where possible re-export from Meshy with Remesh→low-poly for cleaner topology.
- `assets.ts` wraps `GLTFLoader` + `DRACOLoader`, a `Map` cache, and `toonify()`
  (`MeshToonMaterial` + 3-step ramp, preserve map/color). Returns clones.
- **LoadManager** drives the themed loader bar. **Gate entry** on a *core* set (Gandalf +
  terrain + spawn-area landmark). **Lazy-load** distant landmarks as Gandalf approaches
  (distance-based) so first paint is fast.

### 7.2 Character controller (`gandalf.ts`)
- Kinematic capsule. Input → desired horizontal velocity in **camera space**; walk speed
  vs run speed (run on Shift / left-stick fully pushed). Smooth accel/decel.
- **Ground:** raycast down to terrain each frame → set y to ground height; small gravity for
  steps/slopes.
- **Collisions:** push-out against landmark colliders (cylinders/AABBs from `landmarks.ts`)
  + world bounds. Block walking through buildings/water.
- **Animation state machine:** `idle ↔ walk ↔ run` via `AnimationMixer` crossfades, driven by
  speed. Uses `gandalf.glb` (idle) + `gandalf_walking.glb` + `gandalf_running.glb` clips
  (retarget onto one skeleton, or load clips onto the shared rig).
- Faces movement direction (turn toward velocity).

### 7.3 Follow camera (`followCamera.ts`)
- Spring-arm behind Gandalf; yaw/pitch from mouse-drag (desktop) / right-thumb drag (mobile).
- **Collision:** raycast Gandalf→desired cam pos; pull in if blocked by terrain/buildings.
- Damped follow; auto-trails behind motion when the user isn't actively looking.
- Clamp pitch above ground; sensible min/max distance + FOV.

### 7.4 Interaction / tales (`interaction.ts` + `talePanel.ts`)
- Each stop has a trigger radius. On enter → world-space **prompt** sprite over the landmark's
  scroll spot: *"Press E · tap to recall this tale."*
- On **E / tap**: play the **portfolio-scroll** reveal (the `portfolio-scroll.glb` scales/unfurls
  at the spot, or the panel itself is styled as an unrolling scroll) → open the **side panel**
  with chapter content (role, dates, headline result, bullets, stack chips, links).
- World stays live behind the panel (optional gentle slow-down). Esc / ✕ / walk-away closes;
  focus management for keyboard users. Recalling marks the tale in `journal`.

### 7.5 Journal & map (`journal.ts` + `mapOverlay.ts`)
- `journal` holds the `visited` set, persisted to `localStorage`. Exposes `count`, `isVisited`.
- HUD shows **"Tales recalled: n/6."** Press **M** (or tap a button) → overlay the **illustrated
  map** with six markers: visited = lit/colored, unvisited = dim; a live marker for Gandalf's
  position; gentle nudge (nearest unvisited shimmers / compass hint).
- **Fast-travel (optional, Phase 2):** click a *visited* marker → fade-teleport Gandalf there.

### 7.6 World construction (`world/*`)
- Terrain mirrors the **map geography**: Shire lowland (SW) rising to mountains (NE); Isengard
  to the east, Minas Tirith crowning the NE peaks. Heightfield or sculpted ground + fog.
- **Winding stone road** along a Catmull-Rom spline using the optimized road tiles (or a road
  ribbon), threading all six places; **stone bridge** over the river.
- **Water:** lake/streams from the generated water assets when ready; **fallback = flat toon
  water plane** (no custom shader — per the rejection of procedural water). Static is fine.
- Six landmarks placed per map positions (+ **Argonath** as a non-stop gateway). **Instanced**
  forests, rocks, `mountain-backdrop`. Ambient: `covered-wagon` on the road, `campfire-rest-point`,
  birds, subtle water shimmer.

### 7.7 Mobile / touch controls (`touchControls.ts`)
- **Left-thumb virtual joystick** = move; **right-side drag** = camera look; **tap prompt button**
  = recall tale; **map button** = journal. Same input bus as keyboard/mouse (controller reads
  one unified state).
- Responsive HUD; `touch-action:none` on canvas; detect touch via `matchMedia('(pointer:coarse)')`.

### 7.8 Performance & quality tiers (`quality.ts`)
- Tiers by device: **desktop** (full draw distance, shadows, dense grass) vs **mobile** (pixelRatio
  ≤1.6, smaller/again fewer shadows, reduced instance counts, shorter fog/cull distance).
- Draco geometry; **InstancedMesh** vegetation; frustum culling; distance cull/LOD for landmarks;
  textures ≤1 K; single shadow-casting sun with tight frustum. Targets: 60 fps desktop, ≥30 mobile.

### 7.9 Accessibility, SEO & fallback
- A 3D game is inherently hard for a11y, so ship a **first-class text fallback**: a semantic,
  responsive **`/resume`** page (port `designs/resume.html`) with the full career — the
  accessible + SEO + "I won't play, just show me" path. A persistent **"Skip to résumé"** link.
- Honor `prefers-reduced-motion` (cut camera sway/auto-cam, instant transitions). Panels are
  keyboard-operable with focus management. Contact bar always reachable.
- SEO: static `<title>`/meta description, **OpenGraph/Twitter** tags using the **illustrated map**
  as the OG image, `Person` JSON-LD. (All achievable without SSR.)

### 7.10 Caching & delivery
- **Content-hashed, immutable assets** (`Cache-Control: public, max-age=31536000, immutable`) —
  import GLBs via Vite `?url` so filenames are hashed; repeat visits load from browser cache.
- **Cloudflare Pages** CDN caches at the edge for fast first load globally.
- **Workbox service worker** (`pwa/sw.ts`) precaches the core world → instant repeat visits,
  offline-capable. (This — not Next.js — is the caching story.)

---

## 8. Content model (`data/career.ts`)

Each stop is one typed object: `{ id, locale, org, role, era, headline, bullets[], stack[],
links[], model, worldPos, scrollPos }`. Source of truth for panels, journal, and map markers.

| id | Locale | Company / role | Era | model |
|----|--------|----------------|-----|-------|
| shire | The Shire | B.Tech IT · OURT | 2018–22 | shire-home |
| bywater | Bywater Mill | SDE Intern · Milk Mantra | 2020–21 | bywater-mill |
| bree | Bree | Product Developer · Aarna | 2021–22 | bree-inn |
| edoras | Edoras | Product Lead · Frifty | 2022–23 | edoras-hall |
| isengard | Isengard | Full Stack · Dextr Labs | 2023–24 | isengard-tower |
| minas | Minas Tirith | SDE-II · Pathfndr (current) | 2025– | minas-tirith |

(Full bullet/stack content already drafted in `designs/design-14-portfolio.html` STOPS — reuse
verbatim.) **Argonath** = decorative gateway landmark, not a stop. **LinkedIn URL** stays a
`<!-- LINKEDIN_URL TODO -->` placeholder until Prateek supplies it.

---

## 9. Phasing

### Phase 1 — Vertical slice (prove the feel)
A small, self-contained playable proof — **not** the full map:
- Compact test terrain (gentle ground, fog, sky, light).
- **Gandalf**: idle/walk/run, free-roam WASD + mouse-look **and** mobile joystick + drag-look.
- Third-person follow camera with collision.
- **One** landmark (the Shire home) with the full **proximity → scroll → panel** flow, real content.
- Themed loader + minimal HUD ("Tales recalled: 1/1" placeholder).
- Deployed to **Cloudflare Pages** with immutable headers + a basic service worker.

**Acceptance criteria (Phase 1):** Gandalf walks/runs smoothly and animates correctly; camera
follows without clipping; the Shire tale recalls via scroll+panel; **playable on a real phone**
(joystick + look) and desktop; 60 fps desktop / smooth mobile; no console errors; live on a
Cloudflare Pages URL.

### Phase 2 — Full world
- Full map-based terrain; all six landmarks + Argonath; winding road + bridge + water; instanced
  forests/mountains; ambient life.
- Journal + illustrated-map overlay (visited tracking, nudge, optional fast-travel).
- Quality tiers, full perf pass, reduced-motion, `/resume` fallback, SEO/OG, service-worker precache.
- "Journey complete" flourish + contact CTA when all six recalled.

---

## 10. Risks & mitigations
- **Mobile free-roam smoothness** (the hard part) → the Phase-1 slice tests it *first*, on a real
  device, before building the world.
- **Asset weight** (heavy raw GLBs) → batch optimizer + Draco + instancing + lazy load; re-export
  buildings remeshed where feasible.
- **Controller/camera feel** → isolate `gandalf.ts`/`followCamera.ts` with tunable constants; iterate
  in the slice.
- **Collision tuning** → simple cylinder/AABB colliders; start generous, refine.

## 11. Assumptions & open items
- **Water:** prefer generated water assets; flat toon plane as fallback. Final choice deferred to
  Phase 2 build.
- **Audio** (ambient music, footsteps): nice-to-have, **deferred** (Phase 2 polish, optional).
- **Fast-travel** from the map: included as Phase-2 optional.
- **Terrain authoring** (heightmap image vs modeled): decided at Phase-2 start; slice uses simple ground.
- **Git:** repo is not yet initialized; will `git init` + commit before/with implementation.

## 12. Out of scope (v1)
Combat, NPC dialogue, multiplayer, accounts, level editor, Next.js/SSR, procedural water shaders,
day/night cycle, weather.
