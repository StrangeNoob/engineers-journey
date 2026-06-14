# Phase 1 Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable third-person Gandalf walking/running a small test world, with the Shire "tale" recallable via a scroll prompt + panel, working on desktop and mobile, deployed to Cloudflare Pages.

**Architecture:** Vite + TS + Three.js. A small composition root (`main.ts`) wires focused modules: `engine/*` (renderer, scene, loop, input), `world/*` (assets, sky, lights, ground, landmarks), `player/*` (gandalf controller + follow camera), `systems/*` (interaction, journal), `ui/*` (loader, prompt, tale panel, hud, touch controls). Pure logic (input math, movement, proximity, journal) is unit-tested with Vitest; rendering/animation/camera/touch are verified manually in the dev server.

**Tech Stack:** Three.js 0.160, TypeScript (strict), Vite, Vitest, Workbox (service worker), gltf-transform (asset optimize), Cloudflare Pages (wrangler).

**Conventions:** kinematic controller (no physics engine); flat ground at y=0 for the slice; one shared `AnimationMixer`; `MeshToonMaterial` + 3-step ramp for all models; commit after every task.

**Source assets (raw) live in** `../new_portfolio/designs/assets/gen/middle-earth/`. Optimized GLBs are committed under `public/assets/models/`.

---

## File map (created in this plan)

```
src/
  engine/input.ts            unified keyboard/pointer input state (+ pure helpers)
  engine/renderer.ts         WebGLRenderer factory
  engine/scene.ts            Scene + sky + lights + fog factory
  engine/loop.ts             requestAnimationFrame loop with dt
  world/assets.ts            GLTF+Draco loader, cache, toonify
  world/ground.ts            flat toon ground
  world/landmarks.ts         place the Shire landmark + collider
  player/gandalf.ts          kinematic controller + animation state machine (+ pure helpers)
  player/followCamera.ts     spring-arm third-person camera
  systems/interaction.ts     proximity → prompt → recall (+ pure helper)
  systems/journal.ts         visited-set progress + localStorage
  ui/loader.ts               boot loader show/hide
  ui/prompt.ts               world-anchored "press E / tap" prompt
  ui/talePanel.ts            side panel with chapter content
  ui/hud.ts                  "Tales recalled: n/total"
  ui/touchControls.ts        on-screen joystick + drag-look
  main.ts                    composition root (rewritten)
public/sw.js                 Workbox-generated service worker (build step)
```

---

## Task 0: Test runner (Vitest)

**Files:**
- Modify: `package.json`
- Create: `src/engine/sanity.test.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest@^2`
Expected: adds vitest to devDependencies.

- [ ] **Step 2: Add test script**

In `package.json` `"scripts"`, add: `"test": "vitest run"`.

- [ ] **Step 3: Write a sanity test**

Create `src/engine/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/engine/sanity.test.ts
git commit -m "test: add vitest runner"
```

---

## Task 1: Optimize & wire the Gandalf assets

The walking/running GLBs share one 24-bone skeleton (bone names: Hips, LeftUpLeg…). We ship
the **walking** rig as the canonical Gandalf (mesh + walk clip) and the **running** rig only
for its run clip. They're 116k-tri / 30 MB raw → optimize (gentle simplify, keeps skin) to ~1–2 MB.

**Files:**
- Create: `public/assets/models/gandalf-walk.glb`, `public/assets/models/gandalf-run.glb`

- [ ] **Step 1: Optimize the walking rig (canonical mesh + walk clip)**

Run (gentle ratio 0.4 keeps a hero character; texture 1024):
```bash
bash scripts/optimize-glb.sh ../new_portfolio/designs/assets/gen/middle-earth/character/gandalf_walking.glb public/assets/models/gandalf-walk.glb 0.4 1024
```
Expected: prints `gandalf-walk.glb  ~30 MB -> ~1–2 MB  (~40–50k tris)`.

- [ ] **Step 2: Optimize the running rig (for its run clip)**

```bash
bash scripts/optimize-glb.sh ../new_portfolio/designs/assets/gen/middle-earth/character/gandalf_running.glb public/assets/models/gandalf-run.glb 0.4 1024
```
Expected: similar size.

- [ ] **Step 3: Verify both keep their animation**

