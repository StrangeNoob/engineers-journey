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
