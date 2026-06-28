# AAA Animus HUD Implementation Plan (Milestone 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A warm-skinned Assassin's-Creed-style HUD — compass strip, waypoint markers, a synchronization meter, and a recall flourish — that tracks landmarks and progress, hides during cinematics/map, and stays accessible.

**Architecture:** Four focused `ui/` modules, each with its pure math (`bearingToStripX`, `screenMarker`, `segments`) extracted and unit-tested, plus a DOM class. A one-line extension to `StopManager`'s recall callback reports the recalled stop id. Thin wiring in `main.ts` builds the four, updates compass + waypoints each frame, hides them during reveal/tale/map, and fires the flourish + segment fill on recall. Pure DOM (no canvas/WebGL), parchment/gold styling matching the existing HUD.

**Tech Stack:** TypeScript, Three.js `0.160` (camera projection only), Vitest, Vite.

## Global Constraints

- **No new dependency.** Pure DOM + the existing Three camera projection.
- **Aesthetic:** warm parchment/gold (the existing HUD palette — bg `rgba(244,236,216,…)`, gold `#caa24a`/`#8a6d28`, ink `#2e2a22`, border `#d8cba8`, serif `'Iowan Old Style',Georgia,serif`). NO blue/holographic styling.
- **Accessibility:** compass + waypoint markers are `aria-hidden="true"` decorative aids; the sync meter carries `role="img"` + `aria-label="Synchronization X of N"`; the flourish announces via `aria-live="polite"`; all motion respects `prefers-reduced-motion`. The accessible SVG map (M) is unchanged.
- **Mobile:** all persistent HUD pinned to the TOP (compass center, sync meter left, Map/Sound right) — clear of the bottom touch zones (joystick bottom-left, Interact button bottom-right). Markers are `pointer-events:none`.
- **Data sources:** landmark positions `STOP_PLACEMENTS` (`{id,x,z,height}` — six entries, ids match STOP ids); journey order + names from `STOPS` (`{id, locale}`); visited from `Journal.isVisited(id)`.
- **No regression:** movement, tales/interaction, map/fast-travel, journal, audio, and accessibility behave as before. Existing suite stays green; typecheck clean; `npm run build` warning-free.
- **Commit messages:** plain, NO Claude/AI attribution.
- **Tests pure/node:** unit-test the pure functions; DOM/visual is browser-verified.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/ui/compass.ts` | create | `bearingToStripX` (pure) + `Compass` class (top strip, cardinal ticks, landmark pips). |
| `src/ui/compass.test.ts` | create | Tests for `bearingToStripX`. |
| `src/ui/waypoints.ts` | create | `screenMarker` (pure) + `Waypoints` class (per-landmark DOM marker; on-screen seal+distance, off-screen edge arrow). |
| `src/ui/waypoints.test.ts` | create | Tests for `screenMarker`. |
| `src/ui/syncMeter.ts` | create | `segments` (pure) + `SyncMeter` class (segmented bar, accessible label). |
| `src/ui/syncMeter.test.ts` | create | Tests for `segments`. |
| `src/ui/flourish.ts` | create | `Flourish` class (recall flourish; reduced-motion + aria-live). |
| `src/ui/hud.ts` | modify | Remove the tales-recalled text + `set()`; keep Map/Sound buttons. |
| `src/systems/interaction.ts` | modify | `onChange: () => void` → `onChange: (id: string) => void`; `recall()` passes the recalled id. |
| `src/main.ts` | modify | Build the four; update compass + waypoints each frame; hide during reveal/tale/map; recall → segment fill + flourish; replace `hud.set(...)` with `syncMeter.set(...)`. |

---

## Task 1: Compass strip

**Files:** Create `src/ui/compass.ts`, `src/ui/compass.test.ts`

**Interfaces:**
- Consumes: `STOP_PLACEMENTS` from `../data/world` (`{id,x,z}`), `Journal` from `../systems/journal` (`isVisited(id)`).
- Produces:
  - `const COMPASS_FOV: number` (≈ 2.44 rad ≈ ±70° visible arc).
  - `bearingToStripX(camYaw, fromX, fromZ, toX, toZ, fovRad, stripW): number | null` — pip x in px, or null if outside the arc.
  - `class Compass { constructor(journal: Journal); update(camYaw: number, px: number, pz: number): void; setVisible(v: boolean): void }`.

- [ ] **Step 1: Write the failing test** — create `src/ui/compass.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { bearingToStripX, COMPASS_FOV } from "./compass";

