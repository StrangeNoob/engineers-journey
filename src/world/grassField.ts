import * as THREE from "three";
import type { Quality } from "../engine/quality";
import { inAClearing, roadDist } from "./nature";
import { RIVER_POINTS } from "../data/world";
import { REGIONS } from "../data/regions";

// True if (x,z) sits on a region's solid paved/rock floor patch — grass shouldn't sprout
// through cobbles/stone (Bree, Isengard, Minas). Skips only the solid core (radius); grass
// resumes through the patch's falloff band so the edge still blends into the meadow.
function onPavedPatch(x: number, z: number): boolean {
  for (const region of REGIONS) {
    if (!region.ground) continue;
    const dx = x - region.center.x, dz = z - region.center.z;
    if (dx * dx + dz * dz < region.radius * region.radius) return true;
  }
  return false;
}

// min distance from (x,z) to the river polyline — keep grass out of the water
function riverDist(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
    const [ax, az] = RIVER_POINTS[i], [bx, bz] = RIVER_POINTS[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// deterministic scatter so the field is identical every load
const seed = { s: 1337 };
const rnd = () => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;

/** Two unit-height quads (width = aspect) crossed at 90°, base edge on y=0.
 *  Drawn double-sided, so each instance reads as a little 3D clump of grass. */
function crossedCard(aspect: number): THREE.BufferGeometry {
  const w = aspect / 2;
  const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
  let base = 0;
  for (const rot of [0, Math.PI / 2]) {
    const s = Math.sin(rot), c = Math.cos(rot);
    for (const [x, y] of [[-w, 0], [w, 0], [w, 1], [-w, 1]]) {
      verts.push(x * c, y, -x * s);            // rotate the quad about Y
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);          // base of card → bottom of image
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/** Unlit (texture carries its own shading) + alpha-cut + fog, with a wind-sway
 *  injected into the vertex stage so the tops drift and clumps wave out of phase. */
function grassMaterial(tex: THREE.Texture, time: { value: number }): THREE.Material {
  // Light green tint nudges the texture's pale seed-head tops toward a lush meadow green.
  // Kept light (near-bright) so values aren't crushed dark — a dark tint triggers bloom artifacts.
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0x9ed27e) });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float hf = position.y;                                   // 0 at base, 1 at tip
       vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
       float ph = ip.x * 0.3 + ip.z * 0.3 + uTime * 1.6;        // per-clump phase
       transformed.x += sin(ph) * 0.22 * hf;
       transformed.z += cos(ph * 0.85) * 0.12 * hf;`,
    );
  };
  return mat;
}

/** Dense field of tall grass billboards across the meadow (off the road + villages).
 *  Returns a per-frame updater that drives the wind animation. */
export async function buildGrassField(scene: THREE.Scene, quality: Quality): Promise<(t: number) => void> {
  const loader = new THREE.TextureLoader();
  // grass-card is the lush green tuft; the grass-1..4 set is wheat (golden tops) which
  // reads orange across a dense field, so the meadow uses the green one.
  const names = ["grass-card"];
  const texes = await Promise.all(names.map((n) => loader.loadAsync(`/assets/textures/${n}.png`)));
  const time = { value: 0 };
  const total = quality.tier === "mobile" ? 5000 : 15000; // alpha-tested billboards = heavy overdraw; trimmed for FPS
  const per = Math.floor(total / names.length);
  const d = new THREE.Object3D();

  for (const tex of texes) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = (tex.image.width || 1) / (tex.image.height || 1);
    const inst = new THREE.InstancedMesh(crossedCard(aspect), grassMaterial(tex, time), per);
    inst.castShadow = false; inst.receiveShadow = false;
    let n = 0, guard = 0;
    while (n < per && guard < per * 40) {
      guard++;
      const a = rnd() * 6.283, r = Math.pow(rnd(), 0.8) * 120; // a touch denser toward the centre
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (inAClearing(x, z, -2) || roadDist(x, z) < 2.8 || riverDist(x, z) < 5.5 || onPavedPatch(x, z)) continue; // hug the road edge, clear doorsteps + the pebble riverbank + paved squares
      const h = 1.2 + rnd() * 0.7;                                 // ~1.2–1.9 m tall — waist/chest high
      d.position.set(x, 0, z);
      d.rotation.y = rnd() * 6.283;
      d.scale.setScalar(h);
      d.updateMatrix();
      inst.setMatrixAt(n++, d.matrix);
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }
  return (t) => { time.value = t; };
}
