import { describe, it, expect } from "vitest";
import { viewpointHeight, PEAK, KNOLL_R, KNOLL_H } from "./viewpoint";

describe("viewpointHeight", () => {
  it("peaks at the summit and is flat outside the radius", () => {
    expect(viewpointHeight(PEAK.x, PEAK.z)).toBeCloseTo(KNOLL_H);
    expect(viewpointHeight(PEAK.x + KNOLL_R, PEAK.z)).toBe(0);
    expect(viewpointHeight(PEAK.x + KNOLL_R + 50, PEAK.z)).toBe(0);
  });
  it("decreases monotonically from center to rim", () => {
    const a = viewpointHeight(PEAK.x + 2, PEAK.z);
    const b = viewpointHeight(PEAK.x + 6, PEAK.z);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });
});
