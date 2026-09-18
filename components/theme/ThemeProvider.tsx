"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppearanceConfig,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  ThemeId,
  pickTheme,
} from "@/lib/themes";
import SiteBackdrop from "./SiteBackdrop";

type ThemeContextValue = {
  /** The model currently painted. */
  theme: ThemeId;
  /** Switch models. Ignored if the theme isn't in the admin's allow-list. */
  setTheme: (next: ThemeId) => void;
  /** Move to the next allowed model — what the single-button switcher calls. */
  cycleTheme: () => void;
  config: AppearanceConfig;
  /**
   * False until the first client effect runs. Components that would otherwise
   * render different markup on the server and the client (the switcher's
   * pressed state, for one) wait on this instead of guessing.
   */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider> (see app/layout.tsx)");
  }
  return ctx;
}

export default function ThemeProvider({
  config,
  children,
}: {
  config: AppearanceConfig;
  children: React.ReactNode;
}) {
  // The inline boot script in layout.tsx has already written the attribute
  // before first paint, so there is no flash. Seeding state from the admin
  // default (not from localStorage) keeps the server and client markup
  // identical; the effect below reconciles on mount.
  const [theme, setThemeState] = useState<ThemeId>(config.defaultTheme);
  const [ready, setReady] = useState(false);

  const apply = useCallback((next: ThemeId) => {
    document.documentElement.setAttribute("data-theme", next);
    setThemeState(next);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Private mode / storage blocked — the admin default is a fine answer.
    }
    apply(pickTheme(stored, config));
    setReady(true);
    // `config` is a fresh object each render of the server layout, so compare
    // by value rather than identity or this re-runs on every navigation.
  }, [apply, config.defaultTheme, config.switcherEnabled, config.switchableThemes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Another tab switched models — follow it, so a member with the site open
  // twice doesn't see two different sites.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      apply(pickTheme(e.newValue, config));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply, config]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      if (!config.switcherEnabled) return;
      if (!config.switchableThemes.includes(next)) return;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Not fatal: the theme still applies for this session.
      }
      apply(next);
    },
    [apply, config]
  );

  const cycleTheme = useCallback(() => {
    const list = config.switchableThemes;
    if (list.length < 2) return;
    const i = list.indexOf(theme);
    setTheme(list[(i + 1) % list.length]);
  }, [config.switchableThemes, setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, cycleTheme, config, ready }),
    [theme, setTheme, cycleTheme, config, ready]
  );

  return (
    <ThemeContext.Provider value={value}>
      <SiteBackdrop theme={theme} />
      {children}
    </ThemeContext.Provider>
  );
}
