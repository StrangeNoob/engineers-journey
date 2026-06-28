import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { regionWeight, nearestRegion, lerpProfile } from "./atmosphere";
import { REGIONS, DEFAULT_PROFILE } from "../data/regions";

describe("regionWeight", () => {
  it("is 1 at/inside the radius and 0 beyond radius+falloff", () => {
    expect(regionWeight(0, 20, 10)).toBe(1);
    expect(regionWeight(20, 20, 10)).toBe(1);
    expect(regionWeight(30, 20, 10)).toBe(0);
    expect(regionWeight(40, 20, 10)).toBe(0);
  });
  it("is monotonic between radius and radius+falloff", () => {
    const a = regionWeight(23, 20, 10), b = regionWeight(27, 20, 10);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(0);
  });
});

describe("nearestRegion", () => {
  it("returns the closest region to a point near its center", () => {
    const isengard = REGIONS.find((r) => r.id === "isengard")!;
    const got = nearestRegion(isengard.center.x + 1, isengard.center.z - 1);
    expect(got?.region.id).toBe("isengard");
    expect(got?.dist).toBeLessThan(3);
  });
  it("returns null for an empty region list", () => {
    expect(nearestRegion(0, 0, [])).toBeNull();
  });
});

describe("lerpProfile", () => {
  const region = REGIONS.find((r) => r.id === "isengard")!;
  it("t=0 yields the base, t=1 yields the region", () => {
    expect(lerpProfile(DEFAULT_PROFILE, region, 0).exposure).toBeCloseTo(DEFAULT_PROFILE.exposure);
    expect(lerpProfile(DEFAULT_PROFILE, region, 1).exposure).toBeCloseTo(region.exposure);
  });
  it("t=0.5 blends exposure and fog color halfway", () => {
    const b = lerpProfile(DEFAULT_PROFILE, region, 0.5);
    expect(b.exposure).toBeCloseTo((DEFAULT_PROFILE.exposure + region.exposure) / 2);
    const mid = new THREE.Color(DEFAULT_PROFILE.fog.color).lerp(new THREE.Color(region.fog.color), 0.5);
    expect(b.fog.color).toBe(mid.getHex());
    expect(b.fog.near).toBeCloseTo((DEFAULT_PROFILE.fog.near + region.fog.near) / 2);
    expect(b.fog.far).toBeCloseTo((DEFAULT_PROFILE.fog.far + region.fog.far) / 2);
  });
});
