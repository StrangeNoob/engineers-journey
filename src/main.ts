import "./styles/main.css";
import * as THREE from "three";
import { LUTCubeLoader } from "postprocessing";
import { STOPS, CONTACT } from "./data/career";
import { createRenderer, configureRenderer } from "./engine/renderer";
import { createScene } from "./engine/scene";
import { startLoop } from "./engine/loop";
import { Input } from "./engine/input";
import { detectQuality, pickQualityLevel, effectFlags } from "./engine/quality";
import type { QualityLevel } from "./engine/quality";
import { createEnvironment } from "./engine/environment";
import { createPostFX } from "./engine/postfx";
import type { PostFX } from "./engine/postfx";
import { mountDebugOverlay } from "./ui/debugOverlay";
import { createTerrain } from "./world/terrain";
import { placeLandmarks } from "./world/landmarks";
import { buildRoad, bridgeHeight } from "./world/road";
import { buildWater } from "./world/water";
import { scatterNature, cullTreesNearCamera } from "./world/nature";
import { buildGrassField } from "./world/grassField";
import { createSnow } from "./world/weather";
import { buildAmbient } from "./world/ambient";
import { Gandalf, pickGait } from "./player/gandalf";
import { FollowCamera } from "./player/followCamera";
import { Journal } from "./systems/journal";
import { StopManager } from "./systems/interaction";
import { Hud } from "./ui/hud";
import { SyncMeter } from "./ui/syncMeter";
import { Compass } from "./ui/compass";
import { Waypoints } from "./ui/waypoints";
import { Flourish } from "./ui/flourish";
import { mountTouchControls } from "./ui/touchControls";
import { showBoot, hideBoot } from "./ui/loader";
import { MapOverlay } from "./ui/mapOverlay";
import { createFade } from "./ui/fade";
import { travelTarget } from "./world/mapProjection";
import { STOP_PLACEMENTS } from "./data/world";
import { buildScrolls } from "./world/scrollReveal";
import { AudioEngine, footstepDue } from "./audio/audioEngine";
import { mountIntro } from "./ui/intro";
import { createAtmosphere } from "./engine/atmosphere";

/** Resolve a quality level: localStorage override → URL param → device tier default. */
function resolveLevel(tier: ReturnType<typeof detectQuality>["tier"]): QualityLevel {
  const VALID: QualityLevel[] = ["high", "medium", "low"];
  const stored = localStorage.getItem("qualityOverride") as QualityLevel | null;
  if (stored && VALID.includes(stored)) return stored;
  const param = new URLSearchParams(location.search).get("quality") as QualityLevel | null;
  if (param && VALID.includes(param)) return param;
  return pickQualityLevel(tier);
}

const app = document.getElementById("app")!;
const boot = showBoot();
const quality = detectQuality();
const level = resolveLevel(quality.tier);
const flags = effectFlags(level);
flags.grain = false; // film grain disabled (the LUT colour-grade stays — that was the good part)

const renderer = createRenderer();
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows || flags.csm;
app.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";
// label the canvas for assistive tech, and point it at the accessible map path
renderer.domElement.setAttribute("role", "img");
renderer.domElement.setAttribute("aria-label",
  "Interactive 3D Middle-earth. Walk Gandalf between six villages, each recalling a career chapter. Press M to open an accessible map and jump to any chapter.");

const scene = createScene();
createTerrain(scene);

const input = new Input();
input.attach(renderer.domElement);
mountTouchControls(input);

const cam = new FollowCamera();
const gandalf = new Gandalf();
const journal = new Journal(STOPS.map((s) => s.id));
const hud = new Hud();
const syncMeter = new SyncMeter(STOPS.map((s) => s.id));
syncMeter.set((id) => journal.isVisited(id));
const compass = new Compass(journal);
const waypoints = new Waypoints(Object.fromEntries(STOPS.map((s) => [s.id, s.locale])));
const flourish = new Flourish();

const audio = new AudioEngine();
hud.setMuted(audio.isMuted);
hud.onMute(() => { audio.setMuted(!audio.isMuted); hud.setMuted(audio.isMuted); });
// AudioContext can only start after a user gesture (autoplay policy)
addEventListener("pointerdown", () => void audio.start(), { once: true });
addEventListener("keydown", () => void audio.start(), { once: true });

const content: Record<string, typeof STOPS[number]> = Object.fromEntries(STOPS.map((s) => [s.id, s]));

// Outer-scope handle so the resize handler can reach postfx before the async IIFE resolves.
let postfx: PostFX | null = null;

