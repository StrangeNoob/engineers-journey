import * as THREE from "three";
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0xa9bcc6) }, bot: { value: new THREE.Color(0xe7decb) } },
      vertexShader: `varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float h;uniform vec3 top,bot;void main(){gl_FragColor=vec4(mix(bot,top,clamp(h*1.1+.25,0.,1.)),1.);}`,
    }),
  ));

  // generous fill so shadowed building faces never read as near-black
  scene.add(new THREE.HemisphereLight(0xcfe0e6, 0x6f7d4a, 1.35), new THREE.AmbientLight(0xf1e9d2, 0.5));
  return scene;
}

