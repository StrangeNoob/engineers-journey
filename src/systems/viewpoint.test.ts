import { describe, it, expect } from "vitest";
import { ViewpointTrigger } from "./viewpoint";
import { PEAK, SUMMIT_R } from "../world/viewpoint";

describe("ViewpointTrigger", () => {
  it("fires once on entering the summit zone, not again until re-armed", () => {
    let fires = 0;
    const t = new ViewpointTrigger(() => fires++);
    t.update(PEAK.x, PEAK.z);                 // inside → fire
    t.update(PEAK.x + 0.1, PEAK.z);           // still inside → no re-fire
    expect(fires).toBe(1);
    t.update(PEAK.x + SUMMIT_R + 5, PEAK.z);  // leave → re-arm
    t.update(PEAK.x, PEAK.z);                 // re-enter → fire again
    expect(fires).toBe(2);
  });
});
