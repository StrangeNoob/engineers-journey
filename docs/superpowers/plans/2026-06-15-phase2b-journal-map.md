# Phase 2b — Journal & Map Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press **M** (or tap a [Map] button) to open a parchment map overlay showing the six tale-markers (visited vs. unvisited), Gandalf's position, a nudge to the nearest unvisited tale, and fast-travel (click a marker → fade-teleport).

**Architecture:** Pure geometry/projection helpers (`mapProjection.ts`, unit-tested) feed a thin SVG DOM overlay (`mapOverlay.ts`, following the existing `TalePanel` pattern). `main.ts` wires the toggle, freezes the world while open, and runs a fade-teleport on fast-travel. No new art asset — the map is drawn from `data/world.ts`.

**Tech Stack:** TypeScript, Three.js (existing), SVG/DOM for UI, Vitest. Spec: `docs/superpowers/specs/2026-06-15-phase2b-journal-map-design.md`.

**Conventions:** Run `npx tsc --noEmit` + `npx vitest run` before every commit. UI/DOM components are not unit-tested (matching `hud.ts`/`talePanel.ts`); verify them in the browser. Commit as `StrangeNoob <sipun63427452@gmail.com>` (repo default) — never mention AI in commit messages. Branch: `phase-2b-journal-map`.

---

### Task 1: Map projection — bounds + worldToMap

**Files:**
- Create: `src/world/mapProjection.ts`
- Test: `src/world/mapProjection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/world/mapProjection.test.ts
import { describe, it, expect } from "vitest";
import { mapBounds, worldToMap, type Bounds, type MapView } from "./mapProjection";

describe("mapBounds", () => {
  it("encloses the far villages and road extents", () => {
    const b = mapBounds();
    expect(b.minX).toBeLessThanOrEqual(-68);  // Shire (west)
    expect(b.maxX).toBeGreaterThanOrEqual(91); // Minas (east)
    expect(b.minZ).toBeLessThanOrEqual(-57);   // Edoras (north)
    expect(b.maxZ).toBeGreaterThanOrEqual(55);  // road start (south)
  });
});

describe("worldToMap", () => {
  const b: Bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 50 };
  const v: MapView = { w: 200, h: 200, pad: 10 };
  it("maps the bounds min corner to the padded, centered top-left", () => {
    const p = worldToMap(0, 0, b, v); // scale=1.8, content 180x90, centered → (10,55)
    expect(p.px).toBeCloseTo(10); expect(p.py).toBeCloseTo(55);
  });
  it("maps the bounds max corner to the far content corner", () => {
    const p = worldToMap(100, 50, b, v);
    expect(p.px).toBeCloseTo(190); expect(p.py).toBeCloseTo(145);
  });
  it("north (smaller z) maps higher on screen than south (larger z)", () => {
    expect(worldToMap(50, 0, b, v).py).toBeLessThan(worldToMap(50, 50, b, v).py);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/mapProjection.test.ts`
Expected: FAIL ("Failed to resolve import './mapProjection'").

- [ ] **Step 3: Write minimal implementation**

```ts
// src/world/mapProjection.ts
import { STOP_PLACEMENTS, ARGONATH, ROAD_POINTS, RIVER_POINTS } from "../data/world";

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface MapView { w: number; h: number; pad: number; } // SVG viewBox size + inner padding

/** Bounding box of every feature drawn on the map (villages ∪ Argonath ∪ road ∪ river). */
export function mapBounds(): Bounds {
  const xs: number[] = [], zs: number[] = [];
  for (const p of [...STOP_PLACEMENTS, ARGONATH]) { xs.push(p.x); zs.push(p.z); }
  for (const [x, z] of [...ROAD_POINTS, ...RIVER_POINTS]) { xs.push(x); zs.push(z); }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** World (x,z) → SVG (px,py). East (+x) → right; north (−z) → up. Uniform fit into the
 *  padded view, centered. */
export function worldToMap(x: number, z: number, b: Bounds, v: MapView): { px: number; py: number } {
  const bw = b.maxX - b.minX || 1, bh = b.maxZ - b.minZ || 1;
  const iw = v.w - v.pad * 2, ih = v.h - v.pad * 2;
  const s = Math.min(iw / bw, ih / bh);
  const ox = v.pad + (iw - bw * s) / 2;
  const oy = v.pad + (ih - bh * s) / 2;
  return { px: ox + (x - b.minX) * s, py: oy + (z - b.minZ) * s };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/world/mapProjection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/mapProjection.ts src/world/mapProjection.test.ts
git commit -m "feat(map): world→map projection + content bounds"
```

---

### Task 2: Map projection — travelTarget + nearestUnvisited

**Files:**
- Modify: `src/world/mapProjection.ts`
- Test: `src/world/mapProjection.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/world/mapProjection.test.ts`:

