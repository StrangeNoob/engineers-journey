// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { Journal } from "./journal";

beforeEach(() => localStorage.clear());

describe("Journal", () => {
  it("starts empty", () => { expect(new Journal(["a", "b"]).count).toBe(0); });
  it("records a recall once", () => {
    const j = new Journal(["a", "b"]); j.recall("a"); j.recall("a");
    expect(j.count).toBe(1); expect(j.isVisited("a")).toBe(true);
  });
  it("persists across instances", () => {
    new Journal(["a", "b"]).recall("b");
    expect(new Journal(["a", "b"]).isVisited("b")).toBe(true);
  });
});
