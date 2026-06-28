import { describe, it, expect } from "vitest";
import { segments } from "./syncMeter";

describe("segments", () => {
  it("maps visited ids to filled flags in order", () => {
    const visited = new Set(["a", "c"]);
    expect(segments((id) => visited.has(id), ["a", "b", "c"])).toEqual([true, false, true]);
  });
  it("is all-false when nothing is visited", () => {
    expect(segments(() => false, ["a", "b"])).toEqual([false, false]);
  });
});
