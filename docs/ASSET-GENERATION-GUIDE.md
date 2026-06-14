# Asset Generation Guide — ChatGPT image → Meshy image-to-3D

Workflow: **(1)** generate a clean concept image in ChatGPT → **(2)** approve the look →
**(3)** upload it to Meshy **Image-to-3D** → **(4)** (optional) remesh to low-poly →
**(5)** drop the GLB into `designs/assets/gen/` and place it in the scene.

This gives you full control of the art style in 2D *before* committing to a 3D model,
and every model inherits one consistent look. Companion to
`docs/MIDDLE-EARTH-BUILD-BRIEF.md`.

---

## A. Universal image rules (critical for good image-to-3D)

Meshy reconstructs geometry from what it can see, so the image must be a clean,
unambiguous "product shot" of ONE object:

1. **One object, centered, fully in frame** with ~10% margin — never cropped.
2. **3/4 view from slightly above** (hero/isometric angle) — shows front + one side +
   top. This single angle reconstructs best. Avoid dramatic perspective or worm's-eye.
3. **Plain, flat background** — solid light grey (`#d9d9d9`) or pure white. **No scene,
   no ground plane, no horizon, no other objects.** (A busy background bleeds into the mesh.)
4. **Even, soft lighting**, minimal hard shadows; **no cast shadow on the ground**.
5. **No text, no labels, no watermark, no UI, no border.**
6. **Square (1:1), high resolution.**
7. Matte, flat colors — **no glossy highlights, no reflections** (they confuse depth).

In ChatGPT (DAL·E/GPT-Image), end every prompt with:
> "single centered object, 3/4 isometric view from slightly above, plain flat light-grey
> background, soft even lighting, no shadows, no text, matte flat colors, square image."

---

## B. The shared STYLE BLOCK (prepend to EVERY prompt → cohesion)

> "Stylized low-poly 3D render, storybook Middle-earth fantasy, hand-painted matte flat
> colors, gentle toon shading, clean simple geometry, warm and cozy, muted natural palette
> — mossy green, parchment cream, warm timber brown, slate grey, soft red accents —"

Palette to keep consistent (from the build brief): grass `#8a9c57`, cream `#e7decb`,
timber `#7a5b3a`, slate `#6f7a82`, ink `#2e2a22`, red accent `#b03a48`.

**IP safety:** build *inspired originals*. Do NOT put trademarked names or exact film
landmarks in the prompt or image (no "Lord of the Rings", "Bag End", "Minas Tirith" text,
no screen-accurate replicas). Describe generic forms (a round-door hill home, a white
tiered citadel) — that's what keeps a public, name-bearing portfolio clear of IP issues.

---

## C. Meshy Image-to-3D settings (recommended)

- Mode: **Image to 3D**, single image (front 3/4). Multi-image optional if you make
  matching front+side views — single is fine for these.
- **Topology:** triangle · **Target polycount:** 6,000–15,000 for hero buildings,
  3,000–6,000 for props (you can also remesh down afterward).
- **PBR: off**, **Texture: on** (base color from the image). Symmetry: auto.
- After preview, if a model is too dense/noisy for the toon look, run a **remesh /
  decimate** pass to ~3–5k tris (cleaner silhouette + ink edges in-scene).
- Export **GLB**, Y-up. Save as the exact filename listed below.

---

## D. TIER 1 — the six career landmarks (MUST generate; not in the kit)

One distinctive hero structure per career stop. These carry the whole theme.

### 1. `shire-home.glb` — The Shire (education / OURT)
> [STYLE BLOCK] "a cozy round hobbit hill-home built into a grassy green mound, a bright
> round wooden front door with a brass knob, two round windows, a small brick chimney,
> flower boxes and a tiny fenced garden path, snug and welcoming —" [IMAGE RULES]

### 2. `bywater-mill.glb` — Bywater Mill (Milk Mantra)
> [STYLE BLOCK] "a stone-and-timber watermill beside a small stream, a large wooden
> water wheel on the side, a thatched pitched roof, a stubby stone chimney, a little
> wooden footbridge —" [IMAGE RULES]

### 3. `bree-inn.glb` — Bree, the crossroads (Aarna)
> [STYLE BLOCK] "a two-storey timber-framed medieval coaching inn, white plaster and dark
> wood beams, a steep tiled roof with dormer windows, a hanging wooden sign on an iron
> bracket, warm glowing windows, an attached stable wing —" [IMAGE RULES]

### 4. `edoras-hall.glb` — Edoras of Rohan (Frifty)
> [STYLE BLOCK] "a grand golden-roofed timber mead-hall of the horse-lords on a stepped
> green mound, tall carved wooden gables with horse-head motifs, banners on poles flanking
> the doors, a low wooden palisade around the base —" [IMAGE RULES]

