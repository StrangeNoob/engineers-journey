# AAA Traversal Implementation Plan (Milestone 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give traversal weight (accelerated movement + smooth turning), a jump that clears `low` obstacles, and one procedural viewpoint that fires a cinematic reveal.

**Architecture:** Pure locomotion math (`locomotion.ts`) integrates horizontal velocity toward a target and a vertical jump under gravity; the Gandalf controller consumes it, tracks airborne state, and skips `low` colliders while aloft. A procedural knoll (`viewpoint.ts`) with an analytic height function plus a unified `groundHeightAt` gives the jump something to land on; a trigger system fires a camera reveal at the summit. Stays kinematic — no physics engine.

**Tech Stack:** TypeScript, Three.js `0.160`, Vitest, Vite.

## Global Constraints

- **No new dependency.** Stays kinematic (the project rejected Rapier in M1).
- **Preserve gameplay:** existing walk/run speeds (walk 4.2 / run 8.8), collision, follow camera, tales/interaction, map/fast-travel, journal, audio behave as before — only the movement *feel* changes and jump is added.
- **Jump only clears `low` colliders, only while airborne** above the clear height; tall colliders (buildings, trees, Argonath, bridge parapets) always block.
- **`Role` gains `"jump"`;** until the re-merge adds the clip, `resolveClips` falls it back to `idle` (graceful — the app keeps working).
- **Tunable constants** (accel/decel/turn/jump/gravity/knoll position) are starting values, calibrated in-browser.
- **Commit messages:** plain, NO Claude/AI attribution.
- **Tests are pure/node:** unit-test pure functions; GPU/integration is browser-verified.
- **Existing suite stays green;** typecheck clean; `npm run build` warning-free.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/player/locomotion.ts` | create | Pure: `integrateVelocity`, `approachAngle`, `integrateJump`. |
| `src/player/locomotion.test.ts` | create | Tests for the three helpers. |
| `src/player/gandalf.ts` | modify | `Collider.low?`; `resolveCollisions(..., skipLow)`; `Role` gains `"jump"`; `update()` reworked to use `locomotion` + a `groundHeightAt` callback + airborne state + jump anim. |
| `src/world/nature.ts` | modify | Local `Collider` interface gains `low?` (keep in sync with gandalf's). |
| `src/world/ambient.ts` | modify | Tag the small props (`campfire`, `route-marker`) `low: true`. |
| `src/engine/input.ts` | modify | `InputState.jump` (edge-triggered on Space). |
| `src/world/viewpoint.ts` | create | Pure `viewpointHeight(x,z)` + `PEAK`/`SUMMIT_R`; `buildViewpoint(scene)` (knoll + cairn). |
| `src/world/viewpoint.test.ts` | create | Tests for `viewpointHeight`. |
| `src/systems/viewpoint.ts` | create | `ViewpointTrigger`: fires a callback when the player enters the summit zone; re-arms on leaving. |
| `src/systems/viewpoint.test.ts` | create | Tests for the enter/re-arm logic. |
| `src/player/followCamera.ts` | modify | A `reveal` mode: ease to a high pulled-back vantage + slow orbit; `startReveal()`/`isRevealing`/`update` honoring it. |
| `src/main.ts` | modify | Build the viewpoint; compose `groundHeightAt`; pass jump + `groundHeightAt` to `gandalf.update`; wire the trigger → reveal + caption. |
| `src/ui/*` (caption) | reuse | A fading caption during the reveal (reuse fade/intro styling). |
| `scripts/merge-gandalf.mjs` | modify | Add `Regular_Jump: "jump"`; re-run `merge:gandalf`. |

---

## Task 1: Locomotion math (pure)

**Files:** Create `src/player/locomotion.ts`, `src/player/locomotion.test.ts`

**Interfaces:**
- Produces:
  - `interface Vec2 { x: number; z: number }`
  - `integrateVelocity(v: Vec2, target: Vec2, rate: number, dt: number): Vec2` — move `v` toward `target` by at most `rate·dt` (vector), no overshoot.
  - `approachAngle(cur: number, target: number, maxStep: number): number` — rotate along the shortest signed arc, clamped to `maxStep`.
  - `interface JumpState { y: number; vy: number; grounded: boolean }`
  - `integrateJump(s: JumpState, groundY: number, jumpPressed: boolean, dt: number, jumpV: number, gravity: number): JumpState` — grounded jump sets `vy=jumpV`; integrate under gravity; land at `groundY`; no double-jump.

- [ ] **Step 1: Write the failing test** — create `src/player/locomotion.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { integrateVelocity, approachAngle, integrateJump } from "./locomotion";

describe("integrateVelocity", () => {
  it("moves toward target by at most rate*dt, no overshoot", () => {
    const v = integrateVelocity({ x: 0, z: 0 }, { x: 4.2, z: 0 }, 30, 0.016);
    expect(v.x).toBeGreaterThan(0);
    expect(v.x).toBeLessThanOrEqual(30 * 0.016 + 1e-6);
  });
  it("snaps to target when within one step", () => {
    const v = integrateVelocity({ x: 4.19, z: 0 }, { x: 4.2, z: 0 }, 30, 0.1);
    expect(v).toEqual({ x: 4.2, z: 0 });
  });
  it("decelerates toward zero", () => {
    const v = integrateVelocity({ x: 4.2, z: 0 }, { x: 0, z: 0 }, 40, 0.016);
    expect(v.x).toBeGreaterThan(0);
    expect(v.x).toBeLessThan(4.2);
  });
});

describe("approachAngle", () => {
  it("reaches target within one step", () => {
    expect(approachAngle(0, 0.05, 1)).toBeCloseTo(0.05);
  });
  it("takes the shortest arc across the wrap", () => {
    // from 3.0 toward -3.0 is shorter going forward across π (+ ~0.28), not back ~ -6
    const a = approachAngle(3.0, -3.0, 0.1);
    expect(a).toBeGreaterThan(3.0);
  });
});

describe("integrateJump", () => {
  it("launches on a grounded jump and leaves the ground", () => {
    const s = integrateJump({ y: 0, vy: 0, grounded: true }, 0, true, 0.016, 5.5, 18);
    expect(s.vy).toBeGreaterThan(0);
    expect(s.grounded).toBe(false);
  });
  it("cannot double-jump while airborne", () => {
    const s = integrateJump({ y: 2, vy: 3, grounded: false }, 0, true, 0.016, 5.5, 18);
    expect(s.vy).toBeLessThan(3); // gravity only, no re-launch to 5.5
  });
  it("lands exactly at groundY and re-grounds", () => {
    const s = integrateJump({ y: 0.05, vy: -5, grounded: false }, 0, false, 0.05, 5.5, 18);
    expect(s.y).toBe(0);
    expect(s.vy).toBe(0);
    expect(s.grounded).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/player/locomotion.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/player/locomotion.ts`:

```typescript
export interface Vec2 { x: number; z: number }

/** Pure: move `v` toward `target` by at most `rate*dt` (vector); snaps when within a step. */
export function integrateVelocity(v: Vec2, target: Vec2, rate: number, dt: number): Vec2 {
  const max = rate * dt;
  const dx = target.x - v.x, dz = target.z - v.z;
  const d = Math.hypot(dx, dz);
  if (d <= max || d < 1e-6) return { x: target.x, z: target.z };
  const k = max / d;
  return { x: v.x + dx * k, z: v.z + dz * k };
}

