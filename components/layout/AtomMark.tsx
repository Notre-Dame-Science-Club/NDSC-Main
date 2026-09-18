/**
 * The compact, always-on version of the club's atom mark: a lit nucleus
 * with three elliptical orbits, each spinning at its own slow speed so
 * they never fall into visual sync. This replaces the static PNG the
 * navbar brand used to show — same spot, same size, just alive again.
 *
 * Pure CSS animation (no JS, no scroll-linking) so it costs nothing and
 * keeps turning even while the page is otherwise idle.
 */
export default function AtomMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <circle cx="22" cy="22" r="3.4" fill="var(--blue)">
        <animate attributeName="r" values="3.4;4;3.4" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <g style={{ transformOrigin: "22px 22px", animation: "atom-spin-a 5.2s linear infinite" }}>
        <ellipse cx="22" cy="22" rx="17" ry="6.6" stroke="var(--blue)" strokeOpacity=".85" strokeWidth="1.4" />
      </g>
      <g style={{ transformOrigin: "22px 22px", animation: "atom-spin-b 7.6s linear infinite reverse" }}>
        <ellipse cx="22" cy="22" rx="17" ry="6.6" stroke="var(--blue)" strokeOpacity=".55" strokeWidth="1.4" transform="rotate(60 22 22)" />
      </g>
      <g style={{ transformOrigin: "22px 22px", animation: "atom-spin-c 6.4s linear infinite" }}>
        <ellipse cx="22" cy="22" rx="17" ry="6.6" stroke="var(--blue)" strokeOpacity=".55" strokeWidth="1.4" transform="rotate(120 22 22)" />
      </g>
      <style>{`
        @keyframes atom-spin-a { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes atom-spin-b { from { transform: rotate(60deg); } to { transform: rotate(420deg); } }
        @keyframes atom-spin-c { from { transform: rotate(120deg); } to { transform: rotate(480deg); } }
        @media (prefers-reduced-motion: reduce) {
          svg g { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}
