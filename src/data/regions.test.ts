import { describe, it, expect } from "vitest";
import { REGIONS, DEFAULT_PROFILE } from "./regions";
import { STOP_PLACEMENTS } from "./world";

describe("REGIONS", () => {
  it("resolves each region's center from STOP_PLACEMENTS / ARGONATH", () => {
    const isengard = REGIONS.find((r) => r.id === "isengard")!;
    const place = STOP_PLACEMENTS.find((p) => p.id === "isengard")!;
    expect(isengard.center.x).toBeCloseTo(place.x);
    expect(isengard.center.z).toBeCloseTo(place.z);
  });
  it("covers the four graded regions + argonath", () => {
    expect(REGIONS.map((r) => r.id).sort()).toEqual(["argonath", "bree", "edoras", "isengard", "minas"]);
  });
  it("every region has positive radius/falloff and a fog band with near < far", () => {
    for (const r of REGIONS) {
      expect(r.radius).toBeGreaterThan(0);
      expect(r.falloff).toBeGreaterThan(0);
      expect(r.fog.near).toBeLessThan(r.fog.far);
    }
  });
  it("default profile uses the existing golden-hour LUT", () => {
    expect(DEFAULT_PROFILE.lut).toBe("golden-hour.cube");
  });
});
