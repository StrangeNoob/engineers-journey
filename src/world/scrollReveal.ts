import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";
import type { PlacedStop } from "./landmarks";
import type { Stop } from "../data/career";

export interface Scrolls {
  /** Scroll roots (each tagged `userData.stopId`) for click/tap raycasting. */
  pickables: THREE.Object3D[];
}

/** A transparent canvas texture with the chapter title + role, for the scroll's face. */
function titleTexture(locale: string, org: string): THREE.Texture {
  const W = 512, H = 512;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  // title (wrap to two lines if long)
  ctx.fillStyle = "#3a2f1c";
  ctx.font = "bold 50px 'Iowan Old Style', Georgia, serif";
  const words = locale.split(" ");
  const lines = words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [locale];
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 210 + i * 56));
  // role beneath
  ctx.fillStyle = "#6a4a2a";
  ctx.font = "30px 'Iowan Old Style', Georgia, serif";
  ctx.fillText(org.split("·")[0].trim(), W / 2, 210 + lines.length * 56 + 30);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/** Place a persistent portfolio-scroll at each landmark, tagged with its stop id for click/tap
 *  picking, with the chapter title rendered on the face. (Replaces the old rise-on-recall scroll.) */
export async function buildScrolls(
  scene: THREE.Scene, placed: PlacedStop[], content: Record<string, Stop>,
): Promise<Scrolls> {
  const g = await loadGLTF("portfolio-scroll");
  const pickables: THREE.Object3D[] = [];
  for (const ps of placed) {
    const tale = content[ps.id];
    if (!tale) continue;
    const model = (g.scene as unknown as THREE.Group).clone(true);
    toonify(model);
    fitToHeight(model, 2.4);                              // ~2.4 m proclamation board (sets y to ground)
    model.position.x = ps.scrollPos.x; model.position.z = ps.scrollPos.z;
    model.rotation.y = Math.atan2(-ps.scrollPos.x, -ps.scrollPos.z); // face the world centre / road
    model.traverse((o) => { o.userData.stopId = ps.id; });          // every child pickable → this stop
    scene.add(model);
    pickables.push(model);

    // chapter title rendered on the scroll's face (double-sided so it reads from either approach)
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({ map: titleTexture(tale.locale, tale.org), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    plane.position.set(0, 1.55, 0.14);                   // upper-front of the board (local space)
    plane.userData.stopId = ps.id;
    model.add(plane);
  }
  return { pickables };
}
