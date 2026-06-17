import { describe, it, expect } from "vitest";
import { FrameMeter } from "./debugOverlay";

describe("FrameMeter", () => {
  it("averages frame times and reports fps", () => {
    const m = new FrameMeter(4);
    [16, 16, 16, 16].forEach((x) => m.push(x));
    expect(m.avgMs).toBeCloseTo(16, 1);
    expect(m.fps).toBeGreaterThan(58);
    expect(m.fps).toBeLessThan(64);
  });
  it("windows to the last N samples", () => {
    const m = new FrameMeter(2);
    m.push(100); m.push(10); m.push(10);
    expect(m.avgMs).toBeCloseTo(10, 1);
  });
});
