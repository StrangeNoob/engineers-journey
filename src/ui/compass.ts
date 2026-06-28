import { STOP_PLACEMENTS } from "../data/world";
import type { Journal } from "../systems/journal";

export const COMPASS_FOV = 2.44; // visible arc ≈ ±70°

/** Pure: x-position (px) of a target's pip on a strip of width `stripW`, or null if the
 *  target's bearing (relative to camYaw) is outside ±fovRad/2. Uses the same atan2(dx,dz)
 *  convention as the player/camera yaw. */
export function bearingToStripX(
  camYaw: number, fromX: number, fromZ: number, toX: number, toZ: number, fovRad: number, stripW: number,
): number | null {
  const bearing = Math.atan2(toX - fromX, toZ - fromZ);
  let rel = bearing - camYaw;
  rel = rel - Math.round(rel / (Math.PI * 2)) * (Math.PI * 2); // wrap to (-PI, PI]
  if (Math.abs(rel) > fovRad / 2) return null;
  return (rel / (fovRad / 2)) * (stripW / 2) + stripW / 2;
}

const FONT = "'Iowan Old Style',Georgia,serif";
// cardinal directions as world unit-vectors: +x east, -z north
const CARDINALS: [string, number, number][] = [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]];

export class Compass {
  private el = document.createElement("div");
  private ticks: { dx: number; dz: number; el: HTMLElement }[] = [];
  private pips = new Map<string, HTMLElement>();

  constructor(private journal: Journal) {
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText =
      "position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(440px,68vw);height:26px;" +
      "z-index:6;pointer-events:none;overflow:hidden;border-radius:13px;" +
      "background:rgba(244,236,216,.55);border:1px solid #d8cba8;box-shadow:inset 0 0 12px rgba(0,0,0,.06)";
    // center heading line
    const center = document.createElement("div");
    center.style.cssText = "position:absolute;left:50%;top:3px;width:1px;height:20px;background:#b8a36a";
    this.el.appendChild(center);
    for (const [label, dx, dz] of CARDINALS) {
      const t = document.createElement("div");
      t.textContent = label;
      t.style.cssText = `position:absolute;top:5px;transform:translateX(-50%);font:11px ${FONT};color:#7a6f57;letter-spacing:.1em`;
      this.el.appendChild(t);
      this.ticks.push({ dx, dz, el: t });
    }
    for (const p of STOP_PLACEMENTS) {
      const pip = document.createElement("div");
      pip.style.cssText =
        "position:absolute;top:13px;transform:translate(-50%,-50%);width:7px;height:7px;border-radius:50%;" +
        "background:#caa24a;border:1px solid #8a6d28";
      this.el.appendChild(pip);
      this.pips.set(p.id, pip);
    }
    document.body.appendChild(this.el);
  }

  update(camYaw: number, px: number, pz: number): void {
    const w = this.el.clientWidth || 400;
    for (const t of this.ticks) {
      const x = bearingToStripX(camYaw, px, pz, px + t.dx, pz + t.dz, COMPASS_FOV, w);
      if (x == null) { t.el.style.display = "none"; } else { t.el.style.display = ""; t.el.style.left = `${x}px`; }
    }
    for (const p of STOP_PLACEMENTS) {
      const pip = this.pips.get(p.id)!;
      const x = bearingToStripX(camYaw, px, pz, p.x, p.z, COMPASS_FOV, w);
      if (x == null) { pip.style.display = "none"; continue; }
      pip.style.display = "";
      pip.style.left = `${x}px`;
      pip.style.opacity = this.journal.isVisited(p.id) ? "0.32" : "1";
    }
  }

  setVisible(v: boolean): void { this.el.style.display = v ? "" : "none"; }
}
