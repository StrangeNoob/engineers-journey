const FONT = "'Iowan Old Style',Georgia,serif";

/** A brief gold "memory synchronized" flourish on tale recall. Respects prefers-reduced-motion. */
export class Flourish {
  private el = document.createElement("div");
  private live = document.createElement("div");
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText =
      `position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;` +
      `text-align:center;opacity:0;font:18px ${FONT};color:#3a2f1c;text-shadow:0 1px 2px rgba(255,255,255,.5)`;
    this.live.setAttribute("aria-live", "polite");
    this.live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    document.body.append(this.el, this.live);
  }

  play(locale: string): void {
    this.live.textContent = `Memory synchronized: ${locale}`;
    this.el.innerHTML =
      `<div style="font:13px ${FONT};letter-spacing:.18em;color:#9a7b2e">✦ MEMORY SYNCHRONIZED ✦</div>` +
      `<div style="margin-top:4px">${locale}</div>`;
    if (this.timer) clearTimeout(this.timer);
    if (this.reduced) {
      this.el.style.transition = "none";
      this.el.style.opacity = "1";
      this.timer = setTimeout(() => { this.el.style.opacity = "0"; }, 1600);
      return;
    }
    this.el.style.transition = "none";
    this.el.style.opacity = "0";
    this.el.style.transform = "translate(-50%,-50%) scale(.92)";
    requestAnimationFrame(() => {
      this.el.style.transition = "opacity .5s ease, transform .5s ease";
      this.el.style.opacity = "1";
      this.el.style.transform = "translate(-50%,-50%) scale(1)";
    });
    this.timer = setTimeout(() => { this.el.style.opacity = "0"; }, 1600);
  }
}
