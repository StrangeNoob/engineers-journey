import type { QualityLevel } from "../engine/quality";

/** Pure: rolling frame-time average over a fixed window. */
export class FrameMeter {
  private buf: number[] = [];
  constructor(private size = 60) {}
  push(dtMs: number): void {
    this.buf.push(dtMs);
    if (this.buf.length > this.size) this.buf.shift();
  }
  get avgMs(): number {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  get fps(): number {
    const a = this.avgMs;
    return a > 0 ? 1000 / a : 0;
  }
}

export interface DebugOverlay { tick(dtSeconds: number): void; destroy(): void }

let activeOverlay: DebugOverlay | null = null;

/** Mounts the debug overlay. Idempotent — a prior mount is torn down first. Toggle with backtick or ?debug. */
export function mountDebugOverlay(opts: { level: QualityLevel; onLevel(l: QualityLevel): void }): DebugOverlay {
  activeOverlay?.destroy();
  const meter = new FrameMeter(60);
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:9999;font:12px monospace;background:rgba(0,0,0,.6);color:#9f9;padding:6px 8px;border-radius:6px;pointer-events:auto";
  const fps = document.createElement("div");
  const sel = document.createElement("select");
  (["high", "medium", "low"] as QualityLevel[]).forEach((l) => {
    const o = document.createElement("option"); o.value = l; o.textContent = l; if (l === opts.level) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => opts.onLevel(sel.value as QualityLevel);
  el.append(fps, sel);

  const enabled = location.search.includes("debug");
  if (enabled) document.body.appendChild(el);
  const key = (e: KeyboardEvent) => { if (e.code === "Backquote") el.parentElement ? el.remove() : document.body.appendChild(el); };
  addEventListener("keydown", key);

  const overlay: DebugOverlay = {
    tick(dtSeconds: number) {
      meter.push(dtSeconds * 1000);
      if (el.parentElement) fps.textContent = `${meter.fps.toFixed(0)} fps · ${meter.avgMs.toFixed(1)} ms`;
    },
    destroy() {
      removeEventListener("keydown", key);
      el.remove();
      if (activeOverlay === overlay) activeOverlay = null;
    },
  };
  activeOverlay = overlay;
  return overlay;
}
