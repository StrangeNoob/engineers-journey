import { PEAK, SUMMIT_R } from "../world/viewpoint";

/** Fires `onReach` when the player enters the summit zone; re-arms after they leave. */
export class ViewpointTrigger {
  private armed = true;
  constructor(private onReach: () => void) {}
  update(x: number, z: number): void {
    const inside = Math.hypot(x - PEAK.x, z - PEAK.z) <= SUMMIT_R;
    if (inside && this.armed) { this.armed = false; this.onReach(); }
    else if (!inside) this.armed = true;
  }
}
