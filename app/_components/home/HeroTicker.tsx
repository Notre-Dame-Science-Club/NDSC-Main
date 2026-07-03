"use client";

import { useState, useEffect } from "react";

export function HeroTicker() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/admin/homepage-settings").then(r => r.json()).then(d => setSettings(d)).catch(() => {});
  }, []);
  if (!settings.last_event_label && !settings.next_event_label) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-1" style={{ animation: "fadeUp 0.7s ease 1.1s both" }}>
      {settings.last_event_label && (
        <a href={settings.last_event_url || "/activities"} className="ticker-pill">
          <span style={{ color: "var(--muted)" }}>◷</span>{settings.last_event_label}
        </a>
      )}
      {settings.next_event_label && (
        <a href={settings.next_event_url || "/activities"} className="ticker-pill"
          style={{ borderColor: "rgba(var(--accent2-rgb), 0.35)", background: "rgba(var(--accent2-rgb), 0.06)", color: "var(--accent2)" }}>
          <span>◈</span>{settings.next_event_label}
        </a>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION LABEL
════════════════════════════════════════════════════════════ */