const W = 400;
describe("bearingToStripX", () => {
  it("centers a target dead ahead", () => {
    // facing +z (camYaw 0), target straight ahead at +z
    expect(bearingToStripX(0, 0, 0, 0, 10, COMPASS_FOV, W)).toBeCloseTo(W / 2);
  });
  it("offsets a target to one side toward that edge", () => {
    // target ~60° to the right (within the ±70° arc)
    const x = bearingToStripX(0, 0, 0, 10, 5.77, COMPASS_FOV, W); // atan2(10,5.77)=~60deg
    expect(x).not.toBeNull();
    expect(x!).toBeGreaterThan(W / 2);
  });
  it("returns null for a target behind", () => {
    expect(bearingToStripX(0, 0, 0, 0, -10, COMPASS_FOV, W)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/compass.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/ui/compass.ts`:

```typescript
import { STOP_PLACEMENTS } from "../data/world";
import type { Journal } from "../systems/journal";

export const COMPASS_FOV = 2.44; // visible arc ≈ ±70°

/** Pure: x-position (px) of a target's pip on a strip of width `stripW`, or null if the
 *  target's bearing (relative to camYaw) is outside ±fovRad/2. Uses the same atan2(dx,dz)
 *  convention as the player/camera yaw. */
export function bearingToStripX(
  camYaw: number, fromX: number, fromZ: number, toX: number, toZ: number, fovRad: number, stripW: number,
): number | null {
  const bearing = Math.atan2(toX - fromX, toZ - fromZ);
  let rel = (bearing - camYaw) % (Math.PI * 2);
  if (rel > Math.PI) rel -= Math.PI * 2;
  if (rel < -Math.PI) rel += Math.PI * 2;
  if (Math.abs(rel) > fovRad / 2) return null;
  return (rel / (fovRad / 2)) * (stripW / 2) + stripW / 2;
}

const FONT = "'Iowan Old Style',Georgia,serif";
// cardinal directions as world unit-vectors: +x east, -z north
const CARDINALS: [string, number, number][] = [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]];

export class Compass {
  private el = document.createElement("div");
  private ticks: { dx: number; dz: number; el: HTMLElement }[] = [];
  private pips = new Map<string, HTMLElement>();

  constructor(private journal: Journal) {
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText =
      "position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(440px,68vw);height:26px;" +
      "z-index:6;pointer-events:none;overflow:hidden;border-radius:13px;" +
      "background:rgba(244,236,216,.55);border:1px solid #d8cba8;box-shadow:inset 0 0 12px rgba(0,0,0,.06)";
    // center heading line
    const center = document.createElement("div");
    center.style.cssText = "position:absolute;left:50%;top:3px;width:1px;height:20px;background:#b8a36a";
    this.el.appendChild(center);
    for (const [label, dx, dz] of CARDINALS) {
      const t = document.createElement("div");
      t.textContent = label;
      t.style.cssText = `position:absolute;top:5px;transform:translateX(-50%);font:11px ${FONT};color:#7a6f57;letter-spacing:.1em`;
      this.el.appendChild(t);
      this.ticks.push({ dx, dz, el: t });
    }
    for (const p of STOP_PLACEMENTS) {
      const pip = document.createElement("div");
      pip.style.cssText =
        "position:absolute;top:13px;transform:translate(-50%,-50%);width:7px;height:7px;border-radius:50%;" +
        "background:#caa24a;border:1px solid #8a6d28";
      this.el.appendChild(pip);
      this.pips.set(p.id, pip);
    }
    document.body.appendChild(this.el);
  }

  update(camYaw: number, px: number, pz: number): void {
    const w = this.el.clientWidth || 400;
    for (const t of this.ticks) {
      const x = bearingToStripX(camYaw, px, pz, px + t.dx, pz + t.dz, COMPASS_FOV, w);
      if (x == null) { t.el.style.display = "none"; } else { t.el.style.display = ""; t.el.style.left = `${x}px`; }
    }
    for (const p of STOP_PLACEMENTS) {
      const pip = this.pips.get(p.id)!;
      const x = bearingToStripX(camYaw, px, pz, p.x, p.z, COMPASS_FOV, w);
      if (x == null) { pip.style.display = "none"; continue; }
      pip.style.display = "";
      pip.style.left = `${x}px`;
      pip.style.opacity = this.journal.isVisited(p.id) ? "0.32" : "1";
    }
  }

  setVisible(v: boolean): void { this.el.style.display = v ? "" : "none"; }
}
```

- [ ] **Step 4: Run + typecheck + build**

Run: `npx vitest run src/ui/compass.test.ts && npm run typecheck && npm run build`
Expected: PASS / clean / build succeeds (confirms the DOM class compiles + bundles).

- [ ] **Step 5: Commit**

```bash
git add src/ui/compass.ts src/ui/compass.test.ts
git commit -m "feat(hud): compass strip with landmark bearing pips"
```

---

## Task 2: Waypoint markers

**Files:** Create `src/ui/waypoints.ts`, `src/ui/waypoints.test.ts`

**Interfaces:**
- Consumes: `STOP_PLACEMENTS` (`{id,x,z,height}`), `THREE` (camera projection).
- Produces:
  - `interface MarkerPos { x: number; y: number; onScreen: boolean; angleDeg: number }`
  - `screenMarker(ndcX, ndcY, behind, margin, w, h): MarkerPos` — on-screen passthrough; off-screen/behind → clamp to the inset edge with an arrow angle.
  - `class Waypoints { constructor(names: Record<string,string>); update(camera: THREE.Camera, px: number, pz: number, isVisited: (id:string)=>boolean): void; setVisible(v: boolean): void }`.

- [ ] **Step 1: Write the failing test** — create `src/ui/waypoints.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { screenMarker } from "./waypoints";

const W = 1000, H = 600, M = 30;
describe("screenMarker", () => {
  it("passes through an on-screen target", () => {
    const m = screenMarker(0, 0, false, M, W, H);
    expect(m.onScreen).toBe(true);
    expect(m.x).toBeCloseTo(W / 2);
    expect(m.y).toBeCloseTo(H / 2);
  });
  it("clamps an off-screen-right target to the right inset edge, pointing right", () => {
    const m = screenMarker(2, 0, false, M, W, H);
    expect(m.onScreen).toBe(false);
    expect(m.x).toBeGreaterThan(W / 2);
    expect(m.x).toBeLessThanOrEqual(W - M + 0.5);
    expect(Math.abs(m.angleDeg)).toBeLessThan(1); // ~0° = pointing right
  });
  it("flips a behind-camera target to the opposite edge", () => {
    // target projects slightly right but is BEHIND → should clamp to the LEFT edge
    const m = screenMarker(0.1, 0, true, M, W, H);
    expect(m.onScreen).toBe(false);
    expect(m.x).toBeLessThan(W / 2);
    expect(Math.abs(Math.abs(m.angleDeg) - 180)).toBeLessThan(1); // ~180° = pointing left
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/waypoints.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/ui/waypoints.ts`:

```typescript
import * as THREE from "three";
import { STOP_PLACEMENTS } from "../data/world";

export interface MarkerPos { x: number; y: number; onScreen: boolean; angleDeg: number }

/** Pure: map a target's NDC (from camera.project: x,y in [-1,1], plus `behind` = z>1) to a
 *  screen pixel position. On-screen → passthrough. Off-screen/behind → clamp the direction to
 *  the viewport rectangle inset by `margin`, with `angleDeg` pointing screen-ward toward it. */
export function screenMarker(ndcX: number, ndcY: number, behind: boolean, margin: number, w: number, h: number): MarkerPos {
  let nx = ndcX, ny = ndcY;
  if (behind) { nx = -nx; ny = -ny; } // a behind-camera point projects mirrored; flip back
  const onScreen = !behind && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
  if (onScreen) {
    return { x: (nx * 0.5 + 0.5) * w, y: (-ny * 0.5 + 0.5) * h, onScreen: true, angleDeg: 0 };
  }
  const mx = margin / (w / 2), my = margin / (h / 2); // margin expressed in NDC
  // scale the direction (nx,ny) out to the inset rectangle edge
  const t = Math.min((1 - mx) / (Math.abs(nx) || 1e-6), (1 - my) / (Math.abs(ny) || 1e-6));
  const ex = nx * t, ey = ny * t;
  return {
    x: (ex * 0.5 + 0.5) * w,
    y: (-ey * 0.5 + 0.5) * h,
    onScreen: false,
    angleDeg: Math.atan2(-ny, nx) * 180 / Math.PI, // screen-space: +x right, +y up
  };
}

const FONT = "'Iowan Old Style',Georgia,serif";

export class Waypoints {
  private markers = new Map<string, { wrap: HTMLElement; seal: HTMLElement; dist: HTMLElement }>();
  private v = new THREE.Vector3();

  constructor(names: Record<string, string>) {
    for (const p of STOP_PLACEMENTS) {
      const wrap = document.createElement("div");
      wrap.setAttribute("aria-hidden", "true");
      wrap.style.cssText = "position:fixed;z-index:6;transform:translate(-50%,-50%);pointer-events:none;text-align:center";
      const seal = document.createElement("div");
      seal.style.cssText =
        "width:16px;height:16px;margin:0 auto;border-radius:50%;background:rgba(202,162,74,.92);" +
        "border:1.5px solid #8a6d28;box-shadow:0 1px 3px rgba(0,0,0,.25);color:#3a2f10;" +
        `font:10px ${FONT};line-height:14px`;
      const dist = document.createElement("div");
      dist.style.cssText = `margin-top:2px;font:10px ${FONT};color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.5);letter-spacing:.04em`;
      const title = document.createElement("div");
      title.textContent = names[p.id] ?? p.id;
      title.style.cssText = `font:10px ${FONT};color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.5);white-space:nowrap`;
      wrap.append(seal, title, dist);
      document.body.appendChild(wrap);
      this.markers.set(p.id, { wrap, seal, dist });
    }
  }

  update(camera: THREE.Camera, px: number, pz: number, isVisited: (id: string) => boolean): void {
    const w = innerWidth, h = innerHeight;
    for (const p of STOP_PLACEMENTS) {
      const m = this.markers.get(p.id)!;
      this.v.set(p.x, (p.height ?? 6) + 1, p.z);
      const ndc = this.v.clone().project(camera);
      const behind = ndc.z > 1;
      const pos = screenMarker(ndc.x, ndc.y, behind, 28, w, h);
      const visited = isVisited(p.id);
      // off-screen visited landmarks stay quiet (no edge arrows nagging you back)
      if (!pos.onScreen && visited) { m.wrap.style.display = "none"; continue; }
      m.wrap.style.display = "";
      m.wrap.style.left = `${pos.x}px`;
      m.wrap.style.top = `${pos.y}px`;
      if (pos.onScreen) {
        m.wrap.style.transform = "translate(-50%,-50%)";
        m.seal.textContent = visited ? "✓" : "◆";
        m.seal.style.opacity = visited ? "0.55" : "1";
        m.dist.textContent = `${Math.round(Math.hypot(p.x - px, p.z - pz))} m`;
        m.dist.style.display = "";
      } else {
        // off-screen unvisited: a directional arrow rotated toward the target
        m.wrap.style.transform = `translate(-50%,-50%) rotate(${pos.angleDeg}deg)`;
        m.seal.textContent = "➤";
        m.seal.style.opacity = "1";
        m.dist.style.display = "none";
      }
    }
  }

  setVisible(v: boolean): void {
    for (const m of this.markers.values()) m.wrap.style.visibility = v ? "" : "hidden";
  }
}
```

- [ ] **Step 4: Run + typecheck + build**

Run: `npx vitest run src/ui/waypoints.test.ts && npm run typecheck && npm run build`
Expected: PASS / clean / build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/waypoints.ts src/ui/waypoints.test.ts
git commit -m "feat(hud): waypoint markers with off-screen edge arrows"
```

---

## Task 3: Synchronization meter (+ trim HUD)

**Files:** Create `src/ui/syncMeter.ts`, `src/ui/syncMeter.test.ts`; Modify `src/ui/hud.ts`

**Interfaces:**
- Produces:
  - `segments(isVisited: (id:string)=>boolean, orderedIds: string[]): boolean[]` — filled state per ordered id.
  - `class SyncMeter { constructor(orderedIds: string[]); set(isVisited: (id:string)=>boolean): void }`.
- Modifies: `Hud` loses `set(count,total)` and its text element; keeps `mapBtn`/`muteBtn`/`onMap`/`onMute`/`setMuted`.

- [ ] **Step 1: Write the failing test** — create `src/ui/syncMeter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { segments } from "./syncMeter";

describe("segments", () => {
  it("maps visited ids to filled flags in order", () => {
    const visited = new Set(["a", "c"]);
    expect(segments((id) => visited.has(id), ["a", "b", "c"])).toEqual([true, false, true]);
  });
  it("is all-false when nothing is visited", () => {
    expect(segments(() => false, ["a", "b"])).toEqual([false, false]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/syncMeter.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/ui/syncMeter.ts`:

```typescript
/** Pure: filled-state per ordered id. */
export function segments(isVisited: (id: string) => boolean, orderedIds: string[]): boolean[] {
  return orderedIds.map((id) => isVisited(id));
}

const FONT = "'Iowan Old Style',Georgia,serif";

export class SyncMeter {
  private el = document.createElement("div");
  private label = document.createElement("span");
  private segs: HTMLElement[] = [];

  constructor(private orderedIds: string[]) {
    this.el.setAttribute("role", "img");
    this.el.style.cssText =
      `position:fixed;top:12px;left:14px;z-index:6;display:flex;flex-direction:column;gap:5px;` +
      `pointer-events:none;font:12px ${FONT};color:#2e2a22`;
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:3px";
    for (let i = 0; i < orderedIds.length; i++) {
      const s = document.createElement("div");
      s.style.cssText = "width:22px;height:7px;border-radius:3px;border:1px solid #c9b888;background:rgba(244,236,216,.5)";
      bar.appendChild(s);
      this.segs.push(s);
    }
    this.label.style.cssText = "letter-spacing:.06em;text-shadow:0 1px 0 rgba(255,255,255,.4)";
    this.el.append(bar, this.label);
    document.body.appendChild(this.el);
  }

  set(isVisited: (id: string) => boolean): void {
    const seg = segments(isVisited, this.orderedIds);
    const count = seg.filter(Boolean).length;
    seg.forEach((on, i) => {
      this.segs[i].style.background = on ? "#caa24a" : "rgba(244,236,216,.5)";
      this.segs[i].style.borderColor = on ? "#8a6d28" : "#c9b888";
    });
    const total = this.orderedIds.length;
    this.label.textContent = `Synchronization ${count} / ${total}`;
    this.el.setAttribute("aria-label", `Synchronization ${count} of ${total}`);
  }
}
```

- [ ] **Step 4: Trim `hud.ts`** — remove the tales-recalled text element + `set()`. The file becomes:

```typescript
export class Hud {
  readonly mapBtn = document.createElement("button");
  readonly muteBtn = document.createElement("button");
  constructor() {
    const btn = "z-index:7;font:12px/1 'Iowan Old Style',Georgia,serif;letter-spacing:.08em;color:#2e2a22;background:rgba(244,236,216,.92);border:1px solid #d8cba8;border-radius:999px;padding:9px 15px;cursor:pointer";
    // visible button text is the accessible name; no aria-label (avoids a label/name mismatch)
    this.mapBtn.textContent = "Map (M)";
    this.mapBtn.style.cssText = `position:fixed;top:12px;right:14px;${btn}`;
    this.muteBtn.style.cssText = `position:fixed;top:12px;right:104px;${btn}`;
    document.body.append(this.mapBtn, this.muteBtn);
    this.setMuted(false);
  }
  onMap(fn: () => void): void { this.mapBtn.onclick = fn; }
  onMute(fn: () => void): void { this.muteBtn.onclick = fn; }
  setMuted(muted: boolean): void { this.muteBtn.textContent = muted ? "Sound: off" : "Sound: on"; }
}
```

(Note: `main.ts` callers of `hud.set(...)` are replaced by `syncMeter.set(...)` in Task 5 — do not run the build expecting main.ts to compile until Task 5; run the unit test + typecheck of the new module here, and the full build at the end of Task 5. To keep this task's gate green, after trimming hud.ts also remove its now-broken `hud.set` calls is NOT in scope — instead Task 3 commits the new module + test, and the hud.ts trim, together; main.ts still references hud.set and will fail typecheck. To avoid a red gate, Task 3 ALSO updates the two `main.ts` call sites minimally: see Step 4b.)

- [ ] **Step 4b: Keep the build green** — in `src/main.ts`, the two existing `hud.set(journal.count, journal.total)` / `() => hud.set(...)` references must not break typecheck. Replace them with the sync meter now (the fuller wiring lands in Task 5): add `import { SyncMeter } from "./ui/syncMeter";`, construct `const syncMeter = new SyncMeter(STOPS.map((s) => s.id));` right after `const hud = new Hud();`, change line ~78 `hud.set(journal.count, journal.total)` → `syncMeter.set((id) => journal.isVisited(id))`, and change the StopManager callback `() => hud.set(journal.count, journal.total)` → `() => syncMeter.set((id) => journal.isVisited(id))`. (Task 5 extends that callback to also fire the flourish.)

- [ ] **Step 5: Run + typecheck + build**

Run: `npx vitest run src/ui/syncMeter.test.ts && npm test && npm run typecheck && npm run build`
Expected: new tests PASS; full suite green; typecheck clean; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ui/syncMeter.ts src/ui/syncMeter.test.ts src/ui/hud.ts src/main.ts
git commit -m "feat(hud): synchronization meter replaces the tales-recalled text"
```

---

## Task 4: Recall flourish

**Files:** Create `src/ui/flourish.ts`

**Interfaces:**
- Produces: `class Flourish { constructor(); play(locale: string): void }` — a brief gold "memory synchronized" flourish; reduced-motion → static + `aria-live` announcement.

This task has no pure logic to unit-test (DOM + timing + media query); it is validated by typecheck/build here and browser-verified after Task 5. Keep it small and YAGNI.

- [ ] **Step 1: Implement** — create `src/ui/flourish.ts`:

```typescript
const FONT = "'Iowan Old Style',Georgia,serif";

/** A brief gold "memory synchronized" flourish on tale recall. Respects prefers-reduced-motion. */
export class Flourish {
  private el = document.createElement("div");
  private live = document.createElement("div");
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText =
      `position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;` +
      `text-align:center;opacity:0;font:18px ${FONT};color:#3a2f1c;text-shadow:0 1px 2px rgba(255,255,255,.5)`;
    this.live.setAttribute("aria-live", "polite");
    this.live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    document.body.append(this.el, this.live);
  }

  play(locale: string): void {
    this.live.textContent = `Memory synchronized: ${locale}`;
    this.el.innerHTML =
      `<div style="font:13px ${FONT};letter-spacing:.18em;color:#9a7b2e">✦ MEMORY SYNCHRONIZED ✦</div>` +
      `<div style="margin-top:4px">${locale}</div>`;
    if (this.timer) clearTimeout(this.timer);
    if (this.reduced) {
      this.el.style.transition = "none";
      this.el.style.opacity = "1";
      this.timer = setTimeout(() => { this.el.style.opacity = "0"; }, 1600);
      return;
    }
    this.el.style.transition = "none";
    this.el.style.opacity = "0";
    this.el.style.transform = "translate(-50%,-50%) scale(.92)";
    requestAnimationFrame(() => {
      this.el.style.transition = "opacity .5s ease, transform .5s ease";
      this.el.style.opacity = "1";
      this.el.style.transform = "translate(-50%,-50%) scale(1)";
    });
    this.timer = setTimeout(() => { this.el.style.opacity = "0"; }, 1600);
  }
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean / build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/ui/flourish.ts
git commit -m "feat(hud): memory-synchronized recall flourish"
```

---

## Task 5: Wire the HUD into the loop

**Files:** Modify `src/systems/interaction.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `Compass`, `Waypoints`, `SyncMeter` (already wired in Task 3), `Flourish`; `cam.yawAngle`, `cam.camera`, `cam.isRevealing`; `stops.isPanelOpen`; `map.isOpen`; `journal.isVisited`; `content[id].locale`.
- Produces: `StopManager` recall callback now reports the recalled stop id.

- [ ] **Step 1: Extend the StopManager callback** — in `src/systems/interaction.ts`:
  - Change the constructor param type `private readonly onChange: () => void` → `private readonly onChange: (id: string) => void`.
  - In `recall(id)`, change the `this.onChange()` call to `this.onChange(id)`. (Confirm `recall` is the only caller of `onChange`; if any other call exists, pass the relevant id or `""`.)

- [ ] **Step 2: Build + update the HUD in `main.ts`**:
  - Add imports: `import { Compass } from "./ui/compass";`, `import { Waypoints } from "./ui/waypoints";`, `import { Flourish } from "./ui/flourish";`. (`SyncMeter` already imported in Task 3.)
  - After `const syncMeter = new SyncMeter(STOPS.map((s) => s.id));`, add:
    ```ts
    const compass = new Compass(journal);
    const waypoints = new Waypoints(Object.fromEntries(STOPS.map((s) => [s.id, s.locale])));
    const flourish = new Flourish();
    ```
  - Update the StopManager callback (from Task 3's `() => syncMeter.set(...)`) to also fire the flourish on recall:
    ```ts
    const stops = new StopManager(landmarks.stops, content, journal, (id) => {
      syncMeter.set((i) => journal.isVisited(i));
      flourish.play(content[id]?.locale ?? id);
    }, { gandalf, scroll, camera: cam, audio });
    ```
  - In the `startLoop` callback, drive visibility every frame (so it hides even while the map is open) and update when visible. Insert near the top of the callback, right after `input.beginFrame();`:
    ```ts
    const hudVisible = !map.isOpen && !stops.isPanelOpen && !cam.isRevealing;
    compass.setVisible(hudVisible);
    waypoints.setVisible(hudVisible);
    ```
    Then inside the existing `if (!map.isOpen) { ... }` block, after `stops.update(...)`, add:
    ```ts
    if (hudVisible) {
      compass.update(cam.yawAngle, gandalf.root.position.x, gandalf.root.position.z);
      waypoints.update(cam.camera, gandalf.root.position.x, gandalf.root.position.z, (id) => journal.isVisited(id));
    }
    ```

- [ ] **Step 3: Run the suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: full suite green (89 + 7 new from Tasks 1-3 = 96); typecheck clean; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/systems/interaction.ts src/main.ts
git commit -m "feat(hud): wire compass/waypoints/sync/flourish; recall reports stop id"
```

---

## Self-Review

**Spec coverage**
- Compass strip + landmark bearing pips + visited dimming → Task 1. ✓
- Waypoint markers (on-screen seal+distance, off-screen edge arrow unvisited-only, visited state) → Task 2. ✓
- Synchronization meter (segments, label, accessible aria-label) replacing tales-recalled text → Task 3. ✓
- Recall flourish + reduced-motion + aria-live → Task 4. ✓
- HUD hides during reveal/tale/map → Task 5 (`hudVisible`). ✓
- StopManager reports recalled id → Task 5 Step 1. ✓
- Pure unit tests (bearingToStripX, screenMarker, segments) → Tasks 1,2,3. ✓
- Accessibility (aria-hidden aids, sync aria-label, aria-live, reduced-motion) → Tasks 1,2,3,4 + constraints. ✓
- Mobile top placement clear of touch zones → all DOM pinned top (constraints). ✓
- No new dependency / warm palette / no attribution → all tasks. ✓

**Placeholder scan:** no TBD/TODO. The flourish (Task 4) has no pure test by design (DOM/timing/media-query) — stated explicitly, validated by typecheck/build + browser. Task 3's hud.ts trim is paired with the minimal main.ts call-site swap (Step 4b) so no task leaves the build red.

**Type consistency:** `bearingToStripX`/`COMPASS_FOV` (Task 1) used by `Compass`. `screenMarker`/`MarkerPos` (Task 2). `segments`/`SyncMeter.set((id)=>bool)` (Task 3) — the `set` argument is an `isVisited` predicate everywhere (`(id)=>journal.isVisited(id)`). `Flourish.play(locale)` (Task 4) called with `content[id]?.locale` (Task 5). `Compass.update(camYaw,px,pz)`, `Waypoints.update(camera,px,pz,isVisited)`, `setVisible(v)` consistent between definition (Tasks 1-2) and call (Task 5). `StopManager` `onChange:(id:string)=>void` defined Task 5 Step 1, called with `(id)=>{...}` Task 5 Step 2.

**Known judgment calls:** the compass arc (±70°, `COMPASS_FOV=2.44`), marker margin (28 px), and segment sizing are tunable starting values (browser-tuned). Off-screen visited markers hide (deliberate de-clutter). The flourish auto-dismisses at 1.6 s.
