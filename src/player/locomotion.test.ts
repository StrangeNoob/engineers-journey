import { describe, it, expect } from "vitest";
import { integrateVelocity, approachAngle, integrateJump } from "./locomotion";

describe("integrateVelocity", () => {
  it("moves toward target by at most rate*dt, no overshoot", () => {
    const v = integrateVelocity({ x: 0, z: 0 }, { x: 4.2, z: 0 }, 30, 0.016);
    expect(v.x).toBeGreaterThan(0);
    expect(v.x).toBeLessThanOrEqual(30 * 0.016 + 1e-6);
  });
  it("snaps to target when within one step", () => {
    const v = integrateVelocity({ x: 4.19, z: 0 }, { x: 4.2, z: 0 }, 30, 0.1);
    expect(v).toEqual({ x: 4.2, z: 0 });
  });
  it("decelerates toward zero", () => {
    const v = integrateVelocity({ x: 4.2, z: 0 }, { x: 0, z: 0 }, 40, 0.016);
    expect(v.x).toBeGreaterThan(0);
    expect(v.x).toBeLessThan(4.2);
  });
});

describe("approachAngle", () => {
  it("reaches target within one step", () => {
    expect(approachAngle(0, 0.05, 1)).toBeCloseTo(0.05);
  });
  it("takes the shortest arc across the wrap", () => {
    // from 3.0 toward -3.0 is shorter going forward across π (+ ~0.28), not back ~ -6
    const a = approachAngle(3.0, -3.0, 0.1);
    expect(a).toBeGreaterThan(3.0);
  });
});

describe("integrateJump", () => {
  it("launches on a grounded jump and leaves the ground", () => {
    const s = integrateJump({ y: 0, vy: 0, grounded: true }, 0, true, 0.016, 5.5, 18);
    expect(s.vy).toBeGreaterThan(0);
    expect(s.grounded).toBe(false);
  });
  it("cannot double-jump while airborne", () => {
    const s = integrateJump({ y: 2, vy: 3, grounded: false }, 0, true, 0.016, 5.5, 18);
    expect(s.vy).toBeLessThan(3); // gravity only, no re-launch to 5.5
  });
  it("lands exactly at groundY and re-grounds", () => {
    const s = integrateJump({ y: 0.05, vy: -5, grounded: false }, 0, false, 0.05, 5.5, 18);
    expect(s.y).toBe(0);
    expect(s.vy).toBe(0);
    expect(s.grounded).toBe(true);
  });
});
