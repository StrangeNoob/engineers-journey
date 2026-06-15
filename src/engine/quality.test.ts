import { describe, it, expect } from "vitest";
import { pickTier } from "./quality";

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
