import { describe, it, expect } from "vitest";
import { screenMarker } from "./waypoints";

const W = 1000, H = 600, M = 30;
describe("screenMarker", () => {
  it("passes through an on-screen target", () => {
    const m = screenMarker(0, 0, false, M, W, H);
    expect(m.onScreen).toBe(true);
    expect(m.x).toBeCloseTo(W / 2);
    expect(m.y).toBeCloseTo(H / 2);
  });
  it("clamps an off-screen-right target to the right inset edge, pointing right", () => {
    const m = screenMarker(2, 0, false, M, W, H);
    expect(m.onScreen).toBe(false);
    expect(m.x).toBeGreaterThan(W / 2);
    expect(m.x).toBeLessThanOrEqual(W - M + 0.5);
    expect(Math.abs(m.angleDeg)).toBeLessThan(1); // ~0° = pointing right
  });
  it("flips a behind-camera target to the opposite edge", () => {
    // target projects slightly right but is BEHIND → should clamp to the LEFT edge
    const m = screenMarker(0.1, 0, true, M, W, H);
    expect(m.onScreen).toBe(false);
    expect(m.x).toBeLessThan(W / 2);
    expect(Math.abs(Math.abs(m.angleDeg) - 180)).toBeLessThan(1); // ~180° = pointing left
  });
});
