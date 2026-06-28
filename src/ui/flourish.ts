const FONT = "'Iowan Old Style',Georgia,serif";

/** A brief gold "memory synchronized" flourish on tale recall. Respects prefers-reduced-motion. */
export class Flourish {
  private el = document.createElement("div");
  private title = document.createElement("div");
  private name = document.createElement("div");
  private live = document.createElement("div");
  private reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText =
      `position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;` +
      `text-align:center;opacity:0;font:18px ${FONT};color:#3a2f1c;text-shadow:0 1px 2px rgba(255,255,255,.5)`;
    // Persistent child nodes set via textContent — no innerHTML from runtime strings.
    this.title.textContent = "✦ MEMORY SYNCHRONIZED ✦";
    this.title.style.cssText = `font:13px ${FONT};letter-spacing:.18em;color:#9a7b2e`;
    this.name.style.cssText = "margin-top:4px";
    this.el.append(this.title, this.name);
    this.live.setAttribute("aria-live", "polite");
    this.live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)";
    document.body.append(this.el, this.live);
  }

  play(locale: string): void {
    this.name.textContent = locale;
    // clear first, then set on the next frame so an identical locale still re-announces
    this.live.textContent = "";
    requestAnimationFrame(() => { this.live.textContent = `Memory synchronized: ${locale}`; });
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
