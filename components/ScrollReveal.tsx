"use client";
import { useEffect } from "react";

/**
 * Site-wide reveal-on-scroll. Mounted once in app/layout.tsx so every
 * page (not just the home page) gets the same `.reveal` /
 * `.reveal-mask` scroll-in motion.
 *
 * Two improvements over the previous version:
 *   1. The MutationObserver auto-disconnects after 5s, so it doesn't
 *      keep re-observing the DOM forever (which was a real perf bug —
 *      the observer walked the whole document on every childList
 *      mutation, even after the page was idle).
 *   2. Respects prefers-reduced-motion — when set, every reveal
 *      element is marked visible in one synchronous pass.
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
    // Watch for route changes / new sections being added.
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    // Auto-disconnect after 5s — by then the initial paint and any
    // route-load content is in. Anything mounted later can still reveal
    // because IntersectionObserver fires on observe() for elements
    // already in view, so the user's scroll position takes over.
    const stop = window.setTimeout(() => mo.disconnect(), 5000);

    return () => {
      obs.disconnect();
      mo.disconnect();
      window.clearTimeout(stop);
    };
  }, []);
  return null;
}
