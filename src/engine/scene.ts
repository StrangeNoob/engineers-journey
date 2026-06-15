import * as THREE from "three";
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe7decb, 40, 140);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0xa9bcc6) }, bot: { value: new THREE.Color(0xe7decb) } },
      vertexShader: `varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float h;uniform vec3 top,bot;void main(){gl_FragColor=vec4(mix(bot,top,clamp(h*1.1+.25,0.,1.)),1.);}`,
    }),
  ));

  const sun = new THREE.DirectionalLight(0xffe7bf, 2.0);
  sun.name = "sun";
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // a moderate frustum that the follow-helper keeps centred on the player → crisp local shadows everywhere
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xbcd0dc, 0x65763f, 1.0), new THREE.AmbientLight(0xf1e9d2, 0.3));
  return scene;
}

const SUN_OFFSET = new THREE.Vector3(-40, 70, 28);

/** Keep the sun (and thus its shadow frustum) centred over the player so shadows stay crisp
 *  and the frustum edge never smears a dark wedge across the world. Call once per frame. */
export function followSun(scene: THREE.Scene, x: number, z: number): void {
  const sun = scene.getObjectByName("sun") as THREE.DirectionalLight | null;
  if (!sun) return;
  sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
  sun.target.position.set(x, 0, z);
  sun.target.updateMatrixWorld();
}
