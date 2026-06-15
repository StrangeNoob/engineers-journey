import type { Journal } from "../systems/journal";
import { nearestStop, nearestUnvisited } from "../world/mapProjection";

export interface MapStop { id: string; name: string; x: number; z: number; }

const NS = "http://www.w3.org/2000/svg";

// app stop id ↔ the ids baked into public/assets/img/map.svg
const SVG_ID: Record<string, string> = {
  shire: "shire", bywater: "bywaterMill", bree: "bree",
  edoras: "edoras", isengard: "isengard", minas: "minasTirith",
};
const APP_ID: Record<string, string> = Object.fromEntries(Object.entries(SVG_ID).map(([a, s]) => [s, a]));
// marker anchor coords baked into the artwork (where each village is drawn)
const SVG_POS: Record<string, { x: number; y: number }> = {
  shire: { x: 240, y: 860 }, bywaterMill: { x: 285, y: 585 }, bree: { x: 650, y: 598 },
  edoras: { x: 790, y: 382 }, isengard: { x: 1124, y: 748 }, minasTirith: { x: 1324, y: 222 },
};

let stylesInjected = false;
function injectStyle(): void {
  if (stylesInjected) return; stylesInjected = true;
  const s = document.createElement("style");
  s.textContent =
    "#map svg{width:min(1120px,96vw);height:auto;max-height:92vh;border-radius:10px;filter:drop-shadow(0 18px 50px rgba(0,0,0,.55))}" +
    "#map .ej-state{stroke:#2e2a22;stroke-width:2.5;filter:drop-shadow(0 0 3px rgba(252,247,233,.95))}" +
    "#map .ej-visited{fill:#caa24a}" +
    "#map .ej-unvisited{fill:#efe6cf;opacity:.5}" +
    "@keyframes ejmapnudge{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.55);opacity:.4}}" +
    "#map .ej-nudge{fill:#b03a48;transform-box:fill-box;transform-origin:center;animation:ejmapnudge 1.4s ease-in-out infinite}";
  document.head.appendChild(s);
}

/** Full-screen illustrated-map overlay (public/assets/img/map.svg). Open with
 *  open(playerX,playerZ); the SVG hotspots fast-travel; a pin shows the nearest village. */
export class MapOverlay {
  private root = document.createElement("div");
  private svg?: SVGSVGElement;
  private marker?: SVGGraphicsElement;
  private mapBtn?: HTMLElement;
  private ready: Promise<void>;

  constructor(
    private readonly stops: MapStop[],
    private readonly journal: Journal,
    private readonly onTravel: (id: string) => void,
  ) {
    injectStyle();
    this.root.id = "map";
    this.root.setAttribute("inert", "");
    this.root.style.cssText =
      "position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:rgba(20,16,10,.6);" +
      "opacity:0;transition:opacity .3s ease;pointer-events:none";
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.close(); }); // backdrop
    addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen) this.close(); });
    document.body.appendChild(this.root);
    this.ready = this.load();
  }

  /** the element to return focus to on close (the HUD [Map] button). */
  setButton(btn: HTMLElement): void { this.mapBtn = btn; }

  private async load(): Promise<void> {
    let svg: SVGSVGElement;
    try {
      const text = await fetch("/assets/img/map.svg").then((r) => r.text());
      svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement as unknown as SVGSVGElement;
    } catch (e) { console.error("map.svg failed to load", e); return; }
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.querySelector("script")?.remove(); // we wire interactivity ourselves
    this.root.appendChild(svg);
    this.svg = svg;
    this.marker = (svg.querySelector("#current-location-marker") as SVGGraphicsElement | null) ?? undefined;

    // a small state dot per village (visited / nudge), drawn above the pin
    const layer = document.createElementNS(NS, "g");
    for (const appId of Object.keys(SVG_ID)) {
      const pos = SVG_POS[SVG_ID[appId]];
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", String(pos.x)); dot.setAttribute("cy", String(pos.y)); // on the village anchor
      dot.setAttribute("r", "11"); dot.setAttribute("class", "ej-state");
      dot.setAttribute("data-app", appId);
      layer.appendChild(dot);
    }
    svg.appendChild(layer);

    // make the pre-placed hotspots keyboard-focusable and fast-travel on activate
    svg.querySelectorAll<SVGCircleElement>(".hotspot").forEach((hs) => {
      const appId = APP_ID[hs.getAttribute("data-stop") ?? ""];
      if (!appId) return;
      hs.setAttribute("tabindex", "0");
      hs.setAttribute("role", "button");
      const go = () => { this.close(); this.onTravel(appId); };
      hs.addEventListener("click", go);
      hs.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  async open(playerX: number, playerZ: number): Promise<void> {
    await this.ready;
    if (!this.svg) return;
    // "you are here" pin → nearest village
    const pos = SVG_POS[SVG_ID[nearestStop(playerX, playerZ, this.stops)]];
    if (pos && this.marker) this.marker.setAttribute("transform", `translate(${pos.x} ${pos.y})`);

    const nudge = nearestUnvisited(playerX, playerZ, this.stops, (id) => this.journal.isVisited(id));
    this.svg.querySelectorAll<SVGCircleElement>(".hotspot").forEach((hs) => {
      const appId = APP_ID[hs.getAttribute("data-stop") ?? ""];
      const name = this.stops.find((s) => s.id === appId)?.name ?? appId;
      hs.setAttribute("aria-label", `Travel to ${name}${this.journal.isVisited(appId) ? " (visited)" : ""}`);
    });
    this.svg.querySelectorAll<SVGCircleElement>("[data-app]").forEach((dot) => {
      const appId = dot.getAttribute("data-app")!;
      dot.setAttribute("class", appId === nudge ? "ej-state ej-nudge"
        : this.journal.isVisited(appId) ? "ej-state ej-visited" : "ej-state ej-unvisited");
    });

    this.root.removeAttribute("inert");
    this.root.style.opacity = "1";
    this.root.style.pointerEvents = "auto";
    (this.svg.querySelector(".hotspot") as SVGCircleElement | null)?.focus();
  }

  close(): void {
    this.root.style.opacity = "0";
    this.root.style.pointerEvents = "none";
    this.root.setAttribute("inert", "");
    this.mapBtn?.focus();
  }

  get isOpen(): boolean { return !this.root.hasAttribute("inert"); }
}
