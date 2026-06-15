import { describe, it, expect } from "vitest";
import { withinLoadRange } from "./landmarks";

describe("withinLoadRange", () => {
  it("true inside range", () => { expect(withinLoadRange(0, 0, 50, 0, 90)).toBe(true); });
  it("false outside range", () => { expect(withinLoadRange(0, 0, 200, 0, 90)).toBe(false); });
});
