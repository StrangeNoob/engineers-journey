import * as THREE from "three";
import { STOP_PLACEMENTS } from "../data/world";

export interface MarkerPos { x: number; y: number; onScreen: boolean; angleDeg: number }

/** Pure: map a target's NDC (from camera.project: x,y in [-1,1], plus `behind` = z>1) to a
 *  screen pixel position. On-screen → passthrough. Off-screen/behind → clamp the direction to
 *  the viewport rectangle inset by `margin`, with `angleDeg` pointing screen-ward toward it. */
export function screenMarker(ndcX: number, ndcY: number, behind: boolean, margin: number, w: number, h: number): MarkerPos {
  let nx = ndcX, ny = ndcY;
  if (behind) { nx = -nx; ny = -ny; } // a behind-camera point projects mirrored; flip back
  const onScreen = !behind && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
  if (onScreen) {
    return { x: (nx * 0.5 + 0.5) * w, y: (-ny * 0.5 + 0.5) * h, onScreen: true, angleDeg: 0 };
  }
  const mx = margin / (w / 2), my = margin / (h / 2); // margin expressed in NDC
  // scale the direction (nx,ny) out to the inset rectangle edge
  const t = Math.min((1 - mx) / (Math.abs(nx) || 1e-6), (1 - my) / (Math.abs(ny) || 1e-6));
  const ex = nx * t, ey = ny * t;
  return {
    x: (ex * 0.5 + 0.5) * w,
    y: (-ey * 0.5 + 0.5) * h,
    onScreen: false,
    angleDeg: Math.atan2(-ny, nx) * 180 / Math.PI, // screen-space: +x right, +y up
  };
}

const FONT = "'Iowan Old Style',Georgia,serif";

export class Waypoints {
  private markers = new Map<string, { wrap: HTMLElement; seal: HTMLElement; dist: HTMLElement }>();
  private v = new THREE.Vector3();

  constructor(names: Record<string, string>) {
    for (const p of STOP_PLACEMENTS) {
      const wrap = document.createElement("div");
      wrap.setAttribute("aria-hidden", "true");
      wrap.style.cssText = "position:fixed;z-index:6;transform:translate(-50%,-50%);pointer-events:none;text-align:center";
      const seal = document.createElement("div");
      seal.style.cssText =
        "width:16px;height:16px;margin:0 auto;border-radius:50%;background:rgba(202,162,74,.92);" +
        "border:1.5px solid #8a6d28;box-shadow:0 1px 3px rgba(0,0,0,.25);color:#3a2f10;" +
        `font:10px ${FONT};line-height:14px`;
      const dist = document.createElement("div");
      dist.style.cssText = `margin-top:2px;font:10px ${FONT};color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.5);letter-spacing:.04em`;
      const title = document.createElement("div");
      title.textContent = names[p.id] ?? p.id;
      title.style.cssText = `font:10px ${FONT};color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.5);white-space:nowrap`;
      wrap.append(seal, title, dist);
      document.body.appendChild(wrap);
      this.markers.set(p.id, { wrap, seal, dist });
    }
  }

  update(camera: THREE.Camera, px: number, pz: number, isVisited: (id: string) => boolean): void {
    const w = innerWidth, h = innerHeight;
    for (const p of STOP_PLACEMENTS) {
      const m = this.markers.get(p.id)!;
      this.v.set(p.x, (p.height ?? 6) + 1, p.z);
      const ndc = this.v.clone().project(camera);
      const behind = ndc.z > 1;
      const pos = screenMarker(ndc.x, ndc.y, behind, 28, w, h);
      const visited = isVisited(p.id);
      // off-screen visited landmarks stay quiet (no edge arrows nagging you back)
      if (!pos.onScreen && visited) { m.wrap.style.display = "none"; continue; }
      m.wrap.style.display = "";
      m.wrap.style.left = `${pos.x}px`;
      m.wrap.style.top = `${pos.y}px`;
      if (pos.onScreen) {
        m.wrap.style.transform = "translate(-50%,-50%)";
        m.seal.textContent = visited ? "✓" : "◆";
        m.seal.style.opacity = visited ? "0.55" : "1";
        m.dist.textContent = `${Math.round(Math.hypot(p.x - px, p.z - pz))} m`;
        m.dist.style.display = "";
      } else {
        // off-screen unvisited: a directional arrow rotated toward the target
        m.wrap.style.transform = `translate(-50%,-50%) rotate(${pos.angleDeg}deg)`;
        m.seal.textContent = "➤";
        m.seal.style.opacity = "1";
        m.dist.style.display = "none";
      }
    }
  }

  setVisible(v: boolean): void {
    for (const m of this.markers.values()) m.wrap.style.visibility = v ? "" : "hidden";
  }
}
