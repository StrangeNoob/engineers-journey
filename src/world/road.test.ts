import { describe, it, expect } from "vitest";
import { chaikin } from "./road";

describe("chaikin", () => {
  it("keeps endpoints and adds points", () => {
    const out = chaikin([[0, 0], [10, 0], [10, 10]], 1);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([10, 10]);
    expect(out.length).toBeGreaterThan(3);
  });
});
