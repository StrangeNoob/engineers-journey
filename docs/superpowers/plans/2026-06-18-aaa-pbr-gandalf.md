# AAA New PBR Gandalf Implementation Plan (Milestone 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the re-textured stand-in Gandalf with a new high-quality PBR character, merged from the user's GLBs into one `gandalf.glb`, loaded with clip-by-name + graceful idle fallback, preserving the model's PBR maps and the existing scale/blend/gameplay.

**Architecture:** A pure clip-resolver and a PBR-preserving material function are built and unit-tested first. The loader is rewritten to prefer a single merged `gandalf.glb` but gracefully fall back to today's five separate GLBs, so the app stays runnable before the new model exists. An offline `gltf-transform` script merges the user's GLBs into the single file. Final asset integration (run merge, calibrate facing, verify, delete orphans) is gated on the user's model.

**Tech Stack:** TypeScript, Three.js `0.160`, `@gltf-transform/core` (build-time, new devDep), Vitest, Vite.

## Global Constraints

- **No new RUNTIME dependency.** `@gltf-transform/core` is a **devDependency** (build-time merge only; not bundled).
- **Graceful asset gating:** the app must build and run *before* `gandalf.glb` exists — the loader prefers the merged file and falls back to the existing five `gandalf-*.glb`. Do NOT delete the five files in the code tasks.
- **Preserve behavior:** the `AnimationMixer`, gait crossfade (idle/walk/run), gesture blend (wave/listening), `timeScale` tuning, pose-aware **1.9 m** auto-scale, and sole-drop in `gandalf.ts` stay functionally unchanged.
- **Roles:** `Role = "idle" | "walk" | "run" | "wave" | "listening"`. `idle` is the required floor; any other missing role falls back to `idle`; a missing `idle` is a hard error.
- **Merged clip names:** lowercase role names (`idle`, `walk`, `run`, `wave`, `listening`).
- **Commit messages:** plain, NO Claude/AI attribution (no `Co-Authored-By`, no "Generated with" line).
- **Tests are pure/node:** unit-test pure functions and plain Three objects (materials, `AnimationClip` construct without WebGL). GPU/asset behavior is browser-verified.
- **Existing suite stays green**; typecheck clean; `npm run build` warning-free.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/world/materials.ts` | modify | Add `usePBRMaterials(root, cfg)` — preserve a model's shipped PBR maps; fall back to re-texture for toon/basic source materials. |
| `src/world/materials.test.ts` | modify | Tests for `usePBRMaterials`. |
| `src/player/gandalf.ts` | modify | Add pure `resolveClips`; rewrite `load()` to prefer `gandalf.glb` (named clips) with a 5-GLB fallback; use `usePBRMaterials`; apply `MODEL_FACING_OFFSET`. |
| `src/player/gandalf.test.ts` | modify | Tests for `resolveClips`. |
| `scripts/merge-gandalf.mjs` | create | `@gltf-transform/core` merge: user GLBs → one `public/assets/models/gandalf.glb` with named clips; validates shared skeleton. |
| `package.json` | modify | `merge:gandalf` script + `@gltf-transform/core` devDep. |
| `assets-src/gandalf/` | (user) | Drop location for the source GLBs (gitignored — raw art, not committed). |
| `public/assets/models/gandalf.glb` | (asset task) | The merged character. |

---

## Task 1: PBR-preserving material function

**Files:**
- Modify: `src/world/materials.ts`
- Test: `src/world/materials.test.ts`

**Interfaces:**
- Consumes: `PBRConfig`, `buildStandardMaterialParams`, `colorSpaceForSlot` (existing in `materials.ts`); `THREE`.
- Produces: `usePBRMaterials(root: THREE.Object3D, cfg: PBRConfig): THREE.Object3D` — preserves shipped PBR materials (keeps normal/roughness/metalness/ao maps, fixes color spaces, sets shadows + envMapIntensity); converts toon/basic source materials to `MeshStandardMaterial` (preserving albedo), like `applyPBR`.

- [ ] **Step 1: Write the failing test** — append to `src/world/materials.test.ts`:

```typescript
import { usePBRMaterials } from "./materials";

