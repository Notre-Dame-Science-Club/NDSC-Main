/**
 * Theme models for NDSC.
 *
 * A "theme model" is a complete look for the whole site — navbar, footer,
 * every page's text and background. Three ship today:
 *
 *   dark    Deep Space — the original NDSC look (near-black + cyan neon)
 *   light   Daylight   — white surfaces, dark text, print-clean and calm
 *   cosmos  Cosmos     — the cinematic one: a live starfield/nebula backdrop
 *                        behind mostly-transparent surfaces
 *
 * Which one a visitor sees is decided in this order:
 *   1. their own choice (localStorage), if the public switcher is on AND that
 *      theme is still in the admin's allow-list
 *   2. the admin's Default Theme (Admin → Appearance)
 *   3. `dark`
 *
 * Everything is stored as rows in the existing `homepage_settings` key/value
 * table, so there is no migration to run.
 */

export type ThemeId = "dark" | "light" | "cosmos";

export const THEME_IDS: ThemeId[] = ["dark", "light", "cosmos"];

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  /** One line for the admin panel and the switcher tooltip. */
  description: string;
  /** Swatch colors for the admin preview chips: [background, surface, accent]. */
  swatch: [string, string, string];
  /** `color-scheme` so native form controls / scrollbars match. */
  colorScheme: "dark" | "light";
};

export const THEMES: Record<ThemeId, ThemeMeta> = {
  dark: {
    id: "dark",
    label: "Deep Space",
    description: "The original NDSC look — near-black with cyan neon.",
    swatch: ["#020810", "#0a1628", "#00d4ff"],
    colorScheme: "dark",
  },
  light: {
    id: "light",
    label: "Daylight",
    description: "White background, dark text. Clean, professional, print-friendly.",
    swatch: ["#ffffff", "#f4f7fb", "#0b63d6"],
    colorScheme: "light",
  },
  cosmos: {
    id: "cosmos",
    label: "Cosmos",
    description: "Cinematic. A live starfield and nebula drift behind the whole site.",
    swatch: ["#04060d", "#0b1120", "#7dd3fc"],
    colorScheme: "dark",
  },
};

export const DEFAULT_THEME: ThemeId = "cosmos";

/** localStorage key holding the visitor's own pick. */
export const THEME_STORAGE_KEY = "ndsc-theme";

/** Fired on `window` after a theme change so non-React widgets can react. */
export const THEME_EVENT = "ndsc:themechange";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

/** "dark,cosmos" → ["dark", "cosmos"]; junk and duplicates are dropped. */
export function parseThemeList(raw?: string | null): ThemeId[] {
  if (!raw) return [];
  const out: ThemeId[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (isThemeId(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export type AppearanceConfig = {
  /** What a first-time visitor gets. */
  defaultTheme: ThemeId;
  /** Whether the public switcher button appears in the navbar. */
  switcherEnabled: boolean;
  /**
   * Which models the switcher may cycle through. Always contains
   * `defaultTheme` so the button can never strand someone on a theme the
   * admin has since removed.
   */
  switchableThemes: ThemeId[];
};

/**
 * Turn the raw `homepage_settings` rows into a config object. Tolerant of
 * missing / malformed rows: anything unreadable falls back to the defaults
 * rather than breaking the page.
 */
export function resolveAppearance(values: Record<string, string> | null | undefined): AppearanceConfig {
  const v = values || {};
  const defaultTheme = isThemeId(v.default_theme) ? v.default_theme : DEFAULT_THEME;

  // Absent row = on, which keeps the behaviour sites had before this setting
  // existed (there was always a toggle).
  const switcherEnabled = v.theme_switcher_enabled !== "0";

  let switchableThemes = parseThemeList(v.theme_switcher_themes);
  if (switchableThemes.length === 0) switchableThemes = [...THEME_IDS];
  if (!switchableThemes.includes(defaultTheme)) switchableThemes = [defaultTheme, ...switchableThemes];

  return { defaultTheme, switcherEnabled, switchableThemes };
}

/**
 * The exact logic the inline boot script runs, kept here so the server and the
 * client agree on what a stored value means. Returns the theme to paint.
 */
export function pickTheme(stored: string | null, config: AppearanceConfig): ThemeId {
  if (!config.switcherEnabled) return config.defaultTheme;
  if (isThemeId(stored) && config.switchableThemes.includes(stored)) return stored;
  return config.defaultTheme;
}
