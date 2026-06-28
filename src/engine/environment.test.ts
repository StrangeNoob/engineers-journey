import { describe, it, expect } from "vitest";
import { fogConfig, sunDirection } from "./environment";

describe("fogConfig", () => {
  it("scales far with draw distance and keeps near < far", () => {
    const f = fogConfig(380);
    expect(f.far).toBeGreaterThan(f.near);
    expect(f.far).toBeLessThanOrEqual(380);
  });
});

describe("sunDirection", () => {
  it("returns a normalized vector pointing down from above", () => {
    const d = sunDirection();
    expect(d.length()).toBeCloseTo(1, 5);
    expect(d.y).toBeLessThan(0); // light travels downward
  });
});
