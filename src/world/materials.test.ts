import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { colorSpaceForSlot, buildStandardMaterialParams, createPBRMaterial } from "./materials";

describe("colorSpaceForSlot", () => {
  it("albedo + emissive are sRGB", () => {
    expect(colorSpaceForSlot("albedo")).toBe(THREE.SRGBColorSpace);
    expect(colorSpaceForSlot("emissive")).toBe(THREE.SRGBColorSpace);
  });
  it("data maps are linear", () => {
    for (const s of ["normal", "roughness", "metalness", "ao"] as const) {
      expect(colorSpaceForSlot(s)).toBe(THREE.NoColorSpace);
    }
  });
});

describe("buildStandardMaterialParams", () => {
  it("applies defaults and overrides", () => {
    const p = buildStandardMaterialParams({ roughness: 0.8, metalness: 0.1, envMapIntensity: 1.2 });
    expect(p.roughness).toBeCloseTo(0.8);
    expect(p.metalness).toBeCloseTo(0.1);
    expect(p.envMapIntensity).toBeCloseTo(1.2);
  });
});

describe("createPBRMaterial", () => {
  it("assigns maps with correct color spaces", () => {
    const albedo = new THREE.Texture();
    const normal = new THREE.Texture();
    const mat = createPBRMaterial({ roughness: 0.9 }, { albedo, normal });
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).toBe(albedo);
    expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mat.normalMap).toBe(normal);
    expect(mat.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
  });
});
