import * as THREE from "three";
import { createPBRMaterial } from "./materials";
import { REGIONS } from "../data/regions";

const texLoader = new THREE.TextureLoader();

/** Load a tiling ground map, repeating once per `metresPerTile` across the surface, with mip +
 *  anisotropy so it holds up at grazing/distant angles. `spanMetres` is the surface's diameter. */
function groundTex(url: string, spanMetres: number, metresPerTile = 5.4): THREE.Texture {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const r = spanMetres / metresPerTile;
  t.repeat.set(r, r);
  t.anisotropy = 8;
  return t;
}

/** PBR map trio for a /assets/textures/pbr/<name>_{albedo,normal,roughness}.jpg set. */
function pbrSet(name: string, spanMetres: number): Parameters<typeof createPBRMaterial>[1] {
  return {
    albedo: groundTex(`/assets/textures/pbr/${name}_albedo.jpg`, spanMetres),
    normal: groundTex(`/assets/textures/pbr/${name}_normal.jpg`, spanMetres),
    roughness: groundTex(`/assets/textures/pbr/${name}_roughness.jpg`, spanMetres),
  };
}

/** A radial gradient used as an alphaMap so a ground patch dissolves into whatever lies beneath
 *  it instead of showing a hard circular seam. Default: opaque core → transparent rim (for a
 *  disc). `invert: true` flips it to transparent core → opaque rim (for a ring/apron whose inner
 *  edge should fade out). `coreFraction` is where the solid core ends, as a fraction of radius. */
function radialAlphaMap(coreFraction = 0.6, invert = false): THREE.Texture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, (S / 2) * coreFraction, S / 2, S / 2, S / 2);
  g.addColorStop(0, invert ? "#000" : "#fff");
  g.addColorStop(1, invert ? "#fff" : "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; // alpha is read from the (linear) green channel
  return t;
}

/** A soft-edged horizontal PBR disc of radius `r`, centered at (x,z), hovering just above the
 *  base ground so it reads as a distinct floor (cobbles, rock, snow) blended into the grass. */
function groundPatch(name: string, x: number, z: number, r: number, alpha: THREE.Texture): THREE.Mesh {
  const span = r * 2;
  const mat = createPBRMaterial(
    { roughness: 1, metalness: 0, normalScale: 1, envMapIntensity: 1.0 },
    pbrSet(name, span),
  );
  mat.alphaMap = alpha;        // the gradient tiles 1:1 across the disc (alpha keeps default repeat)
  mat.transparent = true;
  mat.depthWrite = false;      // blend over the opaque base ground without fighting its depth
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.03, z);
  mesh.renderOrder = 1;        // draw after the base ground
  mesh.receiveShadow = true;
  return mesh;
}

/** Large flat ground with tiling PBR grass, soft per-region floor patches (cobbles/rock), and a
 *  snowy apron at the foot of the distant mountain ring. (Fog is owned by the environment module.) */
export function createTerrain(scene: THREE.Scene): THREE.Mesh {
  const SPAN = 520; // ~the playable ground diameter
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 72),
    createPBRMaterial(
      { roughness: 1, metalness: 0, normalScale: 1, envMapIntensity: 1.0 },
      pbrSet("grass001", SPAN),
    ),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Each patch fades across its OWN falloff band: the solid core ends at the region radius,
  // so the dissolve starts at radius/(radius+falloff) — different per region.
  for (const region of REGIONS) {
    if (!region.ground) continue;
    const outer = region.radius + region.falloff;
    scene.add(groundPatch(region.ground, region.center.x, region.center.z, outer, radialAlphaMap(region.radius / outer)));
  }

  // Snowline at the base of the distant mountain backdrops (ring at r340; see world/nature.ts).
  const snowMat = createPBRMaterial(
    { roughness: 1, metalness: 0, normalScale: 1, envMapIntensity: 1.0 },
    pbrSet("snow", 220),
  );
  snowMat.alphaMap = radialAlphaMap(0.8, true); // transparent inner rim → solid toward the mountains
  snowMat.transparent = true;
  snowMat.depthWrite = false;
  const snow = new THREE.Mesh(new THREE.RingGeometry(285, 360, 96, 1), snowMat);
  snow.rotation.x = -Math.PI / 2;
  snow.position.y = 0.02;
  snow.renderOrder = 1;
  snow.receiveShadow = true;
  scene.add(snow);

  return ground;
}
