import "./styles/main.css";
import { STOPS } from "./data/career";
import { createRenderer } from "./engine/renderer";
import { createScene } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { createGround } from "./world/ground";
import { placeShire } from "./world/landmarks";
import { Gandalf } from "./player/gandalf";
import { FollowCamera } from "./player/followCamera";
import { Journal } from "./systems/journal";
import { Interaction } from "./systems/interaction";
import { Hud } from "./ui/hud";
import { mountTouchControls } from "./ui/touchControls";
import { showBoot, hideBoot } from "./ui/loader";

const app = document.getElementById("app")!;
const boot = showBoot();

const renderer = createRenderer();
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";
const scene = createScene();
scene.add(createGround());

const input = new Input();
input.attach(renderer.domElement);
mountTouchControls(input);

const cam = new FollowCamera();
const gandalf = new Gandalf();
const journal = new Journal(STOPS.map((s) => s.id));
const hud = new Hud();
hud.set(journal.count, journal.total);

(async () => {
  await gandalf.load();
  gandalf.root.position.set(0, 0, 4);
  scene.add(gandalf.root);
  const shire = await placeShire(scene);
  const shireStop = STOPS.find((s) => s.id === "shire");
  if (!shireStop) throw new Error('Missing "shire" stop in career data');
  const interaction = new Interaction(shire, shireStop, journal, () => hud.set(journal.count, journal.total));

  startLoop((dt) => {
    input.beginFrame();
    cam.update(gandalf.root.position, input, dt);
    gandalf.update(dt, input.state, cam.yawAngle);
    interaction.update(gandalf.root.position, cam.camera, input);
    input.endFrame();
    renderer.render(scene, cam.camera);
  });
  hideBoot(boot);
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  cam.resize();
});
