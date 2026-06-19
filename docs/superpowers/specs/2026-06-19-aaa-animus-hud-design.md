# AAA Animus HUD — Design Spec (Milestone 5)

**Date:** 2026-06-19
**Status:** Approved (design)
**Milestone:** 5 of the AAA visual refactor — the final feature milestone (builds on M1–M4, all in `dev`)

## Background

The current HUD is minimal and warm: `ui/hud.ts` shows a top-center "Tales recalled: X/6" line plus Map (M) and Sound buttons; `ui/prompt.ts` projects a world-space "Press E · tap to recall this tale" label over the nearest landmark; `ui/mapOverlay.ts` is an accessible SVG map with fast-travel. Milestone 5 adds an **Assassin's-Creed-style navigation/progress HUD** — a compass, waypoint markers, a synchronization meter, and a recall flourish — but rendered in the game's own **warm parchment-and-gold** language so it stays cohesive with the world. The AC identity comes from the *layout and behavior*, not a blue holographic overlay.

### Production context

`main` is production and frozen. M5 merges to `dev` only. After M5, one deferred polish pass, then the single `dev → main` push. All tuning/polish stays deferred.

### Decisions locked during brainstorming

- **Aesthetic:** Animus *structure*, warm parchment/gold *skin* (not a blue holographic overlay).
- **Components (all four):** compass/heading strip; on-screen + edge-clamped waypoint markers; a segmented synchronization meter (replaces the plain tales-recalled text); a "synchronized" recall flourish.
- **Accessibility is first-class:** the compass + markers are decorative (`aria-hidden`); the accessible SVG map (M) stays the canonical screen-reader navigation; the sync meter keeps an accessible text equivalent; all motion respects `prefers-reduced-motion`.
- **No assets** — pure code/UI; the data already exists (`STOP_PLACEMENTS` positions, career `locale` names, `Journal` visited state).

## Goal & Success Criteria

Done means:
- A top **compass strip** whose pips track each landmark's bearing relative to the camera heading; visited pips dim.
- **Waypoint markers** over each landmark (gold seal + distance), edge-clamped with a directional arrow when off-screen (arrows only for *unvisited* landmarks); visited markers show a "recalled" state.
- A **synchronization meter** — a 6-segment bar that fills per recalled tale ("Synchronization X / 6"), replacing the plain tales-recalled text and preserving its accessible value.
- A **recall flourish** on tale recall; the matching segment + marker complete; respects reduced motion.
- The compass + waypoints **hide** during the viewpoint reveal, an open tale panel, and the map overlay.
- The pure math (bearing-to-strip, screen-marker projection/clamp, sync segments) is unit-tested.
- No regression to existing movement, tales/interaction, map/fast-travel, journal, audio, or accessibility.

## Scope

**In scope**
- Four UI modules (`compass`, `waypoints`, `syncMeter`, `flourish`) + their pure math, unit-tested.
- Trimming `hud.ts` (the tales-recalled text moves to `syncMeter`; Map/Sound buttons stay).
- A small extension to the `StopManager` recall callback so it reports the recalled stop id (for the flourish + segment fill).
- Wiring in `main.ts`: build the four, update compass + waypoints each frame, hide them during reveal/tale/map, fire the flourish + segment fill on recall.
- Accessibility (text equivalents, `aria-hidden` decorative aids, `prefers-reduced-motion`, `aria-live` recall announcement) and mobile-safe placement (top, clear of bottom touch zones).

**Out of scope (later)**
- The deferred polish pass, then `dev → main`.
- A codex/database panel (the accessible map already serves as the visited-tales reference).
- Any blue/holographic styling, glitch transitions, or a "synchronizing" boot screen.
- Re-styling the existing tale panel, intro, or map overlay.

## Architecture — New / Changed Modules

