// Bootstrap — minimal scene to verify the toolchain (Vite + TS + Three + Draco + asset load).
// NOT the game yet: the player controller, world, tales, and HUD come with the Phase 1 plan.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { STOPS } from "./data/career";
import "./styles/main.css";

const app = document.getElementById("app")!;
const boot = document.createElement("div");
boot.id = "boot";
boot.innerHTML = `<div><div class="ring"></div><div class="lab">Mapping the realm…</div></div>`;
document.body.appendChild(boot);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe7decb, 30, 120);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 600);
camera.position.set(10, 8, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

// sky gradient dome
scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0xa9bcc6) }, bot: { value: new THREE.Color(0xe7decb) } },
      vertexShader: `varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float h;uniform vec3 top,bot;void main(){gl_FragColor=vec4(mix(bot,top,clamp(h*1.1+.25,0.,1.)),1.);}`,
    }),
  ),
);

const sun = new THREE.DirectionalLight(0xffe7bf, 2.0);
sun.position.set(-20, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, new THREE.HemisphereLight(0xbcd0dc, 0x65763f, 1.0), new THREE.AmbientLight(0xf1e9d2, 0.3));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(120, 64),
  new THREE.MeshStandardMaterial({ color: 0x8a9c57, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// loaders (Draco decoder bundled under /public/draco)
const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
const gltf = new GLTFLoader();
gltf.setDRACOLoader(draco);

// 3-step toon ramp for cohesive shading
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.needsUpdate = true;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
})();
function toonify(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const mat = m.material as THREE.MeshStandardMaterial;
    m.material = new THREE.MeshToonMaterial({ map: mat.map ?? null, color: mat.color?.clone() ?? new THREE.Color(0xcfc2a3), gradientMap: ramp });
  });
}

// smoke-test: load the Shire landmark (first stop)
gltf.load(
  `/assets/models/${STOPS[0].model}.glb`,
  (g) => {
    toonify(g.scene);
    const box = new THREE.Box3().setFromObject(g.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const k = 9 / Math.max(size.x, size.z);
    g.scene.scale.setScalar(k);
    g.scene.position.y = -box.min.y * k;
    scene.add(g.scene);
    boot.classList.add("gone");
    console.info(`[engineers-journey] booted · ${STOPS.length} tales · loaded ${STOPS[0].model}`);
  },
  undefined,
  (err) => {
    console.error("asset load failed", err);
    boot.querySelector(".lab")!.textContent = "Load error — see console";
  },
);

function frame() {
  requestAnimationFrame(frame);
  controls.update();
  renderer.render(scene, camera);
}
frame();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