/** Pure: rotate `cur` toward `target` along the shortest signed arc, clamped to `maxStep`. */
export function approachAngle(cur: number, target: number, maxStep: number): number {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return cur + d;
  return cur + Math.sign(d) * maxStep;
}

export interface JumpState { y: number; vy: number; grounded: boolean }

/** Pure: vertical jump/gravity integration. Grounded jump launches; lands at groundY; no double-jump. */
export function integrateJump(
  s: JumpState, groundY: number, jumpPressed: boolean, dt: number, jumpV: number, gravity: number,
): JumpState {
  let { y, vy, grounded } = s;
  if (grounded && jumpPressed) { vy = jumpV; grounded = false; }
  vy -= gravity * dt;
  y += vy * dt;
  if (y <= groundY) { y = groundY; vy = 0; grounded = true; }
  return { y, vy, grounded };
}
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/player/locomotion.test.ts && npm run typecheck` — PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/locomotion.ts src/player/locomotion.test.ts
git commit -m "feat(locomotion): pure velocity/turn/jump integrators"
```

---

## Task 2: Collider `low` flag + collision skip

**Files:** Modify `src/player/gandalf.ts`, `src/world/nature.ts`; Test `src/player/gandalf.test.ts`

**Interfaces:**
- Produces: `Collider { x; z; r; low?: boolean }`; `resolveCollisions(x, z, colliders, radius, skipLow?: boolean)` — when `skipLow` is true, colliders with `low === true` are ignored.

