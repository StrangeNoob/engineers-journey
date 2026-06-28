export class Hud {
  readonly mapBtn = document.createElement("button");
  readonly muteBtn = document.createElement("button");
  constructor() {
    const btn = "z-index:7;font:12px/1 'Iowan Old Style',Georgia,serif;letter-spacing:.08em;color:#2e2a22;background:rgba(244,236,216,.92);border:1px solid #d8cba8;border-radius:999px;padding:9px 15px;cursor:pointer";
    // visible button text is the accessible name; no aria-label (avoids a label/name mismatch)
    this.mapBtn.textContent = "Map (M)";
    this.mapBtn.style.cssText = `position:fixed;top:12px;right:14px;${btn}`;
    this.muteBtn.style.cssText = `position:fixed;top:12px;right:104px;${btn}`;
    document.body.append(this.mapBtn, this.muteBtn);
    this.setMuted(false);
  }
  onMap(fn: () => void): void { this.mapBtn.onclick = fn; }
  onMute(fn: () => void): void { this.muteBtn.onclick = fn; }
  setMuted(muted: boolean): void { this.muteBtn.textContent = muted ? "Sound: off" : "Sound: on"; }
}