describe("usePBRMaterials", () => {
  it("preserves a shipped PBR material and fixes map color spaces", () => {
    const normal = new THREE.Texture(); const albedo = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map: albedo, normalMap: normal });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const root = new THREE.Group(); root.add(mesh);
    usePBRMaterials(root, { envMapIntensity: 1.0 });
    expect(mesh.material).toBe(mat);                       // same instance kept
    expect((mesh.material as THREE.MeshStandardMaterial).normalMap).toBe(normal);
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(albedo.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mesh.castShadow).toBe(true);
  });
  it("converts a toon/basic source material to MeshStandardMaterial", () => {
    const albedo = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshToonMaterial({ map: albedo }));
    const root = new THREE.Group(); root.add(mesh);
    usePBRMaterials(root, { roughness: 0.85 });
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(albedo);
    expect(mesh.receiveShadow).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/materials.test.ts`
Expected: FAIL — `usePBRMaterials` not exported.

- [ ] **Step 3: Implement** — append to `src/world/materials.ts`:

```typescript
/**
 * Character/material prep that KEEPS a model's shipped PBR maps. If a mesh's material is a
 * MeshStandardMaterial already carrying PBR maps (normal/roughness/metalness), keep it and
 * just fix color spaces + shadow flags + envMapIntensity. Otherwise re-texture to PBR
 * (preserving the albedo), like applyPBR.
 */
export function usePBRMaterials(root: THREE.Object3D, cfg: PBRConfig): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    m.castShadow = m.receiveShadow = true;
    const mat = m.material as THREE.MeshStandardMaterial;
    const hasPBR = mat.isMeshStandardMaterial && !!(mat.normalMap || mat.roughnessMap || mat.metalnessMap);
    if (hasPBR) {
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      for (const t of [mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap]) {
        if (t) t.colorSpace = THREE.NoColorSpace;
      }
      mat.envMapIntensity = cfg.envMapIntensity ?? 1.0;
      mat.needsUpdate = true;
    } else {
      const prev = mat as THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
      const albedo = (prev as THREE.MeshStandardMaterial).map ?? undefined;
      if (albedo) albedo.colorSpace = THREE.SRGBColorSpace;
      m.material = new THREE.MeshStandardMaterial({
        ...buildStandardMaterialParams({ ...cfg, color: cfg.color ?? prev.color?.getHex() }),
        map: albedo ?? null,
      });
      (m.material as THREE.Material).needsUpdate = true;
    }
  });
  return root;
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/world/materials.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/world/materials.ts src/world/materials.test.ts
git commit -m "feat(materials): usePBRMaterials preserves a model's shipped PBR maps"
```

---

## Task 2: Pure clip resolver

**Files:**
- Modify: `src/player/gandalf.ts`
- Test: `src/player/gandalf.test.ts`

**Interfaces:**
- Consumes: `THREE`.
- Produces: `type Role = "idle" | "walk" | "run" | "wave" | "listening"`; `resolveClips(roles: Role[], clipsByName: Map<string, THREE.AnimationClip>): Record<Role, THREE.AnimationClip>` — each role → its clip, else the `idle` clip; throws if `idle` is absent.

- [ ] **Step 1: Write the failing test** — append to `src/player/gandalf.test.ts`:

```typescript
import * as THREE from "three";
import { resolveClips, type Role } from "./gandalf";

const clip = (name: string) => new THREE.AnimationClip(name, -1, []);
const ROLES: Role[] = ["idle", "walk", "run", "wave", "listening"];

