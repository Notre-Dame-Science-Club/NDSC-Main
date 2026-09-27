"use client";

import { Moon, Sparkles, Sun } from "lucide-react";
import { THEMES, ThemeId } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

const ICONS: Record<ThemeId, typeof Sun> = {
  dark: Moon,
  light: Sun,
  cosmos: Sparkles,
};

/**
 * The public theme-model switcher. Rendered in the navbar to the right of
 * Login, and as a full-width row in the mobile drawer.
 *
 * Admin controls it entirely (Admin → Appearance):
 *   - switcher off        → this renders nothing at all
 *   - one model allowed   → nothing (there is nowhere to switch to)
 *   - two models allowed  → a single icon button that toggles between them
 *   - three models        → a segmented control, one icon per model
 */
export default function ThemeSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { theme, setTheme, cycleTheme, config, ready } = useTheme();
  const list = config.switchableThemes;

  if (!config.switcherEnabled || list.length < 2) return null;

  // Two models is a toggle, not a menu — showing a two-item segmented control
  // for "dark or light" wastes the navbar's narrowest real estate.
  if (list.length === 2) {
    const next = list[(list.indexOf(theme) + 1) % 2];
    const Icon = ICONS[next];
    return (
      <button
        type="button"
        onClick={cycleTheme}
        className={mobile ? "theme-switch theme-switch--block" : "theme-switch"}
        title={ready ? `Switch to ${THEMES[next].label}` : "Switch theme"}
        aria-label={ready ? `Switch to ${THEMES[next].label} theme` : "Switch theme"}
      >
        <span className="theme-switch-btn" aria-hidden="true">
          <Icon size={15} />
          {mobile && <span className="theme-switch-label">{THEMES[next].label}</span>}
        </span>
      </button>
    );
  }

  return (
    <div
      className={mobile ? "theme-switch theme-switch--block" : "theme-switch"}
      role="group"
      aria-label="Site theme"
    >
      {list.map((id) => {
        const Icon = ICONS[id];
        const meta = THEMES[id];
        const active = ready && theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className="theme-switch-btn"
            aria-pressed={active}
            title={`${meta.label} — ${meta.description}`}
            aria-label={`${meta.label} theme`}
          >
            <Icon size={15} />
            {mobile && <span className="theme-switch-label">{meta.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
