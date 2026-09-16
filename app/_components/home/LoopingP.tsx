"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./hooks";

/**
 * One-shot fade-in for a paragraph. Used in the Pioneer section and
 * AudriCTA where a paragraph should appear with a slight delay after
 * the surrounding content has revealed. No more loop — the user gets
 * one entrance and that's it.
 */
export function LoopingP({ children, className = "", style = {}, delay = 0 }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay * 1000);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, reduced]);

  return (
    <p
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {children}
    </p>
  );
}


