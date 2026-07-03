"use client";
import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      }),
      { threshold: 0.1, rootMargin: "-30px" }
    );
    const observe = () => document.querySelectorAll(".reveal:not(.visible)").forEach(el => obs.observe(el));
    observe();
    // Re-observe on route changes
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
