import { useEffect, useState } from "react";

/**
 * Returns true when the user has set their OS to prefer reduced motion.
 * Re-renders on media-query change so consumers can branch live.
 *
 * Components that run JS-driven motion (LetterAnim, LoopingP, anything
 * that mutates a transform via setState) should branch on this. The CSS
 * `prefers-reduced-motion` media query in globals.css handles the rest.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    // `addEventListener` is the modern API; `addListener` is the legacy
    // Safari fallback. Both are kept so older mobile browsers still work.
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  return reduced;
}

export function useCountdown(target: string | null) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!target) { setLeft(null); return; }
    const targetTime = new Date(target).getTime();
    const tick = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) { setLeft({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

/**
 * Reveal-on-scroll hook. Marks every `.reveal` (and `.reveal-mask`)
 * element with `.visible` when it enters the viewport.
 *
 * Respects prefers-reduced-motion: when set, every element is
 * immediately marked visible (no transform, no opacity transition).
 */
export function useReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal, .reveal-mask");
    if (targets.length === 0) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      targets.forEach((el) => el.classList.add("visible"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.08, rootMargin: "-20px" }
    );
    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}
