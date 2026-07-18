import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <section
      className="relative z-10 min-h-[80vh] flex items-center justify-center py-20 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Subtle ambient glow — same visual language as the home page hero */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(var(--blue-rgb), 0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(var(--blue-rgb), 0.3), transparent)" }}
      />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 text-center">
        <p
          className="text-xs font-bold tracking-[0.35em] mb-4"
          style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}
        >
          ERROR · 404
        </p>

        <h1
          className="font-bold mb-4"
          style={{
            fontSize: "clamp(4rem, 14vw, 8rem)",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            color: "var(--white)",
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            filter: "drop-shadow(0 0 30px rgba(var(--blue-rgb), 0.25))",
          }}
        >
          Lost in space
        </h1>

        <p
          className="text-base sm:text-lg leading-relaxed mb-10 max-w-md mx-auto"
          style={{ color: "var(--muted)", fontFamily: "'Poppins', sans-serif" }}
        >
          The page you're looking for doesn't exist on this server. It may have been moved, renamed, or never existed in the first place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm tracking-widest rounded-xl"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <Home size={15} /> Back to home
          </Link>
          <Link
            href="/activities"
            className="btn-outline inline-flex items-center gap-2 px-6 py-3 text-sm tracking-widest rounded-xl"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <Search size={15} /> Browse activities
          </Link>
        </div>

        <p
          className="mt-10 text-xs"
          style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.15em" }}
        >
          <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--blue)] transition-colors">
            <ArrowLeft size={11} /> NDSCBD.NET
          </Link>
        </p>
      </div>
    </section>
  );
}
