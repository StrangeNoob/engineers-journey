# Build Brief — "Through Middle-earth: An Engineer's Journey"

A complete spec for Claude Code to build Prateek Kumar Mohanty's 3D developer
portfolio. Hand this whole file to a fresh Claude Code session. It is the source
of truth for content, theme, tech, assets, and acceptance criteria.

---

## 0. One-paragraph goal
Build a polished, performant, accessible developer-portfolio website whose hero is
an interactive 3D Middle-earth landscape (Three.js). A rigged horse pulls a cart
along a road that threads six villages — each village is one chapter of Prateek's
career. Visitors can free-explore (orbit) or "take the reins" and ride the journey
stop to stop; arriving at a village opens a panel with that role's story, results,
stack, and links. Below/around the 3D world is a fast, conventional, SEO- and
screen-reader-friendly portfolio (about, experience, projects, skills, contact)
plus a plain-text résumé route. Must hit 60fps, Lighthouse ~100, axe 0 violations,
and work on touch devices.

---

## 1. The person — content source of truth (use verbatim)

**Prateek Kumar Mohanty** — SDE-II, backend engineer. 4+ yrs production
Node.js/TypeScript backends; API performance & microservice design. India.

- Email: **itsprateekmohanty@gmail.com**
- Phone: **+91 7205400596**
- GitHub: **github.com/StrangeNoob**
- Résumé PDF: https://portfolio-one-murex-75.vercel.app/pdf/Prateek%20Kumar%20Mohanty.pdf
- LinkedIn: ⚠️ **Prateek will fill in the real LinkedIn URL himself** — leave a clearly
  marked `<!-- LINKEDIN_URL TODO -->` placeholder everywhere it's used; do not guess a slug.

### Experience (newest first)
1. **SDE II — Pathfndr** (Jan 2025–present)
   - Hotel-search p95 **20s → 300–700ms (60×)**
   - 3 microservices on **GCP GKE**
   - Hotel aggregator over **6 supplier APIs** (1.2K hotels <10s p95)
   - AI agent workflow cutting supplier onboarding **75%**
   - Production **RAG** (Pinecone + OpenAI text-embedding-3-small)
   - Idempotent scheduler + **DLQ** for API-key expiry notifications
   - Stack: Node.js, TypeScript, NestJS, GCP (GKE, Cloud Run, Pub/Sub), Pinecone, OpenAI
2. **Full Stack Developer — Dextr Labs** (Jul 2023–Dec 2024)
   - Real-time **fantasy-sports** backend (Node.js, GraphQL, MongoDB, Redis, AWS Lambda/Step Functions, SSE)
   - **RWA NFT** trading platform (Ethers.js/Web3.js, Web3Auth, Ethereum/Polygon)
   - CI/CD GitHub Actions + ECR + EC2 (**45→10 min** deploys)
   - Composite-index refactor (p95 **12s→5s**)
3. **Product Lead — Frifty** (Jun 2022–Jul 2023)
   - Owned **AWS + MongoDB Atlas** infra from scratch
   - React bundle optimization; **50+ component** internal design system
4. **Product Developer — Aarna** (Jun 2021–Apr 2022)
   - Crypto portfolio dashboard: 10+ tokens, 5+ exchanges, 4 chains
   - Redis cache cutting third-party calls **50%**
5. **SDE Intern — Milk Mantra** (Sep 2020–Mar 2021)
   - 3 payment gateways in the **MilkyMoo** app
   - Zero to App Store in **3 months, solo**

**Education:** B.Tech IT, Odisha University of Research and Technology, Bhubaneswar (2018–2022).

**Skills:** TypeScript, JavaScript, Python · Node.js, NestJS, Express, HapiJS, GraphQL,
REST · PostgreSQL, MongoDB, Redis, Pub/Sub · AWS (Lambda, Step Functions, ECS, ECR, S3),
GCP (GKE, Cloud Run, Pub/Sub), GitHub Actions, Docker · React, Next.js, Flutter ·
RAG/LLM · Web3 (Ethers.js, Solidity, EVM).

### Flagship projects (for the Projects section / map "legend")
- **relay** (Go) — distributed task queue: at-least-once delivery, visibility timeouts, retries, DLQ on Redis primitives.
- **speed-test-cli** (Go) — dependency-free internet speed test CLI via Cloudflare, colored TUI.
- **animepahe-dl-desktop** (TS/Tauri/Rust) — desktop downloader UI over animepahe-dl.sh.
- **PawMatch** (TS) + **pawmatch-api** (Go) — location-based dog matching app.
- **Spotify-Share / "RoadTrip Music"** (TS) — collaborative road-trip music control.

---

## 2. Theme — the journey through Middle-earth

The career IS the road. The horse-cart starts in the Shire (school) and travels to
the White City (current role). Each company is a village/landmark. Map:

