# Phase 2c — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real idle + gesture animations for Gandalf, a scroll reveal on tale recall (3D scroll rises + unrolling panel), a cinematic camera framing, and a file-based procedural-free audio layer.

**Architecture:** All five Gandalf clips share one rig, so `gandalf.ts` runs one mixer with a locomotion crossfade (`idle/walk/run`) plus one-shot gestures. `StopManager.recall` conducts the recall sequence (gesture → 3D scroll → unrolling panel → rustle SFX → camera focus). A small `AudioEngine` plays optional CC0 files from `public/assets/audio/`.

**Tech Stack:** TypeScript, Three.js (`AnimationMixer`, `AudioContext`), Vitest. Spec: `docs/superpowers/specs/2026-06-15-phase2c-polish-design.md`.

**Conventions:** Run `npx tsc --noEmit` + `npx vitest run` before each commit. DOM/audio/3D code is verified in-browser (not unit-tested), matching existing UI files. Commit as the repo default identity — never mention AI in messages. Branch: `phase-2c-polish`.

**Clip names** (each glb's `animations[0]`): `gandalf-walk`→`Casual_Walk`, `gandalf-run`→`running`, `gandalf-idle`→`Idle_02`, `gandalf-listening`→`Listening_Gesture`, `gandalf-one-hand-wave`→`Wave_One_Hand`. All on the same 24-bone rig / mesh `char1`.

---

### Task 1: Optimize the three new 32 MB gandalf glbs

The new clip glbs are ~32 MB each (uncompressed Meshy exports). We only use their animation clip (the mesh comes from `gandalf-walk`), so compress them in place with the existing optimizer.

**Files:** Modify (overwrite) `public/assets/models/gandalf-idle.glb`, `gandalf-listening.glb`, `gandalf-one-hand-wave.glb`.

- [ ] **Step 1: Compress each glb in place**

```bash
cd /Users/leon/WorkSpace/engineers-journey
for n in gandalf-idle gandalf-listening gandalf-one-hand-wave; do
  bash scripts/optimize-glb.sh "public/assets/models/$n.glb" "/tmp/$n.glb" 0.3 512
  mv "/tmp/$n.glb" "public/assets/models/$n.glb"
done
ls -la public/assets/models/gandalf-*.glb
```
Expected: each of the three drops from ~32 MB to ~1–3 MB; `gandalf-walk`/`gandalf-run` unchanged.

- [ ] **Step 2: Sanity-check the clip survived**

```bash
node -e '
const {readFileSync}=require("fs");
for(const n of ["gandalf-idle","gandalf-listening","gandalf-one-hand-wave"]){
  const b=readFileSync(`public/assets/models/${n}.glb`); let o=12;
  while(o<b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);
    if(t===0x4E4F534A){const j=JSON.parse(b.slice(o+8,o+8+l));console.log(n,(j.animations||[]).map(a=>a.name),"joints",(j.skins||[]).map(s=>s.joints.length));break;}
    o+=8+l;}}'
```
Expected: each still lists its animation (`Idle_02` / `Listening_Gesture` / `Wave_One_Hand`) and `joints [24]`.

- [ ] **Step 3: Commit**

```bash
git add public/assets/models/gandalf-idle.glb public/assets/models/gandalf-listening.glb public/assets/models/gandalf-one-hand-wave.glb
git commit -m "chore(assets): compress the new gandalf clip glbs (32MB -> ~2MB)"
```

---

### Task 2: Gandalf — real idle + locomotion crossfade + gestures

**Files:** Modify `src/player/gandalf.ts`; Test `src/player/gandalf.test.ts`.

- [ ] **Step 1: Add the failing test for `gaitWeights`**

Append to `src/player/gandalf.test.ts`:

```ts
import { gaitWeights } from "./gandalf";

describe("gaitWeights", () => {
  it("idle -> only idle", () => { expect(gaitWeights("idle")).toEqual({ idle: 1, walk: 0, run: 0 }); });
  it("walk -> only walk", () => { expect(gaitWeights("walk")).toEqual({ idle: 0, walk: 1, run: 0 }); });
  it("run -> only run", () => { expect(gaitWeights("run")).toEqual({ idle: 0, walk: 0, run: 1 }); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/player/gandalf.test.ts`
Expected: FAIL ("gaitWeights is not a function").

- [ ] **Step 3: Add `gaitWeights` and rework the class**

In `src/player/gandalf.ts`, add this pure function next to `pickGait`:

```ts
/** Pure: target blend weights for the locomotion clips given a gait. */
export function gaitWeights(gait: Gait): { idle: number; walk: number; run: number } {
  return { idle: gait === "idle" ? 1 : 0, walk: gait === "walk" ? 1 : 0, run: gait === "run" ? 1 : 0 };
}
```

Then replace the entire `export class Gandalf { ... }` with:

```ts
export class Gandalf {
  readonly root = new THREE.Group();
  private mixer!: THREE.AnimationMixer;
  private loco!: Record<Gait, THREE.AnimationAction>;
  private gestures!: Record<"wave" | "listening", THREE.AnimationAction>;
  private active: THREE.AnimationAction | null = null; // current gesture, if any
  private gestureTarget = 0;                            // 0 = fade out, 1 = fade in
  private hold = false;                                 // keep the gesture's end pose until released

  async load(): Promise<void> {
    const [walk, run, idle, listening, wave] = await Promise.all([
      loadGLTF("gandalf-walk"), loadGLTF("gandalf-run"), loadGLTF("gandalf-idle"),
      loadGLTF("gandalf-listening"), loadGLTF("gandalf-one-hand-wave"),
    ]);
    const mesh = walk.scene;
    toonify(mesh);
    this.root.add(mesh);

    const clip = (g: typeof walk, label: string): THREE.AnimationClip => {
      const c = g.animations[0];
      if (!c) throw new Error(`Gandalf ${label} clip missing`);
      return c;
    };
    this.mixer = new THREE.AnimationMixer(mesh);
    // every clip shares the rig's bone names, so they all retarget onto this mesh's mixer.
    this.loco = {
      idle: this.mixer.clipAction(clip(idle, "idle")),
      walk: this.mixer.clipAction(clip(walk, "walk")),
      run: this.mixer.clipAction(clip(run, "run")),
    };
    this.gestures = {
      wave: this.mixer.clipAction(clip(wave, "wave")),
      listening: this.mixer.clipAction(clip(listening, "listening")),
    };
    (["idle", "walk", "run"] as Gait[]).forEach((k) => { this.loco[k].play(); this.loco[k].weight = k === "idle" ? 1 : 0; });
    // a finished gesture that isn't being held fades back to locomotion
    this.mixer.addEventListener("finished", (e) => {
      if (e.action === this.active && !this.hold) this.gestureTarget = 0;
    });

    // Size + ground from the ANIMATED idle pose (pose-aware; Box3.setFromObject under-measures
    // this rig). Apply the idle frame, measure real skinned bounds, scale to 1.9 m, drop soles to 0.
    this.mixer.update(0);
    const poseBox = () => {
      this.root.updateMatrixWorld(true);
      const box = new THREE.Box3(), smBox = new THREE.Box3();
      mesh.traverse((o) => {
        const sm = o as THREE.SkinnedMesh;
        if (!sm.isSkinnedMesh) return;
        sm.computeBoundingBox();
        if (sm.boundingBox) box.union(smBox.copy(sm.boundingBox).applyMatrix4(sm.matrixWorld));
      });
      return box;
    };
    const raw = poseBox();
    const k = 1.9 / (raw.max.y - raw.min.y || 1);
    mesh.scale.setScalar(k);
    const grounded = poseBox();
    if (!grounded.isEmpty()) mesh.position.y -= grounded.min.y;
  }

  /** Play a one-shot gesture. hold=true keeps the end pose until releaseGesture(). */
  playGesture(name: "wave" | "listening", hold = false): void {
    const a = this.gestures[name];
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.weight = 0; a.play();
    this.active = a; this.gestureTarget = 1; this.hold = hold;
  }

  /** Release a held gesture (e.g. listening) back to locomotion. */
  releaseGesture(): void { this.gestureTarget = 0; this.hold = false; }

  /** Move + animate. Returns horizontal speed. */
  update(dt: number, input: InputState, camYaw: number, colliders: Collider[] = []): number {
    const dir = cameraRelativeMove(input.move.forward, input.move.right, camYaw);
    const moving = dir.x !== 0 || dir.z !== 0;
    const speed = moving ? (input.run ? RUN_SPEED : WALK_SPEED) : 0;
    this.root.position.x += dir.x * speed * dt;
    this.root.position.z += dir.z * speed * dt;
    if (colliders.length) {
      const p = resolveCollisions(this.root.position.x, this.root.position.z, colliders, BODY_RADIUS);
      this.root.position.x = p.x; this.root.position.z = p.z;
    }
    if (moving) this.root.rotation.y = Math.atan2(dir.x, dir.z);

    if (this.active && speed > 0.1) { this.gestureTarget = 0; this.hold = false; } // movement wins

    let gWeight = 0;
    if (this.active) {
      this.active.weight += (this.gestureTarget - this.active.weight) * Math.min(1, dt * 8);
      gWeight = this.active.weight;
      if (this.gestureTarget === 0 && gWeight < 0.02) { this.active.weight = 0; this.active.stop(); this.active = null; gWeight = 0; }
    }

    const t = gaitWeights(pickGait(speed, input.run));
    const lerp = (a: THREE.AnimationAction, target: number) => { a.weight += (target - a.weight) * Math.min(1, dt * 10); };
    lerp(this.loco.idle, t.idle * (1 - gWeight));
    lerp(this.loco.walk, t.walk * (1 - gWeight));
    lerp(this.loco.run, t.run * (1 - gWeight));

    this.mixer.update(dt);
    return speed;
  }
}
```

- [ ] **Step 4: Run tests + type-check**

Run: `npx vitest run src/player/gandalf.test.ts && npx tsc --noEmit`
Expected: gaitWeights tests pass (existing gandalf tests still pass); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/gandalf.ts src/player/gandalf.test.ts
git commit -m "feat(gandalf): real idle clip, locomotion crossfade, one-shot gestures"
```

---

### Task 3: Scroll reveal in-world

**Files:** Create `src/world/scrollReveal.ts`.

- [ ] **Step 1: Create the module**

```ts
import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ScrollReveal {
  show(x: number, z: number, faceYaw: number): void;
  hide(): void;
  update(dt: number): void;
}

/** Loads portfolio-scroll.glb (hidden); show() rises + scales it in at a spot, hide() retracts it. */
export async function buildScrollReveal(scene: THREE.Scene): Promise<ScrollReveal> {
  const g = await loadGLTF("portfolio-scroll");
  const model = (g.scene as unknown as THREE.Group).clone(true);
  toonify(model);
  fitToHeight(model, 2.4);              // ~2.4 m proclamation board
  const fullScale = model.scale.x;
  const fullY = model.position.y;
  model.visible = false;
  scene.add(model);

  let t = 0, target = 0;               // reveal progress 0..1
  const apply = () => {
    const e = t * t * (3 - 2 * t);     // smoothstep
    model.scale.setScalar(fullScale * Math.max(0.0001, e));
    model.position.y = fullY - (1 - e) * 0.6; // rise ~0.6 m as it scales in
  };

  return {
    show(x, z, faceYaw) {
      model.position.x = x; model.position.z = z; model.rotation.y = faceYaw;
      model.visible = true; target = 1;
      if (REDUCED) { t = 1; apply(); }
    },
    hide() { target = 0; if (REDUCED) { t = 0; model.visible = false; } },
    update(dt) {
      if (t === target) return;
      t += Math.sign(target - t) * Math.min(Math.abs(target - t), dt * 3); // ~0.33 s
      apply();
      if (t <= 0) model.visible = false;
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/world/scrollReveal.ts
git commit -m "feat(scroll): 3D portfolio-scroll rise/retract reveal"
```

---

### Task 4: Tale panel — unrolling reveal

**Files:** Modify `src/ui/talePanel.ts`.

- [ ] **Step 1: Make the panel unroll instead of slide**

In `src/ui/talePanel.ts`, at the top of the file (after the import) add:

```ts
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
```

In the constructor, replace the `this.el.style.cssText = "...transform:translateX(100%);transition:transform .45s cubic-bezier(.6,.05,.2,1);..."` assignment with one that uses an unrolling `clip-path` instead of the slide:

```ts
    this.el.style.cssText =
      "position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);z-index:8;background:linear-gradient(180deg,#f4ecd8,#ece2c9);box-shadow:-12px 0 40px rgba(46,42,34,.22);clip-path:inset(0 0 100% 0);" +
      (REDUCED ? "" : "transition:clip-path .55s cubic-bezier(.6,.05,.2,1);") +
      "padding:60px 32px 32px;overflow-y:auto;font-family:'Iowan Old Style',Georgia,serif;color:#2e2a22";
```

In `open(...)`, replace `this.el.style.transform = "translateX(0)";` with:

```ts
    this.el.style.clipPath = "inset(0 0 0 0)"; // unroll top -> bottom
```

In `close()`, replace `this.el.style.transform = "translateX(100%)";` with:

```ts
    this.el.style.clipPath = "inset(0 0 100% 0)"; // roll back up
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/talePanel.ts
git commit -m "feat(tale): unroll the panel (clip-path) instead of sliding"
```

---

### Task 5: Camera — cinematic focus on recall

**Files:** Modify `src/player/followCamera.ts`.

- [ ] **Step 1: Add a `focus` mode that eases the camera in**

In `src/player/followCamera.ts`, after the import line add:

```ts
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Add a field + method to the class (next to `get yawAngle`):

```ts
  private focused = false;
  /** When on, the camera eases closer to frame the tale scroll; off restores normal follow. */
  focus(on: boolean): void { this.focused = on; }
```

In `update(...)`, immediately after the first two lines (`this.yaw -= ...; this.pitch = ...;`) insert a dist ease toward the focus distance, and use that field for `h`/`r`:

```ts
    const targetDist = this.focused ? 6.5 : 11;
    this.dist += (targetDist - this.dist) * (REDUCED ? 1 : 1 - Math.exp(-dt * 5));
```

(`this.dist` already exists; the existing `const h = Math.sin(this.pitch) * this.dist;` / `const r = Math.cos(this.pitch) * this.dist;` now use the eased value.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/player/followCamera.ts
git commit -m "feat(camera): cinematic push-in focus for tale recall"
```

---

### Task 6: Audio engine (file-based) + footstep cadence

**Files:** Create `src/audio/audioEngine.ts`; Test `src/audio/audioEngine.test.ts`.

- [ ] **Step 1: Failing test for `footstepDue`**

```ts
// src/audio/audioEngine.test.ts
import { describe, it, expect } from "vitest";
import { footstepDue } from "./audioEngine";

describe("footstepDue", () => {
  it("never fires when idle", () => { expect(footstepDue(99, "idle")).toBe(false); });
  it("fires after a walk stride, not before", () => {
    expect(footstepDue(0.3, "walk")).toBe(false);
    expect(footstepDue(0.7, "walk")).toBe(true);
  });
  it("needs a longer stride at a run", () => {
    expect(footstepDue(0.7, "run")).toBe(false);
    expect(footstepDue(1.0, "run")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/audio/audioEngine.test.ts`
Expected: FAIL ("footstepDue is not a function").

- [ ] **Step 3: Implement the engine**

```ts
// src/audio/audioEngine.ts
import type { Gait } from "../player/gandalf";

/** Pure: should a footstep fire given distance walked since the last step + gait? */
export function footstepDue(dist: number, gait: Gait): boolean {
  if (gait === "idle") return false;
  return dist >= (gait === "run" ? 0.95 : 0.65);
}

const FILES = ["ambient", "footstep", "footstep-1", "footstep-2", "footstep-3", "scroll", "click"];

/** Plays optional CC0 files from public/assets/audio/. Any missing file is a silent no-op. */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private buffers: Record<string, AudioBuffer | null> = {};
  private ambientOn = false;
  private muted = localStorage.getItem("ej.muted") === "1";

  /** Create/resume the context on the first user gesture, then load files + start ambient. */
  async start(): Promise<void> {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    await Promise.all(FILES.map(async (n) => {
      try {
        const res = await fetch(`/assets/audio/${n}.ogg`);
        this.buffers[n] = res.ok ? await this.ctx!.decodeAudioData(await res.arrayBuffer()) : null;
      } catch { this.buffers[n] = null; }
    }));
    this.ambient();
  }

  private play(name: string, gain: number, loop = false): AudioBufferSourceNode | null {
    if (!this.ctx || !this.master || !this.buffers[name]) return null;
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers[name]; src.loop = loop;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.master); src.start();
    return src;
  }

  ambient(): void { if (!this.ambientOn && this.play("ambient", 0.35, true)) this.ambientOn = true; }
  footstep(): void {
    const v = ["footstep-1", "footstep-2", "footstep-3"].filter((n) => this.buffers[n]);
    this.play(v.length ? v[Math.floor(Math.random() * v.length)] : "footstep", 0.5);
  }
  scroll(): void { this.play("scroll", 0.6); }
  click(): void { this.play("click", 0.5); }

  get isMuted(): boolean { return this.muted; }
  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem("ej.muted", m ? "1" : "0");
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }
}
```

- [ ] **Step 4: Run tests + type-check**

Run: `npx vitest run src/audio/audioEngine.test.ts && npx tsc --noEmit`
Expected: 3 footstepDue tests pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/audio/audioEngine.ts src/audio/audioEngine.test.ts
git commit -m "feat(audio): file-based audio engine + footstep cadence"
```

---

### Task 7: HUD mute toggle

**Files:** Modify `src/ui/hud.ts`.

- [ ] **Step 1: Add a mute button**

Replace `src/ui/hud.ts` with:

```ts
export class Hud {
  private el = document.createElement("div");
  readonly mapBtn = document.createElement("button");
  readonly muteBtn = document.createElement("button");
  constructor() {
    this.el.id = "hud";
    this.el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;font:13px/1.4 'Iowan Old Style',Georgia,serif;letter-spacing:.06em;color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.4);pointer-events:none";
    const btn = "z-index:7;font:12px/1 'Iowan Old Style',Georgia,serif;letter-spacing:.08em;color:#2e2a22;background:rgba(244,236,216,.92);border:1px solid #d8cba8;border-radius:999px;padding:9px 15px;cursor:pointer";
    this.mapBtn.textContent = "Map (M)";
    this.mapBtn.setAttribute("aria-label", "Open the journey map");
    this.mapBtn.style.cssText = `position:fixed;top:12px;right:14px;${btn}`;
    this.muteBtn.setAttribute("aria-label", "Toggle sound");
    this.muteBtn.style.cssText = `position:fixed;top:12px;right:104px;${btn}`;
    document.body.append(this.el, this.mapBtn, this.muteBtn);
  }
  set(count: number, total: number): void { this.el.textContent = `Tales recalled: ${count} / ${total}`; }
  onMap(fn: () => void): void { this.mapBtn.onclick = fn; }
  onMute(fn: () => void): void { this.muteBtn.onclick = fn; }
  setMuted(muted: boolean): void { this.muteBtn.textContent = muted ? "Sound: off" : "Sound: on"; }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat(hud): sound mute toggle button"
```

---

### Task 8: Recall orchestration in StopManager

**Files:** Modify `src/systems/interaction.ts`.

- [ ] **Step 1: Inject the recall effects and conduct the sequence**

In `src/systems/interaction.ts`, add an effects interface above the class:

```ts
/** The presentation effects the recall sequence drives (kept behind an interface so the
 *  manager stays decoupled from Gandalf/camera/audio/scroll concretes). */
export interface RecallFx {
  gandalf: { playGesture(name: "wave" | "listening", hold?: boolean): void; releaseGesture(): void };
  scroll: { show(x: number, z: number, faceYaw: number): void; hide(): void };
  camera: { focus(on: boolean): void };
  audio: { scroll(): void };
}
```

Change the constructor to accept `fx` and track the last player position, and make `recall` conduct the sequence. Replace the class body's constructor + `recall` (keep `update`/`rangeFor` but have `update` record the player position) so the relevant parts read:

```ts
  private flat: { id: string; x: number; z: number }[];
  private lastX = 0; private lastZ = 0;
  constructor(
    private readonly placed: PlacedStop[],
    private readonly content: Record<string, Stop>,
    private readonly journal: Journal,
    private readonly onChange: () => void,
    private readonly fx: RecallFx,
  ) {
    this.flat = placed.map((p) => ({ id: p.id, x: p.collider.x, z: p.collider.z }));
  }

  /** true while a tale panel is open (used by the loop to freeze movement). */
  get isPanelOpen(): boolean { return this.panel.isOpen; }

  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    this.lastX = playerPos.x; this.lastZ = playerPos.z;
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = nearestStop(playerPos.x, playerPos.z, this.flat, this.rangeFor());
    if (!near) { this.prompt.hide(); return; }
    const ps = this.placed.find((p) => p.id === near.id)!;
    this.prompt.showAt(ps.scrollPos, camera);
    if (input.state.interact) this.recall(near.id);
  }

  private rangeFor(): number { return 14; }

  private recall(id: string): void {
    const tale = this.content[id];
    if (!tale) { console.warn(`no tale content for stop "${id}"`); return; }
    const ps = this.placed.find((p) => p.id === id)!;
    const sx = ps.scrollPos.x, sz = ps.scrollPos.z;
    this.prompt.hide();
    this.journal.recall(id);
    this.onChange();
    this.fx.gandalf.playGesture("listening", true);
    this.fx.scroll.show(sx, sz, Math.atan2(this.lastX - sx, this.lastZ - sz)); // face the player
    this.fx.audio.scroll();
    this.fx.camera.focus(true);
    this.panel.open(tale, () => {
      this.fx.camera.focus(false);
      this.fx.scroll.hide();
      this.fx.gandalf.releaseGesture();
    });
  }
```

- [ ] **Step 2: Type-check (expect it to flag main.ts next task)**

Run: `npx tsc --noEmit`
Expected: error in `src/main.ts` (StopManager now needs the `fx` arg) — that is fixed in Task 9. The `interaction.ts` file itself must have no errors.

- [ ] **Step 3: Commit**

```bash
git add src/systems/interaction.ts
git commit -m "feat(recall): orchestrate gesture + scroll + camera + sound on recall"
```

---

### Task 9: Wire it all in main.ts

**Files:** Modify `src/main.ts`.

- [ ] **Step 1: Add imports**

After the existing imports in `src/main.ts`, add:

```ts
import { buildScrollReveal } from "./world/scrollReveal";
import { AudioEngine, footstepDue } from "./audio/audioEngine";
import { pickGait } from "./player/gandalf";
```

- [ ] **Step 2: Create audio + scroll, start audio on first gesture**

Replace `hud.set(journal.count, journal.total);` (right after `const hud = new Hud();`) with:

```ts
hud.set(journal.count, journal.total);

const audio = new AudioEngine();
hud.setMuted(audio.isMuted);
hud.onMute(() => { audio.setMuted(!audio.isMuted); hud.setMuted(audio.isMuted); });
addEventListener("pointerdown", () => void audio.start(), { once: true });
addEventListener("keydown", () => void audio.start(), { once: true });
```

- [ ] **Step 3: Build the scroll reveal and pass fx to StopManager**

Replace the line
`const stops = new StopManager(landmarks.stops, content, journal, () => hud.set(journal.count, journal.total));`
with:

```ts
  const scroll = await buildScrollReveal(scene);
  const stops = new StopManager(landmarks.stops, content, journal, () => hud.set(journal.count, journal.total), {
    gandalf, scroll, camera: cam, audio,
  });
```

- [ ] **Step 4: Wave on spawn**

Immediately after `scene.add(gandalf.root);` (the spawn block), add:

```ts
  gandalf.playGesture("wave");
```

- [ ] **Step 5: Freeze movement while a tale is open, advance the scroll, play footsteps**

Replace the whole `startLoop((dt) => { ... });` block with:

```ts
  let footDist = 0;
  startLoop((dt) => {
    elapsed += dt;
    input.beginFrame();
    if (!map.isOpen) {
      const frozen = stops.isPanelOpen; // tale open: stop walking, keep animating + camera easing
      const moveInput = frozen
        ? { move: { forward: 0, right: 0 }, run: false, lookDX: 0, lookDY: 0, interact: false }
        : input.state;
      const speed = gandalf.update(dt, moveInput, cam.yawAngle, colliders);
      if (!frozen) gandalf.root.position.y = bridgeHeight(gandalf.root.position.x, gandalf.root.position.z);
      followSun(scene, gandalf.root.position.x, gandalf.root.position.z);
      cam.update(gandalf.root.position, input, dt, landmarks.obstacles);
      cullTreesNearCamera(cam.camera.position.x, cam.camera.position.z, 5);
      grassWind?.(elapsed);
      scroll.update(dt);
      landmarks.update(gandalf.root.position);
      stops.update(gandalf.root.position, cam.camera, input);
      if (!frozen) {
        footDist += speed * dt;
        if (footstepDue(footDist, pickGait(speed, input.state.run))) { audio.footstep(); footDist = 0; }
      }
    }
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
```

- [ ] **Step 6: Sound on map open**

In the `hud.onMap(...)` handler and the `KeyM` keydown handler, add `audio.click();` when opening. Specifically change:

```ts
  hud.onMap(() => { audio.click(); map.open(gandalf.root.position.x, gandalf.root.position.z); });
```
and in the `KeyM` listener, the open branch:
```ts
    if (map.isOpen) map.close();
    else { audio.click(); map.open(gandalf.root.position.x, gandalf.root.position.z); }
```

- [ ] **Step 7: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all vitest pass, build succeeds.

- [ ] **Step 8: Verify in the browser**

Run `npm run dev`, open `http://localhost:5173`, wait for load, then check:
1. **Spawn:** Gandalf plays a one-hand wave, then settles into a natural standing idle (no frozen mid-stride).
2. **Walk/run:** smooth crossfade idle→walk→run; with audio unmuted (after a click), footsteps play in cadence.
3. **Recall a tale** (walk to a village, press E): Gandalf plays the listening gesture, the 3D scroll rises at the spot, the panel unrolls top→down with the tale, a rustle plays, and the camera eases in. Walking is frozen while it's open.
4. **Close** (✕/Esc): panel rolls up, scroll retracts, camera returns, Gandalf goes back to idle.
5. **Sound toggle:** the HUD "Sound: on/off" button mutes/unmutes and persists across reload.
6. With **no files** in `public/assets/audio/`, everything still works silently (no console errors besides benign fetch 404s).

Capture a screenshot of an open recall (scroll + panel) for the review.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts
git commit -m "feat(2c): wire idle/gestures, scroll reveal, camera focus, audio"
```

---

## After all tasks
- `npx tsc --noEmit && npx vitest run && npm run build` — all green.
- Push the branch, open a PR into `main` (the `ci` check must pass; Cloudflare builds a preview).
- Drop CC0 audio files into `public/assets/audio/` (`ambient.ogg`, `footstep.ogg`, `scroll.ogg`, `click.ogg`) any time — no rebuild of code needed.
- This completes the Phase 2 arc (2a world, 2b map, 2c polish).
