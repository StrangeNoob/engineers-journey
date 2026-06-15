import "./styles/main.css";
import { STOPS } from "./data/career";
import { createRenderer } from "./engine/renderer";
import { createScene, followSun } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { detectQuality } from "./engine/quality";
import { createTerrain } from "./world/terrain";
import { placeLandmarks } from "./world/landmarks";
import { buildRoad, bridgeHeight } from "./world/road";
import { buildWater } from "./world/water";
import { scatterNature, cullTreesNearCamera } from "./world/nature";
import { buildGrassField } from "./world/grassField";
import { buildAmbient } from "./world/ambient";
import { Gandalf } from "./player/gandalf";
import { FollowCamera } from "./player/followCamera";
import { Journal } from "./systems/journal";
import { StopManager } from "./systems/interaction";
import { Hud } from "./ui/hud";
import { mountTouchControls } from "./ui/touchControls";
import { showBoot, hideBoot } from "./ui/loader";

const app = document.getElementById("app")!;
const boot = showBoot();
const quality = detectQuality();

const renderer = createRenderer();
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows;
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

const scene = createScene();
createTerrain(scene, quality);

const input = new Input();
input.attach(renderer.domElement);
mountTouchControls(input);

const cam = new FollowCamera();
const gandalf = new Gandalf();
const journal = new Journal(STOPS.map((s) => s.id));
const hud = new Hud();
hud.set(journal.count, journal.total);

const content: Record<string, typeof STOPS[number]> = Object.fromEntries(STOPS.map((s) => [s.id, s]));

(async () => {
  await gandalf.load();
  gandalf.root.position.set(-59, 0, 49);      // at the start of the road, by the Shire's gate
  gandalf.root.rotation.y = Math.atan2(8, -43); // facing down the road toward Bywater
  scene.add(gandalf.root);

  const landmarks = placeLandmarks(scene);
  landmarks.update(gandalf.root.position);
  const stops = new StopManager(landmarks.stops, content, journal, () => hud.set(journal.count, journal.total));

  // one shared list of solid footprints; every builder appends to it as its assets
  // load, and Gandalf is pushed out of any he overlaps each frame.
  const colliders = [...landmarks.colliders];
  let grassWind: ((t: number) => void) | null = null;
  let elapsed = 0;

  startLoop((dt) => {
    elapsed += dt;
    input.beginFrame();
    // Move the player FIRST, then point the camera at the updated position. Updating the
    // camera before the move made it aim a frame behind where Gandalf is rendered, so the
    // character oscillated in screen space every frame (jitter) while walking.
    gandalf.update(dt, input.state, cam.yawAngle, colliders);
    gandalf.root.position.y = bridgeHeight(gandalf.root.position.x, gandalf.root.position.z); // walk up & over the bridge
    followSun(scene, gandalf.root.position.x, gandalf.root.position.z);
    cam.update(gandalf.root.position, input, dt, landmarks.obstacles);
    cullTreesNearCamera(cam.camera.position.x, cam.camera.position.z, 5);
    grassWind?.(elapsed);
    landmarks.update(gandalf.root.position);
    stops.update(gandalf.root.position, cam.camera, input);
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
  hideBoot(boot);

  // stream in the rest of the world after first paint; surface any asset-load failure
  void Promise.all([
    buildRoad(scene, colliders),
    buildWater(scene, colliders),
    scatterNature(scene, quality, colliders),
    buildGrassField(scene, quality).then((u) => { grassWind = u; }),
    buildAmbient(scene, colliders),
  ]).catch((e) => console.error("world build failed", e));
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); cam.resize(); });
