import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const cache = new Map<string, Promise<GLTF>>();
export function loadGLTF(name: string): Promise<GLTF> {
  if (!cache.has(name)) {
    const p = loader.loadAsync(`/assets/models/${name}.glb`);
    p.catch(() => cache.delete(name)); // evict a failed load so retries can recover
    cache.set(name, p);
  }
  return cache.get(name)!;
}

const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.needsUpdate = true;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
})();

/** Replace materials with toon shading; keep map+color. */
export function toonify(root: THREE.Object3D): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    if (Array.isArray(m.material)) return; // multi-material meshes: leave as-is (none in current assets)
    const mat = m.material as THREE.MeshStandardMaterial;
    m.material = new THREE.MeshToonMaterial({
      map: mat.map ?? null,
      color: mat.color?.clone() ?? new THREE.Color(0xcfc2a3),
      gradientMap: ramp,
    });
  });
  return root;
}

/** Uniform-scale an object so max(x,z) == footprint and base sits on y=0. */
export function fitToGround(obj: THREE.Object3D, footprint: number): void {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const k = footprint / Math.max(size.x, size.z);
  obj.scale.multiplyScalar(k);
  obj.position.y -= box.min.y * k;
}

/**
 * Uniform-scale an object to a real-world HEIGHT (metres; 1 unit = 1 m, Gandalf ≈ 1.9 m)
 * and sit its base on y=0. Returns the resulting world-space size so callers can derive a
 * footprint/collider. This is the primary sizing primitive — it keeps the world on a
 * consistent human scale (a person's height controls how tall everything reads).
 */
export function fitToHeight(obj: THREE.Object3D, height: number): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const k = height / (size.y || 1);
  obj.scale.multiplyScalar(k);
  obj.position.y -= box.min.y * k;
  return size.multiplyScalar(k);
}

let ktx2: KTX2Loader | null = null;
/** Shared KTX2 loader; needs the renderer once to detect GPU transcoder support. */
export function getKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
  }
  return ktx2;
}
