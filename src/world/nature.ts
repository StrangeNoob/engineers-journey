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

function toonOf(src: THREE.Mesh, tint?: number): THREE.MeshToonMaterial {
  const mat = src.material as THREE.MeshStandardMaterial;
  const base = mat.color?.clone() ?? new THREE.Color(0x6f8147);
  if (tint !== undefined) base.multiply(new THREE.Color(tint));
  return new THREE.MeshToonMaterial({ map: mat.map ?? null, color: base, gradientMap: ramp });
}

const seed = { s: 91 };
const rnd = () => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;

// keep a clearing around every landmark sized to its (visual) footprint + a margin
export function inAClearing(x: number, z: number, margin: number): boolean {
  return [...STOP_PLACEMENTS, ARGONATH].some((p) => Math.hypot(x - p.x, z - p.z) < p.footprint * 0.55 + margin);
}

// distance from (x,z) to the road polyline (min distance to any segment)
export function roadDist(x: number, z: number): number {
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
// trees register here so we can hide the ones the camera gets too close to
interface TreeBank { mesh: THREE.InstancedMesh; xz: number[]; base: THREE.Matrix4[]; hidden: boolean[]; }
const treeBanks: TreeBank[] = [];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Hide tree instances within `r` of the camera (XZ) so the view never enters foliage. Per-frame. */
export function cullTreesNearCamera(cx: number, cz: number, r = 3): void {
  const r2 = r * r;
  for (const b of treeBanks) {
    let changed = false;
    for (let i = 0; i < b.base.length; i++) {
      const dx = b.xz[i * 2] - cx, dz = b.xz[i * 2 + 1] - cz;
      const near = dx * dx + dz * dz < r2;
      if (near !== b.hidden[i]) { b.mesh.setMatrixAt(i, near ? ZERO : b.base[i]); b.hidden[i] = near; changed = true; }
    }
    if (changed) b.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Collider { x: number; z: number; r: number; }

async function instance(scene: THREE.Scene, name: string, count: number, fit: number,
  place: (i: number, d: THREE.Object3D) => boolean,
  opts: { sink?: number; cullable?: boolean; tint?: number; collide?: { list: Collider[]; factor: number } } = {}): Promise<void> {
  const g = await loadGLTF(name);
  const src = firstMesh(g.scene);
  if (!src) return;
  src.geometry.computeBoundingBox();
  const bb = src.geometry.boundingBox!;            // local geometry bbox (models are center-origin)
  const size = new THREE.Vector3(); bb.getSize(size);
  const base = fit / (size.y || 1);
  // trunk/root-base radius (local units): the widest point in the bottom slice, where the
  // player's body actually meets the tree. Measured from geometry so the collider matches
  // the real trunk instead of a guessed constant.
  let trunkR = 0;
  if (opts.collide) {
    const p = src.geometry.getAttribute("position");
    const yCut = bb.min.y + size.y * 0.12;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) <= yCut) trunkR = Math.max(trunkR, Math.hypot(p.getX(i), p.getZ(i)));
    }
  }
  const inst = new THREE.InstancedMesh(src.geometry, toonOf(src, opts.tint), count);
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
    const rs = d.scale.x;                  // per-instance random scale (before the height fit)
    const s = rs * base;                   // final uniform scale
    d.scale.setScalar(s);
    d.position.y = -bb.min.y * s - (opts.sink ?? 0); // base on the ground, minus an optional sink
    d.updateMatrix();
    inst.setMatrixAt(n, d.matrix);
    // register the trunk's real footprint (local radius × this instance's world scale)
    if (opts.collide) opts.collide.list.push({ x: d.position.x, z: d.position.z, r: trunkR * s * opts.collide.factor });
    n++;
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  if (opts.cullable) {                     // record base matrices + positions for camera culling
    const xz: number[] = [], baseMats: THREE.Matrix4[] = [], m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { inst.getMatrixAt(i, m4); baseMats.push(m4.clone()); v.setFromMatrixPosition(m4); xz.push(v.x, v.z); }
    treeBanks.push({ mesh: inst, xz, base: baseMats, hidden: new Array(n).fill(false) });
  }
}

/** Forests (mallorn variants) + grass + scattered rocks + distant mountain backdrops. */
export async function scatterNature(scene: THREE.Scene, quality: Quality, colliders: { x: number; z: number; r: number }[] = []): Promise<void> {
  treeBanks.length = 0; // reset so a re-scatter never leaves stale banks for cullTreesNearCamera
  const per = Math.floor(quality.treeCount / 3);
  for (const name of ["mallorn-tree-1", "mallorn-tree-2", "mallorn-tree-3"]) {
    await instance(scene, name, per, 13 + rnd() * 4, (_, d) => { // mallorns ~10–19 m tall
      const a = rnd() * 6.283, r = 28 + rnd() * 210;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (inAClearing(x, z, 8) || roadDist(x, z) < 5) return false; // keep clear of villages + the road
      d.position.set(x, 0, z); d.rotation.y = rnd() * 6.283;
      d.scale.setScalar(0.8 + rnd() * 0.7);
      return true;
    }, { sink: 0.7, cullable: true, tint: 0x8fb45a, collide: { list: colliders, factor: 0.7 } }); // base in ground; solid trunk
  }
  // tall grass is its own billboard field (see world/grassField.ts) — replaces the old tufts.
  // distant mountain ring: an even circle of wide backdrop panels far enough out that they
  // never reach the play area (player roams to ~r90; ring is at r340). fit=55 → ~55 m tall,
  // ~205 m wide each, so 20 of them overlap into a continuous range on the horizon.
  const RING = 20, RR = 340;
  await instance(scene, "mountain-backdrop-square", RING, 55, (i, d) => {
    const a = (i / RING) * Math.PI * 2;
    d.position.set(Math.cos(a) * RR, 0, Math.sin(a) * RR);
    d.rotation.y = -a;              // face the centre of the world
    d.scale.setScalar(1);
    return true;
  });
}
