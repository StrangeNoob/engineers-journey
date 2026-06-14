import * as THREE from "three";
import type { Stop } from "../data/career";
import type { Landmark } from "../world/landmarks";
import type { Input } from "../engine/input";
import type { Journal } from "./journal";
import { Prompt } from "../ui/prompt";
import { TalePanel } from "../ui/talePanel";

/** Pure: is (px,pz) within `r` of (cx,cz)? */
export function withinRadius(cx: number, cz: number, px: number, pz: number, r: number): boolean {
  return Math.hypot(px - cx, pz - cz) <= r;
}

export class Interaction {
  private prompt = new Prompt();
  private panel = new TalePanel();
  constructor(
    private readonly landmark: Landmark,
    private readonly stop: Stop,
    private readonly journal: Journal,
    private readonly onChange: () => void,
  ) {}

  /** call each frame. */
  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = withinRadius(this.landmark.collider.x, this.landmark.collider.z, playerPos.x, playerPos.z, this.landmark.collider.r + 3);
    if (near) {
      this.prompt.showAt(this.landmark.scrollPos, camera);
      if (input.state.interact) this.recall();
    } else this.prompt.hide();
  }
  private recall(): void {
    this.prompt.hide();
    this.journal.recall(this.stop.id);
    this.onChange();
    this.panel.open(this.stop, () => { /* closed */ });
  }
}
