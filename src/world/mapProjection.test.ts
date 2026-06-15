import { describe, it, expect } from "vitest";
import { travelTarget, nearestStop, nearestUnvisited } from "./mapProjection";

describe("travelTarget", () => {
  it("lands on the road within tale-recall range of the stop, facing it", () => {
    const t = travelTarget(-68.8, 53.4); // Shire centre
    expect(Math.hypot(t.x - (-68.8), t.z - 53.4)).toBeLessThan(14); // within recall range
    expect(Number.isFinite(t.faceY)).toBe(true);
  });
});

describe("nearestStop", () => {
  const stops = [{ id: "a", x: 0, z: 0 }, { id: "b", x: 10, z: 0 }];
  it("returns the closest stop (regardless of visited)", () => {
    expect(nearestStop(9, 0, stops)).toBe("b");
    expect(nearestStop(1, 0, stops)).toBe("a");
  });
});

describe("nearestUnvisited", () => {
  const stops = [{ id: "a", x: 0, z: 0 }, { id: "b", x: 10, z: 0 }, { id: "c", x: 100, z: 0 }];
  it("picks the closest unvisited stop", () => {
    const visited = new Set(["a"]);
    expect(nearestUnvisited(0, 0, stops, (id) => visited.has(id))).toBe("b");
  });
  it("returns null when all are visited", () => {
    expect(nearestUnvisited(0, 0, stops, () => true)).toBe(null);
  });
});