Run:
```bash
node -e '
const fs=require("fs");
for(const n of ["gandalf-walk","gandalf-run"]){
  const d=fs.readFileSync("public/assets/models/"+n+".glb");
  let off=12,js;
  while(off<d.length){const cl=d.readUInt32LE(off),ct=d.readUInt32LE(off+4);
    if(ct===0x4E4F534A) js=JSON.parse(d.slice(off+8,off+8+cl).toString());off+=8+cl;}
  console.log(n, "anims:", (js.animations||[]).map(a=>a.name), "skins:", (js.skins||[]).length);
}'
```
Expected: `gandalf-walk anims: [ 'Armature|Casual_Walk|baselayer' ] skins: 1` and `gandalf-run anims: [ 'Armature|running|baselayer' ] skins: 1`.

- [ ] **Step 4: Commit**

```bash
git add public/assets/models/gandalf-walk.glb public/assets/models/gandalf-run.glb
git commit -m "assets: optimized Gandalf walk rig + run clip"
```

> **Note (idle):** the static `gandalf.glb` is un-rigged, so Phase 1 idle = the rig held on a
> neutral pose (walk action, weight blended out). A proper idle clip is a Phase-2 Meshy polish
> (Gandalf is humanoid → riggable). Not a blocker for the slice.
>
> **Fallback (skin damage):** aggressive simplify can mangle skin weights. If the animation
> deforms badly in Task 10's visual check, re-run Steps 1–2 with ratio `1.0` (no simplify —
> texture resize + Draco still cut most of the size, since the bake texture is the bulk).

---

## Task 2: Input system

**Files:**
- Create: `src/engine/input.ts`, `src/engine/input.test.ts`

- [ ] **Step 1: Write failing tests for the pure move helper**

Create `src/engine/input.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { keyboardMove } from "./input";

describe("keyboardMove", () => {
  it("returns zero when no keys", () => {
    expect(keyboardMove(new Set())).toEqual({ forward: 0, right: 0 });
  });
  it("W is forward +1", () => {
    expect(keyboardMove(new Set(["KeyW"]))).toEqual({ forward: 1, right: 0 });
  });
  it("S+D combine", () => {
    expect(keyboardMove(new Set(["KeyS", "KeyD"]))).toEqual({ forward: -1, right: 1 });
  });
  it("opposite keys cancel", () => {
    expect(keyboardMove(new Set(["KeyW", "KeyS"]))).toEqual({ forward: 0, right: 0 });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL (`keyboardMove` not exported).

- [ ] **Step 3: Implement `input.ts`**

Create `src/engine/input.ts`:
```ts
export interface MoveAxes { forward: number; right: number; }

/** Pure: map held key codes to a movement axis pair in [-1,1]. */
export function keyboardMove(keys: Set<string>): MoveAxes {
  let forward = 0, right = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) right += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) right -= 1;
  return { forward, right };
}

export interface InputState {
  move: MoveAxes;     // -1..1 each axis (keyboard or joystick)
  run: boolean;
  lookDX: number;     // accumulated look delta since last consume
  lookDY: number;
  interact: boolean;  // edge-triggered this frame
}

/** Collects keyboard + pointer input; touch fills `move`/look via setters. */
export class Input {
  readonly state: InputState = { move: { forward: 0, right: 0 }, run: false, lookDX: 0, lookDY: 0, interact: false };
  private keys = new Set<string>();
  private dragging = false;
  private touchMove: MoveAxes | null = null;
  private pendingInteract = false;

