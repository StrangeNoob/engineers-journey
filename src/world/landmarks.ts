import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";
import { STOP_PLACEMENTS, ARGONATH, type Placement } from "../data/world";

export interface PlacedStop {
  id: string;
  scrollPos: THREE.Vector3;      // where the "recall" prompt anchors
  collider: { x: number; z: number; r: number };
}

/** Pure: is (px,pz) within `range` of (x,z)? */
export function withinLoadRange(x: number, z: number, px: number, pz: number, range: number): boolean {
  return Math.hypot(px - x, pz - z) <= range;
}

const LOAD_RANGE = 95;

function scrollPosFor(p: Placement): THREE.Vector3 {
  const toCentreX = -p.x, toCentreZ = -p.z;
  const len = Math.hypot(toCentreX, toCentreZ) || 1;
  const d = p.footprint * 0.55;
  return new THREE.Vector3(p.x + (toCentreX / len) * d, 0.6, p.z + (toCentreZ / len) * d);
}

export interface LandmarkRegistry {
  stops: PlacedStop[];
  update(playerPos: THREE.Vector3): void;
}

export function placeLandmarks(scene: THREE.Scene): LandmarkRegistry {
  const all: Placement[] = [...STOP_PLACEMENTS, ARGONATH];
  const loaded = new Set<string>();

  const stops: PlacedStop[] = STOP_PLACEMENTS.map((p) => ({
    id: p.id,
    scrollPos: scrollPosFor(p),
    collider: { x: p.x, z: p.z, r: p.footprint * 0.5 },
  }));

  function load(p: Placement): void {
    loaded.add(p.id);
    loadGLTF(p.id === "argonath" ? "argonath" : modelFor(p.id))
      .then((g) => {
        const root = g.scene as unknown as THREE.Group;
        toonify(root);
        fitToHeight(root, p.height); // scale by real-world height (human-relative)
        root.position.x = p.x; root.position.z = p.z;
        root.position.y -= p.sink;
        root.rotation.y = THREE.MathUtils.degToRad(p.facingDeg);
        scene.add(root);
      })
      .catch((e) => console.error(`landmark ${p.id} failed`, e));
  }

  return {
    stops,
    update(playerPos) {
      for (const p of all) {
        if (!loaded.has(p.id) && withinLoadRange(p.x, p.z, playerPos.x, playerPos.z, LOAD_RANGE)) load(p);
      }
    },
  };
}

function modelFor(id: string): string {
  const map: Record<string, string> = {
    shire: "shire-home", bywater: "bywater-mill", bree: "bree-inn",
    edoras: "edoras-hall", isengard: "isengard-tower", minas: "minas-tirith",
  };
  return map[id] ?? id;
}