describe("resolveClips", () => {
  it("maps each role to its own clip when all are present", () => {
    const map = new Map(ROLES.map((r) => [r, clip(r)]));
    const got = resolveClips(ROLES, map);
    for (const r of ROLES) expect(got[r].name).toBe(r);
  });
  it("falls back to idle for any missing role", () => {
    const map = new Map([["idle", clip("idle")], ["walk", clip("walk")]]);
    const got = resolveClips(ROLES, map);
    expect(got.walk.name).toBe("walk");
    expect(got.run.name).toBe("idle");       // fallback
    expect(got.listening.name).toBe("idle"); // fallback
  });
  it("throws when idle is missing", () => {
    expect(() => resolveClips(ROLES, new Map([["walk", clip("walk")]]))).toThrow(/idle/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/player/gandalf.test.ts`
Expected: FAIL — `resolveClips`/`Role` not exported.

- [ ] **Step 3: Implement** — in `src/player/gandalf.ts`, add near the top (after the `Gait` type):

```typescript
export type Role = "idle" | "walk" | "run" | "wave" | "listening";

/** Pure: resolve each role to its same-named clip, else fall back to `idle`. Missing idle throws. */
export function resolveClips(
  roles: Role[],
  clipsByName: Map<string, THREE.AnimationClip>,
): Record<Role, THREE.AnimationClip> {
  const idle = clipsByName.get("idle");
  if (!idle) throw new Error("Gandalf model has no 'idle' animation clip");
  const out = {} as Record<Role, THREE.AnimationClip>;
  for (const r of roles) out[r] = clipsByName.get(r) ?? idle;
  return out;
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/player/gandalf.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/player/gandalf.ts src/player/gandalf.test.ts
git commit -m "feat(gandalf): pure resolveClips with idle fallback"
```

---

## Task 3: Loader rewrite (single GLB preferred, 5-GLB fallback)

**Files:**
- Modify: `src/player/gandalf.ts`

**Interfaces:**
- Consumes: `loadGLTF` (existing), `resolveClips`/`Role` (Task 2), `usePBRMaterials` (Task 1).
- Produces: an updated `Gandalf.load()`; a private `loadModel()` returning `{ mesh: THREE.Object3D, clips: Map<string, THREE.AnimationClip> }`; a `MODEL_FACING_OFFSET` constant.

- [ ] **Step 1: Add the facing constant + import** — in `src/player/gandalf.ts`, change the materials import and add the constant near the other consts:

```typescript
import { applyPBR, usePBRMaterials } from "../world/materials";
// ...near WALK_SPEED etc.:
// Y-rotation (radians) applied to the model so its authored forward matches the movement
// convention (root.rotation.y = atan2(dir.x, dir.z)). Calibrated in-browser; 0 if already aligned.
const MODEL_FACING_OFFSET = 0;
```

(Keep `applyPBR` imported — `usePBRMaterials` uses the same module; `applyPBR` may still be used by landmarks. If `applyPBR` is now unused *in gandalf.ts*, drop it from this import to satisfy `noUnusedLocals` — it remains exported from `materials.ts`.)

- [ ] **Step 2: Add the model loader + rewrite `load()`** — replace the body of `async load()` (the part that loads the 5 GLBs, applies PBR, builds the mixer) so it uses `loadModel()` + `resolveClips`. Add this private method and update `load()`:

```typescript
  /** Prefer a single merged gandalf.glb (named clips); fall back to the five legacy GLBs. */
  private async loadModel(): Promise<{ mesh: THREE.Object3D; clips: Map<string, THREE.AnimationClip> }> {
    try {
      const g = await loadGLTF("gandalf");
      if (g.animations.length > 0) {
        const clips = new Map(g.animations.map((c) => [c.name.toLowerCase(), c]));
        return { mesh: g.scene, clips };
      }
    } catch { /* no merged model yet — fall back to the legacy five */ }
    const [walk, run, idle, listening, wave] = await Promise.all([
      loadGLTF("gandalf-walk"), loadGLTF("gandalf-run"), loadGLTF("gandalf-idle"),
      loadGLTF("gandalf-listening"), loadGLTF("gandalf-one-hand-wave"),
    ]);
    const first = (g: { animations: THREE.AnimationClip[] }, label: string) => {
      const c = g.animations[0];
      if (!c) throw new Error(`Gandalf ${label} clip missing`);
      return c;
    };
    const clips = new Map<string, THREE.AnimationClip>([
      ["idle", first(idle, "idle")], ["walk", first(walk, "walk")], ["run", first(run, "run")],
      ["wave", first(wave, "wave")], ["listening", first(listening, "listening")],
    ]);
    return { mesh: walk.scene, clips };
  }

  async load(): Promise<void> {
    const { mesh, clips } = await this.loadModel();
    usePBRMaterials(mesh, { roughness: 0.85, metalness: 0.0 });
    this.root.add(mesh);

    const resolved = resolveClips(["idle", "walk", "run", "wave", "listening"], clips);
    this.mixer = new THREE.AnimationMixer(mesh);
    this.loco = {
      idle: this.mixer.clipAction(resolved.idle),
      walk: this.mixer.clipAction(resolved.walk),
      run: this.mixer.clipAction(resolved.run),
    };
    this.gestures = {
      wave: this.mixer.clipAction(resolved.wave),
      listening: this.mixer.clipAction(resolved.listening),
    };
    (["idle", "walk", "run"] as Gait[]).forEach((k) => { this.loco[k].play(); this.loco[k].weight = k === "idle" ? 1 : 0; });
    this.loco.walk.timeScale = WALK_SPEED / WALK_CLIP_SPEED;
    this.loco.run.timeScale = RUN_SPEED / RUN_CLIP_SPEED;
    Object.values(this.gestures).forEach((a) => { a.weight = 0; });
    this.mixer.addEventListener("finished", (e) => {
      if (e.action === this.active && !this.hold) this.gestureTarget = 0;
    });

    // Size + ground from the ANIMATED idle pose (pose-aware), then apply the facing offset.
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
    mesh.rotation.y += MODEL_FACING_OFFSET;
  }
```

(Delete the old 5-GLB-loading body of `load()` that this replaces. Keep the class fields `mixer`, `loco`, `gestures`, `active`, `gestureTarget`, `hold`, `update()`, `playGesture()`, `releaseGesture()` unchanged.)

- [ ] **Step 3: Verify suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; build succeeds. (At runtime, `gandalf.glb` does not exist yet, so `loadModel` falls back to the five legacy GLBs — the existing Gandalf still works.)

- [ ] **Step 4: Browser smoke (controller, optional now)**

`npm run dev`: Gandalf still loads/animates exactly as before (the legacy fallback path), 0 console errors. Confirms the rewrite didn't regress the current character.

- [ ] **Step 5: Commit**

```bash
git add src/player/gandalf.ts
git commit -m "feat(gandalf): single-GLB loader with clip-by-name + legacy 5-GLB fallback"
```

---

## Task 4: Offline merge script

**Files:**
- Create: `scripts/merge-gandalf.mjs`
- Modify: `package.json`
- Create/modify: `.gitignore` (ignore `assets-src/`)

**Interfaces:**
- Consumes: `@gltf-transform/core` (new devDep).
- Produces: `npm run merge:gandalf` → reads GLBs in `assets-src/gandalf/`, writes `public/assets/models/gandalf.glb` with named clips.

- [ ] **Step 1: Add the devDependency + script**

```bash
npm install --save-dev @gltf-transform/core
```

Then add to `package.json` "scripts": `"merge:gandalf": "node scripts/merge-gandalf.mjs"`. Add `assets-src/` to `.gitignore` (raw source art is not committed).

- [ ] **Step 2: Write the merge script** — create `scripts/merge-gandalf.mjs`:

```javascript
// Merge the user's Gandalf GLBs (shared skeleton) in assets-src/gandalf/ into one
// public/assets/models/gandalf.glb with clips named by role. Run: npm run merge:gandalf
//
// Convention: each input filename contains a role keyword (idle/walk/run/wave/listening).
// The `idle` file (or the first file) provides the base skinned mesh + skeleton; every other
// file's animation is grafted onto the base skeleton by matching bone (node) names.
import { NodeIO } from "@gltf-transform/core";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "assets-src/gandalf";
const OUT = "public/assets/models/gandalf.glb";
const ROLES = ["idle", "walk", "run", "wave", "listening"];

const roleOf = (file) => ROLES.find((r) => file.toLowerCase().includes(r)) ?? null;
const boneNames = (doc) =>
  new Set(doc.getRoot().listNodes().filter((n) => n.listChannels?.().length === undefined ? false : false)
    .map((n) => n.getName())); // placeholder; real bone set computed below

async function main() {
  const io = new NodeIO();
  const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".glb"));
  if (!files.length) throw new Error(`no .glb files in ${SRC}/`);

  const tagged = files.map((f) => ({ f, role: roleOf(f) })).filter((x) => x.role);
  const baseEntry = tagged.find((x) => x.role === "idle") ?? tagged[0];
  if (!baseEntry) throw new Error("no input file matched a role keyword (idle/walk/run/wave/listening)");

  const base = await io.read(join(SRC, baseEntry.f));
  const baseNodes = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]));
  const baseBones = new Set(baseNodes.keys());

  for (const { f, role } of tagged) {
    const isBase = f === baseEntry.f;
    const doc = isBase ? base : await io.read(join(SRC, f));

    if (!isBase) {
      const names = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
      const missing = [...names].filter((n) => doc.getRoot().listSkins().length && !baseBones.has(n));
      // Validate that the animated bones exist in the base skeleton.
      const animatedMissing = new Set();
      for (const anim of doc.getRoot().listAnimations()) {
        for (const ch of anim.listChannels()) {
          const tn = ch.getTargetNode()?.getName();
          if (tn && !baseBones.has(tn)) animatedMissing.add(tn);
        }
      }
      if (animatedMissing.size) {
        throw new Error(`Skeleton mismatch in ${f}: bones not in base skeleton: ${[...animatedMissing].join(", ")}`);
      }
    }

    // Re-create each animation in the base document, rebinding channels to base nodes by name.
    for (const anim of doc.getRoot().listAnimations()) {
      const out = base.createAnimation(role);
      for (const ch of anim.listChannels()) {
        const targetName = ch.getTargetNode()?.getName();
        const target = targetName ? baseNodes.get(targetName) : null;
        if (!target) continue;
        const srcS = ch.getSampler();
        const input = base.createAccessor().setType(srcS.getInput().getType())
          .setArray(srcS.getInput().getArray().slice()).setBuffer(base.getRoot().listBuffers()[0]);
        const output = base.createAccessor().setType(srcS.getOutput().getType())
          .setArray(srcS.getOutput().getArray().slice()).setBuffer(base.getRoot().listBuffers()[0]);
        const sampler = base.createAnimationSampler()
          .setInput(input).setOutput(output).setInterpolation(srcS.getInterpolation());
        out.addSampler(sampler);
        out.addChannel(base.createAnimationChannel().setTargetNode(target)
          .setTargetPath(ch.getTargetPath()).setSampler(sampler));
      }
      if (isBase) anim.dispose(); // replace the base's own animation with the renamed copy
    }
  }

  await io.write(OUT, base);
  const clipNames = base.getRoot().listAnimations().map((a) => a.getName());
  console.log(`Wrote ${OUT} with clips: ${clipNames.join(", ")}`);
}

main().catch((e) => { console.error("merge-gandalf failed:", e.message); process.exit(1); });
```

(The placeholder `boneNames` helper at the top is unused scaffolding — delete it; the real bone set is `baseBones`. Keep the file lint-clean.)

- [ ] **Step 3: Smoke the script wiring (no assets yet)**

Run: `npm run merge:gandalf`
Expected: it exits with a clear error `no .glb files in assets-src/gandalf/` (the folder is empty/absent until the user drops GLBs). This confirms the script runs, finds the convention, and fails loudly — not that it produced output. Create the empty dir if needed: `mkdir -p assets-src/gandalf`.

- [ ] **Step 4: Commit**

```bash
git add scripts/merge-gandalf.mjs package.json package-lock.json .gitignore
git commit -m "feat(build): merge-gandalf script (gltf-transform) for the single character GLB"
```

---

## Task 5: Asset integration (gated on the user's model)

**Files:**
- Asset: `public/assets/models/gandalf.glb` (produced by the merge)
- Possibly: `src/player/gandalf.ts:MODEL_FACING_OFFSET` (calibration)
- Delete: `public/assets/models/gandalf-*.glb` (the five legacy files), once the new model is verified.

This task runs when the user has dropped their GLBs in `assets-src/gandalf/`. It is asset + verification work (no new unit tests).

- [ ] **Step 1: Produce the merged model**

User drops the GLBs (shared skeleton, filenames containing role keywords) in `assets-src/gandalf/`. Run `npm run merge:gandalf`. Expected: `public/assets/models/gandalf.glb` written, with the printed clip list. If the script reports a skeleton mismatch, the provided GLBs don't share a rig — the source must be re-exported on one skeleton (or, as a fallback, drop the separate GLBs renamed `gandalf-walk/run/idle/listening/one-hand-wave.glb` and the loader's legacy path will use them).

- [ ] **Step 2: Browser-verify (controller)**

`npm run dev`. Confirm: Gandalf is the NEW model (PBR-shaded), at ~1.9 m, idle/walk/run blend on movement, wave on intro, listening (or idle fallback) on tale-recall, casts shadows; collision/camera/interaction/journal unchanged; 0 console errors.

- [ ] **Step 3: Calibrate facing**

If the new model faces the wrong way when moving, set `MODEL_FACING_OFFSET` in `gandalf.ts` (e.g. `Math.PI` for a 180° flip) and re-verify until forward matches travel direction.

- [ ] **Step 4: Remove the orphaned legacy files**

Once the new model is confirmed good:
```bash
git rm public/assets/models/gandalf-walk.glb public/assets/models/gandalf-run.glb \
  public/assets/models/gandalf-idle.glb public/assets/models/gandalf-listening.glb \
  public/assets/models/gandalf-one-hand-wave.glb
```
The loader's legacy fallback then becomes dormant (only triggers if `gandalf.glb` is ever absent). Keep the fallback code — it is cheap and harmless.

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run build`. Then commit the model + any calibration:
```bash
git add public/assets/models/gandalf.glb src/player/gandalf.ts
git commit -m "feat(assets): new PBR Gandalf model (merged) + facing calibration"
# (and the legacy-file removal, if done in this step)
git commit -am "chore(assets): remove legacy gandalf-*.glb (superseded by merged gandalf.glb)"
```

---

## Self-Review

**Spec coverage**
- Offline merge (user GLBs → one named-clip GLB, shared-skeleton validation) → Task 4 (+ Task 5 runs it). ✓
- Loader: single GLB + clip-by-name + graceful idle fallback → Tasks 2 (resolveClips) + 3 (loadModel/load). ✓
- Legacy fallback so the app runs before the model exists → Task 3 `loadModel`. ✓
- Preserve the model's PBR maps → Task 1 `usePBRMaterials`. ✓
- Pose-aware 1.9 m scale + sole-drop preserved → Task 3 (unchanged logic). ✓
- Facing offset → Task 3 (`MODEL_FACING_OFFSET`) + Task 5 calibration. ✓
- Remove orphaned 5 GLBs once merged model is in → Task 5 Step 4. ✓
- `@gltf-transform/core` is a devDep, not runtime → Task 4 (`--save-dev`); Global Constraints. ✓
- Unit tests for `resolveClips` + `usePBRMaterials` → Tasks 1, 2. ✓

**Placeholder scan:** the merge script notes one unused scaffolding helper to delete (Task 4 Step 2) — flagged explicitly, not left as a silent TODO. The `@gltf-transform/core` animation-rebinding API is concrete in the script; if a method name differs in the installed version, Task 5 Step 1 surfaces it on first run (it's a build script, validated against real assets there).

**Type consistency:** `Role`/`resolveClips` (Task 2) used in Task 3. `usePBRMaterials(root, cfg)` (Task 1) used in Task 3. `loadModel(): { mesh, clips: Map<string, AnimationClip> }` consumed by `load()` in the same task. `PBRConfig`/`buildStandardMaterialParams` reused from existing `materials.ts`.

**Known judgment calls (for the implementer):**
- The merge script is the one piece not unit-testable without assets; it is validated in Task 5 against the real GLBs, and the loader's legacy multi-GLB fallback is the safety net if the merge needs iteration.
- `MODEL_FACING_OFFSET` and the material `roughness` default are starting values, calibrated in-browser in Task 5.
