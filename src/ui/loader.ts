export function showBoot(): HTMLElement {
  const b = document.createElement("div");
  b.id = "boot";
  b.innerHTML = `<div><div class="ring"></div><div class="lab">Mapping the realm…</div></div>`;
  document.body.appendChild(b);
  return b;
}
export function hideBoot(b: HTMLElement): void { b.classList.add("gone"); }