- [ ] **Step 1: Write the failing test** — append to `src/player/gandalf.test.ts`:

```typescript
import { resolveCollisions } from "./gandalf";

describe("resolveCollisions skipLow", () => {
  const low = [{ x: 1, z: 0, r: 1, low: true }];
  it("pushes out of a low collider on the ground", () => {
    const p = resolveCollisions(0.5, 0, low, 0.5, false);
    expect(p.x).toBeLessThan(0.5); // pushed away from the collider at x=1
  });
  it("ignores a low collider when skipLow (airborne)", () => {
    const p = resolveCollisions(0.5, 0, low, 0.5, true);
    expect(p).toEqual({ x: 0.5, z: 0 }); // unchanged — jumped over
  });
  it("still blocks a non-low collider when skipLow", () => {
    const tall = [{ x: 1, z: 0, r: 1 }];
    const p = resolveCollisions(0.5, 0, tall, 0.5, true);
    expect(p.x).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/player/gandalf.test.ts` — FAIL (skipLow param / behavior).

- [ ] **Step 3: Implement** — in `src/player/gandalf.ts`:

Change the `Collider` interface:
```typescript
export interface Collider { x: number; z: number; r: number; low?: boolean }
```
Change `resolveCollisions` signature + the loop guard:
```typescript
export function resolveCollisions(
  x: number, z: number, colliders: Collider[], radius: number, skipLow = false,
): { x: number; z: number } {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (skipLow && c.low) continue;
      // ...existing push-out body unchanged...
    }
  }
  return { x, z };
}
```
In `src/world/nature.ts`, update the local `interface Collider` to match:
```typescript
interface Collider { x: number; z: number; r: number; low?: boolean }
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/player/gandalf.test.ts && npm run typecheck` — PASS / clean (the existing `gandalf.update` call to `resolveCollisions` keeps working; `skipLow` defaults false).

- [ ] **Step 5: Commit**

```bash
git add src/player/gandalf.ts src/world/nature.ts
git commit -m "feat(collision): optional low-collider flag, skipped while airborne"
```

---

## Task 3: Viewpoint knoll + height function

**Files:** Create `src/world/viewpoint.ts`, `src/world/viewpoint.test.ts`

**Interfaces:**
- Consumes: `THREE`, `loadGLTF` (optional — the cairn can reuse an existing prop or be a primitive).
- Produces:
  - `const PEAK: { x: number; z: number }`, `const SUMMIT_R: number`, `const KNOLL_R: number`, `const KNOLL_H: number`
  - `viewpointHeight(x: number, z: number): number` — analytic smoothstep dome, 0 outside `KNOLL_R`.
  - `buildViewpoint(scene: THREE.Scene): void` — adds the knoll mesh (a dome whose surface matches `viewpointHeight`) + a small stone cairn at `PEAK`.

