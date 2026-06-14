import { describe, it, expect } from "vitest";
import { withinRadius } from "./interaction";

describe("withinRadius", () => {
  it("true when inside", () => { expect(withinRadius(0, 0, 1, 1, 3)).toBe(true); });
  it("false when outside", () => { expect(withinRadius(0, 0, 5, 0, 3)).toBe(false); });
});
