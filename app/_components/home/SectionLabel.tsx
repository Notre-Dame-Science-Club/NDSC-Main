"use client";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", fontFamily: "'Share Tech Mono',monospace", fontSize: "0.72rem", letterSpacing: "0.35em", color: "var(--blue)", textTransform: "uppercase" }}>
      <span style={{ display: "inline-block", width: 28, height: 1, background: "var(--blue)", flexShrink: 0 }} />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   REVEAL HOOK
════════════════════════════════════════════════════════════ */
