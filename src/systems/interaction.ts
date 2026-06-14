import * as THREE from "three";
import type { Stop } from "../data/career";
import type { PlacedStop } from "../world/landmarks";
import type { Input } from "../engine/input";
import type { Journal } from "./journal";
import { Prompt } from "../ui/prompt";
import { TalePanel } from "../ui/talePanel";

/** Pure: is (px,pz) within `r` of (cx,cz)? */
export function withinRadius(cx: number, cz: number, px: number, pz: number, r: number): boolean {
  return Math.hypot(px - cx, pz - cz) <= r;
}

/** Pure: nearest stop (by collider centre) within `range`, else null. */
export function nearestStop<T extends { id: string; x: number; z: number }>(
  px: number, pz: number, stops: T[], range: number,
): T | null {
  let best: T | null = null, bestD = range;
  for (const s of stops) {
    const d = Math.hypot(px - s.x, pz - s.z);
    if (d <= bestD) { bestD = d; best = s; }
  }
  return best;
}

/** Manages proximity prompts + tale panel across all stops. */
export class StopManager {
  private prompt = new Prompt();
  private panel = new TalePanel();
  private flat: { id: string; x: number; z: number }[];
  constructor(
    private readonly placed: PlacedStop[],
    private readonly content: Record<string, Stop>,
    private readonly journal: Journal,
    private readonly onChange: () => void,
  ) {
    this.flat = placed.map((p) => ({ id: p.id, x: p.collider.x, z: p.collider.z }));
  }

  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = nearestStop(playerPos.x, playerPos.z, this.flat, this.rangeFor());
    if (!near) { this.prompt.hide(); return; }
    const ps = this.placed.find((p) => p.id === near.id)!;
    this.prompt.showAt(ps.scrollPos, camera);
    if (input.state.interact) this.recall(near.id);
  }

  private rangeFor(): number { return 14; } // proximity from a stop's centre (covers larger footprints)

  private recall(id: string): void {
    this.prompt.hide();
    this.journal.recall(id);
    this.onChange();
    this.panel.open(this.content[id], () => { /* closed */ });
  }
}
