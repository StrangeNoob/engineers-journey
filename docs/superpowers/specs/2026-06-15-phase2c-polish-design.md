# Phase 2c — Polish: idle/gestures, scroll reveal, cinematic camera, audio (design)

**Date:** 2026-06-15
**Status:** approved (brainstorm)
**Builds on:** Phase 2a (world) + 2b (journal map). Final phase of the "populate + polish" arc.

## Goal

The final polish pass: a **real idle pose** and **gesture animations** for Gandalf, a
**scroll reveal** when a tale is recalled (3D scroll rises in-world + an unrolling tale panel),
a **cinematic camera** framing for the recall, and a lightweight **procedural audio** layer.

## Decisions (from brainstorm)

1. **Animations:** the user added `gandalf-idle.glb` (`Idle_02`), `gandalf-listening.glb`
   (`Listening_Gesture`), `gandalf-one-hand-wave.glb` (`Wave_One_Hand`) — all on the **same
   24-bone rig / mesh `char1`** as the existing `gandalf-walk` (`Casual_Walk`) and
   `gandalf-run` (`running`). Mapping: **Idle_02 = idle**, **Wave_One_Hand = greeting on
   spawn**, **Listening_Gesture = on tale recall**.
2. **Scroll reveal:** **Both** — the 3D `portfolio-scroll.glb` rises/scales in at the recall
   spot AND the tale panel opens (restyled as an unrolling parchment card with the career text).
3. **Camera:** a subtle **cinematic framing on recall** (push-in toward Gandalf + scroll),
   returns to normal follow on close; honors `prefers-reduced-motion`.
4. **Audio:** **file-based** — user-supplied CC0 files in `public/assets/audio/`
   (`ambient.ogg` looping bed; `footstep.ogg` (+ optional `footstep-1/2/3.ogg` variants);
   `scroll.ogg`; `click.ogg`), played via Web Audio with a HUD mute toggle. Any missing file is
   a silent no-op.

## Scope

In scope:
- Locomotion state machine: crossfade `Idle_02 ↔ Casual_Walk ↔ running` by speed.
- One-shot gestures: `Wave_One_Hand` on spawn, `Listening_Gesture` on recall (fade in → play
  once → return to locomotion).
- Optimize the 3 new 32 MB glbs and load only their clips onto the shared mesh.
- Recall sequence: gesture + 3D scroll rise + unrolling tale panel + scroll rustle + cinematic
  camera; reverse on close; freeze movement while the panel is open.
- File-based audio engine (loads CC0 files from `public/assets/audio/`) + HUD mute toggle
  (persisted), gesture-gated start, reduced-motion aware, graceful when a file is absent.

Out of scope:
- Procedurally synthesized audio (using real files instead).
- New character art/rig (clips already provided).
- Positional/3D audio, footstep surface variation, voiceover.
- Intro fly-in / free-look camera (camera = recall framing only).

## Architecture

### Changed: `src/player/gandalf.ts` — clips + gestures
Today it loads `gandalf-walk` (mesh + clip) + `gandalf-run` (clip) and freezes the walk clip
for idle. Rework:
- Load the **base mesh** from one glb and attach **all five clips** to one `AnimationMixer`
  (clips retarget onto the shared rig by bone name, as the run clip already does).
- **Locomotion:** keep weights for `idle`/`walk`/`run`; each frame, drive the target weights
  from `pickGait(speed, run)` and crossfade (frame-rate-independent lerp). `Idle_02` replaces
  the frozen-frame idle.
- **Gestures:** `playGesture("wave"|"listening")` — set the gesture action to `LoopOnce`,
  `clampWhenFinished`, fade it in over the locomotion layer, and on `finished` (mixer event)
  fade back. `listening` may be held while the panel is open, released on close.
- Grounding/scale: unchanged — already derived from the animated skinned pose, so the new
  clips need no re-tuning.

Pure/tested: `pickGait` (exists) plus a small `gaitWeights(gait)` → `{idle,walk,run}` target
weights (testable) so the crossfade logic stays out of the render loop internals.

### New: `src/world/scrollReveal.ts`
- `buildScrollReveal(scene)` loads `portfolio-scroll.glb` once (hidden), returns
  `{ show(x, z, faceYaw), hide(), update(dt) }`.
- `show` places the scroll near the recall spot (in front of Gandalf, facing the camera) and
  animates a brief **rise + scale-in** (eased, ~0.5 s). `hide` scales/fades out. `update`
  advances the tween. Reduced-motion → appear instantly.

### Changed: `src/ui/talePanel.ts` — unrolling parchment
Keep the content/structure; restyle as a parchment **scroll card** and replace the slide with
an **unroll reveal** (a top→down `clip-path`/`scaleY` transform-origin top), with the text
fading in after the unroll. Reduced-motion → instant open. (Stays crisp HTML for readability.)

