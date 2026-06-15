import { describe, it, expect } from "vitest";
import { withinRadius, nearestStop } from "./interaction";

describe("withinRadius", () => {
  it("true when inside", () => { expect(withinRadius(0, 0, 1, 1, 3)).toBe(true); });
  it("false when outside", () => { expect(withinRadius(0, 0, 5, 0, 3)).toBe(false); });
});

describe("nearestStop", () => {
  const stops = [ { id: "a", x: 0, z: 0 }, { id: "b", x: 10, z: 0 } ];
  it("returns the nearest within range", () => {
    expect(nearestStop(1, 0, stops, 4)?.id).toBe("a");
    expect(nearestStop(9, 0, stops, 4)?.id).toBe("b");
  });
  it("returns null when none in range", () => {
    expect(nearestStop(50, 50, stops, 4)).toBeNull();
  });
});
