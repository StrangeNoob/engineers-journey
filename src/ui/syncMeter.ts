/** Pure: filled-state per ordered id. */
export function segments(isVisited: (id: string) => boolean, orderedIds: string[]): boolean[] {
  return orderedIds.map((id) => isVisited(id));
}

const FONT = "'Iowan Old Style',Georgia,serif";

export class SyncMeter {
  private el = document.createElement("div");
  private label = document.createElement("span");
  private segs: HTMLElement[] = [];

  constructor(private orderedIds: string[]) {
    this.el.setAttribute("role", "img");
    this.el.style.cssText =
      `position:fixed;top:12px;left:14px;z-index:6;display:flex;flex-direction:column;gap:5px;` +
      `pointer-events:none;font:12px ${FONT};color:#2e2a22`;
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:3px";
    for (let i = 0; i < orderedIds.length; i++) {
      const s = document.createElement("div");
      s.style.cssText = "width:22px;height:7px;border-radius:3px;border:1px solid #c9b888;background:rgba(244,236,216,.5)";
      bar.appendChild(s);
      this.segs.push(s);
    }
    this.label.style.cssText = "letter-spacing:.06em;text-shadow:0 1px 0 rgba(255,255,255,.4)";
    this.label.textContent = `Synchronization 0 / ${orderedIds.length}`; // accessible name before the first set()
    this.el.setAttribute("aria-label", `Synchronization 0 of ${orderedIds.length}`);
    this.el.append(bar, this.label);
    document.body.appendChild(this.el);
  }

  set(isVisited: (id: string) => boolean): void {
    const seg = segments(isVisited, this.orderedIds);
    const count = seg.filter(Boolean).length;
    seg.forEach((on, i) => {
      this.segs[i].style.background = on ? "#caa24a" : "rgba(244,236,216,.5)";
      this.segs[i].style.borderColor = on ? "#8a6d28" : "#c9b888";
    });
    const total = this.orderedIds.length;
    this.label.textContent = `Synchronization ${count} / ${total}`;
    this.el.setAttribute("aria-label", `Synchronization ${count} of ${total}`);
  }
}