- [ ] **Step 1: Write the failing test** — create `src/world/viewpoint.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { viewpointHeight, PEAK, KNOLL_R, KNOLL_H } from "./viewpoint";

describe("viewpointHeight", () => {
  it("peaks at the summit and is flat outside the radius", () => {
    expect(viewpointHeight(PEAK.x, PEAK.z)).toBeCloseTo(KNOLL_H);
    expect(viewpointHeight(PEAK.x + KNOLL_R, PEAK.z)).toBe(0);
    expect(viewpointHeight(PEAK.x + KNOLL_R + 50, PEAK.z)).toBe(0);
  });
  it("decreases monotonically from center to rim", () => {
    const a = viewpointHeight(PEAK.x + 2, PEAK.z);
    const b = viewpointHeight(PEAK.x + 6, PEAK.z);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/world/viewpoint.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/world/viewpoint.ts`:

```typescript
import * as THREE from "three";

// A grassy knoll just off the road near the journey's start (tuned in-browser).
export const PEAK = { x: -46, z: 38 };
export const KNOLL_R = 12;   // base radius (m)
export const KNOLL_H = 5;    // peak height (m)
export const SUMMIT_R = 2.5; // trigger zone radius at the top (m)

/** Pure: analytic smoothstep dome height; 0 outside KNOLL_R. */
export function viewpointHeight(x: number, z: number): number {
  const d = Math.hypot(x - PEAK.x, z - PEAK.z);
  if (d >= KNOLL_R) return 0;
  const t = 1 - d / KNOLL_R;       // 1 at center, 0 at rim
  return KNOLL_H * t * t * (3 - 2 * t);
}

/** Build the knoll surface (matches viewpointHeight) + a small stone cairn at the summit. */
export function buildViewpoint(scene: THREE.Scene): void {
  const SEG = 48;
  const geo = new THREE.CircleGeometry(KNOLL_R, SEG);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    // CircleGeometry lies in XY before we rotate; raise Z by the height at that (x,y) offset.
    const lx = pos.getX(i), ly = pos.getY(i);
    pos.setZ(i, viewpointHeight(PEAK.x + lx, PEAK.z + ly));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 1, envMapIntensity: 1 });
  const knoll = new THREE.Mesh(geo, mat);
  knoll.rotation.x = -Math.PI / 2;
  knoll.position.set(PEAK.x, 0, PEAK.z);
  knoll.receiveShadow = true;
  scene.add(knoll);

  // Simple stone cairn (stacked boxes) at the summit.
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.9 });
  const cairn = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = 0.9 - i * 0.22;
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, 0.45, s), stone);
    b.position.y = KNOLL_H + 0.22 + i * 0.42;
    b.castShadow = b.receiveShadow = true;
    cairn.add(b);
  }
  cairn.position.set(PEAK.x, 0, PEAK.z);
  scene.add(cairn);
}
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/world/viewpoint.test.ts && npm run typecheck` — PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/world/viewpoint.ts src/world/viewpoint.test.ts
git commit -m "feat(viewpoint): knoll height function + procedural mesh/cairn"
```

---

## Task 4: Jump input + Gandalf movement rework

**Files:** Modify `src/engine/input.ts`, `src/player/gandalf.ts`

**Interfaces:**
- Consumes: `integrateVelocity`, `approachAngle`, `integrateJump` (Task 1); `resolveCollisions(..., skipLow)` (Task 2).
- Produces: `InputState.jump: boolean` (edge-triggered); `Gandalf.update(dt, input, camYaw, colliders, groundHeightAt)` where `groundHeightAt: (x: number, z: number) => number`; `Role` includes `"jump"`.

- [ ] **Step 1: Add jump to input** — in `src/engine/input.ts`:
  - Add `jump: boolean` to `InputState` (init `false`).
  - Add a `pendingJump` field; in keydown: `if (e.code === "Space" && !e.repeat) this.pendingJump = true;`.
  - In `beginFrame()`: `this.state.jump = this.pendingJump; this.pendingJump = false;` (mirrors `interact`).
  - Add a `triggerJump()` method (for a future touch button): `this.pendingJump = true;`.

- [ ] **Step 2: Rework Gandalf** — in `src/player/gandalf.ts`:
  - Import the locomotion helpers + add tuning consts:
    ```typescript
    import { integrateVelocity, approachAngle, integrateJump, type JumpState } from "./locomotion";
    const GROUND_ACCEL = 30, GROUND_DECEL = 40, TURN_RATE = 12;
    const JUMP_V = 5.5, GRAVITY = 18, AIRBORNE_CLEAR_H = 0.4;
    ```
  - Add `"jump"` to `Role` and to the `resolveClips([...])` roles list; add a `jump` action to a `gestures`-style one-shot (or a dedicated `private jumpAction`), played on takeoff, weighted while airborne, fading to locomotion on land (mirror the gesture blend). Until the clip exists, `resolveClips` returns `idle` for `jump` — fine.
  - Add velocity + jump state fields: `private vel = { x: 0, z: 0 }; private jump: JumpState = { y: 0, vy: 0, grounded: true };`
  - Rewrite `update(dt, input, camYaw, colliders, groundHeightAt)`:
    ```typescript
    update(dt, input, camYaw, colliders: Collider[] = [], groundHeightAt: (x: number, z: number) => number = () => 0): number {
      const dir = cameraRelativeMove(input.move.forward, input.move.right, camYaw);
      const moving = dir.x !== 0 || dir.z !== 0;
      const targetSpeed = moving ? (input.run ? RUN_SPEED : WALK_SPEED) : 0;
      const target = { x: dir.x * targetSpeed, z: dir.z * targetSpeed };
      const rate = moving ? GROUND_ACCEL : GROUND_DECEL;
      this.vel = integrateVelocity(this.vel, target, rate, dt);
      this.root.position.x += this.vel.x * dt;
      this.root.position.z += this.vel.z * dt;

      // vertical: jump/gravity against the ground height under the (new) feet
      const groundY = groundHeightAt(this.root.position.x, this.root.position.z);
      this.jump = integrateJump(this.jump, groundY, input.jump, dt, JUMP_V, GRAVITY);
      const airborne = (this.jump.y - groundY) > AIRBORNE_CLEAR_H;

      if (colliders.length) {
        const p = resolveCollisions(this.root.position.x, this.root.position.z, colliders, BODY_RADIUS, airborne);
        this.root.position.x = p.x; this.root.position.z = p.z;
      }
      this.root.position.y = this.jump.y;

      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.1) this.root.rotation.y = approachAngle(this.root.rotation.y, Math.atan2(this.vel.x, this.vel.z), TURN_RATE * dt);

      // ... gesture/gait blend (unchanged), but drive locomotion weights by `speed`,
      //     and play/blend the jump action while !this.jump.grounded ...
      this.mixer.update(dt);
      return speed;
    }
    ```
    Keep `playGesture`/`releaseGesture` and the gait-weight blend; feed the blend `pickGait(speed, input.run)`. Trigger the jump action on the takeoff frame (grounded→airborne transition).
  - **Note:** `main.ts` currently sets `gandalf.root.position.y = bridgeHeight(...)` after `update`. That line is REMOVED in Task 5 — Gandalf now owns its Y via the jump integrator + `groundHeightAt`.

- [ ] **Step 3: Verify suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: pass/clean/succeeds. (`gandalf.update`'s new params are optional-defaulted so existing call sites still compile until Task 5 passes the real `groundHeightAt`; but Task 5 lands in the same branch right after.)

- [ ] **Step 4: Commit**

```bash
git add src/engine/input.ts src/player/gandalf.ts
git commit -m "feat(gandalf): accelerated movement, smooth turn, jump (Space) with airborne clear"
```

---

## Task 5: Viewpoint trigger, camera reveal, and wiring

**Files:** Create `src/systems/viewpoint.ts`, `src/systems/viewpoint.test.ts`; Modify `src/player/followCamera.ts`, `src/world/ambient.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `PEAK`, `SUMMIT_R`, `viewpointHeight`, `buildViewpoint` (Task 3); `bridgeHeight`; `Gandalf.update(..., groundHeightAt)` (Task 4).
- Produces: `ViewpointTrigger` (enter/re-arm); a `FollowCamera` reveal mode; `groundHeightAt` composed in `main.ts`.

