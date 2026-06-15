# Phase 2b — Journal & Illustrated-Map Overlay (design)

**Date:** 2026-06-15
**Status:** approved (brainstorm)
**Builds on:** Phase 2a (populated world). Followed by Phase 2c (scroll unfurl, camera, idle, audio).

## Goal

Add the **journal map overlay**: press **M** (or tap a HUD button) to open a parchment
map of the world showing the six tale-markers (visited vs. unvisited), Gandalf's live
position, a gentle nudge toward the nearest unvisited tale, and **fast-travel** — click any
marker to fade-teleport there. The journal *data* layer (visited set + `localStorage`)
already exists from Phase 1; this phase is the **map overlay UI + fast-travel**.

## Decisions (from brainstorm)

1. **Map rendering:** procedural **parchment map drawn from world data** (road, river,
   village positions) — markers auto-align with the real world; no new art asset.
2. **Fast-travel:** enabled for **all six markers** (visited or not) — a recruiter can jump
   straight to any tale.
3. **Presentation:** **full-screen overlay on demand** (open with M / a [Map] button, close
   with M / Esc / click-out). No persistent minimap.
4. **Tech:** **SVG** overlay (markers as focusable elements, road/river as `<path>`s) for
   clean clicks, hover labels, and keyboard accessibility — following the existing DOM-UI
   pattern (`TalePanel`).

## Scope

In scope:
- A full-screen map overlay (parchment SVG) toggled by M / [Map] button / Esc / click-out.
- Road + river drawn from `ROAD_POINTS` / `RIVER_POINTS`; six village markers + Argonath as a
  non-interactive landmark glyph.
- Marker states: visited = lit/labeled, unvisited = dim; nearest-unvisited marker pulses (nudge).
- A Gandalf position dot (snapshot on open — the world is frozen while the map is up).
- Fast-travel: click/Enter a marker → fade-to-black → teleport to the road beside that village
  (facing it) → fade-in.
- Freeze player movement + camera look while the overlay is open (still renders the dimmed 3D).
- Keyboard accessibility (Tab between markers, Enter to travel, Esc to close) + a touch button.

Out of scope (later phases / not now):
- Persistent minimap, map zoom/pan, animated Gandalf dot while open.
- Scroll-unfurl animation, cinematic camera, idle pose, audio (Phase 2c).
- Any new generated art asset (map is procedural).

## Architecture

### New: `src/world/mapProjection.ts` (pure, tested)
Pure geometry helpers so all logic stays testable and the overlay DOM stays thin.

```ts
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface MapView { w: number; h: number; pad: number; } // SVG viewBox size + inner padding

/** Bounding box of every feature shown on the map (road ∪ river ∪ villages ∪ Argonath). */
export function mapBounds(): Bounds;

/** World (x,z) → SVG (px,py). North (−z) maps up (smaller py); east (+x) maps right.
 *  Uniform scale that fits Bounds into MapView minus padding, centered. */
export function worldToMap(x: number, z: number, b: Bounds, v: MapView): { px: number; py: number };

/** Closest point on the road polyline to a stop centre — the fast-travel landing point
 *  (on the road, within the ~14 m tale-recall range; collision keeps the player out of the
 *  building). Returns the point and a facing angle toward the stop centre. */
export function travelTarget(stopX: number, stopZ: number): { x: number; z: number; faceY: number };

/** The unvisited stop nearest to (x,z) — the marker that gets the nudge pulse. null if all visited. */
export function nearestUnvisited(x: number, z: number, stops: { id: string; x: number; z: number }[],
                                 isVisited: (id: string) => boolean): string | null;
```

`mapBounds` reads `STOP_PLACEMENTS`, `ARGONATH`, `ROAD_POINTS`, `RIVER_POINTS` from
`data/world.ts`. The road is sampled along a Catmull-Rom curve (as in `road.ts`) so the map
line matches the in-world road; the river is the raw polyline.

### New: `src/ui/mapOverlay.ts`
A DOM/SVG component in the style of `TalePanel` (created once, appended to `body`, shown/hidden
via `inert` + opacity/transform transition; Esc closes; focus management).