```ts
import { travelTarget, nearestUnvisited } from "./mapProjection";

describe("travelTarget", () => {
  it("lands on the road within tale-recall range of the stop, facing it", () => {
    const t = travelTarget(-68.8, 53.4); // Shire centre
    expect(Math.hypot(t.x - (-68.8), t.z - 53.4)).toBeLessThan(14); // within recall range
    expect(Number.isFinite(t.faceY)).toBe(true);
  });
});

describe("nearestUnvisited", () => {
  const stops = [{ id: "a", x: 0, z: 0 }, { id: "b", x: 10, z: 0 }, { id: "c", x: 100, z: 0 }];
  it("picks the closest unvisited stop", () => {
    const visited = new Set(["a"]);
    expect(nearestUnvisited(0, 0, stops, (id) => visited.has(id))).toBe("b");
  });
  it("returns null when all are visited", () => {
    expect(nearestUnvisited(0, 0, stops, () => true)).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/world/mapProjection.test.ts`
Expected: FAIL ("travelTarget is not a function").

- [ ] **Step 3: Implement**

Append to `src/world/mapProjection.ts`:

```ts
/** Closest point on the road polyline to (sx,sz), plus a Y-rotation facing the stop.
 *  Used as the fast-travel landing point — on the road beside the village, within the
 *  ~14 m tale-recall range; collision keeps the player out of the building. */
export function travelTarget(sx: number, sz: number): { x: number; z: number; faceY: number } {
  let bx = ROAD_POINTS[0][0], bz = ROAD_POINTS[0][1], best = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i++) {
    const [ax, az] = ROAD_POINTS[i], [cx, cz] = ROAD_POINTS[i + 1];
    const dx = cx - ax, dz = cz - az;
    const t = Math.max(0, Math.min(1, ((sx - ax) * dx + (sz - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(sx - px, sz - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return { x: bx, z: bz, faceY: Math.atan2(sx - bx, sz - bz) }; // rotation.y convention: atan2(dirX, dirZ)
}

/** Id of the unvisited stop nearest (x,z); null if all visited (drives the nudge pulse). */
export function nearestUnvisited(
  x: number, z: number,
  stops: { id: string; x: number; z: number }[],
  isVisited: (id: string) => boolean,
): string | null {
  let id: string | null = null, best = Infinity;
  for (const s of stops) {
    if (isVisited(s.id)) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best) { best = d; id = s.id; }
  }
  return id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/world/mapProjection.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/world/mapProjection.ts src/world/mapProjection.test.ts
git commit -m "feat(map): fast-travel target + nearest-unvisited helpers"
```

---

### Task 3: The map overlay component (SVG)

**Files:**
- Create: `src/ui/mapOverlay.ts`

No unit test (DOM UI, matching `talePanel.ts`); verified in Task 6.

- [ ] **Step 1: Create the component**

