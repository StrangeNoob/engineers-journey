import * as THREE from "three";
import type { Input } from "../engine/input";

export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 700);
  private yaw = 0;
  private pitch = 0.42;     // a touch higher angle for a better overview
  private dist = 11;        // pulled back so the whole figure + world ahead are framed
  private readonly tmp = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();

  get yawAngle(): number { return this.yaw; }

  /** Consume look deltas, orbit, trail the target, and pull in if a building blocks the view. */
  update(target: THREE.Vector3, input: Input, dt: number, obstacles: THREE.Object3D[] = []): void {
    this.yaw -= input.state.lookDX * 0.0035;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.state.lookDY * 0.0035, 0.12, 1.2);
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
      if (hit) desired.copy(this.eye).addScaledVector(this.dir, Math.max(2.5, hit.distance - 0.5));
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
