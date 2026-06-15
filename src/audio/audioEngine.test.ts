import { describe, it, expect } from "vitest";
import { footstepDue } from "./audioEngine";

describe("footstepDue", () => {
  it("never fires when idle", () => { expect(footstepDue(99, "idle")).toBe(false); });
  it("fires after a walk stride, not before", () => {
    expect(footstepDue(0.3, "walk")).toBe(false);
    expect(footstepDue(0.7, "walk")).toBe(true);
  });
  it("needs a longer stride at a run", () => {
    expect(footstepDue(0.7, "run")).toBe(false);
    expect(footstepDue(1.0, "run")).toBe(true);
  });
});
