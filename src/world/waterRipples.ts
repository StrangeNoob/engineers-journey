import * as THREE from "three";
import { RIVER_POINTS } from "../data/world";

const RIVER_WIDTH = 6;       // matches the water ribbon in water.ts
const MAX = 20;              // pooled ripple rings
const SPAWN_INTERVAL = 0.26; // s between ripples while wading
const LIFE = 1.5;            // s a ripple lives
const START_R = 0.35;        // starting ring radius (m)
const GROW = 2.0;            // additional radius over its life (m)

// Sample the SAME Catmull-Rom spline buildWater() renders, so the wading test matches the
// visible ribbon on curves (the raw control-point polyline cuts inside the bends).
const RIVER_PATH: [number, number][] = new THREE.CatmullRomCurve3(
  RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
).getSpacedPoints(220).map((p) => [p.x, p.z] as [number, number]);

/** Min distance from (x,z) to the sampled river spline (same spline the water follows). */
function riverDist(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER_PATH.length - 1; i++) {
    const [ax, az] = RIVER_PATH[i], [bx, bz] = RIVER_PATH[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export interface WaterRipples { update(px: number, pz: number, py: number, dt: number, speed: number): void }

/** Expanding ring ripples spawned at the player's feet while they wade through the river. */
export function createWaterRipples(scene: THREE.Scene): WaterRipples {
  const geo = new THREE.RingGeometry(0.82, 1.0, 32); // unit-ish ring, scaled per ripple
  const pool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  for (let i = 0; i < MAX; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd4ecf5, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // lie flat on the water
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    pool.push({ mesh, mat, t: -1 });
  }
  let timer = 0;

  return {
    update(px, pz, py, dt, speed) {
      for (const r of pool) {
        if (r.t < 0) continue;
        r.t += dt;
        const k = r.t / LIFE;
        if (k >= 1) { r.t = -1; r.mesh.visible = false; continue; }
        r.mesh.scale.setScalar(START_R + k * GROW);
        r.mat.opacity = 0.45 * (1 - k);
      }
      // spawn while actually wading: over the river ribbon, at ground level (not up on the
      // bridge, which also passes over the river), and moving
      const wading = riverDist(px, pz) < RIVER_WIDTH / 2 && py < 0.5;
      timer -= dt;
      if (wading && speed > 0.6 && timer <= 0) {
        const free = pool.find((r) => r.t < 0);
        if (free) {
          free.mesh.position.set(px, 0.085, pz); // just above the water surface (≈0.06)
          free.mesh.scale.setScalar(START_R);
          free.mat.opacity = 0.45;
          free.mesh.visible = true;
          free.t = 0;
        }
        timer = SPAWN_INTERVAL;
      }
    },
  };
}
