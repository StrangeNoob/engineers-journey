import { describe, it, expect } from "vitest";
import { pickTier } from "./quality";

describe("pickTier", () => {
  it("coarse pointer → mobile", () => { expect(pickTier(true, 8)).toBe("mobile"); });
  it("few cores → mobile", () => { expect(pickTier(false, 4)).toBe("mobile"); });
  it("desktop otherwise", () => { expect(pickTier(false, 8)).toBe("desktop"); });
});
