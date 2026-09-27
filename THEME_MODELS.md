# NDSC — Theme Models (dark / light / cosmos)

Ei bundle ta tomar existing NDSC repo-r upore drop-in. Content, routes, admin
features — kichui bad jay nai. Ja add holo: **poura site-r jonno 3 ta theme
model**, admin theke control, ar navbar-e ekta public switcher button.

---

## 1. Files

**New**

| Path | Ki kore |
|---|---|
| `lib/themes.ts` | Theme registry + admin settings resolver. Server ar client duitai eta theke porche, tai kokhono disagree korbe na. |
| `app/theme-models.css` | Tinta model-er token block + switcher/backdrop styles. `globals.css`-er **por** load hoy, tai token gulo override kore. |
| `components/theme/ThemeProvider.tsx` | Config dhore rakhe, `data-theme` apply kore, `useTheme()` hook dey. |
| `components/theme/ThemeSwitcher.tsx` | Navbar-er button. Admin off korle nijei render kore na. |
| `components/theme/SiteBackdrop.tsx` | Site-wide cinematic background canvas (starfield, nebula, parallax, meteor). |

**Modified** — purano file gulo replace koro:

- `app/layout.tsx` — notun settings fetch, boot script, `<ThemeProvider>` wrap
- `components/layout/Navbar.tsx` — switcher desktop (Login-er dane) + mobile drawer
- `app/admin/appearance/page.tsx` — Default Theme Model + Theme Switcher Button section
- `app/api/admin/appearance-settings/route.ts` — notun key duita whitelist
- `app/page.tsx` — homepage-er background stack clean

**Database:** kono migration lage na. Notun setting gulo `homepage_settings`
table-e normal key/value row hisebe jay (`theme_switcher_enabled`,
`theme_switcher_themes`).

---

## 2. Theme models

| Model | ID | Ki rokom |
|---|---|---|
| Deep Space | `dark` | Tomar current look — near-black + cyan neon. Kichu change hoy nai. |
| Daylight | `light` | White background, dark text, opaque paper-like card, real shadow (glow noy). Professional/print-clean. |
| Cosmos | `cosmos` | Cinematic. Live starfield + nebula backdrop, surface gulo glass, ice-blue accent. |

Ekta model change korle **navbar, footer, protita page-er bg + text** ek shathe
change hoy — karon shob component agei `var(--bg)`, `var(--white)` egulo use
korche, ar theme shudhu oi token gulo re-point kore.

### Cosmos-e page gulo dheke jay na keno
Site-r onek section `background: var(--bg)` / `var(--bg2)` diye nijer opaque
band aake. Cosmos-e oi **token duita nijei translucent** kora hoyeche ar solid
color `<html>`-e chole gache — tai 100+ file edit na kore o protita band-er
bhitor diye sky ta dekha jay.

---

## 3. Admin panel (Admin → Appearance)

1. **Default Theme Model** — tinta card, swatch soho. First-time visitor ja pabe.
2. **Theme Switcher Button** — Show / Hide. Hide korle shobai default-e thakbe.
3. **Models the button can switch between** — checkbox. Default model always
   ticked thake (lock kora), jate button kauke emon model-e atke na feleh ja tumi
   pore off kore diyecho. 2-tar kom tick thakle button nijei hide hoye jay.

Switcher-e:
- 2 model allowed → ekta icon toggle button
- 3 model allowed → segmented control, protita model-e ekta icon

Visitor-er choice `localStorage`-e (`ndsc-theme`) thake ar onno tab-eo sync hoy.

---

## 4. Homepage background — ja shorano holo

Age hero-r upore ei gulo stack kora chilo: galaxy canvas + 3 ta blurred
"caustic" blob + grid overlay + gradient tint, ar tar niche protita section
abar `background: var(--bg)` diye shob dheke ditto. Seijonnoi mone hoto duita
alada background jora lagano.

Ekhon: **ekta fixed scene** (`SiteBackdrop`) puro site-r pichone, page ta tar
upor diye scroll kore, ar kono section opaque fill deye na. Hero-te shudhu ekta
hairline horizon line ache.

`GalaxyCanvas.tsx` ar `ThemeToggle.tsx` ekhon unused — chaile delete kore dite paro.

---

## 5. Accent color note

Admin-er Accent Color ekhon `--user-accent-*` hisebe publish hoy, direct `--blue`-e
noy. Karon `<html>`-er inline style shob selector-ke beat kore — tar mane ekta
neon cyan accent Daylight theme-eo force hoye joto, ja white-er upore pora jay na.
Ekhon dark/cosmos raw color ta ney, light ekta darkened variant ney.

---

## 6. Performance / a11y

- Backdrop canvas: DPR 2-e cap, tab hidden hole RAF bondho, resize debounced,
  nebula ekbar offscreen canvas-e aka hoye blit hoy (per-frame gradient noy).
- `prefers-reduced-motion` — ekta frame eke animation off.
- Light theme-e canvas mount-i hoy na.
- Switcher-e `aria-pressed`, proper labels, keyboard-accessible.

---

## 7. Ja ekhono baki (next step)

Ei bundle e theme engine + homepage background clean-up ache. **Protita page-er
full graphic redesign** (activities-er 1963/1985 archive photo layout, video
hero, per-page cinematic sections) alada kaj — page list ar photo gulo dile
ami ek ek kore korte pari, same content rekhe.