- [ ] **Step 1: Tag low props** — in `src/world/ambient.ts`, mark the small props clearable. Where `prop(...)` pushes a collider, allow a `low` flag and set it for `campfire` and the two `route-marker`s (≤~1.6 m). E.g. add a parameter to `prop` and pass `low: true` for those calls; the pushed collider becomes `{ x, z, r, low: true }`.

- [ ] **Step 2: Trigger — write the failing test** — create `src/systems/viewpoint.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ViewpointTrigger } from "./viewpoint";
import { PEAK, SUMMIT_R } from "../world/viewpoint";

describe("ViewpointTrigger", () => {
  it("fires once on entering the summit zone, not again until re-armed", () => {
    let fires = 0;
    const t = new ViewpointTrigger(() => fires++);
    t.update(PEAK.x, PEAK.z);                 // inside → fire
    t.update(PEAK.x + 0.1, PEAK.z);           // still inside → no re-fire
    expect(fires).toBe(1);
    t.update(PEAK.x + SUMMIT_R + 5, PEAK.z);  // leave → re-arm
    t.update(PEAK.x, PEAK.z);                 // re-enter → fire again
    expect(fires).toBe(2);
  });
});
```

- [ ] **Step 3: Implement the trigger** — create `src/systems/viewpoint.ts`:

