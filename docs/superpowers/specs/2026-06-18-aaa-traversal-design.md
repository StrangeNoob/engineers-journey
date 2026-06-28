# AAA Traversal — Design Spec (Milestone 4)

**Date:** 2026-06-18
**Status:** Approved (design)
**Milestone:** 4 of the AAA visual refactor (builds on M1–M3, all in `dev`)

## Background

The character moves with a **kinematic, instant-velocity** controller: input maps directly to a velocity (walk 4.2 / run 8.8 m/s), circle push-out collision resolves overlaps, and `bridgeHeight` adjusts Y on the one bridge. There is no acceleration, no jump, and no verticality — a flat meadow with a road between six landmarks. Milestone 4 makes traversal *feel* deliberate and AAA, adds a jump, and introduces one signature **viewpoint** moment (an "Assassin's Creed synchronize" beat) without a full building-climb system.

### Production context

`main` is production and stays frozen until M4–M5 are done; then one `dev → main` push. M4 merges to `dev` only. All tuning/polish is deferred to a single pass after M5.

### Decisions locked during brainstorming

- **Scope:** movement-feel rework + a jump that clears low obstacles + one viewpoint with a cinematic reveal.
- **Movement architecture:** a velocity + acceleration integrator, staying kinematic (no physics engine — the project deliberately rejected Rapier in M1).
- **Clearing obstacles:** a free jump (Space) carries Gandalf over `low`-flagged obstacles while airborne; tall obstacles always block. No per-obstacle vault tagging beyond a `low` flag.
- **Viewpoint:** one procedural knoll near the journey's start; reaching the top fires a camera reveal. No new art; the jump clip already exists in the user's source animations (`Regular_Jump`).

## Goal & Success Criteria

Done means:
- Movement has weight: acceleration/deceleration and smooth turning instead of instant velocity, with sprint.
- A jump (Space) with a gravity arc that clears `low` obstacles (rocks, fences, the stream) but not buildings/trees/Argonath.
- Reaching the viewpoint knoll fires a one-shot cinematic reveal of the journey, then cleanly returns control.
- Movement math (velocity integration, turn, jump, low-collider skip, viewpoint trigger) is unit-tested.
- No regression to existing walk/run, collision, tales/interaction, map/fast-travel, journal, audio.

## Scope

**In scope**
- Pure locomotion math: horizontal velocity integration (accel/decel), turn smoothing, jump/gravity integration.
- Gandalf controller rework to use it; airborne state; a `jump` animation role.
- A jump input (Space, edge-triggered) in the input system.
- A `low?: boolean` on `Collider`; rock/fence/stream builders tag theirs; `resolveCollisions` skips `low` colliders while airborne.
- A procedural viewpoint knoll + analytic height function; a unified `groundHeightAt`.
- A viewpoint trigger system + a cinematic camera reveal (lift + slow high orbit) with a fading caption.
- Adding `Regular_Jump`→`jump` to the merge map + re-running `merge:gandalf`.

**Out of scope (later)**
- M5 Animus HUD.
- The deferred polish pass.
- Full building/surface climbing, multiple viewpoints, ledge-mantle on arbitrary geometry.

## Architecture — New / Changed Modules

| File | Status | Responsibility |
|---|---|---|
| `src/player/locomotion.ts` *(new)* | Pure: `integrateVelocity(v, target, accel, dt)`, `approachAngle(cur, target, maxStep)`, `integrateJump(state, groundY, jumpPressed, dt)`, `shouldSkipLow(airborneHeight, threshold)`. Unit-tested. |
| `src/player/locomotion.test.ts` *(new)* | Tests for the four pure helpers. |
| `src/player/gandalf.ts` *(modify)* | `update()` uses `locomotion` (accelerated horizontal velocity + smoothed turn + jump/gravity); tracks airborne state; plays the `jump` role one-shot on takeoff; passes `airborne` to collision so `low` colliders are skipped aloft. |
| `src/engine/input.ts` *(modify)* | Add `jump` to `InputState` (edge-triggered on Space — true only on the press frame). |
| `src/player/gandalf.ts` (`Collider`) + `world/*` *(modify)* | `Collider` gains `low?: boolean`; `nature.ts` (rocks), `road.ts`/route markers, `water.ts` (stream edge) tag their colliders `low`. `resolveCollisions(x, z, colliders, radius, skipLow)` skips `low` colliders when `skipLow`. |
| `src/world/viewpoint.ts` *(new)* | Build the knoll mesh + a stone cairn marker; export `viewpointHeight(x, z)` (analytic dome) and the peak position/zone. |
| `src/world/ground.ts` or `gandalf.ts` *(modify)* | `groundHeightAt(x, z)` = max/blend of terrain(0), `bridgeHeight`, `viewpointHeight`. |
| `src/systems/viewpoint.ts` *(new)* | Detect Gandalf entering the peak zone → fire the reveal once per visit; re-arm on leaving. |
| `src/player/followCamera.ts` *(extend)* or `src/ui/cinematic.ts` *(new)* | The reveal sequence: ease the camera to a high pulled-back vantage + slow orbit looking at world center; restore on timeout/input. |
| `src/ui/*` (caption) | A fading caption during the reveal (reuse the intro/fade styling). |
| `scripts/merge-gandalf.mjs` *(modify)* | Add `Regular_Jump: "jump"` to `CLIP_ROLE`; bump the grafted-count expectation; re-run `merge:gandalf` to regenerate `gandalf.glb`. |

