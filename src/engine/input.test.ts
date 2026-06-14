import { describe, it, expect } from "vitest";
import { keyboardMove } from "./input";

describe("keyboardMove", () => {
  it("returns zero when no keys", () => {
    expect(keyboardMove(new Set())).toEqual({ forward: 0, right: 0 });
  });
  it("W is forward +1", () => {
    expect(keyboardMove(new Set(["KeyW"]))).toEqual({ forward: 1, right: 0 });
  });
  it("S+D combine", () => {
    expect(keyboardMove(new Set(["KeyS", "KeyD"]))).toEqual({ forward: -1, right: 1 });
  });
  it("opposite keys cancel", () => {
    expect(keyboardMove(new Set(["KeyW", "KeyS"]))).toEqual({ forward: 0, right: 0 });
  });
});
