import * as THREE from "three";
import { REGIONS } from "../data/regions";
import { regionWeight } from "../engine/atmosphere";

const COUNT = 1800;
const BOX = 70;   // horizontal extent of the snow column around the player (m)
const TOP = 26;   // column height (m)
const FALL = 3.2; // base fall speed (m/s)

/** A soft round white sprite for each flake. */
function flakeTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export interface Snow { update(px: number, pz: number, dt: number): void }

/** A falling-snow column that follows the player and fades in within the Isengard region. */
export function createSnow(scene: THREE.Scene): Snow {
  const iseng = REGIONS.find((r) => r.id === "isengard");
  if (!iseng) return { update() {} }; // no snowfall if the region config ever drops Isengard
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);     // per-flake fall-speed variance
  const drift = new Float32Array(COUNT * 2); // per-flake horizontal sway amplitude
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX;
    pos[i * 3 + 1] = Math.random() * TOP;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    vel[i] = FALL * (0.7 + Math.random() * 0.6);
    drift[i * 2] = (Math.random() - 0.5) * 0.6;
    drift[i * 2 + 1] = (Math.random() - 0.5) * 0.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: flakeTexture(), size: 0.34, sizeAttenuation: true,
    transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  let phase = 0;
  return {
    update(px, pz, dt) {
      const d = Math.hypot(px - iseng.center.x, pz - iseng.center.z);
      const w = regionWeight(d, iseng.radius, iseng.falloff); // 1 at centre → 0 outside the region
      mat.opacity = Math.sqrt(w) * 0.95; // ramp in early so snowfall reads across the region
      points.position.set(px, 0, pz);    // the column follows the player
      if (w <= 0.001) return;            // skip integration entirely when off-region
      phase += dt;
      const arr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= vel[i] * dt;
        arr[i * 3] += Math.sin(phase + i) * drift[i * 2] * dt;
        arr[i * 3 + 2] += Math.cos(phase + i) * drift[i * 2 + 1] * dt;
        if (arr[i * 3 + 1] < 0) { // recycle a landed flake to the top
          arr[i * 3 + 1] = TOP;
          arr[i * 3] = (Math.random() - 0.5) * BOX;
          arr[i * 3 + 2] = (Math.random() - 0.5) * BOX;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
