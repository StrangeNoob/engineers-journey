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

/** The presentation effects the recall sequence drives (kept behind an interface so the
 *  manager stays decoupled from the Gandalf/camera/audio/scroll concretes). */
export interface RecallFx {
  gandalf: { playGesture(name: "wave" | "listening", hold?: boolean): void; releaseGesture(): void };
  scroll: { show(x: number, z: number, faceYaw: number): void; hide(): void };
  camera: { focus(on: boolean): void };
  audio: { scroll(): void };
}

/** Manages proximity prompts + tale panel across all stops. */
export class StopManager {
  private prompt = new Prompt();
  private panel = new TalePanel();
  private flat: { id: string; x: number; z: number }[];
  private lastX = 0;
  private lastZ = 0;
  constructor(
    private readonly placed: PlacedStop[],
    private readonly content: Record<string, Stop>,
    private readonly journal: Journal,
    private readonly onChange: () => void,
    private readonly fx: RecallFx,
  ) {
    this.flat = placed.map((p) => ({ id: p.id, x: p.collider.x, z: p.collider.z }));
  }

  /** true while a tale panel is open (the main loop uses this to freeze movement). */
  get isPanelOpen(): boolean { return this.panel.isOpen; }

  update(playerPos: THREE.Vector3, camera: THREE.Camera, input: Input): void {
    this.lastX = playerPos.x; this.lastZ = playerPos.z;
    if (this.panel.isOpen) { this.prompt.hide(); return; }
    const near = nearestStop(playerPos.x, playerPos.z, this.flat, this.rangeFor());
    if (!near) { this.prompt.hide(); return; }
    const ps = this.placed.find((p) => p.id === near.id)!;
    this.prompt.showAt(ps.scrollPos, camera);
    if (input.state.interact) this.recall(near.id);
  }

  private rangeFor(): number { return 14; } // proximity from a stop's centre (covers larger footprints)

  private recall(id: string): void {
    const tale = this.content[id];
    if (!tale) { console.warn(`no tale content for stop "${id}"`); return; }
    const ps = this.placed.find((p) => p.id === id)!;
    const sx = ps.scrollPos.x, sz = ps.scrollPos.z;
    this.prompt.hide();
    this.journal.recall(id);
    this.onChange();
    this.fx.gandalf.playGesture("listening", true);          // hold the listening pose
    this.fx.scroll.show(sx, sz, Math.atan2(this.lastX - sx, this.lastZ - sz)); // face the player
    this.fx.audio.scroll();                                  // parchment rustle
    this.fx.camera.focus(true);                              // cinematic push-in
    this.panel.open(tale, () => {                            // unrolls; reversed on close
      this.fx.camera.focus(false);
      this.fx.scroll.hide();
      this.fx.gandalf.releaseGesture();
    });
  }
}
