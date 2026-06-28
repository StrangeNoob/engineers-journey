import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { loadGLTF, toonify, fitToHeight } from "./assets";
import { RIVER_POINTS } from "../data/world";
import { sunDirection } from "../engine/environment";
import type { Quality } from "../engine/quality";

type Collider = { x: number; z: number; r: number };

const RIVER_WIDTH = 6;  // metres across the reflective stream
const BANK_WIDTH = 13;  // metres across the pebble riverbank (wider than the water)

/** Horizontal gradient (transparent edges → opaque centre, constant down its length) used as an
 *  alphaMap so the pebble bank dissolves into the surrounding grass at its outer edges. */
function bankAlphaMap(): THREE.Texture {
  const w = 64, h = 4;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#000"); g.addColorStop(0.26, "#fff"); g.addColorStop(0.74, "#fff"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A flat ribbon following the river spline in world XZ (normal up). UVs: u across the width
 *  (0..1), v along the length (0..1) — per-texture repeat handles tiling vs the edge gradient. */
function bankRibbon(width: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 140, half = width / 2;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    let px = -tan.z, pz = tan.x; const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    pos.push(p.x - px * half, 0, p.z - pz * half); // left edge
    pos.push(p.x + px * half, 0, p.z + pz * half); // right edge
    uv.push(0, u); uv.push(1, u);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A pebble riverbank ribbon (real PBR pebbles) under + beside the water, edges faded into grass. */
function buildRiverbank(scene: THREE.Scene): void {
  const loader = new THREE.TextureLoader();
  const total = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z))).getLength();
  const tilesU = Math.max(1, Math.round(BANK_WIDTH / 2.2));   // ~2.2 m pebble tiles across the bank
  const tilesV = Math.max(1, Math.round(total / 2.2));        // …and along its length
  const map = (name: string, srgb = false): THREE.Texture => {
    const t = loader.load(`/assets/textures/pbr/riverbank_${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(tilesU, tilesV);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mat = new THREE.MeshStandardMaterial({
    map: map("albedo", true), normalMap: map("normal"), roughnessMap: map("roughness"),
    alphaMap: bankAlphaMap(), transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const bank = new THREE.Mesh(bankRibbon(BANK_WIDTH), mat);
  bank.position.y = 0.03;     // just above the terrain, under the water (0.06)
  bank.renderOrder = 1;
  bank.receiveShadow = true;
  scene.add(bank);
}

// fountain/well are sized by real-world HEIGHT (metres) for human scale
async function placeOnce(scene: THREE.Scene, name: string, x: number, z: number, height: number, ry = 0, colliders?: Collider[]): Promise<void> {
  const g = await loadGLTF(name);
  const m = (g.scene as unknown as THREE.Group).clone(true);
  toonify(m);
  const size = fitToHeight(m, height); // grounds the base at y=0 (sets position.y); returns world size
  m.position.x = x; m.position.z = z; m.position.y += 0.02; // keep grounding; tiny lift off the terrain
  m.rotation.y = ry;
  scene.add(m);
  if (colliders) colliders.push({ x, z, r: Math.max(size.x, size.z) * 0.45 });
}

/** A seamless tiling water-normal map built from a few integer-wavenumber ripples → RGB normals. */
function waterNormals(): THREE.Texture {
  const S = 256;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  // integer wavenumbers (kx,ky) so the field wraps seamlessly across S
  const waves: [number, number, number, number][] = [[3, 1, 1.0, 0], [1, -4, 0.7, 1.3], [5, 2, 0.45, 2.1], [-2, 3, 0.5, 0.7]];
  const height = (x: number, y: number): number => {
    let h = 0;
    for (const [kx, ky, amp, ph] of waves) h += amp * Math.sin((2 * Math.PI * (kx * x + ky * y)) / S + ph);
    return h;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hl = height((x - 1 + S) % S, y), hr = height((x + 1) % S, y);
    const hd = height(x, (y - 1 + S) % S), hu = height(x, (y + 1) % S);
    const nx = hl - hr, ny = hd - hu, nz = 2.2;
    const len = Math.hypot(nx, ny, nz) || 1;
    const i = (y * S + x) * 4;
    img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
    img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
    img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A flat ribbon following the river spline, built in the LOCAL XY plane (normal +Z) so that
 *  rotating the mesh −90° about X lays it flat with an upward normal — the orientation the
 *  Water reflector expects. UVs run 0..1 across the width and tile down the length. */
function riverRibbon(width: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const total = curve.getLength();
  const N = 140, half = width / 2;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    let px = -tan.z, pz = tan.x;                  // perpendicular in world XZ
    const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    // world edges → local XY as (wx, -wz) so rotateX(-90°) maps back to (wx, 0, wz)
    const lx0 = p.x - px * half, lz0 = p.z - pz * half;
    const lx1 = p.x + px * half, lz1 = p.z + pz * half;
    pos.push(lx0, -lz0, 0); pos.push(lx1, -lz1, 0);
    const v = (u * total) / width;                // ~square tiles for the normal map
    uv.push(0, v); uv.push(1, v);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Reflective river (Three.js Water on desktop; an env-reflective PBR fallback on mobile) along
 *  the spline, plus the fountain + well at Bree. Returns a per-frame ripple updater. */
export async function buildWater(
  scene: THREE.Scene, colliders: Collider[] = [], quality?: Quality,
): Promise<(dt: number) => void> {
  buildRiverbank(scene); // pebble bank under + beside the water
  const normals = waterNormals();
  const geo = riverRibbon(RIVER_WIDTH);
  let update: (dt: number) => void;

  if (!quality || quality.tier === "desktop") {
    const water = new Water(geo, {
      textureWidth: 256, textureHeight: 256, // reflection render-target; 256 is plenty for rippled water

      waterNormals: normals,
      sunDirection: sunDirection().negate(), // toward the sun — keep the glint aligned with the scene light
      sunColor: 0xfff0d8, waterColor: 0x274b59, distortionScale: 2.4,
      alpha: 0.92, fog: scene.fog !== null,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.06;
    water.renderOrder = 2; // above the pebble bank (renderOrder 1)
    scene.add(water);
    const u = (water.material as THREE.ShaderMaterial).uniforms;
    update = (dt) => { u.time.value += dt * 0.5; };
  } else {
    // mobile: skip the reflection pass — reflect the IBL environment + animate the normal map
    normals.repeat.set(1, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x274b59, transparent: true, opacity: 0.9, roughness: 0.12, metalness: 0.1,
      normalMap: normals, envMapIntensity: 1.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    mesh.renderOrder = 2; // above the pebble bank
    scene.add(mesh);
    update = (dt) => { normals.offset.y += dt * 0.04; };
  }

  await placeOnce(scene, "well", 12, 20, 3, 0, colliders);            // ~3 m well, in Bree's square
  await placeOnce(scene, "the-fountain", 6, 23, 3.2, 0, colliders);  // ~3 m fountain, clear of the well
  return update;
}
