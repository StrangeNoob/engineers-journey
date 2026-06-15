import type { Journal } from "../systems/journal";
import { ROAD_POINTS, RIVER_POINTS, ARGONATH } from "../data/world";
import { mapBounds, worldToMap, nearestUnvisited, type MapView } from "../world/mapProjection";

export interface MapStop { id: string; name: string; x: number; z: number; }

const VIEW: MapView = { w: 1000, h: 700, pad: 70 };
const NS = "http://www.w3.org/2000/svg";

/** Full-screen parchment map overlay. Open with open(playerX,playerZ); markers fast-travel. */
export class MapOverlay {
  private root = document.createElement("div");
  private svg!: SVGSVGElement;
  private mapBtn?: HTMLElement;
  private readonly bounds = mapBounds();

  constructor(
    private readonly stops: MapStop[],
    private readonly journal: Journal,
    private readonly onTravel: (id: string) => void,
  ) {
    this.root.id = "map";
    this.root.setAttribute("inert", "");
    this.root.style.cssText =
      "position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:rgba(20,16,10,.55);" +
      "opacity:0;transition:opacity .3s ease;pointer-events:none";
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.close(); }); // backdrop
    addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen) this.close(); });

    const style = document.getElementById("map-style") ?? document.createElement("style"); // inject once
    style.id = "map-style";
    style.textContent =
      "#map svg{width:min(900px,94vw);height:auto;filter:drop-shadow(0 18px 50px rgba(0,0,0,.5))}" +
      "#map .mk{cursor:pointer}#map .mk:focus{outline:none}" +
      "#map .mk:focus .ring,#map .mk:hover .ring{stroke:#b03a48;stroke-width:3}" +
      "@keyframes ejpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}" +
      "#map .pulse{transform-box:fill-box;transform-origin:center;animation:ejpulse 1.4s ease-in-out infinite}";
    document.head.appendChild(style);

    this.build();
    document.body.appendChild(this.root);
  }

  /** the element to return focus to on close (the HUD [Map] button). */
  setButton(btn: HTMLElement): void { this.mapBtn = btn; }

  private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  }

  private path(points: readonly [number, number][]): string {
    return points.map(([x, z], i) => {
      const { px, py } = worldToMap(x, z, this.bounds, VIEW);
      return `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    }).join(" ");
  }

  private build(): void {
    const svg = this.el("svg", { viewBox: `0 0 ${VIEW.w} ${VIEW.h}`, role: "dialog", "aria-label": "Journey map" });
    svg.appendChild(this.el("rect", { x: 8, y: 8, width: VIEW.w - 16, height: VIEW.h - 16, rx: 18, fill: "#e9dcc0" }));
    svg.appendChild(this.el("rect", { x: 20, y: 20, width: VIEW.w - 40, height: VIEW.h - 40, rx: 12, fill: "none", stroke: "#c2ad84", "stroke-width": 3 }));
    svg.appendChild(this.el("path", { d: this.path(RIVER_POINTS), fill: "none", stroke: "#7fb4c9", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85 }));
    svg.appendChild(this.el("path", { d: this.path(ROAD_POINTS), fill: "none", stroke: "#9c7b4d", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "1 12" }));
    const a = worldToMap(ARGONATH.x, ARGONATH.z, this.bounds, VIEW);
    const arg = this.el("text", { x: a.px, y: a.py + 7, "text-anchor": "middle", "font-size": 24, fill: "#6c5a3c" });
    arg.textContent = "⛩";
    svg.appendChild(arg);
    this.svg = svg;
    this.root.appendChild(svg);
  }

  open(playerX: number, playerZ: number): void {
    this.svg.querySelectorAll(".dyn").forEach((n) => n.remove()); // rebuild markers from current journal state
    const layer = this.el("g", { class: "dyn" });
    const nudge = nearestUnvisited(playerX, playerZ, this.stops, (id) => this.journal.isVisited(id));

    for (const s of this.stops) {
      const { px, py } = worldToMap(s.x, s.z, this.bounds, VIEW);
      const visited = this.journal.isVisited(s.id);
      const g = this.el("g", { class: "mk", tabindex: 0, role: "button", "aria-label": `Travel to ${s.name}${visited ? " (visited)" : ""}` });
      const ring = this.el("circle", { class: "ring", cx: px, cy: py, r: 14, fill: visited ? "#caa24a" : "#cabf9f", stroke: "#5a3b2a", "stroke-width": 2 });
      if (s.id === nudge) ring.classList.add("pulse");
      const label = this.el("text", { x: px, y: py - 22, "text-anchor": "middle", "font-size": 18, fill: "#3a2f20" });
      label.textContent = s.name;
      g.append(ring, label);
      const go = () => { this.close(); this.onTravel(s.id); };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      layer.appendChild(g);
    }
    const gp = worldToMap(playerX, playerZ, this.bounds, VIEW);
    layer.appendChild(this.el("circle", { cx: gp.px, cy: gp.py, r: 7, fill: "#2e2a22", stroke: "#fff", "stroke-width": 2 }));
    this.svg.appendChild(layer);

    this.root.removeAttribute("inert");
    this.root.style.opacity = "1";
    this.root.style.pointerEvents = "auto";
    (this.svg.querySelector(".mk") as SVGGElement | null)?.focus();
  }

  close(): void {
    this.root.style.opacity = "0";
    this.root.style.pointerEvents = "none";
    this.root.setAttribute("inert", "");
    this.mapBtn?.focus();
  }

  get isOpen(): boolean { return !this.root.hasAttribute("inert"); }
}