  attach(dom: HTMLElement) {
    addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.state.run = true;
      if (e.code === "KeyE") this.pendingInteract = true;
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.state.run = false;
    });
    dom.addEventListener("pointerdown", (e) => { if (e.button === 0) this.dragging = true; });
    addEventListener("pointerup", () => { this.dragging = false; });
    addEventListener("pointermove", (e) => {
      if (this.dragging) { this.state.lookDX += e.movementX; this.state.lookDY += e.movementY; }
    });
  }

  /** touch joystick sets axes directly (-1..1); pass null to release. */
  setTouchMove(axes: MoveAxes | null, run = false) { this.touchMove = axes; if (axes) this.state.run = run; }
  /** touch look-drag adds deltas. */
  addLook(dx: number, dy: number) { this.state.lookDX += dx; this.state.lookDY += dy; }
  /** touch interact button. */
  triggerInteract() { this.pendingInteract = true; }

  /** call once per frame BEFORE reading state.move/interact, AFTER camera reads look. */
  beginFrame() {
    this.state.move = this.touchMove ?? keyboardMove(this.keys);
    this.state.interact = this.pendingInteract;
    this.pendingInteract = false;
  }
  /** call after camera consumes look deltas. */
  endFrame() { this.state.lookDX = 0; this.state.lookDY = 0; }
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: all `keyboardMove` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/input.ts src/engine/input.test.ts
git commit -m "feat: input system (keyboard/pointer/touch) with tested move helper"
```

---

## Task 3: Engine core (renderer, scene, loop)

Extract the smoke-test plumbing from `main.ts` into focused factories.

**Files:**
- Create: `src/engine/renderer.ts`, `src/engine/scene.ts`, `src/engine/loop.ts`

- [ ] **Step 1: `renderer.ts`**

```ts
import * as THREE from "three";
export function createRenderer(): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
```

- [ ] **Step 2: `scene.ts` (scene + sky + lights + fog)**

```ts
import * as THREE from "three";
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe7decb, 40, 140);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0xa9bcc6) }, bot: { value: new THREE.Color(0xe7decb) } },
      vertexShader: `varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float h;uniform vec3 top,bot;void main(){gl_FragColor=vec4(mix(bot,top,clamp(h*1.1+.25,0.,1.)),1.);}`,
    }),
  ));

  const sun = new THREE.DirectionalLight(0xffe7bf, 2.0);
  sun.position.set(-30, 40, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, new THREE.HemisphereLight(0xbcd0dc, 0x65763f, 1.0), new THREE.AmbientLight(0xf1e9d2, 0.3));
  return scene;
}
```

- [ ] **Step 3: `loop.ts`**

```ts
type Tick = (dt: number) => void;
export function startLoop(tick: Tick) {
  let prev = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderer.ts src/engine/scene.ts src/engine/loop.ts
git commit -m "feat: engine core (renderer, scene, loop)"
```

---

## Task 4: World — assets loader, ground, Shire landmark

**Files:**
- Create: `src/world/assets.ts`, `src/world/ground.ts`, `src/world/landmarks.ts`

- [ ] **Step 1: `assets.ts` (Draco loader + cache + toonify)**

```ts
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const cache = new Map<string, Promise<GLTF>>();
export function loadGLTF(name: string): Promise<GLTF> {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`/assets/models/${name}.glb`));
  return cache.get(name)!;
}

const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.needsUpdate = true;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
})();

/** Replace materials with toon shading; keep map+color. */
export function toonify(root: THREE.Object3D): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const mat = m.material as THREE.MeshStandardMaterial;
    m.material = new THREE.MeshToonMaterial({
      map: mat.map ?? null,
      color: mat.color?.clone() ?? new THREE.Color(0xcfc2a3),
      gradientMap: ramp,
    });
  });
  return root;
}

