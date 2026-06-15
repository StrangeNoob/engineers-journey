/** A full-screen black curtain used to hide an instant teleport. */
export function createFade(): { teleport: (apply: () => void) => void } {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:12;background:#000;opacity:0;pointer-events:none;transition:opacity .28s ease";
  document.body.appendChild(el);
  return {
    teleport(apply) {
      el.style.opacity = "1";
      window.setTimeout(() => { apply(); el.style.opacity = "0"; }, 300); // move at peak black, then fade back
    },
  };
}
