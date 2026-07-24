"use client";
import { useEffect } from "react";

/**
 * Site-wide reveal-on-scroll. Mounted once in app/layout.tsx so every
 * page (not just the home page) gets the same `.reveal` /
 * `.reveal-mask` scroll-in motion.
 *
 * The MutationObserver below picks up `.reveal` elements added to the
 * DOM *after* initial mount — e.g. tab content that swaps in (like the
 * activity type tabs on /activities), or anything behind an async
 * fetch. It has to stay alive for the whole page lifetime: a previous
 * version auto-disconnected it after 5s as a perf optimization, but
 * that meant any `.reveal` element mounted later was never observed,
 * never got `.visible`, and stayed stuck at `opacity: 0` — invisible
 * forever. The `:not(.visible)` filter in the selector already keeps
 * each pass cheap (already-revealed elements are skipped), so there's
 * no need to time-box it.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.1, rootMargin: "-30px" }
    );

    const observe = () => {
      document
        .querySelectorAll(".reveal:not(.visible), .reveal-mask:not(.visible)")
        .forEach((el) => obs.observe(el));
    };

    // Reduced motion → mark everything visible, skip the observer entirely.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document
        .querySelectorAll(".reveal, .reveal-mask")
        .forEach((el) => el.classList.add("visible"));
      return;
    }

    observe();
    // Watch for route changes / new sections being added — stays alive
    // for the page's full lifetime (see comment above).
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