| # | Locale | Company / role | Era | Landmark asset | Headline |
|---|--------|----------------|-----|----------------|----------|
| 1 | **The Shire / Hobbiton** | B.Tech IT, OURT (education) | 2018–22 | cottages + hedges + fields | Where the road begins |
| 2 | **Bywater Mill** | Milk Mantra (SDE Intern) | 2020–21 | watermill + cart | First craft: 3 payment gateways, solo to App Store in 3 mo |
| 3 | **Bree (crossroads market)** | Aarna (Product Developer) | 2021–22 | market stalls + fountain + inn | Coin & exchange: crypto dashboard, Redis cache −50% calls |
| 4 | **Edoras of Rohan (horse-lords' hall)** | Frifty (Product Lead) | 2022–23 | great hall + banners + tower | Built the hall: AWS/Atlas from scratch, 50+ comp design system |
| 5 | **Isengard — the Works of Orthanc** | Dextr Labs (Full Stack) | 2023–24 | dark tower (Orthanc) + forge + chimney + watermill gears/wheel | The works: realtime fantasy-sports, RWA NFT minting, 45→10min CI/CD pipelines |
| 6 | **Minas Tirith / The White Tower** | Pathfndr (SDE-II, current) | 2025– | stacked stone watchtower + flag + gate | The summit: hotel search 60× faster, microservices, RAG |

Each stop's panel shows: locale name + real company/role + dates, the **headline
result** (big number), 2–4 bullet achievements, the **stack chips**, and links
(GitHub where relevant). The current role (Minas Tirith) is the visual climax —
biggest structure, highest ground, end of the road.

---

## 2b. Where this will be built — Claude on the web (claude.ai/code)

Prateek intends to build the prototype with **Claude Code on the web** (cloud), not the
local CLI. That environment clones a **GitHub repo** and has no access to files sitting
only on the local Mac. So before starting there:

1. **Push this whole repo to GitHub**, INCLUDING `designs/assets/` — the Kenney kits
   (`assets/kenney/**`) and `assets/extra/horse.glb`. They're many small GLBs (KB each),
   so commit them normally; git-lfs is optional, not required. The cloud session needs
   them on disk — they are NOT fetched from the internet at runtime.
2. Also commit `designs/design-13-middleearth.html` (the prototype to port) and this
   `docs/MIDDLE-EARTH-BUILD-BRIEF.md`.
3. The dev server: the cloud preview runs the Vite dev server (`npm run dev`); the old
   `python3 -m http.server` step is only for the standalone prototype.
4. Mind the GLB paths: the kit folders contain a **space** ("GLB format") — keep that in
   mind when wiring asset URLs (URL-encode as `%20`), or copy them to space-free paths in
   `public/assets/` during the asset step.

## 3. Tech stack & project structure (recommended)

The existing prototypes are single self-contained HTML files served by
`python3 -m http.server`. For the *full* site, port to a real build so the ~70 GLBs
get bundled/compressed (current debt: 148 requests, no Draco). Recommended:

- **Vite + TypeScript + Three.js 0.160** (keep the version the prototype uses).
- **three/examples/jsm** for GLTFLoader, DRACOLoader, OrbitControls, SkeletonUtils.
- **Draco-compress** all GLBs at build (`gltf-transform`), and **InstancedMesh** the
  forest (150+ trees) and repeated props — single draw call per kind.
- Plain CSS (or Tailwind if preferred) for the 2D content layer. No heavy UI framework needed.
- Deploy on **Vercel** (current host).

```
src/
  main.ts                # bootstrap renderer/scene/camera/loop
  world/
    sky.ts  ground.ts  lights.ts
    assets.ts            # GLB loader + cache + Draco + toonify
    village.ts           # cottage/tower/landmark builders (1-unit module)
    nature.ts            # instanced forest + rocks + mountains
    road.ts              # journey path + road ribbon + bridges
    traveller.ts         # rigged horse + cart, animation mixer, path follow
    stops.ts             # the 6 stops: positions, data, panels
    camera.ts            # tour/ride/showcase modes + transitions
    input.ts             # orbit, keyboard drive, touch controls
  ui/
    panel.ts  contactBar.ts  hud.ts  loader.ts
  data/
    career.ts            # the §1 data as typed objects (single source)
  styles/
public/
  assets/...             # GLBs (Draco-compressed at build)
resume/                  # plain semantic résumé route (port designs/resume.html)
index.html
```

> The single-file **`designs/design-13-middleearth.html`** in this repo is the
> visual + interaction PROTOTYPE. Port its scene-building, palette, lighting, and
> the horse-cart journey into the structure above — don't start the 3D from zero.

---

## 4. Assets (already in repo — reuse, do NOT re-generate)

All CC0/Kenney unless noted. Paths under `designs/assets/`:

- **Kenney Fantasy Town Kit** — `kenney/fantasy-town-kit/Models/GLB format/*.glb`
  (167 pieces: modular walls/roofs/doors/windows, windmill, watermill[-wide], wheel,
  fountains, stalls, carts, lanterns, banners, fences, hedges, trees, rocks, roads, chimneys).
- **Kenney Castle Kit** — `kenney/castle-kit/Models/GLB format/*.glb`
  (76 pieces: square/hexagon towers [base/mid/mid-windows/top-roof], gates, walls,
  flags, bridges, big rocks-large [→ mountains], trees, siege props).
- **Kenney Retro Fantasy Kit** — `kenney/retro-fantasy-kit/...` (105 pieces, extra variety).
- **Rigged horse** — `extra/horse.glb` (**26 animation clips** incl. walk/gallop; ~0.06u tall raw → scale up ~×26).
- Also in `extra/`: cart, wagon, windmill, watermill, ship, seagull, hay, temple.
- Shared texture: each kit GLB references `Textures/colormap.png` (present) — colors
  come from the colormap; the texture MUST load or models go flat.

**Hard-won kit conventions (carry these over — they cost real time to learn):**
- Module grid = **1.0 unit**. Walls are 1×1, thin, panel **offset to one edge**;
  4 rotations (0, ±90, 180) wrap a unit cell. `wall-block` is a solid cube; thin
  `wall`/`wall-door`/`wall-window-*` are EDGE pieces.
- Roof pieces: `roof` is a full pitched roof for one cell; ridge runs ~along X at ry0.
  Gable-end caps are unreliable — for clean results use closed mid slices / single `roof`.
- Towers stack 1u each: `tower-square-base` + `-mid` + `-mid-windows` + `-top-roof`.
- If you re-add ink/outline hulls: **skip them on thin props** (stall, lantern, fence,
  poles, blade, wheel, thin panels) — a backface hull swallows them to black.
- Horse GLB bbox lies for skinned meshes — fit by clip/bone or by Box3 after clone;
  clone skinned meshes with `SkeletonUtils` `clone` (named export, not a namespace).

**Do NOT use the Meshy `assets/gen/*.glb`** (campus/dairy/foundry/stadium/airfield/
wagon/dairy_v1) — that AI-generation route was abandoned for style mismatch.

---

## 5. Design system

- **Palette:** sky misty `#c7d4d6` (gradient to `#a9bcc6` up), warm horizon haze /
  fog `#e7decb`, grass `#8a9c57` / shaded `#6f8147`, ink `#2e2a22`. Single warm-red
  accent for CTAs/markers `#b03a48` (WCAG-AA safe). Keep Kenney's own model colors.
- **Shading:** soft toon/cel via `MeshToonMaterial` + a 3-step gradient ramp
  (90/175/255) preserving each model's `map` + `color`. Storybook, not photoreal.
- **Light:** warm directional "golden-hour" sun (`#ffe7bf`, ~2.0) casting soft
  shadows + cool hemisphere (`#bcd0dc` / grass) + low ambient. Fog for depth (misty mountains).
- **Typography:** a humanist/old-style serif for headings (Iowan Old Style / Palatino
  / Georgia stack, or a webfont like "EB Garamond" / "Cormorant"); clean sans for body.
- **Tone:** wayfaring, warm, understated. Avoid naming/copying the films' exact
  trademarked landmarks (see §10).

---

## 6. The 3D world — behaviour spec

- **Landscape:** big green ground (+ darker inner meadow), gradient sky dome, fog;
  distant mountain silhouettes from up-scaled `castle/rocks-large` on the horizon.
- **Forest:** ~150 trees + boulders as a belt outside the road ring — **InstancedMesh**.
- **Road:** a smooth path (Catmull-Rom / Chaikin-smoothed) threading the 6 stops;
  raised road ribbon + humped **stone arch bridges** at water crossings (the prototype
  history has a `buildBridge` recipe: raised-cosine deck, parapets, segmental arch).
- **Villages:** built from the kit per §4 — cottages (modular), windmill, watermill,
  market (fountain + stalls + cart + lanterns), a Rohan hall, **Isengard** (a dark
  Orthanc-style tower ringed by forge/gears/chimneys), and the Minas-Tirith
  watchtower + gate. Each stop sits in/near its village.
- **Traveller:** rigged `horse.glb` (scaled, walk/gallop clip via AnimationMixer)
  pulling a cart; follows the road. Hitch the cart behind the horse (measure in cart-
  local units). Heading = path tangent (expose a `FACING` constant to flip if reversed).
- **Camera modes:**
  - *Explore* (default): OrbitControls, gentle auto-rotate, clamped above ground.
  - *Ride* ("take the reins"): a one-shot cinematic descent into a follow/seat cam;
    W/S throttle, A/D steer with road-snap; on **arrival at a stop**, the camera
    overrides to a **whole-village showcase** framing (pull back & up, look at the
    settlement centre — show the BUILDING, not the cart), and the stop panel opens.
    Esc lifts back to Explore. Respect `prefers-reduced-motion` (near-instant transitions).
- **Stops/panels:** arriving opens an `<aside>` panel with the §2 content; closing
  restores focus; auto-open on ride arrival, click-to-open in explore.

---

## 7. Site structure (2D content layer)

The 3D hero is the headline, but the site must also work as a normal portfolio:

1. **Hero** — the 3D world, title plate ("Through Middle-earth — An Engineer's
   Journey", name + role), and a clear primary CTA ("Take the reins" / "Begin the
   journey") + secondary ("Read the résumé").
2. **Persistent contact bar** (HUD top-right): Résumé · LinkedIn · GitHub · Email.
3. **About** — short bio (the §1 summary), the journey metaphor explained in a line.
4. **Experience** — the 6 roles as a vertical timeline (mirrors the 6 stops; same data).
5. **Projects** — flagship repos (§1) as cards with stack + GitHub links.
6. **Skills** — grouped chips (languages / backend / data / cloud / frontend / web3).
7. **Contact** — email, phone, GitHub, LinkedIn (confirm slug), résumé PDF.
8. **`/resume`** — clean, semantic, accessible, responsive plain-text résumé
   (port `designs/resume.html`); the skim path + SEO + screen-reader fallback.

---

## 8. UX, accessibility, performance — acceptance criteria

- **60fps** on desktop; smooth on a mid phone (cap pixelRatio ~1.6 on touch).
- **Touch:** journey ridable on phones — on-screen ◀ DRIVE ▶ + Seat buttons feeding
  the same input the keyboard does; pinch-zoom in explore; `touch-action:none` on canvas.
- **Reduced motion:** honor `prefers-reduced-motion` (cut auto-rotate & cinematics).
- **Lighthouse:** Accessibility 100, SEO 100, Best-Practices 100. **axe: 0 violations.**
  Semantic landmarks (`<header>`/`<nav>`/`<main>`/`<aside role=…>`), skip link,
  focus management on panel open/close, `:focus-visible` rings, AA contrast.
- **SEO/social:** meta description + OpenGraph/Twitter tags + an OG preview image
  (1200×630). Title, canonical, structured `Person` JSON-LD optional.
- **Asset perf:** Draco-compress GLBs, instance the forest, lazy/progressive load
  with a themed loader + a gated "enter" so nothing pops in half-built.
- **No console errors.**

---

## 9. Build order (milestones)

1. Scaffold Vite+TS+Three; port sky/ground/lights/fog + palette from the prototype.
2. Asset pipeline: loader + cache + Draco + toonify; verify colormap loads.
3. Village builders (cottage/tower/landmarks) + instanced nature + smooth road + bridges.
4. Traveller: rigged horse + cart following the road; explore camera + orbit.
5. Stops data (`data/career.ts`) + panels + the 6 villages placed along the road.
6. Ride mode + cinematic + per-stop village-showcase camera + auto-open panels.
7. Touch controls + reduced-motion + loader/gating.
8. 2D content layer (about/experience/projects/skills/contact) + `/resume` route.
9. SEO/OG + a11y pass (Lighthouse/axe to targets) + perf pass (instancing/Draco/60fps).
10. Confirm LinkedIn slug, wire real links, deploy to Vercel.

---

## 10. Licensing & IP (important)
- Kenney kits = **CC0** (no attribution required, but credit is kind).
- Quaternius horse = **CC0**; any **Poly by Google** asset = **CC-BY** (must credit).
- Keep a footer credit line: "Assets: Kenney (CC0) · Quaternius (CC0) · Poly by Google (CC-BY)".
- **Do NOT** copy the films' exact trademarked landmarks or use "Lord of the Rings"/
  Tolkien marks as branding. Build a Middle-earth–*inspired* original world
  (generic Shire/market/hall/forge/white-tower forms) to stay clear of IP issues on
  a public, name-bearing portfolio.

---

## 11. Paste-ready kickoff prompt
> Build the website described in `docs/MIDDLE-EARTH-BUILD-BRIEF.md` (this repo).
> Use the assets already in `designs/assets/` (Kenney kits + `extra/horse.glb`) and
> port the scene/interaction from `designs/design-13-middleearth.html`. Stack: Vite +
> TypeScript + Three.js 0.160, Draco-compressed GLBs, InstancedMesh forest. Follow the
> milestones in §9; meet the acceptance criteria in §8 (60fps, Lighthouse ~100, axe 0,
> touch + reduced-motion, no console errors). Content is fixed by §1–§2 — don't invent
> facts. Flag the LinkedIn slug as a TODO until I confirm it. Start with milestone 1 and
> show me each milestone before moving on.
