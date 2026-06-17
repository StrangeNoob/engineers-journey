import * as THREE from "three";

export type TexSlot = "albedo" | "normal" | "roughness" | "metalness" | "ao" | "emissive";

/** Pure: correct color space per texture slot (color maps sRGB, data maps linear). */
export function colorSpaceForSlot(slot: TexSlot): THREE.ColorSpace {
  return slot === "albedo" || slot === "emissive" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
}

export interface PBRConfig {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  normalScale?: number;
  color?: number;
}

/** Pure: resolve a PBRConfig into MeshStandardMaterial parameters with sensible defaults. */
export function buildStandardMaterialParams(cfg: PBRConfig): THREE.MeshStandardMaterialParameters {
  return {
    color: new THREE.Color(cfg.color ?? 0xffffff),
    roughness: cfg.roughness ?? 1.0,
    metalness: cfg.metalness ?? 0.0,
    envMapIntensity: cfg.envMapIntensity ?? 1.0,
  };
}

export function createPBRMaterial(
  cfg: PBRConfig,
  maps: Partial<Record<TexSlot, THREE.Texture>>,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(buildStandardMaterialParams(cfg));
  const assign = (slot: TexSlot, set: (t: THREE.Texture) => void) => {
    const tex = maps[slot];
    if (!tex) return;
    tex.colorSpace = colorSpaceForSlot(slot);
    set(tex);
  };
  assign("albedo", (t) => (mat.map = t));
  assign("normal", (t) => { mat.normalMap = t; if (cfg.normalScale != null) mat.normalScale.set(cfg.normalScale, cfg.normalScale); });
  assign("roughness", (t) => (mat.roughnessMap = t));
  assign("metalness", (t) => (mat.metalnessMap = t));
  assign("ao", (t) => (mat.aoMap = t));
  assign("emissive", (t) => { mat.emissiveMap = t; mat.emissive = new THREE.Color(0xffffff); });
  mat.needsUpdate = true;
  return mat;
}

/**
 * Re-texture an existing model tree to PBR in place, preserving each mesh's albedo map and
 * vertex color. Mirrors `toonify` in assets.ts but produces grounded MeshStandardMaterial.
 */
export function applyPBR(root: THREE.Object3D, cfg: PBRConfig): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    m.castShadow = m.receiveShadow = true;
    const prev = m.material as THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
    const albedo = (prev as THREE.MeshStandardMaterial).map ?? undefined;
    if (albedo) albedo.colorSpace = THREE.SRGBColorSpace;
    m.material = new THREE.MeshStandardMaterial({
      ...buildStandardMaterialParams({ ...cfg, color: cfg.color ?? prev.color?.getHex() }),
      map: albedo ?? null,
    });
    (m.material as THREE.Material).needsUpdate = true;
  });
  return root;
}
