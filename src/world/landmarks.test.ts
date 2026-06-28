import { describe, it, expect } from "vitest";
import { withinLoadRange, materialFor } from "./landmarks";

describe("withinLoadRange", () => {
  it("true inside range", () => { expect(withinLoadRange(0, 0, 50, 0, 90)).toBe(true); });
  it("false outside range", () => { expect(withinLoadRange(0, 0, 200, 0, 90)).toBe(false); });
});

describe("materialFor", () => {
  it("isengard is darker/rougher with slight metalness", () => {
    const m = materialFor("isengard");
    expect(m.metalness).toBeGreaterThan(0);
    expect(m.roughness).toBeLessThanOrEqual(0.8);
  });
  it("minas is low-roughness bright stone", () => {
    expect(materialFor("minas").roughness).toBeLessThanOrEqual(0.65);
  });
  it("unknown ids fall back to a sensible default", () => {
    expect(materialFor("nope").roughness).toBeGreaterThan(0);
  });
});
