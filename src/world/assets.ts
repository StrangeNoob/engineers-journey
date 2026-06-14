import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const cache = new Map<string, Promise<GLTF>>();
export function loadGLTF(name: string): Promise<GLTF> {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`/assets/models/${name}.glb`));
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
