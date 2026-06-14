import * as THREE from "three";
import type { Input } from "../engine/input";

export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 700);
  private yaw = 0;
  private pitch = 0.42;     // a touch higher angle for a better overview
  private dist = 11;        // pulled back so the whole figure + world ahead are framed
  private readonly tmp = new THREE.Vector3();

  get yawAngle(): number { return this.yaw; }

  /** Consume look deltas, orbit, and trail the target. Call once per frame. */
  update(target: THREE.Vector3, input: Input, dt: number): void {
    this.yaw -= input.state.lookDX * 0.0035;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.state.lookDY * 0.0035, 0.12, 1.2);
    const h = Math.sin(this.pitch) * this.dist;
    const r = Math.cos(this.pitch) * this.dist;
    const desired = this.tmp.set(
      target.x + Math.sin(this.yaw) * r,
      target.y + 1.9 + h,        // camera height above the target
      target.z + Math.cos(this.yaw) * r,
    );
    // frame-rate-independent smoothing (≈0.18 per frame at 60fps)
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(target.x, target.y + 1.7, target.z); // aim at head/upper body
  }

  resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
