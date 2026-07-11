import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ndsc: {
          blue: "#00d4ff",
          blue2: "#0077ff",
          bg: "#020810",
          bg2: "#050d1a",
          muted: "#6a8faf",
          border: "#0f2a4a",
          accent: "#ff6b35",
          // Added to complete the set of tokens already used ad hoc via
          // CSS variables in app/globals.css (--white, --card, --accent2,
          // --glow) so they're also available as Tailwind utilities
          // (text-ndsc-white, bg-ndsc-card, etc). Values match the dark
          // theme defaults in lib/theme.ts's `darkTheme` — for light-theme
          // support use the CSS variables (`var(--white)`, `var(--card)`,
          // ...) directly instead of these static utilities, since these
          // don't respond to the [data-theme="light"] override.
          white: "#e8f4ff",
          card: "#0a162899",
          accent2: "#a78bfa",
          glow: "#00d4ff55",
        },
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        rajdhani: ["Rajdhani", "sans-serif"],
        mono: ["Share Tech Mono", "monospace"],
        jakarta: ["Plus Jakarta Sans", "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 20s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
