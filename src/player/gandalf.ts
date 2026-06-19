import * as THREE from "three";
import { loadGLTF } from "../world/assets";
import { usePBRMaterials } from "../world/materials";
import type { InputState } from "../engine/input";

export type Gait = "idle" | "walk" | "run";

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

/** Pure: target blend weights for the locomotion clips given a gait. */
export function gaitWeights(gait: Gait): { idle: number; walk: number; run: number } {
  return { idle: gait === "idle" ? 1 : 0, walk: gait === "walk" ? 1 : 0, run: gait === "run" ? 1 : 0 };
}

/** A solid circular footprint on the ground plane. */
export interface Collider { x: number; z: number; r: number; low?: boolean; }

/**
 * Pure: push (x,z) out of any overlapping collider so a body of `radius`
 * never sits inside one. Two relaxation passes so sliding into a corner
 * (resolving one circle pushes into another) still settles. Returns the
 * corrected position.
 */
export function resolveCollisions(x: number, z: number, colliders: Collider[], radius: number, skipLow = false): { x: number; z: number } {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (skipLow && c.low) continue;
      const dx = x - c.x, dz = z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (d > 1e-4) { const k = (min - d) / d; x += dx * k; z += dz * k; }
      else { x = c.x + min; }   // dead-centre: shove out along +x
    }
  }
  return { x, z };
}

// Y-rotation (radians) applied to the model so its authored forward matches the movement
// convention (root.rotation.y = atan2(dir.x, dir.z)). Calibrated in-browser; 0 if already aligned.
const MODEL_FACING_OFFSET = 0;

const WALK_SPEED = 4.2;
const RUN_SPEED = 8.8;
const BODY_RADIUS = 0.5;   // Gandalf's collision footprint (metres)
// the walk/run clips were authored to look in-step at these speeds; we scale each
// clip's playback by actual/authored so faster movement doesn't make the feet skate.
const WALK_CLIP_SPEED = 2.6;
const RUN_CLIP_SPEED = 5.6;

export class Gandalf {
  readonly root = new THREE.Group();
  private mixer!: THREE.AnimationMixer;
  private loco!: Record<Gait, THREE.AnimationAction>;
  private gestures!: Record<"wave" | "listening", THREE.AnimationAction>;
  private active: THREE.AnimationAction | null = null; // current gesture, if any
  private gestureTarget = 0;                            // 0 = fade out, 1 = fade in
  private hold = false;                                 // keep the gesture's end pose until released

  private async loadModel(): Promise<{ mesh: THREE.Object3D; clips: Map<string, THREE.AnimationClip> }> {
    const g = await loadGLTF("gandalf");
    if (g.animations.length === 0) throw new Error("gandalf.glb has no animation clips");
    const clips = new Map(g.animations.map((c) => [c.name.toLowerCase(), c]));
    return { mesh: g.scene, clips };
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
    this.loco.walk.timeScale = WALK_SPEED / WALK_CLIP_SPEED; // keep strides in step with the faster pace
    this.loco.run.timeScale = RUN_SPEED / RUN_CLIP_SPEED;
    Object.values(this.gestures).forEach((a) => { a.weight = 0; });
    // a finished gesture that isn't being held fades back to locomotion
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

  /** Play a one-shot gesture. hold=true keeps the end pose until releaseGesture(). */
  playGesture(name: "wave" | "listening", hold = false): void {
    if (this.active) { this.active.weight = 0; this.active.stop(); }
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
