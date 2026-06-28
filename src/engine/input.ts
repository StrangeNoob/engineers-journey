export interface MoveAxes { forward: number; right: number; }

/** Pure: map held key codes to a movement axis pair in [-1,1]. */
export function keyboardMove(keys: Set<string>): MoveAxes {
  let forward = 0, right = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) right += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) right -= 1;
  return { forward, right };
}

export interface InputState {
  move: MoveAxes;     // -1..1 each axis (keyboard or joystick)
  run: boolean;
  lookDX: number;     // accumulated look delta since last consume
  lookDY: number;
  interact: boolean;  // edge-triggered this frame
  jump: boolean;      // edge-triggered this frame (Space)
}

/** Collects keyboard + pointer input; touch fills `move`/look via setters. */
export class Input {
  readonly state: InputState = { move: { forward: 0, right: 0 }, run: false, lookDX: 0, lookDY: 0, interact: false, jump: false };
  private keys = new Set<string>();
  private dragging = false;
  private touchMove: MoveAxes | null = null;
  private pendingInteract = false;
  private pendingJump = false;

  attach(dom: HTMLElement) {
    addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.state.run = true;
      if (e.code === "KeyE" && !e.repeat) this.pendingInteract = true; // ignore auto-repeat
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) this.pendingJump = true; } // suppress page scroll
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      // keep running if the other Shift is still held
      if (e.code === "ShiftLeft" || e.code === "ShiftRight")
        this.state.run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    });
    dom.addEventListener("pointerdown", (e) => { if (e.button === 0) this.dragging = true; });
    addEventListener("pointerup", () => { this.dragging = false; });
    addEventListener("pointermove", (e) => {
      if (this.dragging) { this.state.lookDX += e.movementX; this.state.lookDY += e.movementY; }
    });
  }

  /** touch joystick sets axes directly (-1..1); pass null to release. */
  setTouchMove(axes: MoveAxes | null, run = false) { this.touchMove = axes; this.state.run = axes ? run : false; }
  /** touch look-drag adds deltas. */
  addLook(dx: number, dy: number) { this.state.lookDX += dx; this.state.lookDY += dy; }
  /** touch interact button. */
  triggerInteract() { this.pendingInteract = true; }
  /** touch/programmatic jump button. */
  triggerJump() { this.pendingJump = true; }

  /** call once per frame BEFORE reading state.move/interact, AFTER camera reads look. */
  beginFrame() {
    this.state.move = this.touchMove ?? keyboardMove(this.keys);
    this.state.interact = this.pendingInteract;
    this.pendingInteract = false;
    this.state.jump = this.pendingJump;
    this.pendingJump = false;
  }
  /** call after camera consumes look deltas. */
  endFrame() { this.state.lookDX = 0; this.state.lookDY = 0; }
}
