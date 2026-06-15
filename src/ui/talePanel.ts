import type { Stop } from "../data/career";

const REDUCED = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export class TalePanel {
  private el = document.createElement("aside");
  private onClose?: () => void;
  constructor() {
    this.el.id = "tale";
    this.el.setAttribute("inert", "");
    this.el.style.cssText =
      "position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);z-index:8;background:linear-gradient(180deg,#f4ecd8,#ece2c9);box-shadow:-12px 0 40px rgba(46,42,34,.22);clip-path:inset(0 0 100% 0);" +
      (REDUCED ? "" : "transition:clip-path .55s cubic-bezier(.6,.05,.2,1);") +
      "padding:60px 32px 32px;overflow-y:auto;font-family:'Iowan Old Style',Georgia,serif;color:#2e2a22";
    document.body.appendChild(this.el);
    addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  }
  open(stop: Stop, onClose: () => void): void {
    this.onClose = onClose;
    this.el.replaceChildren();
    const add = (tag: string, text: string, css: string) => {
      const n = document.createElement(tag); n.textContent = text; n.style.cssText = css; this.el.appendChild(n); return n;
    };
    const close = add("button", "✕", "position:absolute;top:16px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #d8cba8;background:none;cursor:pointer;font-size:17px");
    (close as HTMLButtonElement).onclick = () => this.close();
    add("div", stop.locale, "font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#b03a48");
    add("h2", stop.org.split("·")[0].trim(), "font-size:27px;margin:6px 0 2px");
    add("div", stop.org, "font-size:15px;opacity:.8");
    add("div", stop.era, "font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-top:4px");
    add("div", stop.headline, "font-size:19px;font-style:italic;margin:20px 0 14px;color:#5a3b2a");
    const ul = document.createElement("ul"); ul.style.cssText = "list-style:none;margin:0 0 18px;padding:0";
    for (const b of stop.bullets) {
      const li = document.createElement("li"); li.textContent = b;
      li.style.cssText = "position:relative;padding-left:18px;margin:9px 0;font-size:14.5px;line-height:1.5";
      ul.appendChild(li);
    }
    this.el.appendChild(ul);
    const chips = document.createElement("div"); chips.style.cssText = "display:flex;flex-wrap:wrap;gap:7px";
    for (const c of stop.stack) {
      const s = document.createElement("span"); s.textContent = c;
      s.style.cssText = "font-size:11.5px;border:1px solid #d8cba8;border-radius:999px;padding:4px 10px;background:rgba(255,255,255,.4)";
      chips.appendChild(s);
    }
    this.el.appendChild(chips);
    this.el.removeAttribute("inert");
    this.el.style.clipPath = "inset(0 0 0 0)"; // unroll top -> bottom
    (close as HTMLButtonElement).focus();
  }
  close(): void {
    this.el.style.clipPath = "inset(0 0 100% 0)"; // roll back up
    this.el.setAttribute("inert", "");
    this.onClose?.(); this.onClose = undefined;
  }
  get isOpen(): boolean { return !this.el.hasAttribute("inert"); }
}