(async () => {
  await gandalf.load();
  gandalf.root.position.set(-59, 0, 49);      // at the start of the road, by the Shire's gate
  gandalf.root.rotation.y = Math.atan2(8, -43); // facing down the road toward Bywater
  scene.add(gandalf.root);
  gandalf.playGesture("wave");

  const landmarks = placeLandmarks(scene);
  landmarks.update(gandalf.root.position);
  const scrolls = await buildScrolls(scene, landmarks.stops, content);
  const stops = new StopManager(landmarks.stops, content, journal, (id) => {
    syncMeter.set((i) => journal.isVisited(i));
    flourish.play(content[id]?.locale ?? id);
  }, { gandalf, camera: cam, audio });

  // Tap/click a landmark's 3D scroll to open its tale — works on mobile (no E key needed).
  // A tap is a pointerup close to where the pointerdown landed (not a look-drag).
  const pickRay = new THREE.Raycaster();
  let downX = 0, downY = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (map.isOpen || stops.isPanelOpen) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return; // a drag, not a tap
    pickRay.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), cam.camera);
    const hit = pickRay.intersectObjects(scrolls.pickables, true)[0];
    if (!hit) return;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.stopId) o = o.parent;
    if (o?.userData.stopId) stops.openById(o.userData.stopId as string);
  });

  // one shared list of solid footprints; every builder appends to it as its assets
  // load, and Gandalf is pushed out of any he overlaps each frame.
  const colliders = [...landmarks.colliders];
  let grassWind: ((t: number) => void) | null = null;
  let waterRipple: ((dt: number) => void) | null = null;
  let elapsed = 0;

  // Compose the walkable ground surface: flat ground (0) + the bridge arch.
  const groundHeightAt = (x: number, z: number) => Math.max(0, bridgeHeight(x, z));

  const fade = createFade();
  const map = new MapOverlay(
    STOP_PLACEMENTS.map((p) => ({ id: p.id, name: content[p.id]?.locale ?? p.id, x: p.x, z: p.z })),
    journal,
    (id) => {
      const p = STOP_PLACEMENTS.find((s) => s.id === id);
      if (!p) { console.warn(`fast-travel: unknown stop "${id}"`); return; }
      const t = travelTarget(p.x, p.z);
      fade.teleport(() => { gandalf.root.position.set(t.x, 0, t.z); gandalf.root.rotation.y = t.faceY; });
    },
  );
  map.setButton(hud.mapBtn);
  hud.onMap(() => { audio.click(); map.open(gandalf.root.position.x, gandalf.root.position.z); });
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyM" || e.repeat) return;
    audio.click();
    if (map.isOpen) map.close();
    else map.open(gandalf.root.position.x, gandalf.root.position.z);
  });

  // Cinematic environment (HDRI/IBL + CSM + fog) and the post-processing stack.
  const environment = await createEnvironment(renderer, scene, cam.camera, flags, quality.drawDistance);

  // Load the base colour-grade LUT; skip gracefully on failure.
  let lut: THREE.Texture | null = null;
  try {
    lut = await new LUTCubeLoader().loadAsync("/assets/luts/golden-hour.cube");
  } catch (e) {
    console.warn("[postfx] LUT load failed — skipping color grade:", e);
  }

  configureRenderer(renderer, { exposure: 1.05, toneMapInRenderer: false });
  postfx = createPostFX(renderer, scene, cam.camera, flags, lut);
  const atmosphere = await createAtmosphere(scene, postfx, quality.drawDistance);
  const snow = createSnow(scene); // falling snowfall, fades in within Isengard

  const overlay = mountDebugOverlay({
    level,
    onLevel: (l) => {
      // Reload is the intentional teardown: a full page load reclaims all GPU memory, so
      // environment.dispose()/postfx.dispose() are reserved for future in-place level switching.
      localStorage.setItem("qualityOverride", l);
      location.reload();
    },
  });

  let footDist = 0;
  startLoop((dt) => {
    elapsed += dt;
    input.beginFrame();
    const hudVisible = !map.isOpen && !stops.isPanelOpen;
    compass.setVisible(hudVisible);
    waypoints.setVisible(hudVisible);
    if (!map.isOpen) {
      // tale panel: stop walking, keep animating + camera easing
      const frozen = stops.isPanelOpen;
      const moveInput = frozen ? { ...input.state, move: { forward: 0, right: 0 }, run: false } : input.state;
      // Move the player FIRST, then point the camera at the updated position (avoids the
      // one-frame camera lag that caused screen jitter while walking).
      const speed = gandalf.update(dt, moveInput, cam.yawAngle, colliders, groundHeightAt);
      atmosphere.update(gandalf.root.position.x, gandalf.root.position.z, dt);
      snow.update(gandalf.root.position.x, gandalf.root.position.z, dt);
      environment.update(gandalf.root.position.x, gandalf.root.position.z);
      cam.update(gandalf.root.position, input, dt, landmarks.obstacles);
      cullTreesNearCamera(cam.camera.position.x, cam.camera.position.z, 5);
      grassWind?.(elapsed);
      waterRipple?.(dt);
      landmarks.update(gandalf.root.position);
      stops.update(gandalf.root.position, cam.camera, input);
      if (hudVisible) {
        compass.update(cam.yawAngle, gandalf.root.position.x, gandalf.root.position.z);
        waypoints.update(cam.camera, gandalf.root.position.x, gandalf.root.position.z, (id) => journal.isVisited(id));
      }
      if (!frozen) {
        footDist += speed * dt;
        if (footstepDue(footDist, pickGait(speed, input.state.run))) { audio.footstep(); footDist = 0; }
      }
    }
    input.endFrame();
    postfx?.setFocus(stops.isPanelOpen); // intensify DoF during a tale
    postfx?.render(dt);
    overlay.tick(dt);
  });
  hideBoot(boot);
  mountIntro(CONTACT.resume); // first-visit control legend + a "skip to résumé" link

  // stream in the rest of the world after first paint; let each builder finish
  // independently and report exactly which one failed (a missing asset shouldn't
  // take the others down or leave an unhandled rejection).
  const builders: [string, Promise<unknown>][] = [
    ["road", buildRoad(scene, colliders)],
    ["water", buildWater(scene, colliders, quality).then((u) => { waterRipple = u; })],
    ["nature", scatterNature(scene, quality, colliders)],
    ["grass", buildGrassField(scene, quality).then((u) => { grassWind = u; })],
    ["ambient", buildAmbient(scene, colliders)],
  ];
  void Promise.allSettled(builders.map(([, p]) => p)).then((results) => {
    results.forEach((r, i) => { if (r.status === "rejected") console.error(`world build "${builders[i][0]}" failed`, r.reason); });
    environment.registerShadows(scene);
  });
})().catch((e) => { console.error(e); boot.querySelector(".lab")!.textContent = "Load error — see console"; });

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  postfx?.setSize(innerWidth, innerHeight);
  cam.resize();
});
