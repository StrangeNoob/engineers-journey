export class Hud {
  private el = document.createElement("div");
  constructor() {
    this.el.id = "hud";
    this.el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;font:13px/1.4 'Iowan Old Style',Georgia,serif;letter-spacing:.06em;color:#2e2a22;text-shadow:0 1px 0 rgba(255,255,255,.4);pointer-events:none";
    document.body.appendChild(this.el);
  }
  set(count: number, total: number): void { this.el.textContent = `Tales recalled: ${count} / ${total}`; }
}