### 5. `isengard-tower.glb` — Isengard, the Works of Orthanc (Dextr Labs)
> [STYLE BLOCK] "a tall sharp black four-pointed obsidian wizard's tower rising from a
> ringed stone courtyard, surrounded by small iron forges, turning gears and smoking
> chimneys, dark and industrial but stylized and tidy —" [IMAGE RULES]

### 6. `minas-tirith.glb` — The White Tower (Pathfndr, current — the summit)
> [STYLE BLOCK] "a white-stone tiered mountain citadel, several concentric ringed walls
> climbing a peak, a tall slender white tower with a banner at the very top, a great
> arched gate at the base, bright and triumphant —" [IMAGE RULES]

---

## E. TIER 2 — signature nature & props (generate if you want full ownership of the look)

These have Kenney equivalents (see Tier 3), so generating them is optional polish.

- `mallorn-tree.glb` — "a majestic elven tree with silver-grey bark and a broad canopy of
  pale gold leaves, graceful and tall." (Make 2–3 colour variants: gold, green, autumn.)
- `mountain-backdrop.glb` — "a row of snow-capped misty grey-blue mountain peaks, low and
  wide, stylized horizon range." (For the distant skyline; scale up huge.)
- `covered-wagon.glb` — "a four-wheeled covered travelling wagon with a cream canvas
  bonnet over wooden hoops, wooden spoked wheels, a driver's bench." (The cart the horse
  pulls — only if you want a hero wagon instead of the kit cart.)
- `signpost.glb` — "a weathered wooden crossroads signpost with several blank pointing
  arrow-boards on a single post."
- `stone-bridge.glb` — "a small humped medieval stone arch bridge with low parapet walls."
- `market-stall.glb` — "a small wooden market stall with a striped awning and a counter."
- `well.glb` — "a round stone village well with a little tiled roof and a bucket on a rope."
- `banner-pole.glb` — "a tall wooden pole flying a long plain cloth banner."

### Terrain & water (generate as static painted models — they won't animate)
- `grass-tuft.glb` — "a small clump of stylized grass blades with a few tiny yellow and white
  wildflowers, on a little rounded patch of earth." (Scatter/instance many.)
- `pond.glb` — "a small calm pond, flat blue-green water, irregular grassy banks with reeds, a
  few lily pads and mossy rocks at the edge, single low-poly object."
- `stream-straight.glb` — "a modular straight brook segment, shallow blue-green water between low
  grassy banks with small pebbles, flat ends so it tiles end-to-end." (Match the road tiles.)
- `stream-curve.glb` — "a modular 90° curved brook segment, blue-green water between grassy banks
  with pebbles, matching the straight brook so they connect."
- `fountain.glb` — "an ornate round stone village fountain, carved basin with a central tiered
  pillar, weathered pale stone with soft moss, calm water in the bowl, low-poly stylized."

> Note: a generated lake/stream is a STATIC painted surface (no ripple/reflection) — fine for the
> storybook look. Make streams MODULAR (straight + curve) so they lay along a path like the roads.

> Characters note: Meshy **image-to-3D can make a static figure** (e.g. a hooded traveller),
> but it will NOT be rigged/animated — Meshy's rigging is humanoid-only and separate. Keep
> the existing **rigged `assets/extra/horse.glb`** for the moving horse; don't regenerate it.

---

## F. TIER 3 — keep from the Kenney kit (do NOT generate)

Already cohesive CC0 and plentiful in `designs/assets/kenney/` — reuse these for the
generic dressing so you only spend generation effort on the hero pieces above:

- generic **trees, rocks, boulders, bushes, hedges**
- **fences, gates, walls, lanterns, barrels, banners, market stalls** (variants)
- **road/path tiles, fountains, chimneys, wheels**
- modular **cottages** for the background village fill (only the 6 hero landmarks are bespoke)

---

## G. Per-asset checklist (repeat for each)

1. Generate the image in ChatGPT (STYLE BLOCK + subject + IMAGE RULES). Regenerate until
   the silhouette is clean and the whole object is visible on a plain background.
2. Upload to Meshy → Image-to-3D → settings in §C → preview.
3. Eyeball: is the geometry clean and the texture flat/on-palette? If dense/noisy, remesh down.
4. Export GLB → save as the filename above in `designs/assets/gen/`.
5. Preview with toon+ink (`designs/assets/gen/_preview.html?m=<name>`) before placing.
6. Place in the scene at its career stop; tune scale/rotation/sink.

---

## H. Suggested order
Do **one Tier-1 landmark end-to-end first** (e.g. `shire-home`) to validate the whole
ChatGPT→Meshy→toon pipeline and lock your style words, THEN batch the other five with the
same STYLE BLOCK so they all match. Tier 2 last, only if you want them.
