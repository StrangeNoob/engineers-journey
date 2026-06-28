export interface Vec2 { x: number; z: number }

/** Pure: move `v` toward `target` by at most `rate*dt` (vector); snaps when within a step. */
export function integrateVelocity(v: Vec2, target: Vec2, rate: number, dt: number): Vec2 {
  const max = rate * dt;
  const dx = target.x - v.x, dz = target.z - v.z;
  const d = Math.hypot(dx, dz);
  if (d <= max || d < 1e-6) return { x: target.x, z: target.z };
  const k = max / d;
  return { x: v.x + dx * k, z: v.z + dz * k };
}

/** Pure: rotate `cur` toward `target` along the shortest signed arc, clamped to `maxStep`. */
export function approachAngle(cur: number, target: number, maxStep: number): number {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return cur + d;
  return cur + Math.sign(d) * maxStep;
}

export interface JumpState { y: number; vy: number; grounded: boolean }

/** Pure: vertical jump/gravity integration. Grounded jump launches; lands at groundY; no double-jump. */
export function integrateJump(
  s: JumpState, groundY: number, jumpPressed: boolean, dt: number, jumpV: number, gravity: number,
): JumpState {
  let { y, vy, grounded } = s;
  if (grounded && jumpPressed) { vy = jumpV; grounded = false; }
  // integrate only while airborne, with the half-gravity position term so a large-dt launch
  // frame can't apply enough gravity to snap y straight back to the ground on the same tick
  if (!grounded) {
    y += vy * dt - 0.5 * gravity * dt * dt;
    vy -= gravity * dt;
  }
  if (y <= groundY) { y = groundY; vy = 0; grounded = true; }
  return { y, vy, grounded };
}