```ts
// src/ui/mapOverlay.ts
import type { Journal } from "../systems/journal";
import { ROAD_POINTS, RIVER_POINTS, ARGONATH } from "../data/world";
import { mapBounds, worldToMap, nearestUnvisited, type MapView } from "../world/mapProjection";

export interface MapStop { id: string; name: string; x: number; z: number; }

const VIEW: MapView = { w: 1000, h: 700, pad: 70 };
const NS = "http://www.w3.org/2000/svg";

/** Full-screen parchment map overlay. Open with open(playerX,playerZ); markers fast-travel. */
export class MapOverlay {
  private root = document.createElement("div");
  private svg!: SVGSVGElement;
  private mapBtn?: HTMLElement;
  private readonly bounds = mapBounds();

  constructor(
    private readonly stops: MapStop[],
    private readonly journal: Journal,
    private readonly onTravel: (id: string) => void,
  ) {
    this.root.id = "map";
    this.root.setAttribute("inert", "");
    this.root.style.cssText =
      "position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:rgba(20,16,10,.55);" +
      "opacity:0;transition:opacity .3s ease;pointer-events:none";
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.close(); }); // backdrop
    addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen) this.close(); });

    const style = document.createElement("style");
    style.textContent =
      "#map svg{width:min(900px,94vw);height:auto;filter:drop-shadow(0 18px 50px rgba(0,0,0,.5))}" +
      "#map .mk{cursor:pointer}#map .mk:focus{outline:none}" +
      "#map .mk:focus .ring,#map .mk:hover .ring{stroke:#b03a48;stroke-width:3}" +
      "@keyframes ejpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}" +
      "#map .pulse{transform-box:fill-box;transform-origin:center;animation:ejpulse 1.4s ease-in-out infinite}";
    document.head.appendChild(style);

    this.build();
    document.body.appendChild(this.root);
  }

  /** the element to return focus to on close (the HUD [Map] button). */
  setButton(btn: HTMLElement): void { this.mapBtn = btn; }

  private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  }

  private path(points: readonly [number, number][]): string {
    return points.map(([x, z], i) => {
      const { px, py } = worldToMap(x, z, this.bounds, VIEW);
      return `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    }).join(" ");
  }

  private build(): void {
    const svg = this.el("svg", { viewBox: `0 0 ${VIEW.w} ${VIEW.h}`, role: "dialog", "aria-label": "Journey map" });
    svg.appendChild(this.el("rect", { x: 8, y: 8, width: VIEW.w - 16, height: VIEW.h - 16, rx: 18, fill: "#e9dcc0" }));
    svg.appendChild(this.el("rect", { x: 20, y: 20, width: VIEW.w - 40, height: VIEW.h - 40, rx: 12, fill: "none", stroke: "#c2ad84", "stroke-width": 3 }));
    svg.appendChild(this.el("path", { d: this.path(RIVER_POINTS), fill: "none", stroke: "#7fb4c9", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85 }));
    svg.appendChild(this.el("path", { d: this.path(ROAD_POINTS), fill: "none", stroke: "#9c7b4d", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "1 12" }));
    const a = worldToMap(ARGONATH.x, ARGONATH.z, this.bounds, VIEW);
    const arg = this.el("text", { x: a.px, y: a.py + 7, "text-anchor": "middle", "font-size": 24, fill: "#6c5a3c" });
    arg.textContent = "⛩";
    svg.appendChild(arg);
    this.svg = svg;
    this.root.appendChild(svg);
  }

  open(playerX: number, playerZ: number): void {
    this.svg.querySelectorAll(".dyn").forEach((n) => n.remove()); // rebuild markers from current journal state
    const layer = this.el("g", { class: "dyn" });
    const nudge = nearestUnvisited(playerX, playerZ, this.stops, (id) => this.journal.isVisited(id));

    for (const s of this.stops) {
      const { px, py } = worldToMap(s.x, s.z, this.bounds, VIEW);
      const visited = this.journal.isVisited(s.id);
      const g = this.el("g", { class: "mk", tabindex: 0, role: "button", "aria-label": `Travel to ${s.name}${visited ? " (visited)" : ""}` });
      const ring = this.el("circle", { class: "ring", cx: px, cy: py, r: 14, fill: visited ? "#caa24a" : "#cabf9f", stroke: "#5a3b2a", "stroke-width": 2 });
      if (s.id === nudge) ring.classList.add("pulse");
      const label = this.el("text", { x: px, y: py - 22, "text-anchor": "middle", "font-size": 18, fill: "#3a2f20" });
      label.textContent = s.name;
      g.append(ring, label);
      const go = () => { this.close(); this.onTravel(s.id); };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      layer.appendChild(g);
    }
    const gp = worldToMap(playerX, playerZ, this.bounds, VIEW);
    layer.appendChild(this.el("circle", { cx: gp.px, cy: gp.py, r: 7, fill: "#2e2a22", stroke: "#fff", "stroke-width": 2 }));
    this.svg.appendChild(layer);

    this.root.removeAttribute("inert");
    this.root.style.opacity = "1";
    this.root.style.pointerEvents = "auto";
    (this.svg.querySelector(".mk") as SVGGElement | null)?.focus();
  }

  close(): void {
    this.root.style.opacity = "0";
    this.root.style.pointerEvents = "none";
    this.root.setAttribute("inert", "");
    this.mapBtn?.focus();
  }

  get isOpen(): boolean { return !this.root.hasAttribute("inert"); }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/mapOverlay.ts
