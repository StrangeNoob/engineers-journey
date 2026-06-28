import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { configureRenderer } from "./renderer";

function stub() {
  return {
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.LinearSRGBColorSpace,
  } as Pick<THREE.WebGLRenderer, "toneMapping" | "toneMappingExposure" | "outputColorSpace">;
}

describe("configureRenderer", () => {
  it("uses ACES filmic when tone mapping in the renderer", () => {
    const r = stub();
    configureRenderer(r, { exposure: 1.1, toneMapInRenderer: true });
    expect(r.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(r.toneMappingExposure).toBeCloseTo(1.1);
    expect(r.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });

  it("disables renderer tone mapping when post handles it", () => {
    const r = stub();
    configureRenderer(r, { exposure: 1.0, toneMapInRenderer: false });
    expect(r.toneMapping).toBe(THREE.NoToneMapping);
    expect(r.toneMappingExposure).toBeCloseTo(1.0);
    expect(r.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });
});
