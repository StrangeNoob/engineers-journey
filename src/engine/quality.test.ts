import { describe, it, expect } from "vitest";
import { pickTier, pickQualityLevel, effectFlags } from "./quality";

describe("pickTier", () => {
  it("coarse pointer → mobile", () => { expect(pickTier(true, 8)).toBe("mobile"); });
  it("few cores → mobile", () => { expect(pickTier(false, 4)).toBe("mobile"); });
  it("desktop otherwise", () => { expect(pickTier(false, 8)).toBe("desktop"); });
  it("threshold: 4 cores is the last mobile, 5 is desktop", () => {
    expect(pickTier(false, 4)).toBe("mobile");
    expect(pickTier(false, 5)).toBe("desktop");
    expect(pickTier(false, 6)).toBe("desktop");
    expect(pickTier(false, 7)).toBe("desktop");
  });
});

describe("pickQualityLevel", () => {
  it("desktop → high", () => { expect(pickQualityLevel("desktop")).toBe("high"); });
  it("mobile → low", () => { expect(pickQualityLevel("mobile")).toBe("low"); });
});

describe("effectFlags", () => {
  it("high enables the full stack (DoF + LUT excepted — off for production clarity)", () => {
    const f = effectFlags("high");
    expect(f.ssao && f.csm && f.bloom && f.smaa).toBe(true);
    expect(f.dof).toBe(false);
    expect(f.lut).toBe(false);
  });
  it("medium drops dof + ssao but keeps bloom/csm", () => {
    const f = effectFlags("medium");
    expect(f.dof).toBe(false);
    expect(f.ssao).toBe(false);
    expect(f.bloom && f.csm).toBe(true);
  });
  it("low strips expensive effects and csm", () => {
    const f = effectFlags("low");
    expect(f.dof || f.ssao || f.csm || f.chromaticAberration).toBe(false);
    expect(f.bloom && f.smaa).toBe(true);
  });
});