**Per-frame flow:** input (incl. jump) → `locomotion` integrates horizontal velocity + vertical jump/gravity → `resolveCollisions(..., skipLow = airborne)` → `groundHeightAt` clamps/lands Y → animation state (idle/walk/run/jump) → camera (follow, or the viewpoint cinematic when active).

## Movement Math (`locomotion.ts`)

- `integrateVelocity(v: Vec2, target: Vec2, accel: number, dt: number): Vec2` — move `v` toward `target` by at most `accel·dt` per component (or along the delta), giving accel-in / decel-out. Walk/run set `target` magnitude; zero input sets `target = 0`.
- `approachAngle(cur: number, target: number, maxStep: number): number` — rotate `cur` toward `target` along the shortest signed arc, clamped to `maxStep`; wraps at ±π.
- `integrateJump(y, vy, groundY, grounded, jumpPressed, dt) → { y, vy, grounded }` — on `grounded && jumpPressed`: `vy = JUMP_V`; else integrate `vy -= G·dt`, `y += vy·dt`; if `y ≤ groundY`: `y = groundY, vy = 0, grounded = true`, else `grounded = false`. No double-jump.
- Constants (tunable in-browser): `GROUND_ACCEL ≈ 30`, `GROUND_DECEL ≈ 40`, `TURN_RATE ≈ 12 rad/s`, `JUMP_V ≈ 5.5`, `GRAVITY ≈ 18`, `AIRBORNE_CLEAR_H ≈ 0.4 m`.

## Collision & Ground

- `Collider { x, z, r, low?: boolean }`. `resolveCollisions(x, z, colliders, radius, skipLow = false)` ignores `low` colliders when `skipLow` is true.
- `skipLow` is true while `(y − groundY) > AIRBORNE_CLEAR_H` — i.e. Gandalf is high enough in a jump to clear knee/waist-high props.
- `groundHeightAt(x, z)` returns the max of terrain (0), `bridgeHeight(x,z)`, and `viewpointHeight(x,z)`; the jump integrator lands against it.
- Builders tag genuinely low props → `low: true`; buildings, tree trunks, Argonath stay blocking. (Implementation note: the world's only knee/waist-high collidable props are the small ambient ones — the campfire and the route-markers in `ambient.ts` — so those are what got tagged; `nature.ts`/`road.ts`/`water.ts` had no low colliders to tag.)

## Viewpoint

- `viewpoint.ts`: a grassy dome knoll (~5 m peak, ~12 m radius) at a tunable spot just off the road near the start, with a small stone cairn at the summit. `viewpointHeight(x,z)` = `peak · smoothstep` falloff within the radius (0 outside). Peak position + a summit zone (radius ~2.5 m) exported.
- `systems/viewpoint.ts`: when Gandalf is within the summit zone (and not already triggered), fire the reveal; re-arm once he leaves the zone, so it can replay on a later visit but won't spam.
- The reveal: yield player movement; ease the follow-camera to a high, pulled-back vantage and slowly orbit looking at the world center, revealing the road + all landmarks; fade in a caption; after ~5 s or on any movement/jump input, restore control and the normal follow-camera. Reuses the existing cinematic easing (tale push-in) and the fade/caption UI.

## Assets

None from the user. The jump animation (`Regular_Jump`) is already in the provided `animations.glb`; M4 adds it to the merge and regenerates `gandalf.glb`. The knoll, cairn, and height function are procedural.

## Testing

- **Unit (Vitest):** `integrateVelocity` (accelerates toward target, decelerates to zero, never overshoots past target by more than a step), `approachAngle` (shortest arc, reaches target, wraps correctly), `integrateJump` (rises then falls, lands exactly at groundY, cannot double-jump), `shouldSkipLow` / the airborne predicate, the viewpoint summit-zone test. All pure.
- **Manual/browser:** movement reads weighty (accel/decel, smooth turn); jump clears a rock and the stream but a building still blocks; reaching the knoll fires the reveal and returns control cleanly; walk/run, tales, map/fast-travel, journal, audio all unaffected; 0 console errors.
- **Gate:** existing suite stays green; typecheck clean; `npm run build` warning-free; CodeRabbit clean before merge.

## Performance & Risks

| Risk | Mitigation |
|---|---|
| Movement rework regresses walk/run/collision feel | Pure integrators unit-tested; speeds preserved; browser before/after check. |
| Jump lets Gandalf clip through buildings | Only `low` colliders are skipped, and only while airborne above the clear height; tall colliders always block. |
| Ground-height blending (terrain/bridge/knoll) glitches | One `groundHeightAt` source of truth; analytic knoll height; jump lands against it. |
| Viewpoint cinematic traps the player | Restore on any input or a timeout; re-arm only on leaving the zone. |
| Re-merge changes the character asset | Only adds a `jump` clip via the existing `merge:gandalf` chain; browser-verify the character still loads/animates. |

## Validation / Done

Weighty accelerated movement + smooth turn; a jump that clears low obstacles but not buildings; a procedural viewpoint that fires a cinematic reveal and returns control; locomotion + trigger math unit-tested; browser-verified; gameplay otherwise unchanged; merged to `dev`.
