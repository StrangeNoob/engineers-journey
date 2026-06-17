import * as THREE from "three";

export type ConfigurableRenderer = Pick<
  THREE.WebGLRenderer,
  "toneMapping" | "toneMappingExposure" | "outputColorSpace"
>;

export interface RendererConfig {
  exposure: number;
  /** true → renderer applies ACES; false → post stack applies tone mapping (renderer stays NoToneMapping). */
  toneMapInRenderer: boolean;
}

/** Pure-ish: apply color + tone-mapping settings to a renderer (or stub). */
export function configureRenderer(r: ConfigurableRenderer, cfg: RendererConfig): void {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = cfg.toneMapInRenderer ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  r.toneMappingExposure = cfg.exposure;
}

export function createRenderer(): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  // Post stack owns tone mapping by default; main.ts may override for the no-post fallback.
  configureRenderer(r, { exposure: 1.0, toneMapInRenderer: false });
  return r;
}