git commit -m "feat(map): parchment SVG map overlay component"
```

---

### Task 4: Fade-teleport helper

**Files:**
- Create: `src/ui/fade.ts`

- [ ] **Step 1: Create the helper**

```ts
// src/ui/fade.ts
/** A full-screen black curtain used to hide an instant teleport. */
export function createFade(): { teleport: (apply: () => void) => void } {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:12;background:#000;opacity:0;pointer-events:none;transition:opacity .28s ease";
  document.body.appendChild(el);
  return {
    teleport(apply) {
      el.style.opacity = "1";
      window.setTimeout(() => { apply(); el.style.opacity = "0"; }, 300); // move at peak black, then fade back
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/fade.ts
git commit -m "feat(ui): fade-to-black teleport curtain"
```

---

### Task 5: HUD [Map] button

**Files:**
- Modify: `src/ui/hud.ts`

- [ ] **Step 1: Replace `src/ui/hud.ts` with**

```ts
export class Hud {
  private el = document.createElement("div");
  readonly mapBtn = document.createElement("button");
  constructor() {
    this.el.id = "hud";
    this.el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;font:13px/1.4 'Iowan Old Style',Georgia,serif;letter-spacing:.06em;color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.4);pointer-events:none";
    this.mapBtn.textContent = "Map (M)";
    this.mapBtn.setAttribute("aria-label", "Open the journey map");
    this.mapBtn.style.cssText =
      "position:fixed;top:12px;right:14px;z-index:7;font:12px/1 'Iowan Old Style',Georgia,serif;letter-spacing:.08em;color:#2e2a22;background:rgba(244,236,216,.92);border:1px solid #d8cba8;border-radius:999px;padding:9px 15px;cursor:pointer";
    document.body.appendChild(this.el);
    document.body.appendChild(this.mapBtn);
  }
  set(count: number, total: number): void { this.el.textContent = `Tales recalled: ${count} / ${total}`; }
  onMap(fn: () => void): void { this.mapBtn.onclick = fn; }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat(hud): add a [Map] button"
```

---

### Task 6: Wire the overlay into the game (toggle, freeze, fast-travel)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add imports**

In `src/main.ts`, after the existing import block, add:

```ts
import { MapOverlay } from "./ui/mapOverlay";
import { createFade } from "./ui/fade";
import { travelTarget } from "./world/mapProjection";
import { STOP_PLACEMENTS } from "./data/world";
```

- [ ] **Step 2: Create the overlay + toggle, just before `startLoop(...)`**

In `src/main.ts`, immediately after the line `let elapsed = 0;` (and before `startLoop((dt) => {`), insert:

```ts
  const fade = createFade();
  const map = new MapOverlay(
    STOP_PLACEMENTS.map((p) => ({ id: p.id, name: content[p.id].locale, x: p.x, z: p.z })),
    journal,
    (id) => {
      const p = STOP_PLACEMENTS.find((s) => s.id === id)!;
      const t = travelTarget(p.x, p.z);
      fade.teleport(() => { gandalf.root.position.set(t.x, 0, t.z); gandalf.root.rotation.y = t.faceY; });
    },
  );
  map.setButton(hud.mapBtn);
  hud.onMap(() => map.open(gandalf.root.position.x, gandalf.root.position.z));
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyM" || e.repeat) return;
    if (map.isOpen) map.close();
    else map.open(gandalf.root.position.x, gandalf.root.position.z);
  });
```

- [ ] **Step 3: Freeze the world while the map is open**

In `src/main.ts`, replace the body of the `startLoop` callback so the update block is gated by `!map.isOpen` (rendering still happens every frame):

```ts
  startLoop((dt) => {
    elapsed += dt;
    input.beginFrame();
    if (!map.isOpen) {
      // Move the player FIRST, then point the camera at the updated position (avoids the
      // one-frame camera lag that caused screen jitter while walking).
      gandalf.update(dt, input.state, cam.yawAngle, colliders);
      gandalf.root.position.y = bridgeHeight(gandalf.root.position.x, gandalf.root.position.z);
      followSun(scene, gandalf.root.position.x, gandalf.root.position.z);
      cam.update(gandalf.root.position, input, dt, landmarks.obstacles);
      cullTreesNearCamera(cam.camera.position.x, cam.camera.position.z, 5);
      grassWind?.(elapsed);
      landmarks.update(gandalf.root.position);
      stops.update(gandalf.root.position, cam.camera, input);
    }
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
```

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all vitest tests pass, build succeeds.

- [ ] **Step 5: Verify in the browser**

Run `npm run dev`, open `http://localhost:5173`, wait for load, then check:
1. A **[Map (M)]** button shows top-right.
2. Press **M** (or click the button) → a parchment map fills the screen (dim backdrop), showing the winding road, the river, six named markers in plausible positions, and a dark dot for Gandalf near the Shire start. The world behind is dimmed and frozen (release/hold W → Gandalf doesn't move while open).
3. The nearest unvisited marker gently pulses.
4. Press **M** / **Esc** / click the dim backdrop → closes.
5. Open the map, click a far marker (e.g., **Minas Tirith**) → screen fades to black, and on fade-in Gandalf is standing on the road beside that village, facing it (walk forward and the "recall this tale" prompt appears).
6. Tab key cycles the markers (red focus ring); Enter on a focused marker travels.

Capture a screenshot of the open map for the review. If any marker sits off the parchment or the road/river look wrong, re-check `worldToMap`/`VIEW` before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(map): toggle overlay (M/button/Esc), freeze world, fast-travel"
```

---

## After all tasks
- Run `npx tsc --noEmit && npx vitest run && npm run build` once more — all green.
- Push the branch and open a PR into `main` (the `ci` check must pass; `main` is protected). Cloudflare Pages builds a preview from the PR.
- This completes Phase 2b. Phase 2c (scroll unfurl, camera polish, idle, audio) is the next phase.
