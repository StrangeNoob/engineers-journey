import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import type { EffectFlags } from "./quality";

/** Sun position offset (matches the previous scene.ts SUN_OFFSET) → light direction. */
const SUN_OFFSET = new THREE.Vector3(-40, 70, 28);

export function sunDirection(): THREE.Vector3 {
  return SUN_OFFSET.clone().multiplyScalar(-1).normalize();
}

/** Pure: fog band derived from the tier's draw distance. */
export interface FogCfg { color: number; near: number; far: number }

export function fogConfig(drawDistance: number): FogCfg {
  return { color: 0xe7decb, near: Math.max(30, drawDistance * 0.25), far: drawDistance };
}

export interface Environment {
  update(x: number, z: number): void;
  dispose(): void;
  registerShadows(root: THREE.Object3D): void;
}

export async function createEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  flags: EffectFlags,
  drawDistance: number,
): Promise<Environment> {
  // 1. Image-based lighting: try HDRI, fall back to RoomEnvironment if missing.
  const pmrem = new THREE.PMREMGenerator(renderer);

  let envRT: THREE.WebGLRenderTarget;
  try {
    pmrem.compileEquirectangularShader();
    const hdr = await new RGBELoader().loadAsync("/assets/env/golden_hour_2k.hdr");
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    envRT = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
    pmrem.dispose();
  } catch (e) {
    console.warn(
      "[environment] HDRI /assets/env/golden_hour_2k.hdr not found — using RoomEnvironment placeholder IBL.",
      e,
    );
    pmrem.compileCubemapShader();
    const roomEnv = new RoomEnvironment();
    envRT = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();
  }

  scene.environment = envRT.texture;

  // 2. Fog.
  const f = fogConfig(drawDistance);
  scene.fog = new THREE.Fog(f.color, f.near, f.far);

  // 3. Sun + shadows. CSM on medium/high; single directional fallback on low.
  const dir = sunDirection();
  let csm: CSM | null = null;
  let sun: THREE.DirectionalLight | null = null;

  if (flags.csm) {
    // CSM API (three@0.160): constructor takes a data object; lightDirection is
    // the direction vector (not normalized internally — we pass a normalized clone).
    // The CSM .js source confirms: mode, cascades, shadowMapSize, parent, camera,
    // lightDirection, fade are all valid. `setupMaterial` and `update` confirmed.
    // Note: CSM does NOT expose a .remove() alias on dispose; we call dispose() only.
    csm = new CSM({
      maxFar: Math.min(drawDistance, 400),
      cascades: 3,
      mode: "practical",
      parent: scene,
      shadowMapSize: 2048,
      lightDirection: dir.clone(),
      camera,
    });
    csm.fade = true;
  } else {
    sun = new THREE.DirectionalLight(0xffe7bf, 2.0);
    sun.position.copy(SUN_OFFSET);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
  }

  // Register every MeshStandardMaterial under `root` with CSM (handles multi-material meshes).
  const registerCsm = (root: THREE.Object3D): void => {
    if (!csm) return;
    root.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) csm.setupMaterial(m);
      }
    });
  };

  // Register all materials in the scene with CSM on setup.
  registerCsm(scene);

  return {
    update(x: number, z: number) {
      if (csm) {
        csm.update();
      } else if (sun) {
        sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
        sun.target.position.set(x, 0, z);
        sun.target.updateMatrixWorld();
      }
    },
    dispose() {
      csm?.dispose();
      if (sun) { scene.remove(sun, sun.target); sun.dispose(); }
      envRT.dispose();
      scene.environment = null;
    },
    registerShadows(root: THREE.Object3D) {
      registerCsm(root);
    },
  };
}
