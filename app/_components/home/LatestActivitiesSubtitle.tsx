"use client";

import { useState, useEffect } from "react";

export function LatestActivitiesSubtitle() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // 3s hold, then fade out 0.5s, wait 0.5s, fade in again — total cycle ~4s
    const cycle = () => {
      setVisible(true);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        const showTimer = setTimeout(() => cycle(), 1000); // 1s gap (fade out 500ms + 500ms pause)
        return showTimer;
      }, 3000);
      return hideTimer;
    };
    const t = cycle();
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="mt-2 text-sm font-medium"
      style={{
        fontFamily: "'Share Tech Mono',monospace",
        color: "var(--blue)",
        letterSpacing: "0.2em",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
      EXPLORE WHAT WE&apos;VE BEEN UP TO
    </p>
  );
}

