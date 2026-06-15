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

/** A solid circular footprint on the ground plane. */
export interface Collider { x: number; z: number; r: number; }

/**
 * Pure: push (x,z) out of any overlapping collider so a body of `radius`
 * never sits inside one. Two relaxation passes so sliding into a corner
 * (resolving one circle pushes into another) still settles. Returns the
 * corrected position.
 */
export function resolveCollisions(x: number, z: number, colliders: Collider[], radius: number): { x: number; z: number } {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
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

const WALK_SPEED = 2.6;
const RUN_SPEED = 5.6;
const BODY_RADIUS = 0.5;   // Gandalf's collision footprint (metres)

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
    this.root.add(mesh);

    const walkClip = walk.animations[0], runClip = run.animations[0];
    if (!walkClip || !runClip) throw new Error("Gandalf rig is missing walk/run animation clips");
    this.mixer = new THREE.AnimationMixer(mesh);
    // bone names match across rigs, so the run clip plays on this mixer.
    this.actions.walk = this.mixer.clipAction(walkClip);
    this.actions.run = this.mixer.clipAction(runClip);
    this.actions.walk.play(); this.actions.walk.weight = 1; // base layer (frozen when idle)
    this.actions.run.play(); this.actions.run.weight = 0;

    // Size + ground from the ANIMATED skinned pose, never from Box3.setFromObject:
    // setFromObject reads the raw (unskinned) vertex positions, which for this Mixamo
    // rig are ~2.9x smaller than the bind/skeleton-transformed mesh — that under-measure
    // is what blew Gandalf up to ~5.5 m and left him floating. Apply the idle pose,
    // measure the real pose-aware bounds, scale to 1.9 m, then drop the soles to y=0.
    this.actions.walk.setEffectiveTimeScale(0);
    this.mixer.update(0);
    const poseBox = () => {
      this.root.updateMatrixWorld(true);
      const box = new THREE.Box3(), smBox = new THREE.Box3();
      mesh.traverse((o) => {
        const sm = o as THREE.SkinnedMesh;
        if (!sm.isSkinnedMesh) return;
        sm.computeBoundingBox();
        box.union(smBox.copy(sm.boundingBox!).applyMatrix4(sm.matrixWorld));
      });
      return box;
    };
    const raw = poseBox();
    const k = 1.9 / (raw.max.y - raw.min.y || 1);
    mesh.scale.setScalar(k);
    const grounded = poseBox();           // re-measure at final scale
    if (!grounded.isEmpty()) mesh.position.y -= grounded.min.y;
  }

  /** Move + animate. Returns horizontal speed. */
  update(dt: number, input: InputState, camYaw: number, colliders: Collider[] = []): number {
    const dir = cameraRelativeMove(input.move.forward, input.move.right, camYaw);
    const moving = dir.x !== 0 || dir.z !== 0;
    const speed = moving ? (input.run ? RUN_SPEED : WALK_SPEED) : 0;
    this.root.position.x += dir.x * speed * dt;
    this.root.position.z += dir.z * speed * dt;
    // block walking through solid landmarks: push the body back out of any collider
    if (colliders.length) {
      const p = resolveCollisions(this.root.position.x, this.root.position.z, colliders, BODY_RADIUS);
      this.root.position.x = p.x; this.root.position.z = p.z;
    }
    if (moving) this.root.rotation.y = Math.atan2(dir.x, dir.z);

    const gait = pickGait(speed, input.run);
    if (gait !== this.current) this.current = gait;
    // Idle: freeze the walk clip (arms at sides) instead of falling back to the T-pose.
    // Walk is the base layer (weight 1); running blends the run clip over it.
    this.actions.walk.setEffectiveTimeScale(gait === "idle" ? 0 : 1);
    const wRun = gait === "run" ? 1 : 0;
    this.actions.run.weight += (wRun - this.actions.run.weight) * Math.min(1, dt * 10);
    this.mixer.update(dt);
    return speed;
  }
}
