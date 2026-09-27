"use client";

import { usePathname } from "next/navigation";
import { ThemeId } from "@/lib/themes";
import CosmosCanvas from "@/components/cosmos/CosmosCanvas";
import type { Intensity } from "@/lib/cosmos/engine";

/**
 * The one background layer for the entire site — mounted once by
 * <ThemeProvider>. What it shows depends on the active theme model:
 *
 *   cosmos  the full scene (planet, atom core, station, dense star field),
 *           camera driven by scroll on the homepage, otherwise static
 *   dark    a quieter star field only — no planet/core geometry — so the
 *           original NDSC look keeps some depth without competing with
 *           page content
 *   light   nothing at all; the CSS wash in theme-models.css is the whole
 *           treatment on paper
 *
 * The scroll-driven camera only makes sense where the chapter sections it
 * flies between actually exist, so it is wired up on the homepage only
 * (see app/page.tsx, which renders the matching data-cosmos-chapter
 * elements in order); every other page gets the same engine holding a
 * fixed, gently drifting view.
 */
const INTENSITY: Record<ThemeId, Intensity> = {
  cosmos: "full",
  dark: "dim",
  light: "off",
};

export default function SiteBackdrop({ theme }: { theme: ThemeId }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const intensity = INTENSITY[theme];

  return (
    <div className="site-backdrop" aria-hidden="true">
      <CosmosCanvas
        key={theme /* a full re-mount on theme change is simpler and safer
                      than trying to hot-swap the WebGL scene's intensity */}
        intensity={intensity}
        sectionSelector={isHome ? "[data-cosmos-chapter]" : undefined}
      />
    </div>
  );
}
