import Link from "next/link";
import { Code2, ArrowLeft, Sparkles } from "lucide-react";

// This page didn't exist at all — the footer's "DEVELOPERS" link has been
// 404ing on every single page of the site. This is a minimal placeholder:
// it stops the 404, but the actual credits (names, roles, photos, links)
// need to be filled in by NDSC — I don't have that roster, so I'm not
// inventing names here.

const STACK = [
  "Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase",
];

export default function DevelopersPage() {
  return (
    <section
      className="relative z-10 min-h-[70vh] py-20 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(var(--blue-rgb), 0.08) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <p
          className="text-xs font-bold tracking-[0.35em] mb-4 inline-flex items-center gap-2"
          style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}
        >
          <Code2 size={14} /> DEVELOPERS
        </p>

        <h1
          className="font-bold mb-4"
          style={{
            fontSize: "clamp(2rem, 6vw, 3rem)",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            color: "var(--white)",
            letterSpacing: "-0.02em",
          }}
        >
          Built by NDSC's ICT team
        </h1>

        <p
          className="text-base leading-relaxed mb-10 max-w-xl mx-auto"
          style={{ color: "var(--muted)", fontFamily: "'Poppins', sans-serif" }}
        >
          This site is designed and maintained in-house by the Notre Dame Science Club's
          ICT department, built with {STACK.slice(0, -1).join(", ")} and {STACK[STACK.length - 1]}.
        </p>

        <div
          className="rounded-2xl border p-8 mb-10 text-left"
          style={{ background: "var(--surface, var(--bg2))", borderColor: "var(--border)" }}
        >
          <p
            className="text-xs font-bold tracking-widest mb-3 inline-flex items-center gap-2"
            style={{ color: "var(--blue)" }}
          >
            <Sparkles size={13} /> INDIVIDUAL CREDITS COMING SOON
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Names, roles, and links for the people who built and maintain this site will be
            added here. If that's you — reach out to the ICT department to get added.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm tracking-widest rounded-xl"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
