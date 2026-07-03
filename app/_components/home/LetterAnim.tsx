"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function LetterAnim({
  text, className = "", style = {}, tag = "span", delay = 0, loop = true, loopInterval = 4000,
  slideDir = "left",
}: {
  text: string; className?: string; style?: React.CSSProperties;
  tag?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  delay?: number; loop?: boolean; loopInterval?: number;
  slideDir?: "left" | "up" | "right";
}) {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "hidden">("hidden");
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const inView = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HOLD_MS = 3000;   // visible for 3s
  const OUT_MS  = 700;    // exit anim duration
  const IN_MS   = 600;    // enter anim duration
  const GAP_MS  = 400;    // gap between out and next in

  const runCycle = useCallback(() => {
    if (!inView.current) return;
    setKey(k => k + 1);
    setPhase("in");
    timerRef.current = setTimeout(() => {
      setPhase("hold");
      timerRef.current = setTimeout(() => {
        setPhase("out");
        timerRef.current = setTimeout(() => {
          setPhase("hidden");
          timerRef.current = setTimeout(() => {
            if (inView.current) runCycle();
          }, GAP_MS);
        }, OUT_MS);
      }, HOLD_MS);
    }, IN_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inView.current) {
          inView.current = true;
          runCycle();
        } else if (!entry.isIntersecting) {
          inView.current = false;
          if (timerRef.current) clearTimeout(timerRef.current);
          setPhase("hidden");
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [runCycle]);

  const letters = text.split("");
  const Tag = tag as React.ElementType;

  const getTransform = (visible: boolean, i: number) => {
    if (visible) return "none";
    if (slideDir === "left")  return `translateX(-${18 + i * 2}px) rotate(-4deg)`;
    if (slideDir === "right") return `translateX(${18 + i * 2}px) rotate(4deg)`;
    return `translateY(20px) rotate(8deg)`;
  };

  const isVisible = phase === "in" || phase === "hold";
  const isOut     = phase === "out";

  return (
    <Tag ref={ref} className={className} style={style}>
      {letters.map((ch, i) => (
        <span
          key={`${key}-${i}`}
          style={{
            display: "inline-block",
            whiteSpace: ch === " " ? "pre" : undefined,
            opacity: isOut ? 0 : isVisible ? 1 : 0,
            transform: isOut
              ? (slideDir === "left" ? `translateX(${14 + i}px) rotate(3deg)` : slideDir === "right" ? `translateX(-${14 + i}px)` : `translateY(-14px)`)
              : isVisible ? "none" : getTransform(false, i),
            transition: isOut
              ? `opacity ${OUT_MS}ms ease ${i * 0.012}s, transform ${OUT_MS}ms ease ${i * 0.012}s`
              : isVisible
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