- `constructor(stops, journal, onTravel)` where `stops` is `[{id, name, x, z}]`, `journal`
  exposes `isVisited`, and `onTravel(stopId)` is the fast-travel callback.
- `open(playerX, playerZ)` — builds/refreshes the SVG: parchment `<rect>` background (subtle
  paper grain via an SVG filter), road `<path>`, river `<path>`, Argonath glyph, six marker
  `<g>`s (focusable, `role="button"`, `aria-label`), a Gandalf dot at the projected player
  position, and a pulse class on `nearestUnvisited`. Shows the overlay, focuses the first
  marker.
- `close()` — hides, returns focus to the [Map] button.
- `get isOpen()`.
- Clicking/Enter on a marker → `close()` then `onTravel(id)`.
- Click on the dim backdrop (not the map) → `close()`.

### Changed: `src/ui/hud.ts`
Add a small **[Map]** button (parchment-styled, fixed corner) that calls a supplied
`onOpenMap` handler. Mobile gets the same via a touch button (mirroring `touchControls`).

### Changed: `src/main.ts`
- Instantiate `MapOverlay` with the stops (id/name from `STOPS`/`STOP_PLACEMENTS`), the
  `Journal`, and an `onTravel` handler.
- **Toggle:** a `keydown` for `KeyM` (ignored while typing/auto-repeat) toggles the overlay;
  the HUD/touch [Map] button opens it.
- **Freeze:** in the loop, when `mapOverlay.isOpen`, skip `gandalf.update` and `cam.update`
  (and don't apply `bridgeHeight`); still `renderer.render` so the dimmed world shows behind.
- **Fast-travel:** `onTravel(id)` → fade a full-screen black `<div>` in (~300 ms) → set
  `gandalf.root.position` to `travelTarget(...)` and `rotation.y = faceY` → fade out. The
  overlay is already closed; the fade hides the jump.

### Fade transition
A reusable full-screen black overlay (`<div>`, `z-index` above the canvas, `opacity` CSS
transition). `fadeTeleport(applyMove)` fades to black, calls `applyMove()` at peak, fades back.

## Data flow

```text
data/world.ts (ROAD_POINTS, RIVER_POINTS, STOP_PLACEMENTS, ARGONATH)
        │                                   │
   mapBounds()/worldToMap()            travelTarget()
        │                                   │
   mapOverlay.open() ── renders ──► SVG (road/river/markers/Gandalf dot)
        ▲                                   │ click/Enter
   journal.isVisited (marker state)         ▼
                                    onTravel(id) → fadeTeleport → gandalf.root.position
```

## Error handling / edge cases
- `localStorage` unavailable: already handled by `Journal` (try/catch).
- Resize while open: the SVG uses a fixed `viewBox` and scales via CSS (`width/height:100%`
  within a max-size container), so it stays correct without recompute.
- Open map while a tale panel is open, or vice-versa: opening one closes the other (single
  modal at a time).
- Fast-travel onto/near the bridge: `travelTarget` lands on the road beside a village (never
  the bridge span), so no deck-height interaction.
- Auto-repeat / typing: M toggle ignores `e.repeat` and ignores when focus is in an input
  (there are none today, but guard anyway).

## Testing
Vitest on the pure helpers (DOM kept thin):
- `worldToMap`: a point at `Bounds` min/max maps to the padded corners; centre maps to centre;
  north (−z) is up.
- `mapBounds`: encloses all villages + Argonath + road + river extents.
- `travelTarget`: returns a point on the road within tale-recall range of the stop, facing it.
- `nearestUnvisited`: picks the closest unvisited; returns null when all visited.
- `journal.ts` already covered.

## Acceptance
- Press **M** / tap [Map] → parchment overlay with the winding road, river, six markers in
  the right places, visited ones lit, nearest unvisited pulsing, Gandalf dot where he stands.
- Esc / M / click-out closes it; movement is frozen while open.
- Click any marker → fade → Gandalf is on the road beside that village, facing it, the
  "recall this tale" prompt available; fade-in.
- Keyboard: Tab between markers, Enter travels, Esc closes. Touch [Map] button works.
- `tsc` clean, all vitest green.
