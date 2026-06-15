import * as THREE from "three";
import { loadGLTF, toonify, fitToHeight } from "./assets";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ScrollReveal {
  show(x: number, z: number, faceYaw: number): void;
  hide(): void;
  update(dt: number): void;
}

/** Loads portfolio-scroll.glb (hidden); show() rises + scales it in at a spot, hide() retracts it. */
export async function buildScrollReveal(scene: THREE.Scene): Promise<ScrollReveal> {
  const g = await loadGLTF("portfolio-scroll");
  const model = (g.scene as unknown as THREE.Group).clone(true);
  toonify(model);
  fitToHeight(model, 2.4);              // ~2.4 m proclamation board
  const fullScale = model.scale.x;
  const fullY = model.position.y;
  model.visible = false;
  scene.add(model);

  let t = 0, target = 0;               // reveal progress 0..1
  const apply = () => {
    const e = t * t * (3 - 2 * t);     // smoothstep
    model.scale.setScalar(fullScale * Math.max(0.0001, e));
    model.position.y = fullY - (1 - e) * 0.6; // rise ~0.6 m as it scales in
  };

  return {
    show(x, z, faceYaw) {
      model.position.x = x; model.position.z = z; model.rotation.y = faceYaw;
      model.visible = true; target = 1;
      if (REDUCED) { t = 1; apply(); }
    },
    hide() { target = 0; if (REDUCED) { t = 0; model.visible = false; } },
    update(dt) {
      if (t === target) return;
      t += Math.sign(target - t) * Math.min(Math.abs(target - t), dt * 3); // ~0.33 s
      apply();
      if (t <= 0) model.visible = false;
    },
  };
}