### Changed: `src/player/followCamera.ts` — cinematic framing
Add a `focus(on: boolean)` (or a `cinematic` target) that, while active, eases the camera to a
tale-framing offset (a bit closer + slightly higher angle so Gandalf and the risen scroll are
both in frame), and restores the normal follow when off. Uses the existing
frame-rate-independent lerp. Reduced-motion → snap, no animated move.

### New: `src/audio/audioEngine.ts`
A small Web Audio engine that plays user-supplied files from `public/assets/audio/`:
- Lazily creates/resumes an `AudioContext` on the first user gesture (pointer/key), per autoplay
  rules; then fetches + `decodeAudioData` for each file, routed through a master gain.
- Expected files (each optional — missing → that sound is a no-op): **`ambient.ogg`** (looped,
  low gain), **`footstep.ogg`** (+ optional `footstep-1/2/3.ogg`, chosen at random),
  **`scroll.ogg`**, **`click.ogg`**.
- API: `ambient()` (start/stop the looping bed), `footstep()`, `scroll()`, `click()`,
  `setMuted(bool)`.
- `setMuted` toggles the master gain; persisted to `localStorage` (`ej.muted`). Default
  unmuted, but nothing plays until the first user gesture starts the context.
- `prefers-reduced-motion` (or muted) → ambient stays silent and SFX are suppressed.
- A pure `footstepDue(distanceWalked, gait)` helper (testable) decides when to trigger a step
  from accumulated movement + cadence, so the loop just calls it.

### Changed: `src/systems/interaction.ts` (`StopManager`) — recall orchestration
`recall(id)` becomes the sequence conductor (given injected deps): play `listening` gesture →
`scrollReveal.show(...)` → `audio.scroll()` → `camera.focus(true)` → open the tale panel. On
panel close: `camera.focus(false)` → `scrollReveal.hide()` → release gesture (back to idle).

### Changed: `src/ui/hud.ts` — mute toggle
Add a small **🔊/🔇 mute button** (next to the [Map] button), wired to `audio.setMuted`.

### Changed: `src/main.ts` — wiring
Instantiate the audio engine and scroll-reveal; pass `gandalf`, `scrollReveal`, `camera`, and
`audio` into `StopManager`; call `gandalf.playGesture("wave")` shortly after spawn; in the loop,
advance `scrollReveal.update(dt)` and trigger `audio.footstep()` when `footstepDue(...)` fires
while moving (and not while the map/panel is open).

## Recall sequence (data flow)

```text
proximity + E/tap
   └─ StopManager.recall(id)
        ├─ gandalf.playGesture("listening")
        ├─ scrollReveal.show(stop.x, stop.z, faceYaw)   (3D scroll rises)
        ├─ audio.scroll()                               (parchment rustle)
        ├─ camera.focus(true)                           (cinematic framing)
        └─ talePanel.open(content[id])                  (unrolls; freezes movement)
   panel close ──► camera.focus(false) → scrollReveal.hide() → gandalf back to idle
```

## Error handling / edge cases
- New glbs fail to load: the loaders are awaited within the existing `Promise.allSettled` world
  build (errors logged per-builder); Gandalf still loads from the base mesh.
- AudioContext blocked until gesture: ambient starts on first interaction; no errors if never
  started; mute persists.
- Missing audio file (fetch/decode fails): that sound becomes a no-op; the rest of the game and
  other sounds are unaffected (errors logged, not thrown).
- Recall while the map is open / map open while a tale is shown: one modal at a time — opening
  the map closes an open tale panel and vice-versa (single overlay).
- Reduced-motion: scroll reveal, panel unroll, and camera move all become instant; audio stays
  off unless explicitly unmuted.
- Gesture interrupted by movement (player walks during `listening`): locomotion takes over
  (gesture fades out) — movement always wins.

## Testing
Vitest on the pure helpers:
- `gaitWeights(gait)` → correct `{idle,walk,run}` target weights (idle=1 when idle, etc.).
- `footstepDue(distance, gait)` → triggers at the right cadence for walk vs run; never when idle.
- `pickGait` already covered.
DOM/audio/3D (panel unroll, scroll reveal, audio nodes, camera focus) verified in-browser.

## Acceptance
- Standing still → Gandalf plays a natural `Idle_02` (no frozen-walk pose); walking/running
  crossfade correctly.
- On spawn → Gandalf waves once, then idles.
- Recall a tale → Gandalf gestures (listening), the 3D scroll rises at the spot, the parchment
  panel unrolls with the tale, a soft rustle plays, and the camera eases into frame; closing
  reverses it.
- Footsteps play in time with walking/running; the ambient track loops; mute toggle silences
  all and persists; reduced-motion makes motion instant and keeps audio off. With no audio files
  present, the game runs silently with no errors.
- `tsc` clean, all vitest green, build succeeds.
