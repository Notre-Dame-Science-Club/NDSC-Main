"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem("ndsc-theme") || "dark";
    setDark(t === "dark");
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    localStorage.setItem("ndsc-theme", next);
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  };
  return (
    <button onClick={toggle} className="theme-toggle" title="Toggle theme" aria-label="Toggle theme">{dark ? "☀" : "🌙"}</button>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