```typescript
import { PEAK, SUMMIT_R } from "../world/viewpoint";

/** Fires `onReach` when the player enters the summit zone; re-arms after they leave. */
export class ViewpointTrigger {
  private armed = true;
  constructor(private onReach: () => void) {}
  update(x: number, z: number): void {
    const inside = Math.hypot(x - PEAK.x, z - PEAK.z) <= SUMMIT_R;
    if (inside && this.armed) { this.armed = false; this.onReach(); }
    else if (!inside) this.armed = true;
  }
}
```

Run: `npx vitest run src/systems/viewpoint.test.ts` — PASS.

- [ ] **Step 4: Camera reveal** — in `src/player/followCamera.ts`, add a reveal mode:
  - `private revealT = 0; get isRevealing() { return this.revealT > 0; }`
  - `startReveal(seconds = 5) { this.revealT = seconds; }`
  - In `update(...)`: when `revealT > 0`, decrement by `dt`, and instead of the normal follow, ease the camera toward a high pulled-back vantage above `PEAK` (e.g. target a point ~18 m up and ~22 m back from world center) while slowly orbiting `lookAt` the world center `(0,0,0)`; when `revealT` reaches 0 (or `endReveal()` is called on input), resume normal follow. Keep the existing follow logic for the non-reveal path.

- [ ] **Step 5: Wire into `main.ts`**:
  - After `createTerrain(scene)`: `import { buildViewpoint, viewpointHeight } from "./world/viewpoint"; buildViewpoint(scene);`
  - Compose ground height: `const groundHeightAt = (x: number, z: number) => Math.max(0, bridgeHeight(x, z), viewpointHeight(x, z));`
  - In the loop: replace `gandalf.update(dt, moveInput, cam.yawAngle, colliders)` with `gandalf.update(dt, moveInput, cam.yawAngle, colliders, groundHeightAt)`, and **remove** the line `gandalf.root.position.y = bridgeHeight(...)` (Gandalf now owns Y).
  - Create the trigger: `const viewpoint = new ViewpointTrigger(() => { cam.startReveal(); /* fade in caption */ });` and call `viewpoint.update(gandalf.root.position.x, gandalf.root.position.z)` each frame when not in a tale/map.
  - While `cam.isRevealing`, freeze player movement (feed zeroed move input, like the tale-panel `frozen` path) and show the caption; end the reveal on any movement/jump input.

- [ ] **Step 6: Verify suite + build + browser**

