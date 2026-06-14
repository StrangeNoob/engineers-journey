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
  sun.position.set(-30, 40, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, new THREE.HemisphereLight(0xbcd0dc, 0x65763f, 1.0), new THREE.AmbientLight(0xf1e9d2, 0.3));
  return scene;
}
