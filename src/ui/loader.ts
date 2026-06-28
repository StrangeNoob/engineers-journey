import * as THREE from "three";

const SERIF = "'Iowan Old Style',Georgia,serif";
const TITLE = "An Engineer's Journey to Middle-earth";

// Anglo-Saxon / Cirth-style runes (Unicode Runic block — renders with system fonts).
const RUNES: Record<string, string> = {
  a: "ᚪ", b: "ᛒ", c: "ᚳ", d: "ᛞ", e: "ᛖ", f: "ᚠ", g: "ᚷ", h: "ᚻ", i: "ᛁ", j: "ᛡ", k: "ᚳ", l: "ᛚ", m: "ᛗ",
  n: "ᚾ", o: "ᚩ", p: "ᛈ", q: "ᚳ", r: "ᚱ", s: "ᛋ", t: "ᛏ", u: "ᚢ", v: "ᚠ", w: "ᚹ", x: "ᛉ", y: "ᚣ", z: "ᛉ",
};
const toRunes = (s: string): string => [...s.toLowerCase()].map((c) => (c === " " ? "᛫" : RUNES[c] ?? "")).join("");

// "Ennor" (Sindarin: Middle-earth) in Alcarin Tengwar CSUR codepoints:
// carrier+e · númen · númen · carrier+o · rómen
const TENGWAR = [0xe02e, 0xe040, 0xe010, 0xe010, 0xe02e, 0xe041, 0xe020].map((c) => String.fromCodePoint(c)).join("");

interface Variant { label: string; text: string; dir?: "rtl"; teng?: boolean; roman?: string }
const VARIANTS: Variant[] = [
  { label: "English",            text: TITLE },
  { label: "Ελληνικά",           text: "Το Ταξίδι ενός Μηχανικού στη Μέση Γη" },
  { label: "Русский",            text: "Путешествие инженера в Средиземье" },
  { label: "日本語",              text: "エンジニアの中つ国への旅" },
  { label: "हिन्दी",              text: "एक इंजीनियर की मध्य-धरा यात्रा" },
  { label: "العربية",            text: "رحلة مهندس إلى الأرض الوسطى", dir: "rtl" },
  { label: "Cirth",              text: toRunes(TITLE) },
  { label: "Tengwar / Sindarin", text: TENGWAR, teng: true, roman: "Lend na Ennor — Journey to Middle-earth" },
];

interface BootEl extends HTMLElement { _timer?: number; _dead?: boolean; _bar?: HTMLElement }

/** A themed loading screen: a typewriter that retypes the title across world scripts, Cirth
 *  runes and Tengwar (Elvish), over a real progress bar driven by Three's loading manager. */
export function showBoot(): HTMLElement {
  const style = document.createElement("style");
  style.textContent =
    "@font-face{font-family:'AlcarinTengwar';src:url('/assets/fonts/AlcarinTengwar.woff2') format('woff2');font-display:swap}" +
    "@keyframes ej-blink{50%{opacity:0}}";
  document.head.appendChild(style);

  const b = document.createElement("div") as BootEl;
  b.id = "boot";
  b.style.cssText =
    "position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;" +
    "background:radial-gradient(circle at 50% 36%,#f6efdc,#e7dabb 68%,#d6c596);color:#3a2f1c;text-align:center;padding:24px;" +
    `font-family:${SERIF};opacity:1;transition:opacity .6s ease`;

  const sup = document.createElement("div");
  sup.textContent = "An Engineer's Journey";
  sup.style.cssText = "font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:#9a7b2e";

  const line = document.createElement("div"); // the typewriter line
  line.style.cssText = "min-height:1.5em;font-size:clamp(20px,3.6vw,30px);letter-spacing:.01em;max-width:90vw";
  const caret = document.createElement("span");
  caret.textContent = "▍";
  caret.style.cssText = "color:#caa24a;animation:ej-blink 1s step-end infinite";

  const roman = document.createElement("div"); // romanized line (shown for the Tengwar pass)
  roman.style.cssText = "min-height:1.1em;font-size:13px;font-style:italic;color:#6a5a3a;transition:opacity .3s";

  const lab = document.createElement("div");
  lab.className = "lab"; // kept: the bootstrap error handler writes the failure message here
  lab.style.cssText = "font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#a9966a";

  const track = document.createElement("div");
  track.style.cssText = "width:min(320px,62vw);height:6px;border-radius:3px;background:rgba(58,47,28,.16);overflow:hidden;margin-top:12px;box-shadow:inset 0 1px 2px rgba(58,47,28,.18)";
  const bar = document.createElement("div");
  bar.style.cssText = "height:100%;width:6%;border-radius:3px;background:linear-gradient(90deg,#d8b25a,#9a7b2e);transition:width .35s ease";
  track.appendChild(bar);
  b._bar = bar;

  b.append(sup, line, roman, lab, track);
  document.body.appendChild(b);

  // real progress (every texture/GLB load); total grows as loads queue, so keep it monotonic
  let pct = 6;
  THREE.DefaultLoadingManager.onProgress = (_u, loaded, total) => {
    if (!total) return;
    pct = Math.max(pct, 6 + (loaded / total) * 92);
    bar.style.width = `${Math.min(98, pct)}%`;
  };

  // typewriter: type a variant, hold, erase, advance, loop
  let vi = 0;
  const render = (v: Variant, shown: string) => {
    line.dir = v.dir ?? "ltr";
    line.style.fontFamily = v.teng ? "'AlcarinTengwar'" : SERIF;
    line.replaceChildren(document.createTextNode(shown), caret);
    roman.textContent = v.teng ? (v.roman ?? "") : "";
    lab.textContent = v.label;
  };
  const step = (delay: number, fn: () => void) => { b._timer = window.setTimeout(() => { if (!b._dead) fn(); }, delay); };
  // split into grapheme clusters so combining marks (Devanagari/Arabic vowel signs, Tengwar
  // tehtar) stay attached to their base while typing instead of flashing in/out on their own.
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : undefined;
  const graphemes = (text: string): string[] =>
    segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : [...text];

  function typeIn(v: Variant, chars: string[], i: number): void {
    render(v, chars.slice(0, i).join(""));
    if (i < chars.length) step(45, () => typeIn(v, chars, i + 1));
    else step(1200, () => eraseOut(v, chars, chars.length));
  }
  function eraseOut(v: Variant, chars: string[], i: number): void {
    render(v, chars.slice(0, i).join(""));
    if (i > 0) step(22, () => eraseOut(v, chars, i - 1));
    else { vi = (vi + 1) % VARIANTS.length; const nv = VARIANTS[vi]; step(260, () => typeIn(nv, graphemes(nv.text), 0)); }
  }
  typeIn(VARIANTS[0], graphemes(VARIANTS[0].text), 0);

  return b;
}

export function hideBoot(b: HTMLElement): void {
  const boot = b as BootEl;
  boot._dead = true;
  if (boot._timer) clearTimeout(boot._timer);
  if (boot._bar) boot._bar.style.width = "100%";
  THREE.DefaultLoadingManager.onProgress = () => {};
  setTimeout(() => { b.style.opacity = "0"; setTimeout(() => b.remove(), 600); }, 240);
}
