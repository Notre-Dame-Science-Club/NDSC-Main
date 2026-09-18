# NDSC — Cosmos redesign

Next.js project — same Supabase backend, same admin panel, same Hostinger
deploy target, same routes and content. This document is only about what's
**new**: the cinematic "Cosmos" homepage and the site-wide WebGL backdrop,
and where each part of it lives.

## Install

```bash
npm install     # pulls in `three`, newly added to package.json
npm run dev
```

No database migration needed — the appearance settings this uses
(`default_theme`, `theme_switcher_enabled`, `theme_switcher_themes`) already
existed from the earlier theme-model work and just save as normal
`homepage_settings` rows the first time Admin ▸ Appearance is touched.

---

## 1. The WebGL scene — `lib/cosmos/`

The whole 3-D backdrop (planet, the club's atom mark, the observatory
ring, star field, post-processing) is generated at runtime — no textures
or models ship with the app for it. It's split by responsibility, not
dumped in one file:

| File | What's in it |
|---|---|
| `math.ts` | Seeded RNG, Perlin-style noise, fbm, easing. No THREE, no DOM — pure functions. |
| `textures.ts` | Every canvas-painted texture: the sky, the planet (day/rough/emissive maps), clouds, moon, ring, star sprite, glow sprite, grain. |
| `world.ts` | Builds the actual THREE objects from those textures — `buildSky`, `buildPlanet`, `buildCore` (the atom), `buildStation`, `buildField` (star layers + dust), `buildLights`. |
| `post.ts` | The post-processing chain: bright-pass → 4-level blur → additive bloom → ACES + chromatic split + grain + vignette composite. |
| `rig.ts` | The camera: one waypoint per homepage chapter (`CAM`), a Catmull-Rom spline between them, and the scroll → camera-progress mapping. |
| `engine.ts` | Orchestrates all of the above: owns the renderer, the render loop, resize, and `dispose()`. This is the only file `components/cosmos/CosmosCanvas.tsx` talks to. |

`components/cosmos/CosmosCanvas.tsx` is the thin React wrapper — it mounts
a `<canvas>`, lazy-loads `engine.ts` on the client only (three.js never
touches SSR), and tears the scene down on unmount.

`components/theme/SiteBackdrop.tsx` decides **how much** scene to show,
per theme model:

- **cosmos** — the full scene, camera driven by scroll (homepage only;
  every other page gets the same engine holding a fixed view)
- **dark** — a quieter star field only, no planet/core geometry — the
  original NDSC look keeps some depth without competing with content
- **light** — nothing; the CSS wash in `app/theme-models.css` is the whole
  treatment on paper

This is the same theme-switcher infrastructure from the earlier redesign
pass (`lib/themes.ts`, `components/theme/ThemeProvider.tsx`,
`components/theme/ThemeSwitcher.tsx`, Admin ▸ Appearance) — cosmos is now
the **default** (`DEFAULT_THEME` in `lib/themes.ts`), dark/light are still
there as admin-controlled alternates via the navbar switcher.

---

## 2. The new homepage — `app/_components/home2/`

One file per chapter, each commented with what it is and — where it reads
real data — which endpoint:

| Component | Chapter | Data source |
|---|---|---|
| `Hero.tsx` | 0 — hero | static |
| `StatsStrip.tsx` | — (sits under the hero, no camera waypoint of its own) | static |
| `LegacySection.tsx` | 1 — founder | static (photo is a placeholder cut-out — see below) |
| `DepartmentsSection.tsx` | 2 — departments | static |
| `ActivitiesMarquee.tsx` | 3 — live feed | `/api/activity-sessions-public` (same endpoint the old carousel used) |
| `LeadersSection.tsx` | 4 — leadership | static, same copy/photos as the original `LeadersSection` |
| `MediaSection.tsx` | 5 — media | `/api/science-media` |
| `AudriSection.tsx` | 6 — publication | `/api/publications?latest=true&category=annual_magazine` |
| `JoinSection.tsx` | 7 — join | static |
| `HomeChrome.tsx` | — | client-only: scroll reveals, the progress rail, hero fade-out, cursor dot, quote word-stagger. One file so these don't get re-implemented per section. |

`home2.css` is the one stylesheet for all of it — and it deliberately
**reads the site's existing design tokens** (`var(--bg)`, `var(--white)`,
`var(--blue)`, `var(--font-heading)`, …) instead of inventing its own
palette. That's what makes this homepage re-skin for free when the theme
model or the admin's accent colour changes — exactly like `Navbar` and
`Footer` already did before this redesign.

`app/page.tsx` itself is ~45 lines: it imports the chapters above and
lays them out. No scene logic, no fetch logic, no animation logic lives
there.

### The founder photo

`LegacySection.tsx` points at `/public/images/founder-cutout.png` — a
transparent cut-out of Fr. Richard William Timm is meant to go there, the
same way the reference image shows KAGE's wordmark with its sanctuary
visible through and around the letters. Until that file exists the `<img>`
just hides itself (see the `onError` handler) and the giant "NDSC" outline
wordmark behind it still fills the space. Drop the real PNG in and nothing
else needs to change.

---

## 3. What changed outside `home2/` and `lib/cosmos/`

- **`components/layout/Navbar.tsx`** — only the brand mark. The static
  `/images/cropped-logo.png` is replaced by `components/layout/AtomMark.tsx`,
  a small always-rotating SVG atom (three orbits at different speeds), and
  the subtitle now reads "SINCE 1955" instead of the full club name. Every
  link, the mobile drawer, the theme switcher, the auth button — untouched.
- **`components/layout/Footer.tsx`** — one line only: `id="ch-footer"
  data-cosmos-chapter` added to the root `<footer>` so the scroll rig can
  use it as the final camera waypoint. No content, no visual change — it
  re-skins automatically from the same tokens it already used.
- **`app/globals.css`** — added Space Grotesk and JetBrains Mono to the
  existing font `@import`, and pointed `--font-heading`/`--font-display` at
  Space Grotesk and `--font-mono` at JetBrains Mono (`--font-body` stays
  Inter). This is what gives headings and labels site-wide the more
  editorial, technical feel — Admin ▸ Appearance's font override still
  works exactly as before.
- **`app/theme-models.css`** — the `cosmos` theme's accent colours tuned to
  match the new scene (`#5ad8ff` blue, `#a78bfa` violet).
- **`lib/themes.ts`** — `DEFAULT_THEME` changed from `"dark"` to `"cosmos"`.
- **`package.json`** — added `three` (and `@types/three`).

Nothing in `app/admin/`, the Supabase client, the API routes, or any other
page (`/about`, `/activities`, `/publication`, …) was touched — they pick
up the new fonts and the (much quieter) backdrop automatically through the
same tokens, and otherwise render exactly as before.

---

## 4. Performance notes

- The renderer's pixel ratio adapts down automatically if a device is
  struggling to hold frame time, and climbs back up once it recovers
  (`engine.ts`, the `perf` governor inside `frame()`).
- `prefers-reduced-motion` renders one static frame and stops the RAF loop
  entirely.
- The tab going hidden (`visibilitychange`) pauses the loop.
- Three.js is dynamically imported client-side only — it never ships in
  the initial page bundle or touches SSR.
