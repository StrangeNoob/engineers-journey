# Phase 2a — Populate the World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the Phase-1 test patch into the full map-shaped world: all six landmarks (+ Argonath) placed along a winding road through open country with forests, mountains, water, and ambient props — every tale recallable, on desktop and mobile.

**Architecture:** Extends the Phase-1 module layout. New `world/` modules (`terrain`, `road`, `water`, `nature`, `ambient`), a rewritten `landmarks` registry with distance-based lazy-loading, a generalized `interaction` manager over N stops, a `data/world.ts` of placements, and an `engine/quality.ts` device tier. Pure logic (tier pick, nearest-stop, spline sampling, Chaikin, lazy-load predicate) is unit-tested with Vitest; placement/rendering is verified by `npm run build` + a headless-browser load (no console errors, correct render).

**Tech Stack:** Three.js 0.160, TypeScript (strict), Vite, Vitest, gltf-transform (optimize), Cloudflare Pages.

**Conventions:** flat walkable ground at y=0; kinematic controller unchanged; `MeshToonMaterial` + 3-step ramp via existing `world/assets.ts` `toonify`; `+x` east / `−z` north; commit after every task. Raw source assets in `../new_portfolio/designs/assets/gen/middle-earth/`.

---

## File map

```text
scripts/optimize-all.sh        NEW  batch-optimize every raw asset → public/assets/models/
src/engine/quality.ts          NEW  device tier + tested pickTier()
src/world/terrain.ts           NEW  large ground + fog tuning
src/data/world.ts              NEW  stop placements, Argonath, road & river control points
src/world/landmarks.ts         REWRITE  registry: immediate colliders/scrollPos + lazy-load GLBs
src/systems/interaction.ts     REWRITE  StopManager over N stops + tested nearestStop()
src/world/road.ts              NEW  spline → road tiles + bridge (+ tested sampleSpline/chaikin)
src/world/water.ts             NEW  river stream tiles + fountain + well
src/world/nature.ts            NEW  InstancedMesh forests + grass + rocks + mountain backdrops
src/world/ambient.ts           NEW  wagon, campfire, market, signposts, route markers
src/main.ts                    MODIFY  compose the populated world
```

---

## Task 1: Optimize all raw assets

**Files:** Create `scripts/optimize-all.sh`; outputs into `public/assets/models/`.

- [ ] **Step 1: Write the batch script**

Create `scripts/optimize-all.sh`:
```bash
#!/usr/bin/env bash
# Batch-optimize every raw Middle-earth asset into public/assets/models/.
# Format per line: "<srcRelPath>|<outName>|<ratio>|<tex>"
set -uo pipefail
SRC="../new_portfolio/designs/assets/gen/middle-earth"
OUT="public/assets/models"
OPT="scripts/optimize-glb.sh"
mkdir -p "$OUT"
items=(
  "buildings/argonath.glb|argonath|0.4|1024"
  "buildings/bree-inn.glb|bree-inn|0.4|1024"
  "buildings/bywater-mill.glb|bywater-mill|0.4|1024"
  "buildings/edoras-hall.glb|edoras-hall|0.4|1024"
  "buildings/isengard-tower.glb|isengard-tower|0.4|1024"
  "buildings/minas-tirith.glb|minas-tirith|0.4|1024"
  "environment/mallorn-tree-1.glb|mallorn-tree-1|0.2|1024"
  "environment/mallorn-tree-2.glb|mallorn-tree-2|0.2|1024"
  "environment/mallorn-tree-3.glb|mallorn-tree-3|0.2|1024"
  "environment/grass-tuft.glb|grass-tuft|0.2|512"
  "environment/mountain-backdrop.glb|mountain-backdrop|0.2|1024"
  "environment/mountain-backdrop_square.glb|mountain-backdrop-square|0.2|1024"
  "environment/stream-straight.glb|stream-straight|0.1|512"
  "environment/stream-curve.glb|stream-curve|0.1|512"
  "environment/the-fountain.glb|the-fountain|0.15|1024"
  "environment/well.glb|well|0.15|1024"
  "environment/roads/stone-road-crossing.glb|road-crossing|0.05|512"
  "environment/roads/stone-road-fork.glb|road-fork|0.05|512"
  "environment/roads/stone-road-end.glb|road-end|0.05|512"
  "environment/covered-wagon.glb|covered-wagon|0.15|1024"
  "environment/campfire-rest-point.glb|campfire|0.15|1024"
  "environment/market-stall.glb|market-stall|0.15|1024"
  "environment/signpost.glb|signpost|0.15|512"
  "environment/route-marker-red.glb|route-marker|0.15|512"
  "environment/portfolio-scroll.glb|portfolio-scroll|0.2|512"
)
for it in "${items[@]}"; do
  IFS='|' read -r src out ratio tex <<<"$it"
  [ -f "$OUT/$out.glb" ] && { echo "skip $out (exists)"; continue; }
  bash "$OPT" "$SRC/$src" "$OUT/$out.glb" "$ratio" "$tex"
done
echo "=== done. sizes: ==="
ls -la "$OUT"/*.glb | awk '{printf "%7.2f MB  %s\n",$5/1048576,$9}'
```

