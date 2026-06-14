import { describe, it, expect } from "vitest";
import { cameraRelativeMove, pickGait } from "./gandalf";

describe("cameraRelativeMove", () => {
  it("forward with yaw 0 goes -Z", () => {
    const v = cameraRelativeMove(1, 0, 0);
    expect(v.x).toBeCloseTo(0); expect(v.z).toBeCloseTo(-1);
  });
  it("right with yaw 0 goes +X", () => {
    const v = cameraRelativeMove(0, 1, 0);
    expect(v.x).toBeCloseTo(1); expect(v.z).toBeCloseTo(0);
  });
  it("normalizes diagonal", () => {
    const v = cameraRelativeMove(1, 1, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
});

describe("pickGait", () => {
  it("idle below walk threshold", () => { expect(pickGait(0.05, false)).toBe("idle"); });
  it("walk when moving, not running", () => { expect(pickGait(2, false)).toBe("walk"); });
  it("run when moving and run held", () => { expect(pickGait(2, true)).toBe("run"); });
});
