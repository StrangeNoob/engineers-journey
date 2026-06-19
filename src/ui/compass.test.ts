import { describe, it, expect } from "vitest";
import { bearingToStripX, COMPASS_FOV } from "./compass";

const W = 400;
describe("bearingToStripX", () => {
  it("centers a target dead ahead", () => {
    // facing +z (camYaw 0), target straight ahead at +z
    expect(bearingToStripX(0, 0, 0, 0, 10, COMPASS_FOV, W)).toBeCloseTo(W / 2);
  });
  it("offsets a target to one side toward that edge", () => {
    // target ~60° to the right (within the ±70° arc)
    const x = bearingToStripX(0, 0, 0, 10, 5.77, COMPASS_FOV, W); // atan2(10,5.77)=~60deg
    expect(x).not.toBeNull();
    expect(x!).toBeGreaterThan(W / 2);
  });
  it("returns null for a target behind", () => {
    expect(bearingToStripX(0, 0, 0, 0, -10, COMPASS_FOV, W)).toBeNull();
  });
});
