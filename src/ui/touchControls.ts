import type { Input } from "../engine/input";

const isTouch = matchMedia("(pointer:coarse)").matches || "ontouchstart" in window;

/** Mounts a left-thumb joystick + right-half drag-look + an Interact button; feeds Input. */
export function mountTouchControls(input: Input): void {
  if (!isTouch) return;
  document.body.classList.add("is-touch");

  // joystick (left half)
  const base = el("position:fixed;left:26px;bottom:34px;width:120px;height:120px;border-radius:50%;background:rgba(247,242,230,.35);border:1px solid #d8cba8;z-index:7;touch-action:none");
  const knob = el("position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:rgba(46,42,34,.55)");
  base.appendChild(knob);
  document.body.appendChild(base);

  let jid = -1, cx = 0, cy = 0;
  base.addEventListener("pointerdown", (e) => { jid = e.pointerId; const r = base.getBoundingClientRect(); cx = r.left + 60; cy = r.top + 60; base.setPointerCapture(e.pointerId); });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1, max = 44;
    const cl = Math.min(len, max);
    dx = (dx / len) * cl; dy = (dy / len) * cl;
    knob.style.left = `${40 + dx}px`; knob.style.top = `${40 + dy}px`;
    input.setTouchMove({ forward: -dy / max, right: dx / max }, len > max * 0.8);
  });
  const release = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = -1; knob.style.left = "40px"; knob.style.top = "40px"; input.setTouchMove(null); };
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);

  // drag-look (right half of screen)
  let lid = -1, lx = 0, ly = 0;
  addEventListener("pointerdown", (e) => { if (e.clientX > innerWidth / 2 && lid === -1) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; } });
  addEventListener("pointermove", (e) => { if (e.pointerId === lid) { input.addLook(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; } });
  addEventListener("pointerup", (e) => { if (e.pointerId === lid) lid = -1; });

  // interact button
  const btn = el("position:fixed;right:26px;bottom:46px;z-index:7;padding:14px 20px;border-radius:999px;background:#b03a48;color:#fff;border:none;font:14px 'Iowan Old Style',Georgia,serif");
  btn.textContent = "Recall";
  btn.addEventListener("pointerdown", () => input.triggerInteract());
  document.body.appendChild(btn);
}

function el(css: string): HTMLDivElement { const d = document.createElement("div"); d.style.cssText = css; return d; }
