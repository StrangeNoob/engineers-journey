import "./styles/main.css";
import { STOPS } from "./data/career";
import { createRenderer } from "./engine/renderer";
import { createScene, followSun } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { detectQuality } from "./engine/quality";
import { createTerrain } from "./world/terrain";
import { placeLandmarks } from "./world/landmarks";
import { buildRoad } from "./world/road";
import { buildWater } from "./world/water";
import { scatterNature } from "./world/nature";
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
  gandalf.root.position.set(-60, 0, 62); // spawn just outside the Shire (start of the road)
  scene.add(gandalf.root);

  const landmarks = placeLandmarks(scene);
  landmarks.update(gandalf.root.position);
  const stops = new StopManager(landmarks.stops, content, journal, () => hud.set(journal.count, journal.total));

  // debug hook — teleport/inspect while developing (e.g. __game.go(56,16) to Isengard)
  (window as unknown as { __game: unknown }).__game = {
    gandalf, cam, scene, input,
    go: (x: number, z: number) => gandalf.root.position.set(x, 0, z),
  };

  startLoop((dt) => {
    input.beginFrame();
    followSun(scene, gandalf.root.position.x, gandalf.root.position.z);
    cam.update(gandalf.root.position, input, dt, landmarks.obstacles);
    gandalf.update(dt, input.state, cam.yawAngle);
    landmarks.update(gandalf.root.position);
    stops.update(gandalf.root.position, cam.camera, input);
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
  hideBoot(boot);

  buildRoad(scene);
  buildWater(scene);
  scatterNature(scene, quality);
  buildAmbient(scene);
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); cam.resize(); });