- [ ] **Step 2: Run it**

Run: `chmod +x scripts/optimize-all.sh && bash scripts/optimize-all.sh`
Expected: each asset prints `raw → small (tris)`; final list shows all GLBs at ≲2 MB.

- [ ] **Step 3: Verify the heaviest landmark loads + has a mesh**

Run:
```bash
node -e 'const fs=require("fs");const d=fs.readFileSync("public/assets/models/minas-tirith.glb");let o=12,js;while(o<d.length){const c=d.readUInt32LE(o),t=d.readUInt32LE(o+4);if(t===0x4E4F534A)js=JSON.parse(d.slice(o+8,o+8+c));o+=8+c;}console.log("meshes",js.meshes.length,"ext",js.extensionsUsed)'
```
Expected: `meshes` ≥ 1 and `KHR_draco_mesh_compression` in `ext`.

- [ ] **Step 4: Commit**

```bash
git add scripts/optimize-all.sh public/assets/models
git commit -m "assets: batch-optimize all landmarks + environment for the world"
```

---

## Task 2: Quality tier (`engine/quality.ts`)

**Files:** Create `src/engine/quality.ts`, `src/engine/quality.test.ts`

- [ ] **Step 1: Failing test**

Create `src/engine/quality.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickTier } from "./quality";

describe("pickTier", () => {
  it("coarse pointer → mobile", () => { expect(pickTier(true, 8)).toBe("mobile"); });
  it("few cores → mobile", () => { expect(pickTier(false, 4)).toBe("mobile"); });
  it("desktop otherwise", () => { expect(pickTier(false, 8)).toBe("desktop"); });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL (pickTier missing).

- [ ] **Step 3: Implement `src/engine/quality.ts`**

```ts
export type Tier = "desktop" | "mobile";

/** Pure: choose a tier from input capabilities. */
export function pickTier(coarsePointer: boolean, cores: number): Tier {
  return coarsePointer || cores <= 4 ? "mobile" : "desktop";
}

export interface Quality {
  tier: Tier;
  pixelRatio: number;
  drawDistance: number; // fog far
  treeCount: number;
  grassCount: number;
  shadows: boolean;
}

