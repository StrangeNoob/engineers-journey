import * as THREE from "three";
import type { Input } from "../engine/input";

const REDUCED = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reveal vantage: high + pulled back, slowly orbiting the world center
const REVEAL_HEIGHT = 18;
const REVEAL_BACK = 22;
const REVEAL_ORBIT_SPEED = 0.18; // radians per second

export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 700);
  private yaw = 0;
  private pitch = 0.42;     // a touch higher angle for a better overview
  private dist = 11;        // pulled back so the whole figure + world ahead are framed
  private readonly tmp = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();

  private focused = false;
  private revealT = 0;
  private revealOrbitAngle = 0;

  /** When on, the camera eases closer to frame the tale scroll; off restores normal follow. */
  focus(on: boolean): void { this.focused = on; }

  get yawAngle(): number { return this.yaw; }

  /** Start the cinematic reveal; camera orbits the world center for `seconds`. */
  startReveal(seconds = 5): void { this.revealT = seconds; }

  /** True while a cinematic reveal is in progress. */
  get isRevealing(): boolean { return this.revealT > 0; }

  /** Cancel the reveal immediately and return to normal follow. */
  endReveal(): void { this.revealT = 0; }

  /** Consume look deltas, orbit, trail the target, and pull in if a building blocks the view. */
  update(target: THREE.Vector3, input: Input, dt: number, obstacles: THREE.Object3D[] = []): void {
    if (this.revealT > 0) {
      this.revealT = Math.max(0, this.revealT - dt);
      this.revealOrbitAngle += REVEAL_ORBIT_SPEED * dt;

      // Ease toward the reveal vantage: high above the world center, slowly circling
      const revealPos = this.tmp.set(
        Math.sin(this.revealOrbitAngle) * REVEAL_BACK,
        REVEAL_HEIGHT,
        Math.cos(this.revealOrbitAngle) * REVEAL_BACK,
      );
      this.camera.position.lerp(revealPos, REDUCED ? 1 : 1 - Math.exp(-dt * 1.5));
      this.camera.lookAt(0, 0, 0);
      return;
    }

    this.yaw -= input.state.lookDX * 0.0035;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.state.lookDY * 0.0035, 0.12, 1.2);
    const targetDist = this.focused ? 6.5 : 11;
    this.dist += (targetDist - this.dist) * (REDUCED ? 1 : 1 - Math.exp(-dt * 5));
    const h = Math.sin(this.pitch) * this.dist;
    const r = Math.cos(this.pitch) * this.dist;
    const desired = this.tmp.set(
      target.x + Math.sin(this.yaw) * r,
      target.y + 1.9 + h,        // camera height above the target
      target.z + Math.cos(this.yaw) * r,
    );

    // camera collision: cast from the head toward the desired position; if a landmark is in
    // the way, pull the camera in to just before it so the view never enters a building.
    this.eye.set(target.x, target.y + 1.6, target.z);
    this.dir.copy(desired).sub(this.eye);
    const want = this.dir.length();
    this.dir.normalize();
    this.ray.set(this.eye, this.dir);
    this.ray.far = want;
    if (obstacles.length) {
      const hit = this.ray.intersectObjects(obstacles, true)[0];
      // pull in to just before the obstacle; a small floor keeps the camera out of Gandalf's head
      if (hit) desired.copy(this.eye).addScaledVector(this.dir, Math.max(1.2, hit.distance - 0.5));
    }

    // frame-rate-independent smoothing (≈0.18 per frame at 60fps)
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(target.x, target.y + 1.7, target.z); // aim at head/upper body
  }

  resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
