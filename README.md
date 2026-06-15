# An Engineer's Journey

[![CI](https://github.com/StrangeNoob/engineers-journey/actions/workflows/ci.yml/badge.svg)](https://github.com/StrangeNoob/engineers-journey/actions/workflows/ci.yml)

A playable **Middle-earth portfolio** for **Prateek Kumar Mohanty** (SDE-II, backend engineer).
You roam a stylized open world as **Gandalf the Grey**; six places each hold a "tale" — a
chapter of the career. Walk up, *recall the tale*, and a scroll unfurls with the story.

> Full design: [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md)

## Stack
- **Vite + TypeScript + Three.js** (kinematic character controller, no physics engine)
- Deploy target: **Cloudflare Pages** (immutable asset caching + Workbox service worker)

## Develop
```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build → dist/
npm run preview    # preview the build
```

## Project layout
```
src/
  engine/   renderer, scene, loop, input, quality tiers
  world/    assets loader, terrain, road, water, nature, landmarks, ambient
  player/   gandalf controller + animation, follow camera
  systems/  interaction (tales), journal/progress
  ui/       hud, prompt, tale panel, map overlay, contact bar, loader, touch controls
  data/     career.ts — the six tales (single source of truth)
  pwa/      service worker (Workbox)
public/
  assets/models/  optimized Draco GLBs        assets/img/  the illustrated map
  draco/          bundled Draco decoder        _headers     Cloudflare cache rules
scripts/
  optimize-glb.sh  weld → simplify → resize → Draco (raw 16–80 MB → ~0.3–1 MB)
```

## Status
Phase 0 — scaffold + toolchain smoke-test (loads the Shire landmark). The character
controller, world, tales, journal, and mobile controls are built per the Phase 1 plan.

## Assets & credits
Kenney (CC0) · ChatGPT→Meshy generated landmarks · rigged characters. Build assets are
optimized via `scripts/optimize-glb.sh` before being committed under `public/assets/models`.
