"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function LoopingP({ children, className = "", style = {}, delay = 0 }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("out");
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HOLD_MS = 4000;
  const FADE_MS = 600;

  const cycle = useCallback(() => {
    if (!inView.current) return;
    setPhase("in");
    timerRef.current = setTimeout(() => {
      setPhase("hold");
      timerRef.current = setTimeout(() => {
        setPhase("out");
        timerRef.current = setTimeout(() => {
          if (inView.current) cycle();
        }, FADE_MS + 200);
      }, HOLD_MS);
    }, FADE_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !inView.current) {
        inView.current = true;
        setTimeout(cycle, delay * 1000);
      } else if (!entry.isIntersecting) {
        inView.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        setPhase("out");
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cycle, delay]);

  const isVisible = phase === "in" || phase === "hold";
  return (
    <p
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : "translateY(8px)",
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}
    >
      {children}
    </p>
  );
}


