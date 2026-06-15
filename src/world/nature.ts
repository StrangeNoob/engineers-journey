import * as THREE from "three";
import { loadGLTF } from "./assets";
import type { Quality } from "../engine/quality";
import { STOP_PLACEMENTS, ARGONATH, ROAD_POINTS } from "../data/world";

const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.needsUpdate = true; t.minFilter = t.magFilter = THREE.NearestFilter; return t;
})();

function firstMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !found) found = m; });
  return found;
}

function toonOf(src: THREE.Mesh): THREE.MeshToonMaterial {
  const mat = src.material as THREE.MeshStandardMaterial;
  return new THREE.MeshToonMaterial({ map: mat.map ?? null, color: mat.color?.clone() ?? new THREE.Color(0x6f8147), gradientMap: ramp });
}

const seed = { s: 91 };
const rnd = () => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;

// keep a clearing around every landmark sized to its (visual) footprint + a margin
function inAClearing(x: number, z: number, margin: number): boolean {
  return [...STOP_PLACEMENTS, ARGONATH].some((p) => Math.hypot(x - p.x, z - p.z) < p.footprint * 0.55 + margin);
}

// distance from (x,z) to the road polyline (min distance to any segment)
function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i++) {
    const [ax, az] = ROAD_POINTS[i], [bx, bz] = ROAD_POINTS[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** InstancedMesh a model's first mesh `count` times via the placement callback. */
async function instance(scene: THREE.Scene, name: string, count: number, fit: number,
  place: (i: number, d: THREE.Object3D) => boolean): Promise<void> {
  const g = await loadGLTF(name);
  const src = firstMesh(g.scene);
  if (!src) return;
  src.geometry.computeBoundingBox();
  const bb = src.geometry.boundingBox!;            // local geometry bbox (models are center-origin)
  const size = new THREE.Vector3(); bb.getSize(size);
  const base = fit / (size.y || 1);
  const inst = new THREE.InstancedMesh(src.geometry, toonOf(src), count);
  // only trees cast shadows; grass is too small to matter and the giant mountain
  // backdrops would smear huge dark shadows across the whole world.
  inst.castShadow = !(name.includes("grass") || name.includes("mountain"));
  inst.receiveShadow = true;
  const d = new THREE.Object3D();
  let n = 0;
  let guard = 0;
  while (n < count && guard < count * 40) {
    guard++;
    d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.setScalar(1);
    if (!place(n, d)) continue;            // place sets x/z position, y-rotation, and a uniform scale
    const s = d.scale.x * base;            // final uniform scale
    d.scale.setScalar(s);
    d.position.y = -bb.min.y * s;          // lift the base onto the ground (y=0)
    d.updateMatrix();
    inst.setMatrixAt(n++, d.matrix);
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

/** Forests (mallorn variants) + grass + scattered rocks + distant mountain backdrops. */
export async function scatterNature(scene: THREE.Scene, quality: Quality): Promise<void> {
  const per = Math.floor(quality.treeCount / 3);
  for (const name of ["mallorn-tree-1", "mallorn-tree-2", "mallorn-tree-3"]) {
    await instance(scene, name, per, 13 + rnd() * 4, (_, d) => { // mallorns ~10–19 m tall
      const a = rnd() * 6.283, r = 28 + rnd() * 210;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (inAClearing(x, z, 8) || roadDist(x, z) < 5) return false; // keep clear of villages + the road
      d.position.set(x, 0, z); d.rotation.y = rnd() * 6.283;
      d.scale.setScalar(0.8 + rnd() * 0.7);
      return true;
    });
  }
  await instance(scene, "grass-tuft", quality.grassCount, 0.5, (_, d) => { // ~knee-high tufts
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 130;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inAClearing(x, z, -1) || roadDist(x, z) < 2.2) return false; // off the road + out of building footprints
    d.position.set(x, 0, z);
    d.rotation.y = rnd() * 6.283; d.scale.setScalar(0.7 + rnd() * 0.8);
    return true;
  });
  await instance(scene, "mountain-backdrop", 14, 110, (_, d) => { // towering, distant
    const a = rnd() * 6.283, r = 230 + rnd() * 70;
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    d.rotation.y = rnd() * 6.283; d.scale.setScalar(1 + rnd() * 0.8);
    return true;
  });
}