Run: `npm test && npm run build` — pass/succeeds.
Then `npm run dev`: movement reads weighty (accel/decel, smooth turn); jumping (Space) hops the campfire/route-marker but a building still blocks; walking up the knoll lifts Gandalf and reaching the cairn fires the camera reveal of the journey, then returns control; tales/map/journal unaffected; 0 console errors. Tune `PEAK`/constants if needed.

- [ ] **Step 7: Commit**

```bash
git add src/systems/viewpoint.ts src/systems/viewpoint.test.ts src/player/followCamera.ts src/world/ambient.ts src/main.ts
git commit -m "feat(viewpoint): summit trigger + camera reveal; jump clears low props; wire ground height"
```

---

## Task 6: Add the jump animation clip

**Files:** Modify `scripts/merge-gandalf.mjs`; regenerate `public/assets/models/gandalf.glb`

- [ ] **Step 1: Map the jump clip** — in `scripts/merge-gandalf.mjs`, add to `CLIP_ROLE`: `Regular_Jump: "jump",`. The grafted-count assertion now expects 6.

- [ ] **Step 2: Re-merge** — `npm run merge:gandalf`. Expected: `Wrote public/assets/models/gandalf.glb: grafted 6 clips -> [idle, walk, run, wave, listening, jump]`. (Requires the source GLBs still in `assets-src/gandalf/`; they are gitignored but present locally.)

- [ ] **Step 3: Verify in-browser** — `npm run dev`: jumping now plays the jump animation (not the idle fallback); character still loads/scales/animates; 0 errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/merge-gandalf.mjs public/assets/models/gandalf.glb
git commit -m "feat(assets): add jump clip to the merged Gandalf"
```

---

## Self-Review

**Spec coverage**
- Velocity+acceleration movement, turn smoothing, sprint → Task 1 (math) + Task 4 (apply). ✓
- Jump (Space) + gravity → Task 1 (`integrateJump`) + Task 4 (apply) + Task 6 (clip). ✓
- Jump clears `low` obstacles, tall always block → Task 2 (`skipLow`) + Task 5 Step 1 (tag props) + Task 4 (airborne→skipLow). ✓
- Unified `groundHeightAt` (terrain/bridge/viewpoint) → Task 5 Step 5. ✓
- Viewpoint knoll + height + cairn → Task 3. ✓
- Summit trigger fires once, re-arms → Task 5 (`ViewpointTrigger`). ✓
- Camera reveal + caption + restore on input/timeout → Task 5 Steps 4–5. ✓
- Pure unit tests (velocity/turn/jump, skipLow, viewpointHeight, trigger) → Tasks 1,2,3,5. ✓
- No new dependency / kinematic → all tasks. ✓

**Placeholder scan:** the gait/jump animation blend in Task 4 Step 2 is described as "mirror the gesture blend" with the existing weight-lerp pattern rather than re-pasting it — the implementer has the current `update()` in front of them; the new code shown is the velocity/jump core. The camera reveal vantage (Task 5 Step 4) gives concrete numbers (≈18 m up, 22 m back, lookAt origin), tuned in-browser. No "TODO"s.

**Type consistency:** `Vec2`/`JumpState`/`integrateVelocity`/`approachAngle`/`integrateJump` (Task 1) used in Task 4. `Collider.low?`/`resolveCollisions(..., skipLow)` (Task 2) used in Task 4. `PEAK`/`SUMMIT_R`/`viewpointHeight`/`buildViewpoint` (Task 3) used in Tasks 5. `ViewpointTrigger` (Task 5) consistent. `Gandalf.update(..., groundHeightAt)` defined in Task 4, called in Task 5. `Role` gains `"jump"` (Task 4), clip added (Task 6).

**Known judgment calls:** the set of genuinely-`low` props is small (campfire, route-markers); the jump's primary value is feel + the viewpoint approach, with low-clear applying to those props. The cairn is a primitive (stacked boxes) — no new art. Constants + `PEAK` are browser-tuned in Task 5/6.
