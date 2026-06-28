import { describe, it, expect } from "vitest";
import { buildEffectChain, type EffectId } from "./postfx";
import { effectFlags } from "./quality";

const ids = (steps: { id: EffectId; enabled: boolean }[]) => steps.map((s) => s.id);
const enabled = (steps: { id: EffectId; enabled: boolean }[]) =>
  steps.filter((s) => s.enabled).map((s) => s.id);

describe("buildEffectChain", () => {
  it("orders AO → bloom → dof → tonemap → lut → vignette → grain → CA → smaa", () => {
    expect(ids(buildEffectChain(effectFlags("high")))).toEqual([
      "ssao", "bloom", "dof", "tonemap", "lut", "vignette", "grain", "chromaticAberration", "smaa",
    ]);
  });
  it("tonemap, bloom, smaa always enabled; lut off (production clarity)", () => {
    for (const lvl of ["high", "medium", "low"] as const) {
      const on = enabled(buildEffectChain(effectFlags(lvl)));
      expect(on).toEqual(expect.arrayContaining(["tonemap", "bloom", "smaa"]));
      expect(on).not.toContain("lut");
    }
  });
  it("low disables ssao, dof, chromaticAberration", () => {
    const on = enabled(buildEffectChain(effectFlags("low")));
    expect(on).not.toContain("ssao");
    expect(on).not.toContain("dof");
    expect(on).not.toContain("chromaticAberration");
  });
});
