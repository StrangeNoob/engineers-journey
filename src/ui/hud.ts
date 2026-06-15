export class Hud {
  private el = document.createElement("div");
  readonly mapBtn = document.createElement("button");
  constructor() {
    this.el.id = "hud";
    this.el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;font:13px/1.4 'Iowan Old Style',Georgia,serif;letter-spacing:.06em;color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.4);pointer-events:none";
    this.mapBtn.textContent = "Map (M)";
    this.mapBtn.setAttribute("aria-label", "Open the journey map");
    this.mapBtn.style.cssText =
      "position:fixed;top:12px;right:14px;z-index:7;font:12px/1 'Iowan Old Style',Georgia,serif;letter-spacing:.08em;color:#2e2a22;background:rgba(244,236,216,.92);border:1px solid #d8cba8;border-radius:999px;padding:9px 15px;cursor:pointer";
    document.body.appendChild(this.el);
    document.body.appendChild(this.mapBtn);
  }
  set(count: number, total: number): void { this.el.textContent = `Tales recalled: ${count} / ${total}`; }
  onMap(fn: () => void): void { this.mapBtn.onclick = fn; }
}
