import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { colorSpaceForSlot, buildStandardMaterialParams, createPBRMaterial, applyPBR } from "./materials";

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
  it("defaults are correct", () => {
    const p = buildStandardMaterialParams({});
    expect(p.roughness).toBeCloseTo(1.0);
    expect(p.metalness).toBeCloseTo(0.0);
    expect(p.envMapIntensity).toBeCloseTo(1.0);
    expect((p.color as THREE.Color).getHex()).toBe(0xffffff);
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

describe("applyPBR", () => {
  it("converts toon material to standard while preserving albedo map", () => {
    const albedoTexture = new THREE.Texture();
    const toonMat = new THREE.MeshToonMaterial({ map: albedoTexture });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), toonMat);
    const root = new THREE.Group();
    root.add(mesh);

    applyPBR(root, { roughness: 0.85 });

    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    const mat = mesh.material as unknown as THREE.MeshStandardMaterial;
    expect(mat.map).toBe(albedoTexture);
    expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});
