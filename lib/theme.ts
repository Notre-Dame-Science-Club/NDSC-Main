/**
 * Design tokens for NDSC.
 *
 * These are the single source of truth for colors, fonts, and spacing used
 * across the app. The values here mirror the CSS custom properties defined
 * in `app/globals.css` — that file drives the actual look (and supports
 * dark/light mode switching at runtime), while this module exists for the
 * cases where a real CSS var isn't usable, e.g.:
 *
 *   - Building an array of colors for a chart/legend
 *   - Passing a color into a canvas/SVG API that needs a literal string
 *   - Any inline style where you want the token name for readability
 *
 * Prefer `var(--token)` directly in `className`/`style` when you can — it
 * automatically respects the user's theme. Reach for `theme.ts` when you
 * need the value as a plain string/array instead.
 */

/** CSS var() references — safe to use anywhere a color value is expected. */
export const color = {
  bg: "var(--bg)",
  bg2: "var(--bg2)",
  bg3: "var(--bg3)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surface-alt)",
  surfaceDeep: "var(--surface-deep)",
  card: "var(--card)",
  border: "var(--border)",
  borderSoft: "var(--border-soft)",

  blue: "var(--blue)",
  blue2: "var(--blue2)",
  glow: "var(--glow)",
  white: "var(--white)",
  whiteSoft: "var(--white-soft)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  accent2: "var(--accent2)",

  success: "var(--success)",
  danger: "var(--danger)",
  dangerSoft: "var(--danger-soft)",
  warning: "var(--warning)",
  info: "var(--info)",
} as const;

/** Build an rgba() string from a token's RGB triplet var, e.g. alpha('blue', 0.15). */
export function alpha(token: "blue" | "blue2" | "white" | "accent2" | "success" | "danger" | "dangerSoft" | "warning" | "info", opacity: number) {
  const cssVar = token === "dangerSoft" ? "danger-soft" : token;
  return `rgba(var(--${cssVar}-rgb), ${opacity})`;
}

export const font = {
  body: "var(--font-body)",
  heading: "var(--font-heading)",
  display: "var(--font-display)",
  mono: "var(--font-mono)",
  exec: "var(--font-exec)",
} as const;

/**
 * Categorical palette for representing distinct groups (departments, tags,
 * chart series) rather than semantic state. Unlike `color.success` /
 * `color.danger`, these don't swap meaning between light/dark — they're a
 * fixed set of hues used for visual variety.
 */
export const categoryPalette = [
  { name: "blue", color: "var(--blue)" },
  { name: "teal", color: "var(--cat-teal)" },
  { name: "purple", color: "var(--cat-purple)" },
  { name: "red", color: "var(--cat-red)" },
  { name: "amber", color: "var(--cat-amber)" },
  { name: "sky", color: "var(--cat-blue)" },
  { name: "orange", color: "var(--cat-orange)" },
] as const;

/** Consistent breakpoints matching the Tailwind config used across the app. */
export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** Shared easing/duration so animations feel consistent site-wide. */
export const motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  fast: "0.2s",
  base: "0.3s",
  slow: "0.7s",
} as const;

const theme = { color, alpha, font, categoryPalette, breakpoint, motion };
export default theme;
