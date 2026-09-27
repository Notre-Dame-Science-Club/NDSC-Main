"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./hooks";

/**
 * Per-character slide-in animation that plays ONCE when the element
 * enters the viewport, then holds. No more endless fade-out / fade-in
 * loops that made the home page feel like a slideshow.
 *
 * `slideDir` controls the entry direction for visual variety across
 * sections. The hero uses `up`, the about section uses `left`, etc.
 *
 * Respects prefers-reduced-motion — when set, the text appears in
 * place immediately, with no per-character animation.
 */
export function LetterAnim({
  text, className = "", style = {}, tag = "span", delay = 0,
  slideDir = "left",
}: {
  text: string; className?: string; style?: React.CSSProperties;
  tag?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  delay?: number;
  slideDir?: "left" | "up" | "right";
}) {
  const [played, setPlayed] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useRef(false);

  useEffect(() => {
    if (reduced) {
      // No animation — render the final state immediately.
      setPlayed(true);
      inView.current = true;
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inView.current) {
          inView.current = true;
          // small RAF so the initial state renders before the transition starts
          requestAnimationFrame(() => setPlayed(true));
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  const letters = text.split("");
  const Tag = tag as React.ElementType;

  const getTransform = (i: number) => {
    if (slideDir === "left")  return `translateX(-${18 + i * 2}px) rotate(-4deg)`;
    if (slideDir === "right") return `translateX(${18 + i * 2}px) rotate(4deg)`;
    return `translateY(20px) rotate(8deg)`;
  };

  return (
    <Tag ref={ref} className={className} style={style}>
      {letters.map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            whiteSpace: ch === " " ? "pre" : undefined,
            opacity: played ? 1 : 0,
            transform: played ? "none" : getTransform(i),
            transition: played
              ? `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 0.028}s, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 0.028}s`
              : "none",
          }}
        >{ch}</span>
      ))}
    </Tag>
  );
}

/* ════════════════════════════════════════════════════════════
   LOOPING PARAGRAPH — fades out every 4s then fades back in
════════════════════════════════════════════════════════════ */