| File | Status | Responsibility |
|---|---|---|
| `src/ui/compass.ts` *(new)* | A top-center compass strip: cardinal ticks (aligned to the world's `+x` east / `−z` north) that scroll with the camera heading, plus a pip per landmark at its bearing; visited pips dim. `update(camYaw, playerX, playerZ)` repositions pips. Pure `bearingToStripX(camYaw, fromX, fromZ, toX, toZ, fovRad, stripW)`. |
| `src/ui/compass.test.ts` *(new)* | Tests for `bearingToStripX`. |
| `src/ui/waypoints.ts` *(new)* | One DOM marker per landmark: projects its world position to screen; on-screen → gold seal + distance (m); off-screen → edge-clamped directional arrow (unvisited only); visited → "recalled" seal. `update(camera, playerX, playerZ, visited)`. Pure `screenMarker(ndcX, ndcY, behind, margin, w, h)`. |
| `src/ui/waypoints.test.ts` *(new)* | Tests for `screenMarker`. |
| `src/ui/syncMeter.ts` *(new)* | A 6-segment synchronization bar (journey order) + "Synchronization X / 6" label; `set(visitedIds)` fills segments; carries an accessible `aria-label`. Pure `segments(visited, orderedIds): boolean[]`. |
| `src/ui/syncMeter.test.ts` *(new)* | Tests for `segments`. |
| `src/ui/flourish.ts` *(new)* | A brief gold "Memory synchronized — <locale>" flourish on recall; `play(label)`; respects `prefers-reduced-motion` (static caption + `aria-live` announcement instead of animation). |
| `src/ui/hud.ts` *(modify)* | Remove the tales-recalled text + its `set(count,total)` (moves to `syncMeter`); keep Map/Sound buttons and their wiring. |
| `src/systems/interaction.ts` *(modify)* | Extend the recall/visit callback to report the recalled stop id (e.g. `onVisit(id: string)`), so the flourish + segment fill can target it. |
| `src/main.ts` *(modify)* | Build `compass`, `waypoints`, `syncMeter`, `flourish`; update compass + waypoints each frame with camera/player/visited; hide them during reveal/tale/map; on recall fill the segment + play the flourish; replace `hud.set(...)` with `syncMeter.set(...)`. |
| data | reuse | Landmark positions from `STOP_PLACEMENTS` (`{id,x,z}`); display names from `content[id].locale`; visited from `Journal.isVisited(id)`; journey order = `STOPS` order. |

**Per-frame flow:** loop (when not map-open) → if HUD visible (not reveal/tale): `compass.update(cam.yawAngle, px, pz)` + `waypoints.update(cam.camera, px, pz, visitedSet)`; else hide both. On recall (`StopManager.onVisit(id)`): `syncMeter.set(journal)` + `flourish.play(content[id].locale)`.

## Component Behavior

### Compass strip (`compass.ts`)
A thin fixed bar at top-center; its center represents the camera heading (`cam.yawAngle`). Cardinal ticks (N/E/S/W) scroll as the player turns. For each landmark: relative bearing = `wrap(atan2(toX−fromX, toZ−fromZ) − camYaw)`; if `|relative| ≤ fov/2` (strip arc ≈ ±70°, `fovRad ≈ 2.44`), place a pip at `x = (relative / (fov/2)) · (stripW/2) + stripW/2`, else hide it. Visited pips render dimmed/checked; unvisited gold. `bearingToStripX` returns the pip x (px) or `null` when outside the arc — pure and tested.

### Waypoint markers (`waypoints.ts`)
One marker per landmark, anchored to a point above the landmark. Project via the camera (same NDC pattern as `prompt.ts`): `p = world.project(camera)`. `behind = p.z > 1`. If on-screen (in front, within NDC ±1): seal at screen `((p.x·.5+.5)·w, (−p.y·.5+.5)·h)` + distance `round(hypot(dx,dz))` m; visited → a filled "recalled" seal. If off-screen or behind: clamp to the viewport edge (inset by `margin`) along the direction from center toward the (flipped-if-behind) projected point, drawn as an arrow rotated to `angleDeg` — **only for unvisited landmarks** (visited ones simply hide when off-screen, to avoid six edge arrows). Pure `screenMarker(ndcX, ndcY, behind, margin, w, h) → { x, y, onScreen, angleDeg }` handles the clamp + behind-camera flip.

### Synchronization meter (`syncMeter.ts`)
Top-left. A row of 6 segments in journey order; `segments(visited, orderedIds)` → a `boolean[]` (filled per recalled). Renders filled segments gold, empty as parchment outlines, with a "Synchronization X / 6" caption. The container carries `role="img"` + `aria-label="Synchronization X of 6"`, updated on change — preserving the accessible value the old "Tales recalled" text provided.

### Recall flourish (`flourish.ts`)
On recall, a brief centered gold flourish — a fading seal/ring with "Memory synchronized — <locale>" — ~1.5 s, then gone. Under `prefers-reduced-motion`, no animation: a short static caption plus an `aria-live="polite"` announcement of "Memory synchronized: <locale>". `play(label)` triggers it; safe to call repeatedly.

## HUD Visibility

Compass + waypoints show only during normal play. They **hide** when: the map overlay is open, a tale panel is open (`stops.isPanelOpen`), or the viewpoint reveal is active (`cam.isRevealing`) — keeping cinematics and the map clean. The sync meter stays visible (it's progress, not navigation), except it's naturally behind the map overlay's own surface.

## Accessibility & Mobile

- **Decorative aids:** compass + waypoint markers are `aria-hidden="true"` (purely visual); the accessible SVG map (M) remains the canonical, screen-reader-friendly navigation — unchanged.
- **Sync meter:** keeps an accessible `aria-label` ("Synchronization 4 of 6"), preserving the old tales-recalled a11y value.
- **Motion:** the flourish and any segment-fill/pip animations respect `prefers-reduced-motion`; reduced → no animation, plus an `aria-live` recall announcement.
- **Mobile/touch:** all persistent HUD lives at the **top** (compass center, sync meter left, Map/Sound right), clear of the **bottom** touch zones (joystick / look-drag / recall button from `touchControls`). The compass width scales down on narrow viewports. Waypoint seals float over landmarks (mid-screen) and are non-interactive (`pointer-events:none`).

## Assets

None. Pure code/UI; all data (`STOP_PLACEMENTS`, career `locale`, `Journal`) already exists.

## Testing

- **Unit (Vitest):** `bearingToStripX` (landmark dead-ahead → strip center; 90° to the side → offset toward the edge; behind the camera → `null`); `screenMarker` (in-front in-bounds → `onScreen` passthrough x/y; off-screen → clamped to the edge inset with a correct `angleDeg`; behind-camera → flipped to the opposite edge); `segments` (visited ids → the right `boolean[]` in journey order). All pure.
- **Manual/browser:** compass pips track landmarks as the player turns and dim when visited; waypoint seals sit over landmarks with distance, off-screen unvisited ones become edge arrows; recalling a tale fills its segment and plays the flourish; compass + waypoints hide during the reveal, a tale panel, and the map; the meter reads "Synchronization X / 6"; no a11y regression (map still works, sync meter announces); mobile layout clear of the touch controls; 0 console errors.
- **Gate:** existing suite stays green; typecheck clean; `npm run build` warning-free; CodeRabbit clean before merge.

## Performance & Risks

| Risk | Mitigation |
|---|---|
| Per-frame DOM updates for ~6 markers + pips cost frame time | DOM transforms only (translate/rotate), no layout thrash; ~12 elements; negligible. |
| Edge-clamp / behind-camera math wrong → markers fly off or stick | `screenMarker` is pure + unit-tested for the in-front, off-screen, and behind cases. |
| Compass bearing convention mismatched with world axes → pips point wrong | `bearingToStripX` uses the same `atan2(dx,dz)` convention as the player facing; unit-tested with dead-ahead/side/behind. |
| HUD overlaps mobile touch controls | HUD pinned to the top; touch controls own the bottom; verified on a narrow viewport. |
| Accessibility regression | Markers/compass `aria-hidden`; sync meter keeps the accessible label; map unchanged; reduced-motion honored. |
| Clutter from six markers/arrows | On-screen seals are small; off-screen arrows only for *unvisited* landmarks; visited markers quiet down. |

## Validation / Done

A warm-skinned Animus HUD — compass, waypoint markers, synchronization meter, recall flourish — that tracks landmarks, fills on recall, hides during cinematics/map, stays accessible and mobile-safe; pure math unit-tested; browser-verified; existing gameplay and a11y unchanged; merged to `dev`.