/** Uniform-scale an object so max(x,z) == footprint and base sits on y=0. */
export function fitToGround(obj: THREE.Object3D, footprint: number): void {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const k = footprint / Math.max(size.x, size.z);
  obj.scale.multiplyScalar(k);
  obj.position.y -= box.min.y * k;
}
```

- [ ] **Step 2: `ground.ts`**

```ts
import * as THREE from "three";
export function createGround(): THREE.Mesh {
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(140, 64),
    new THREE.MeshStandardMaterial({ color: 0x8a9c57, roughness: 1 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}
```

- [ ] **Step 3: `landmarks.ts` (place Shire + collider)**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToGround } from "./assets";

export interface Landmark { id: string; group: THREE.Group; collider: { x: number; z: number; r: number }; scrollPos: THREE.Vector3; }

export async function placeShire(scene: THREE.Scene): Promise<Landmark> {
  const gltf = await loadGLTF("shire-home");
  const group = gltf.scene as unknown as THREE.Group;
  toonify(group);
  fitToGround(group, 9);
  group.position.set(0, group.position.y, -14);
  scene.add(group);
  return {
    id: "shire",
    group,
    collider: { x: 0, z: -14, r: 5.5 },
    scrollPos: new THREE.Vector3(0, 0.5, -8.5), // in front of the door, on the path
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/world/assets.ts src/world/ground.ts src/world/landmarks.ts
git commit -m "feat: world assets loader, ground, Shire landmark"
```

---

## Task 5: Gandalf controller + animation state machine

**Files:**
- Create: `src/player/gandalf.ts`, `src/player/gandalf.test.ts`

- [ ] **Step 1: Failing tests for pure helpers**

Create `src/player/gandalf.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cameraRelativeMove, pickGait } from "./gandalf";

describe("cameraRelativeMove", () => {
  it("forward with yaw 0 goes -Z", () => {
    const v = cameraRelativeMove(1, 0, 0);
    expect(v.x).toBeCloseTo(0); expect(v.z).toBeCloseTo(-1);
  });
  it("right with yaw 0 goes +X", () => {
    const v = cameraRelativeMove(0, 1, 0);
    expect(v.x).toBeCloseTo(1); expect(v.z).toBeCloseTo(0);
  });
  it("normalizes diagonal", () => {
    const v = cameraRelativeMove(1, 1, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
});

describe("pickGait", () => {
  it("idle below walk threshold", () => { expect(pickGait(0.05, false)).toBe("idle"); });
  it("walk when moving, not running", () => { expect(pickGait(2, false)).toBe("walk"); });
  it("run when moving and run held", () => { expect(pickGait(2, true)).toBe("run"); });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL (module not found / not exported).

- [ ] **Step 3: Implement `gandalf.ts`**

```ts
import * as THREE from "three";
import { loadGLTF, toonify } from "../world/assets";
import type { InputState } from "../engine/input";

export type Gait = "idle" | "walk" | "run";

/** Pure: world-space horizontal move direction (normalized) from axes + camera yaw. */
export function cameraRelativeMove(forward: number, right: number, camYaw: number) {
  // camera looks down -Z at yaw 0; forward maps to -Z, right to +X, rotated by yaw.
  const len = Math.hypot(forward, right);
  if (len < 1e-4) return { x: 0, z: 0 };
  const fx = forward / len, rx = right / len;
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  // local (right, -forward) -> rotate by yaw about Y
  const lx = rx, lz = -fx;
  return { x: lx * cos + lz * sin, z: -lx * sin + lz * cos };
}

/** Pure: choose gait from horizontal speed + run flag. */
export function pickGait(speed: number, run: boolean): Gait {
  if (speed < 0.1) return "idle";
  return run ? "run" : "walk";
}

const WALK_SPEED = 2.6;
const RUN_SPEED = 5.6;

export class Gandalf {
  readonly root = new THREE.Group();
  private mixer!: THREE.AnimationMixer;
  private actions: Record<"walk" | "run", THREE.AnimationAction> = {} as never;
  private current: Gait = "idle";

  async load(): Promise<void> {
    const walk = await loadGLTF("gandalf-walk");
    const run = await loadGLTF("gandalf-run");
    const mesh = walk.scene;
    toonify(mesh);
    // normalize height to ~1.9 units, feet on ground
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const k = 1.9 / size.y;
    mesh.scale.setScalar(k);
    mesh.position.y -= box.min.y * k;
    this.root.add(mesh);

    this.mixer = new THREE.AnimationMixer(mesh);
    // bone names match across rigs, so the run clip plays on this mixer.
    this.actions.walk = this.mixer.clipAction(walk.animations[0]);
    this.actions.run = this.mixer.clipAction(run.animations[0]);
    this.actions.walk.play(); this.actions.walk.weight = 0;
    this.actions.run.play(); this.actions.run.weight = 0;
  }

  /** Move + animate. Returns horizontal speed. */
  update(dt: number, input: InputState, camYaw: number): number {
    const dir = cameraRelativeMove(input.move.forward, input.move.right, camYaw);
    const moving = dir.x !== 0 || dir.z !== 0;
    const speed = moving ? (input.run ? RUN_SPEED : WALK_SPEED) : 0;
    this.root.position.x += dir.x * speed * dt;
    this.root.position.z += dir.z * speed * dt;
    if (moving) this.root.rotation.y = Math.atan2(dir.x, dir.z);

    const gait = pickGait(speed, input.run);
    if (gait !== this.current) this.current = gait;
    // crossfade weights toward the active gait
    const tgt = { walk: gait === "walk" ? 1 : 0, run: gait === "run" ? 1 : 0 };
    this.actions.walk.weight += (tgt.walk - this.actions.walk.weight) * Math.min(1, dt * 10);
    this.actions.run.weight += (tgt.run - this.actions.run.weight) * Math.min(1, dt * 10);
    this.mixer.update(dt);
    return speed;
  }
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: all `cameraRelativeMove` + `pickGait` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/player/gandalf.ts src/player/gandalf.test.ts
git commit -m "feat: Gandalf kinematic controller + tested move/gait helpers"
```

---

## Task 6: Follow camera

> **Deferral:** camera-vs-world collision (raycast pull-in) is Phase-2. In a small flat slice
> with one building the damped spring-arm doesn't clip noticeably; the DoD's "no obvious
> clipping" holds. Real collision lands with the full world.

**Files:**
- Create: `src/player/followCamera.ts`

- [ ] **Step 1: Implement `followCamera.ts`**

```ts
import * as THREE from "three";
import type { Input } from "../engine/input";

export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
  private yaw = 0;
  private pitch = 0.35;
  private dist = 7;
  private readonly tmp = new THREE.Vector3();

  get yawAngle(): number { return this.yaw; }

  /** Consume look deltas, orbit, and trail the target. Call once per frame. */
  update(target: THREE.Vector3, input: Input): void {
    this.yaw -= input.state.lookDX * 0.0035;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.state.lookDY * 0.0035, 0.05, 1.2);
    const h = Math.sin(this.pitch) * this.dist;
    const r = Math.cos(this.pitch) * this.dist;
    const desired = this.tmp.set(
      target.x + Math.sin(this.yaw) * r,
      target.y + 1.6 + h,
      target.z + Math.cos(this.yaw) * r,
    );
    this.camera.position.lerp(desired, 0.18);
    this.camera.lookAt(target.x, target.y + 1.4, target.z);
  }

  resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/player/followCamera.ts
git commit -m "feat: spring-arm third-person follow camera"
```

---

## Task 7: Journal + HUD

**Files:**
- Create: `src/systems/journal.ts`, `src/systems/journal.test.ts`, `src/ui/hud.ts`

- [ ] **Step 1: Failing journal tests**

Create `src/systems/journal.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { Journal } from "./journal";

beforeEach(() => localStorage.clear());

describe("Journal", () => {
  it("starts empty", () => { expect(new Journal(["a", "b"]).count).toBe(0); });
  it("records a recall once", () => {
    const j = new Journal(["a", "b"]); j.recall("a"); j.recall("a");
    expect(j.count).toBe(1); expect(j.isVisited("a")).toBe(true);
  });
  it("persists across instances", () => {
    new Journal(["a", "b"]).recall("b");
    expect(new Journal(["a", "b"]).isVisited("b")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL (`Journal` not found). (Vitest's jsdom env provides `localStorage`; if missing, set `// @vitest-environment jsdom` at the top of the test file.)

- [ ] **Step 3: Implement `journal.ts`**

```ts
const KEY = "ej.visited";
export class Journal {
  private visited = new Set<string>();
  constructor(private readonly all: string[]) {
    try { JSON.parse(localStorage.getItem(KEY) ?? "[]").forEach((id: string) => this.visited.add(id)); } catch { /* ignore */ }
  }
  recall(id: string): void { this.visited.add(id); this.save(); }
  isVisited(id: string): boolean { return this.visited.has(id); }
  get count(): number { return this.visited.size; }
  get total(): number { return this.all.length; }
  private save(): void { try { localStorage.setItem(KEY, JSON.stringify([...this.visited])); } catch { /* ignore */ } }
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test`
Expected: Journal tests pass.

- [ ] **Step 5: Implement `hud.ts`**

```ts
export class Hud {
  private el = document.createElement("div");
  constructor() {
    this.el.id = "hud";
    this.el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;font:13px/1.4 'Iowan Old Style',Georgia,serif;letter-spacing:.06em;color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.4);pointer-events:none";
    document.body.appendChild(this.el);
  }
  set(count: number, total: number): void { this.el.textContent = `Tales recalled: ${count} / ${total}`; }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/systems/journal.ts src/systems/journal.test.ts src/ui/hud.ts
git commit -m "feat: journal progress (tested) + HUD counter"
```

---

## Task 8: Interaction — prompt, proximity, tale panel

> **Deferral:** the spec's *3D `portfolio-scroll` unfurl* on recall is a Phase-2 polish. The
> slice proves the loop with a world-anchored prompt + a scroll-styled DOM side panel. Swapping
> in the 3D scroll reveal later is additive (an animation before `panel.open`), no refactor.

**Files:**
- Create: `src/systems/interaction.ts`, `src/systems/interaction.test.ts`, `src/ui/prompt.ts`, `src/ui/talePanel.ts`

- [ ] **Step 1: Failing proximity test**

Create `src/systems/interaction.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { withinRadius } from "./interaction";

describe("withinRadius", () => {
  it("true when inside", () => { expect(withinRadius(0, 0, 1, 1, 3)).toBe(true); });
  it("false when outside", () => { expect(withinRadius(0, 0, 5, 0, 3)).toBe(false); });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `prompt.ts` (DOM prompt anchored to a world point)**

```ts
import * as THREE from "three";
export class Prompt {
  private el = document.createElement("div");
  private visible = false;
  constructor() {
    this.el.textContent = "Press E · tap to recall this tale";
    this.el.style.cssText =
      "position:fixed;z-index:6;padding:7px 13px;border-radius:999px;background:rgba(247,242,230,.92);border:1px solid #d8cba8;font:13px 'Iowan Old Style',Georgia,serif;color:#2e2a22;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .2s";
    document.body.appendChild(this.el);
  }
  showAt(world: THREE.Vector3, camera: THREE.Camera): void {
    const p = world.clone().project(camera);
    if (p.z > 1) { this.hide(); return; }
    this.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    this.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    this.el.style.opacity = "1";
    this.visible = true;
  }
  hide(): void { if (this.visible) { this.el.style.opacity = "0"; this.visible = false; } }
}
```

- [ ] **Step 4: Implement `talePanel.ts` (safe DOM — no innerHTML for data)**

```ts
import type { Stop } from "../data/career";

export class TalePanel {
  private el = document.createElement("aside");
  private onClose?: () => void;
  constructor() {
    this.el.id = "tale";
    this.el.setAttribute("inert", "");
    this.el.style.cssText =
      "position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);z-index:8;background:linear-gradient(180deg,#f4ecd8,#ece2c9);box-shadow:-12px 0 40px rgba(46,42,34,.22);transform:translateX(100%);transition:transform .45s cubic-bezier(.6,.05,.2,1);padding:60px 32px 32px;overflow-y:auto;font-family:'Iowan Old Style',Georgia,serif;color:#2e2a22";
    document.body.appendChild(this.el);
    addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  }
  open(stop: Stop, onClose: () => void): void {
    this.onClose = onClose;
    this.el.replaceChildren();
    const add = (tag: string, text: string, css: string) => {
      const n = document.createElement(tag); n.textContent = text; n.style.cssText = css; this.el.appendChild(n); return n;
    };
    const close = add("button", "✕", "position:absolute;top:16px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #d8cba8;background:none;cursor:pointer;font-size:17px");
    (close as HTMLButtonElement).onclick = () => this.close();
    add("div", stop.locale, "font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#b03a48");
    add("h2", stop.org.split("·")[0].trim(), "font-size:27px;margin:6px 0 2px");
    add("div", stop.org, "font-size:15px;opacity:.8");
    add("div", stop.era, "font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-top:4px");
    add("div", stop.headline, "font-size:19px;font-style:italic;margin:20px 0 14px;color:#5a3b2a");
    const ul = document.createElement("ul"); ul.style.cssText = "list-style:none;margin:0 0 18px;padding:0";
    for (const b of stop.bullets) {
      const li = document.createElement("li"); li.textContent = b;
      li.style.cssText = "position:relative;padding-left:18px;margin:9px 0;font-size:14.5px;line-height:1.5";
      ul.appendChild(li);
    }
    this.el.appendChild(ul);
    const chips = document.createElement("div"); chips.style.cssText = "display:flex;flex-wrap:wrap;gap:7px";
    for (const c of stop.stack) {
      const s = document.createElement("span"); s.textContent = c;
      s.style.cssText = "font-size:11.5px;border:1px solid #d8cba8;border-radius:999px;padding:4px 10px;background:rgba(255,255,255,.4)";
      chips.appendChild(s);
    }
    this.el.appendChild(chips);
    this.el.removeAttribute("inert");
    this.el.style.transform = "translateX(0)";
    (close as HTMLButtonElement).focus();
  }
  close(): void {
    this.el.style.transform = "translateX(100%)";
    this.el.setAttribute("inert", "");
    this.onClose?.(); this.onClose = undefined;
  }
  get isOpen(): boolean { return !this.el.hasAttribute("inert"); }
}
```

- [ ] **Step 5: Implement `interaction.ts`**

```ts
import * as THREE from "three";
import type { Stop } from "../data/career";
import type { Landmark } from "../world/landmarks";
import type { Input } from "../engine/input";
import type { Journal } from "./journal";
import { Prompt } from "../ui/prompt";
import { TalePanel } from "../ui/talePanel";

/** Pure: is (px,pz) within `r` of (cx,cz)? */
export function withinRadius(cx: number, cz: number, px: number, pz: number, r: number): boolean {
  return Math.hypot(px - cx, pz - cz) <= r;
}

export class Interaction {
  private prompt = new Prompt();
  private panel = new TalePanel();
  constructor(
    private readonly landmark: Landmark,
    private readonly stop: Stop,
    private readonly journal: Journal,
    private readonly onChange: () => void,
  ) {}

  /** call each frame. */
  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = withinRadius(this.landmark.collider.x, this.landmark.collider.z, playerPos.x, playerPos.z, this.landmark.collider.r + 3);
    if (near) {
      this.prompt.showAt(this.landmark.scrollPos, camera);
      if (input.state.interact) this.recall();
    } else this.prompt.hide();
  }
  private recall(): void {
    this.prompt.hide();
    this.journal.recall(this.stop.id);
    this.onChange();
    this.panel.open(this.stop, () => { /* closed */ });
  }
}
```

- [ ] **Step 6: Run, expect PASS**

Run: `npm test`
Expected: proximity test passes.

- [ ] **Step 7: Commit**

```bash
git add src/systems/interaction.ts src/systems/interaction.test.ts src/ui/prompt.ts src/ui/talePanel.ts
git commit -m "feat: proximity interaction → prompt + tale panel (tested proximity)"
```

---

## Task 9: Touch controls (joystick + drag-look)

**Files:**
- Create: `src/ui/touchControls.ts`

- [ ] **Step 1: Implement `touchControls.ts`**

```ts
import type { Input } from "../engine/input";

const isTouch = matchMedia("(pointer:coarse)").matches || "ontouchstart" in window;

/** Mounts a left-thumb joystick + right-half drag-look + an Interact button; feeds Input. */
export function mountTouchControls(input: Input): void {
  if (!isTouch) return;
  document.body.classList.add("is-touch");

  // joystick (left half)
  const base = el("position:fixed;left:26px;bottom:34px;width:120px;height:120px;border-radius:50%;background:rgba(247,242,230,.35);border:1px solid #d8cba8;z-index:7;touch-action:none");
  const knob = el("position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:rgba(46,42,34,.55)");
  base.appendChild(knob);
  document.body.appendChild(base);

  let jid = -1, cx = 0, cy = 0;
  base.addEventListener("pointerdown", (e) => { jid = e.pointerId; const r = base.getBoundingClientRect(); cx = r.left + 60; cy = r.top + 60; base.setPointerCapture(e.pointerId); });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1, max = 44;
    const cl = Math.min(len, max);
    dx = (dx / len) * cl; dy = (dy / len) * cl;
    knob.style.left = `${40 + dx}px`; knob.style.top = `${40 + dy}px`;
    input.setTouchMove({ forward: -dy / max, right: dx / max }, len > max * 0.8);
  });
  const release = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = -1; knob.style.left = "40px"; knob.style.top = "40px"; input.setTouchMove(null); };
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);

  // drag-look (right half of screen)
  let lid = -1, lx = 0, ly = 0;
  addEventListener("pointerdown", (e) => { if (e.clientX > innerWidth / 2 && lid === -1) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; } });
  addEventListener("pointermove", (e) => { if (e.pointerId === lid) { input.addLook(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; } });
  addEventListener("pointerup", (e) => { if (e.pointerId === lid) lid = -1; });

  // interact button
  const btn = el("position:fixed;right:26px;bottom:46px;z-index:7;padding:14px 20px;border-radius:999px;background:#b03a48;color:#fff;border:none;font:14px 'Iowan Old Style',Georgia,serif");
  btn.textContent = "Recall";
  btn.addEventListener("pointerdown", () => input.triggerInteract());
  document.body.appendChild(btn);
}

function el(css: string): HTMLDivElement { const d = document.createElement("div"); d.style.cssText = css; return d; }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Note: `el()` returns a div; the interact "button" is a div with a pointer handler — acceptable. If `btn.textContent` typing complains, it won't: div has textContent.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/touchControls.ts
git commit -m "feat: mobile touch controls (joystick + drag-look + recall)"
```

---

## Task 10: Compose everything in `main.ts` + boot loader

**Files:**
- Modify: `src/main.ts` (replace smoke-test), `src/ui/loader.ts` (create)

- [ ] **Step 1: `ui/loader.ts`**

```ts
export function showBoot(): HTMLElement {
  const b = document.createElement("div");
  b.id = "boot";
  b.innerHTML = `<div><div class="ring"></div><div class="lab">Mapping the realm…</div></div>`;
  document.body.appendChild(b);
  return b;
}
export function hideBoot(b: HTMLElement): void { b.classList.add("gone"); }
```

- [ ] **Step 2: Rewrite `main.ts` as the composition root**

```ts
import * as THREE from "three";
import "./styles/main.css";
import { STOPS } from "./data/career";
import { createRenderer } from "./engine/renderer";
import { createScene } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { createGround } from "./world/ground";
import { placeShire } from "./world/landmarks";
import { Gandalf } from "./player/gandalf";
import { FollowCamera } from "./player/followCamera";
import { Journal } from "./systems/journal";
import { Interaction } from "./systems/interaction";
import { Hud } from "./ui/hud";
import { mountTouchControls } from "./ui/touchControls";
import { showBoot, hideBoot } from "./ui/loader";

const app = document.getElementById("app")!;
const boot = showBoot();

const renderer = createRenderer();
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";
const scene = createScene();
scene.add(createGround());

const input = new Input();
input.attach(renderer.domElement);
mountTouchControls(input);

const cam = new FollowCamera();
const gandalf = new Gandalf();
const journal = new Journal(STOPS.map((s) => s.id));
const hud = new Hud();
hud.set(journal.count, journal.total);

(async () => {
  await gandalf.load();
  gandalf.root.position.set(0, 0, 4);
  scene.add(gandalf.root);
  const shire = await placeShire(scene);
  const shireStop = STOPS.find((s) => s.id === "shire")!;
  const interaction = new Interaction(shire, shireStop, journal, () => hud.set(journal.count, journal.total));

  startLoop((dt) => {
    input.beginFrame();
    cam.update(gandalf.root.position, input);
    gandalf.update(dt, input.state, cam.yawAngle);
    interaction.update(gandalf.root.position, cam.camera, input);
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
  hideBoot(boot);
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  cam.resize();
});
```

- [ ] **Step 3: Manual verification (desktop)**

Run: `npm run dev`, open the local URL.
Expected: boot fades; Gandalf stands near origin; **WASD walks, Shift runs**, mouse-drag orbits the camera; walking toward the Shire shows the **prompt**; **E** opens the **tale panel** with Shire content; HUD reads `Tales recalled: 1 / 6`; closing (✕/Esc) works. No console errors.

- [ ] **Step 4: Manual verification (mobile emulation)**

In the browser devtools, toggle device emulation (e.g. iPhone). Reload.
Expected: a **joystick** (bottom-left) moves Gandalf, **right-side drag** looks, **Recall** button opens the tale near the Shire.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (expect clean), then:
```bash
git add src/main.ts src/ui/loader.ts
git commit -m "feat: compose vertical slice (player + camera + Shire tale + HUD + touch)"
```

---

## Task 11: Service worker (offline/repeat-visit caching)

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: service worker via `vite-plugin-pwa`

- [ ] **Step 1: Install the PWA plugin**

Run: `npm i -D vite-plugin-pwa@^0.20`

- [ ] **Step 2: Configure it in `vite.config.ts`**

Replace the file with:
```ts
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
  server: { host: true },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/models/*.glb", "assets/img/*.png", "draco/*"],
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/") || url.pathname.startsWith("/draco/"),
            handler: "CacheFirst",
            options: { cacheName: "world-assets", expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
      manifest: {
        name: "An Engineer's Journey",
        short_name: "Journey",
        theme_color: "#e7decb",
        background_color: "#cdd6d3",
        display: "standalone",
        icons: [],
      },
    }),
  ],
});
```

- [ ] **Step 3: Build and verify the SW is emitted**

Run: `npm run build`
Expected: build succeeds; `dist/sw.js` and `dist/manifest.webmanifest` exist (`ls dist`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "feat: PWA service worker (Workbox) for asset precache"
```

---

## Task 12: Deploy to Cloudflare Pages

**Files:** none (uses `public/_headers`, already present).

> Requires the user's Cloudflare account. These steps are run by Prateek (auth happens in a browser).

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: `dist/` produced, includes `_headers`, `assets/`, `draco/`, `sw.js`.

- [ ] **Step 2: Deploy with Wrangler**

Run:
```bash
npx wrangler pages deploy dist --project-name engineers-journey
```
Expected: first run prompts `wrangler login` (opens browser); on success prints a `*.pages.dev` URL.

- [ ] **Step 3: Verify the live URL**

Open the printed `*.pages.dev` URL on **desktop and a real phone**.
Expected: the slice loads and plays; DevTools → Network shows `/assets/*` served with `Cache-Control: ...immutable`; second load serves assets from cache/SW. No console errors.

- [ ] **Step 4: Commit any config touched**

```bash
git add -A && git commit -m "chore: Cloudflare Pages deploy config" || echo "nothing to commit"
```

---

## Definition of done (Phase 1 acceptance)
- Gandalf walks/runs with correct gait blending; faces movement direction.
- Follow camera orbits via mouse/drag without obvious clipping.
- Approaching the Shire shows the prompt; E/tap opens the tale panel with real content; HUD updates.
- Playable on **desktop and a real phone** (joystick + drag-look + Recall).
- 60 fps on desktop; no console errors.
- Live on a Cloudflare Pages URL with immutable asset caching + service worker.

## Out of scope (Phase 2)
Full map terrain, the other five landmarks + Argonath, road/water/bridge, instanced forests/mountains,
the journal map overlay + fast-travel, ambient life, quality tiers, a proper idle clip, `/resume`
fallback page, audio, "journey complete" flourish.
