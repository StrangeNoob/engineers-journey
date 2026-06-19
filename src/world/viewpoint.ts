import * as THREE from "three";

// A grassy knoll just off the road near the journey's start (tuned in-browser).
export const PEAK = { x: -46, z: 38 };
export const KNOLL_R = 12;   // base radius (m)
export const KNOLL_H = 5;    // peak height (m)
export const SUMMIT_R = 2.5; // trigger zone radius at the top (m)

/** Pure: analytic smoothstep dome height; 0 outside KNOLL_R. */
export function viewpointHeight(x: number, z: number): number {
  const d = Math.hypot(x - PEAK.x, z - PEAK.z);
  if (d >= KNOLL_R) return 0;
  const t = 1 - d / KNOLL_R;       // 1 at center, 0 at rim
  return KNOLL_H * t * t * (3 - 2 * t);
}

/** Build the knoll surface (matches viewpointHeight) + a small stone cairn at the summit. */
export function buildViewpoint(scene: THREE.Scene): void {
  const SEG = 48;
  const geo = new THREE.CircleGeometry(KNOLL_R, SEG);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    // CircleGeometry lies in XY before we rotate; raise Z by the height at that (x,y) offset.
    const lx = pos.getX(i), ly = pos.getY(i);
    pos.setZ(i, viewpointHeight(PEAK.x + lx, PEAK.z + ly));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 1, envMapIntensity: 1 });
  const knoll = new THREE.Mesh(geo, mat);
  knoll.rotation.x = -Math.PI / 2;
  knoll.position.set(PEAK.x, 0, PEAK.z);
  knoll.receiveShadow = true;
  scene.add(knoll);

  // Simple stone cairn (stacked boxes) at the summit.
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.9 });
  const cairn = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = 0.9 - i * 0.22;
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, 0.45, s), stone);
    b.position.y = KNOLL_H + 0.22 + i * 0.42;
    b.castShadow = b.receiveShadow = true;
    cairn.add(b);
  }
  cairn.position.set(PEAK.x, 0, PEAK.z);
  scene.add(cairn);
}