export function detectQuality(): Quality {
  const tier = pickTier(matchMedia("(pointer:coarse)").matches, navigator.hardwareConcurrency || 8);
  return tier === "mobile"
    ? { tier, pixelRatio: Math.min(devicePixelRatio, 1.6), drawDistance: 140, treeCount: 90, grassCount: 1500, shadows: false }
    : { tier, pixelRatio: Math.min(devicePixelRatio, 2), drawDistance: 230, treeCount: 240, grassCount: 6000, shadows: true };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: pickTier tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/quality.ts src/engine/quality.test.ts
git commit -m "feat: device quality tier (tested pickTier)"
```

---

## Task 3: Terrain (`world/terrain.ts`)

**Files:** Create `src/world/terrain.ts`

- [ ] **Step 1: Implement `src/world/terrain.ts`**

```ts
import * as THREE from "three";
import type { Quality } from "../engine/quality";

/** Large flat ground; tunes scene fog to the world scale + quality. */
export function createTerrain(scene: THREE.Scene, quality: Quality): THREE.Mesh {
  scene.fog = new THREE.Fog(0xe7decb, 60, quality.drawDistance);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 72),
    new THREE.MeshStandardMaterial({ color: 0x8a9c57, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // a darker central meadow under the Bree crossroads area
  const meadow = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x71823f, roughness: 1 }),
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(-8, 0.01, 4);
  meadow.receiveShadow = true;
  scene.add(meadow);
  return ground;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/world/terrain.ts
git commit -m "feat: larger terrain + quality-scaled fog"
```

---

## Task 4: World placements (`data/world.ts`)

**Files:** Create `src/data/world.ts`

- [ ] **Step 1: Implement `src/data/world.ts`**

```ts
// World placement data: where each landmark/prop sits, and the road/river control points.
// Coordinate convention: +x east, -z north. Mirrors the illustrated map.

export interface Placement {
  id: string;       // matches a STOP id, or "argonath"
  x: number; z: number;
  facingDeg: number; // yaw in degrees (0 faces +z/south)
  footprint: number; // fit width in world units
  sink: number;      // tuck base under ground
}

export const STOP_PLACEMENTS: Placement[] = [
  { id: "shire",    x: -60, z: 55,  facingDeg: 30,  footprint: 11, sink: 0.1 },
  { id: "bywater",  x: -52, z: 12,  facingDeg: 80,  footprint: 11, sink: 0.1 },
  { id: "bree",     x: -8,  z: 4,   facingDeg: 120, footprint: 12, sink: 0.1 },
  { id: "edoras",   x: 6,   z: -44, facingDeg: 160, footprint: 13, sink: 0.1 },
  { id: "isengard", x: 56,  z: 16,  facingDeg: 230, footprint: 12, sink: 0.2 },
  { id: "minas",    x: 74,  z: -52, facingDeg: 200, footprint: 16, sink: 0.4 },
];

export const ARGONATH: Placement = { id: "argonath", x: 34, z: -8, facingDeg: 180, footprint: 14, sink: 0 };

/** Road control points, in journey order (Argonath is a waypoint the road passes). */
export const ROAD_POINTS: [number, number][] = [
  [-60, 55], [-52, 12], [-8, 4], [6, -44], [34, -8], [56, 16], [74, -52],
];

/** River control points (a stream the road crosses near the Argonath). */
export const RIVER_POINTS: [number, number][] = [
  [12, -82], [26, -40], [34, -8], [44, 24], [58, 52],
];

/** Where the bridge sits (road × river crossing, near the Argonath). */
export const BRIDGE_AT: [number, number] = [34, -8];
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/data/world.ts
git commit -m "feat: world placement data (stops, Argonath, road & river points)"
```

---

## Task 5: Landmark registry with lazy-load (`world/landmarks.ts`)

**Files:** Modify (rewrite) `src/world/landmarks.ts`; Create `src/world/landmarks.test.ts`

- [ ] **Step 1: Failing test for the lazy-load predicate**

Create `src/world/landmarks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { withinLoadRange } from "./landmarks";

describe("withinLoadRange", () => {
  it("true inside range", () => { expect(withinLoadRange(0, 0, 50, 0, 90)).toBe(true); });
  it("false outside range", () => { expect(withinLoadRange(0, 0, 200, 0, 90)).toBe(false); });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/world/landmarks.ts`**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { STOP_PLACEMENTS, ARGONATH, type Placement } from "../data/world";

export interface PlacedStop {
  id: string;
  scrollPos: THREE.Vector3;      // where the "recall" prompt anchors
  collider: { x: number; z: number; r: number };
}

/** Pure: is (px,pz) within `range` of (x,z)? */
export function withinLoadRange(x: number, z: number, px: number, pz: number, range: number): boolean {
  return Math.hypot(px - x, pz - z) <= range;
}

const LOAD_RANGE = 95;

function scrollPosFor(p: Placement): THREE.Vector3 {
  // anchor the prompt just in front of the building, biased toward world centre (the road)
  const toCentreX = -p.x, toCentreZ = -p.z;
  const len = Math.hypot(toCentreX, toCentreZ) || 1;
  const d = p.footprint * 0.55;
  return new THREE.Vector3(p.x + (toCentreX / len) * d, 0.6, p.z + (toCentreZ / len) * d);
}

export interface LandmarkRegistry {
  stops: PlacedStop[];           // the six recallable stops (colliders + scroll anchors)
  update(playerPos: THREE.Vector3): void; // lazy-loads nearby GLBs
}

export function placeLandmarks(scene: THREE.Scene): LandmarkRegistry {
  const all: Placement[] = [...STOP_PLACEMENTS, ARGONATH];
  const loaded = new Set<string>();

  const stops: PlacedStop[] = STOP_PLACEMENTS.map((p) => ({
    id: p.id,
    scrollPos: scrollPosFor(p),
    collider: { x: p.x, z: p.z, r: p.footprint * 0.5 },
  }));

  function load(p: Placement): void {
    loaded.add(p.id);
    loadGLTF(p.id === "argonath" ? "argonath" : modelFor(p.id))
      .then((g) => {
        const root = g.scene as unknown as THREE.Group;
        toonify(root);
        fitToGround(root, p.footprint);
        root.position.x = p.x; root.position.z = p.z;
        root.position.y -= p.sink;
        root.rotation.y = THREE.MathUtils.degToRad(p.facingDeg);
        scene.add(root);
      })
      .catch((e) => console.error(`landmark ${p.id} failed`, e));
  }

  return {
    stops,
    update(playerPos) {
      for (const p of all) {
        if (!loaded.has(p.id) && withinLoadRange(p.x, p.z, playerPos.x, playerPos.z, LOAD_RANGE)) load(p);
      }
    },
  };
}

// STOP id → model filename (career.ts stop.model). Kept local + tiny to avoid a circular import.
function modelFor(id: string): string {
  const map: Record<string, string> = {
    shire: "shire-home", bywater: "bywater-mill", bree: "bree-inn",
    edoras: "edoras-hall", isengard: "isengard-tower", minas: "minas-tirith",
  };
  return map[id] ?? id;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: withinLoadRange tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/world/landmarks.ts src/world/landmarks.test.ts
git commit -m "feat: landmark registry with distance lazy-loading (tested predicate)"
```

---

## Task 6: Interaction over N stops (`systems/interaction.ts`)

**Files:** Modify (rewrite) `src/systems/interaction.ts`; update `src/systems/interaction.test.ts`

- [ ] **Step 1: Failing test for nearestStop**

Replace `src/systems/interaction.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import { withinRadius, nearestStop } from "./interaction";

describe("withinRadius", () => {
  it("true when inside", () => { expect(withinRadius(0, 0, 1, 1, 3)).toBe(true); });
  it("false when outside", () => { expect(withinRadius(0, 0, 5, 0, 3)).toBe(false); });
});

describe("nearestStop", () => {
  const stops = [
    { id: "a", x: 0, z: 0 },
    { id: "b", x: 10, z: 0 },
  ];
  it("returns the nearest within range", () => {
    expect(nearestStop(1, 0, stops, 4)?.id).toBe("a");
    expect(nearestStop(9, 0, stops, 4)?.id).toBe("b");
  });
  it("returns null when none in range", () => {
    expect(nearestStop(50, 50, stops, 4)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL (nearestStop missing).

- [ ] **Step 3: Rewrite `src/systems/interaction.ts`**

```ts
import * as THREE from "three";
import type { Stop } from "../data/career";
import type { PlacedStop } from "../world/landmarks";
import type { Input } from "../engine/input";
import type { Journal } from "./journal";
import { Prompt } from "../ui/prompt";
import { TalePanel } from "../ui/talePanel";

/** Pure: is (px,pz) within `r` of (cx,cz)? */
export function withinRadius(cx: number, cz: number, px: number, pz: number, r: number): boolean {
  return Math.hypot(px - cx, pz - cz) <= r;
}

/** Pure: nearest stop (by collider centre) within `range`, else null. */
export function nearestStop<T extends { id: string; x: number; z: number }>(
  px: number, pz: number, stops: T[], range: number,
): T | null {
  let best: T | null = null, bestD = range;
  for (const s of stops) {
    const d = Math.hypot(px - s.x, pz - s.z);
    if (d <= bestD) { bestD = d; best = s; }
  }
  return best;
}

/** Manages proximity prompts + tale panel across all stops. */
export class StopManager {
  private prompt = new Prompt();
  private panel = new TalePanel();
  private flat: { id: string; x: number; z: number }[];
  constructor(
    private readonly placed: PlacedStop[],
    private readonly content: Record<string, Stop>,
    private readonly journal: Journal,
    private readonly onChange: () => void,
  ) {
    this.flat = placed.map((p) => ({ id: p.id, x: p.collider.x, z: p.collider.z }));
  }

  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = nearestStop(playerPos.x, playerPos.z, this.flat, this.rangeFor());
    if (!near) { this.prompt.hide(); return; }
    const ps = this.placed.find((p) => p.id === near.id)!;
    this.prompt.showAt(ps.scrollPos, camera);
    if (input.state.interact) this.recall(near.id);
  }

  private rangeFor(): number { return 14; } // proximity from a stop's centre (covers larger footprints)

  private recall(id: string): void {
    this.prompt.hide();
    this.journal.recall(id);
    this.onChange();
    this.panel.open(this.content[id], () => { /* closed */ });
  }
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: withinRadius + nearestStop tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/systems/interaction.ts src/systems/interaction.test.ts
git commit -m "feat: StopManager over all six tales (tested nearestStop)"
```

---

## Task 7: Road (`world/road.ts`)

**Files:** Create `src/world/road.ts`, `src/world/road.test.ts`

- [ ] **Step 1: Failing tests for the pure helpers**

Create `src/world/road.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { chaikin } from "./road";

describe("chaikin", () => {
  it("keeps endpoints and adds points", () => {
    const out = chaikin([[0, 0], [10, 0], [10, 10]], 1);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([10, 10]);
    expect(out.length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/world/road.ts`**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { ROAD_POINTS, BRIDGE_AT } from "../data/world";

type Pt = [number, number];

/** Pure: Chaikin corner-cutting smoothing; pins endpoints. */
export function chaikin(points: Pt[], iterations: number): Pt[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Lay road tiles along the smoothed spline + a bridge at the river crossing. */
export async function buildRoad(scene: THREE.Scene): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(
    ROAD_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  );
  const len = curve.getLength();
  const tile = await loadGLTF("road-straight");
  const STEP = 4.6; // approximate tile length in world units after fit
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, 5);
    m.position.set(p.x, 0.03, p.z);
    m.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(m);
  }
  // bridge at the river crossing
  const bridge = await loadGLTF("stone-bridge");
  const bm = (bridge.scene as unknown as THREE.Group).clone(true);
  toonify(bm);
  fitToGround(bm, 6);
  bm.position.set(BRIDGE_AT[0], 0.1, BRIDGE_AT[1]);
  // orient across the road tangent at the crossing
  const ct = curve.getTangent(0.65);
  bm.rotation.y = Math.atan2(ct.x, ct.z) + Math.PI / 2;
  scene.add(bm);
}
```

> Note: `chaikin` is exported + tested even though `buildRoad` uses Catmull-Rom directly (the
> curve already smooths). `chaikin` stays available for the drawn-map/journal work in 2b and as a
> tested utility; keep it.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: chaikin tests pass.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/world/road.ts src/world/road.test.ts
git commit -m "feat: winding road tiles along spline + bridge (tested chaikin)"
```

---

## Task 8: Water (`world/water.ts`)

**Files:** Create `src/world/water.ts`

- [ ] **Step 1: Implement `src/world/water.ts`**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";
import { RIVER_POINTS } from "../data/world";

async function placeOnce(scene: THREE.Scene, name: string, x: number, z: number, footprint: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToGround(m, footprint);
  m.position.set(x, 0.02, z);
  m.rotation.y = ry;
  scene.add(m);
}

/** River of stream tiles along the river spline; fountain + well at Bree. */
export async function buildWater(scene: THREE.Scene): Promise<void> {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const tile = await loadGLTF("stream-straight");
  const len = curve.getLength();
  const STEP = 4.6;
  const n = Math.floor(len / STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), tan = curve.getTangent(t);
    const m = (tile.scene as unknown as THREE.Group).clone(true);
    toonify(m);
    fitToGround(m, 5);
    m.position.set(p.x, 0.01, p.z);
    m.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(m);
  }
  await placeOnce(scene, "the-fountain", -2, 7, 5);   // Bree market square
  await placeOnce(scene, "well", -13, 9, 2.4);        // Bree village prop
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/world/water.ts
git commit -m "feat: river stream tiles + fountain + well"
```

---

## Task 9: Nature (`world/nature.ts`)

**Files:** Create `src/world/nature.ts`

- [ ] **Step 1: Implement `src/world/nature.ts`**

```ts
import * as THREE from "three";
import { loadGLTF } from "./assets";
import type { Quality } from "../engine/quality";
import { STOP_PLACEMENTS } from "../data/world";

const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.needsUpdate = true; t.minFilter = t.magFilter = THREE.NearestFilter; return t;
})();

function firstMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !found) found = m; });
  return found;
}

function toonOf(src: THREE.Mesh): THREE.MeshToonMaterial {
  const mat = src.material as THREE.MeshStandardMaterial;
  return new THREE.MeshToonMaterial({ map: mat.map ?? null, color: mat.color?.clone() ?? new THREE.Color(0x6f8147), gradientMap: ramp });
}

const seed = { s: 91 };
const rnd = () => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;

function nearAStop(x: number, z: number, pad: number): boolean {
  return STOP_PLACEMENTS.some((p) => Math.hypot(x - p.x, z - p.z) < pad);
}

/** InstancedMesh a model's first mesh `count` times via the placement callback. */
async function instance(scene: THREE.Scene, name: string, count: number, fit: number,
  place: (i: number, d: THREE.Object3D) => boolean): Promise<void> {
  const g = await loadGLTF(name);
  const src = firstMesh(g.scene);
  if (!src) return;
  // normalize source height to `fit` units by baking a scale into instance matrices later
  const box = new THREE.Box3().setFromObject(src); const size = new THREE.Vector3(); box.getSize(size);
  const base = fit / (size.y || 1);
  const inst = new THREE.InstancedMesh(src.geometry, toonOf(src), count);
  inst.castShadow = true; inst.receiveShadow = true;
  const d = new THREE.Object3D();
  let n = 0;
  let guard = 0;
  while (n < count && guard < count * 40) {
    guard++;
    d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.setScalar(1);
    if (!place(n, d)) continue;
    d.scale.multiplyScalar(base);
    d.updateMatrix();
    inst.setMatrixAt(n++, d.matrix);
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

/** Forests (mallorn variants) + grass + scattered rocks + distant mountain backdrops. */
export async function scatterNature(scene: THREE.Scene, quality: Quality): Promise<void> {
  const per = Math.floor(quality.treeCount / 3);
  for (const name of ["mallorn-tree-1", "mallorn-tree-2", "mallorn-tree-3"]) {
    await instance(scene, name, per, 7 + rnd() * 2, (_, d) => {
      const a = rnd() * 6.283, r = 30 + rnd() * 210;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (nearAStop(x, z, 16)) return false;          // keep clearings around stops
      d.position.set(x, 0, z); d.rotation.y = rnd() * 6.283;
      d.scale.setScalar(0.8 + rnd() * 0.7);
      return true;
    });
  }
  await instance(scene, "grass-tuft", quality.grassCount, 0.6, (_, d) => {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 120;
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    d.rotation.y = rnd() * 6.283; d.scale.setScalar(0.7 + rnd() * 0.8);
    return true;
  });
  // distant mountains ring the far field (behind Minas Tirith / NE + edges)
  await instance(scene, "mountain-backdrop", 14, 40, (_, d) => {
    const a = rnd() * 6.283, r = 230 + rnd() * 70;
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    d.rotation.y = rnd() * 6.283; d.scale.setScalar(1 + rnd() * 0.8);
    return true;
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/world/nature.ts
git commit -m "feat: instanced forests, grass, and mountain backdrops"
```

---

## Task 10: Ambient props (`world/ambient.ts`)

**Files:** Create `src/world/ambient.ts`

- [ ] **Step 1: Implement `src/world/ambient.ts`**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";

async function prop(scene: THREE.Scene, name: string, x: number, z: number, footprint: number, ry = 0): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  fitToGround(m, footprint);
  m.position.set(x, 0, z);
  m.rotation.y = ry;
  scene.add(m);
}

/** Static ambient props that dress the world (no animation in 2a). */
export async function buildAmbient(scene: THREE.Scene): Promise<void> {
  await prop(scene, "covered-wagon", -16, 8, 4, 0.6);     // parked near Bree
  await prop(scene, "campfire", -34, 30, 2.5, 0);         // a layby on the road
  await prop(scene, "market-stall", -4, 11, 3, -0.5);     // Bree market
  await prop(scene, "signpost", -22, 6, 2.2, 0.3);        // a junction
  await prop(scene, "route-marker", 24, -22, 1.6, 0);     // along the road
  await prop(scene, "route-marker", 48, 4, 1.6, 0);
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/world/ambient.ts
git commit -m "feat: ambient props (wagon, campfire, market, signposts, markers)"
```

---

## Task 11: Compose the populated world (`main.ts`) + verify

**Files:** Modify `src/main.ts`

- [ ] **Step 1: Rewrite `src/main.ts`**

```ts
import "./styles/main.css";
import { STOPS } from "./data/career";
import { createRenderer } from "./engine/renderer";
import { createScene } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { detectQuality } from "./engine/quality";
import { createTerrain } from "./world/terrain";
import { placeLandmarks } from "./world/landmarks";
import { buildRoad } from "./world/road";
import { buildWater } from "./world/water";
import { scatterNature } from "./world/nature";
import { buildAmbient } from "./world/ambient";
import { Gandalf } from "./player/gandalf";
import { FollowCamera } from "./player/followCamera";
import { Journal } from "./systems/journal";
import { StopManager } from "./systems/interaction";
import { Hud } from "./ui/hud";
import { mountTouchControls } from "./ui/touchControls";
import { showBoot, hideBoot } from "./ui/loader";

const app = document.getElementById("app")!;
const boot = showBoot();
const quality = detectQuality();

const renderer = createRenderer();
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows;
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

const scene = createScene();
createTerrain(scene, quality);

const input = new Input();
input.attach(renderer.domElement);
mountTouchControls(input);

const cam = new FollowCamera();
const gandalf = new Gandalf();
const journal = new Journal(STOPS.map((s) => s.id));
const hud = new Hud();
hud.set(journal.count, journal.total);

const content: Record<string, typeof STOPS[number]> = Object.fromEntries(STOPS.map((s) => [s.id, s]));

(async () => {
  await gandalf.load();
  gandalf.root.position.set(-60, 0, 62); // spawn just outside the Shire (start of the road)
  scene.add(gandalf.root);

  const landmarks = placeLandmarks(scene);
  landmarks.update(gandalf.root.position); // load spawn-area landmark before reveal
  const stops = new StopManager(landmarks.stops, content, journal, () => hud.set(journal.count, journal.total));

  startLoop((dt) => {
    input.beginFrame();
    cam.update(gandalf.root.position, input, dt);
    gandalf.update(dt, input.state, cam.yawAngle);
    landmarks.update(gandalf.root.position);
    stops.update(gandalf.root.position, cam.camera, input);
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
  hideBoot(boot);

  // stream in the rest of the world after first paint
  buildRoad(scene);
  buildWater(scene);
  scatterNature(scene, quality);
  buildAmbient(scene);
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); cam.resize(); });
```

- [ ] **Step 2: Build + tests + typecheck**

Run: `npm run build` (expect clean) and `npm test` (expect all green).

- [ ] **Step 3: Headless runtime check**

Run the dev server and load it; confirm **no console errors** and that landmarks/road/forest render. Use whatever headless tool is available (e.g. Playwright): navigate to the dev URL, wait ~6s for streaming loads, capture `console` errors (a `favicon.ico` 404 is acceptable; nothing else), and a screenshot. Expected: Gandalf at the Shire, the road and trees visible, zero JS errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: compose the populated world (terrain, landmarks, road, water, nature, ambient)"
```

---

## Definition of done (Phase 2a acceptance)
- All six landmarks render at their map positions (correct scale/facing); each tale recalls via proximity → prompt → panel; journal counts to 6/6.
- Argonath present; the road threads all stops with a bridge over the river.
- Instanced forests, grass, mountains, and ambient props populate the world cohesively.
- Plays on desktop **and** a real phone; 60 fps desktop / smooth mobile; no console errors.
- Deploys to Cloudflare Pages via the existing pipeline.

## Out of scope (later)
- **2b:** illustrated-map journal overlay (press M), visited markers, fast-travel.
- **2c:** 3D `portfolio-scroll` unfurl, camera framing/collision, proper idle clip, moving ambient, audio, rolling hills.
