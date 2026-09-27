"use client";

import { useEffect, useRef } from "react";
import type { Intensity } from "@/lib/cosmos/engine";

/**
 * Mounts the cosmos scene into a fixed, full-viewport canvas and tears it
 * down on unmount. This is a dumb wrapper on purpose — all the actual
 * scene logic lives in lib/cosmos/, so this component only owns the
 * canvas element, the boot/dispose lifecycle, and forwarding the pointer.
 *
 * `sections`, when given, are the chapter elements (one per homepage
 * section, in DOM order) the scroll-driven camera flies between. Leave it
 * out for a static backdrop (used outside the homepage).
 */
export default function CosmosCanvas({
  intensity,
  sectionSelector,
}: {
  intensity: Intensity;
  /** CSS selector collecting the chapter elements, evaluated after mount
   *  so this works whether the sections are server- or client-rendered. */
  sectionSelector?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (intensity === "off") return;
    const canvas = ref.current;
    if (!canvas) return;

    let disposed = false;
    let handle: { dispose: () => void; setPointer: (nx: number, ny: number) => void } | null = null;

    // Three.js touches `document`/`window` at import time in ways that are
    // unsafe during SSR, so it is loaded lazily, client-side only.
    import("@/lib/cosmos/engine").then(({ bootCosmos }) => {
      if (disposed) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sections = sectionSelector
        ? (Array.from(document.querySelectorAll(sectionSelector)) as HTMLElement[])
        : undefined;
      handle = bootCosmos({ canvas, intensity, sections, reducedMotion });
    });

    const onPointer = (e: PointerEvent) => {
      handle?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointermove", onPointer);
      handle?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity, sectionSelector]);

  if (intensity === "off") return null;
  return <canvas ref={ref} className="cosmos-canvas" aria-hidden="true" />;
}
