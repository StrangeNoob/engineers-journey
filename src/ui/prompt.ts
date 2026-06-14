import * as THREE from "three";
export class Prompt {
  private el = document.createElement("div");
  private visible = false;
  constructor() {
    this.el.textContent = "Press E · tap to recall this tale";
    this.el.style.cssText =
      "position:fixed;z-index:6;padding:7px 13px;border-radius:999px;background:rgba(247,242,230,.92);border:1px solid #d8cba8;font:13px 'Iowan Old Style',Georgia,serif;color:#2e2a22;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .2s";
    document.body.appendChild(this.el);
  }
  showAt(world: THREE.Vector3, camera: THREE.Camera): void {
    const p = world.clone().project(camera);
    if (p.z > 1) { this.hide(); return; }
    this.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    this.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    this.el.style.opacity = "1";
    this.visible = true;
  }
  hide(): void { if (this.visible) { this.el.style.opacity = "0"; this.visible = false; } }
}
