"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, ChevronRight } from "lucide-react";
import NDSCBot from "@/components/NDSCBot";

import "./_components/home/home.css";
import { DEPTS, STATS } from "./_components/home/data";
import { LetterAnim } from "./_components/home/LetterAnim";
import { AtomCanvas3D } from "./_components/home/AtomCanvas3D";
import { GalaxyCanvas } from "./_components/home/GalaxyCanvas";
import { DeptModal } from "./_components/home/DeptModal";
import { OlympiadPulse } from "./_components/home/OlympiadPulse";
import { LogoOrbit } from "./_components/home/LogoOrbit";
import { HeroTicker } from "./_components/home/HeroTicker";
import { SectionLabel } from "./_components/home/SectionLabel";
import { PioneerSection } from "./_components/home/PioneerSection";
import { LeadersSection } from "./_components/home/LeadersSection";
import { ActivitiesCarousel } from "./_components/home/ActivitiesCarousel";
import { ScienceMediaSection } from "./_components/home/ScienceMediaSection";
import { AudriCTA } from "./_components/home/AudriCTA";
import { ThemeToggle } from "./_components/home/ThemeToggle";

export default function HomePage() {
  const [deptModal, setDeptModal] = useState<typeof DEPTS[0] | null>(null);

  return (
    <>

      <GalaxyCanvas />
      {deptModal && <DeptModal dept={deptModal} onClose={() => setDeptModal(null)} />}

      {/* ══════ HERO ══════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
        {/* Underwater caustic light overlay — whole hero feels submerged */}
        <div className="caustic-layer z-[1]">
          <div className="caustic-blob caustic-blob-1" />
          <div className="caustic-blob caustic-blob-2" />
          <div className="caustic-blob caustic-blob-3" />
          <div className="caustic-grid" />
          {/* Deep water tint — bottom fade */}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 0%, rgba(0,8,30,0.18) 60%, rgba(0,15,50,0.38) 100%)", pointerEvents:"none" }} />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-[1]" style={{ backgroundImage: "linear-gradient(rgba(var(--blue-rgb), 0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--blue-rgb), 0.015) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

        <div className="relative z-[2] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-5">
              <div className="hero-badge flex">
                <span className="ticker-pill">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  SINCE 1955 · DHAKA, BANGLADESH
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                {[
                  { text: "Join the",      color: "var(--white)",       cls: "hero-h1-l1", outline: false },
                  { text: "Community",     color: "var(--blue)",        cls: "hero-h1-l2", outline: false },
                  { text: "of Science",    color: "var(--white)",       cls: "hero-h1-l3", outline: false },
                  { text: "Enthusiasts",   color: "transparent",        cls: "hero-h1-l4", outline: true  },
                ].map((line, i) => (
                  <div key={i} className="overflow-hidden">
                    <h1
                      className={`${line.cls} font-black block hero-h1-size`}
                      style={{
                        fontSize: "clamp(2.4rem,5vw,4.4rem)",
                        fontFamily: "'Poppins',sans-serif",
                        fontWeight: 800,
                        lineHeight: 1.02,
                        letterSpacing: "-0.025em",
                        color: line.outline ? "transparent" : line.color,
                        WebkitTextStroke: line.outline ? "1.5px var(--blue)" : undefined,
                        filter: line.color === "var(--blue)" ? "drop-shadow(0 0 20px rgba(var(--blue-rgb), 0.5))" : undefined,
                      }}
                    >{line.text}</h1>
                  </div>
                ))}
              </div>

              <div className="hero-sub flex items-center gap-4">
                <div style={{ height: 1, width: 36, background: "linear-gradient(to right, var(--blue), transparent)" }} />
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.67rem", letterSpacing: "0.3em", color: "var(--muted)", textTransform: "uppercase" }}>
                  Science in Human Welfare
                </span>
              </div>

              <p className="hero-desc text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)", maxWidth: 420, fontFamily: "'Poppins',sans-serif" }}>
                The <span style={{ color: "var(--white)", fontWeight: 600 }}>first college-level science club</span> in the Indian Subcontinent — shaping scientists, innovators &amp; leaders for{" "}
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>70 years</span>.
              </p>

              <div className="hero-btns flex flex-wrap gap-4">
                <Link href="/activities" className="btn-primary group flex items-center gap-3 px-7 py-3.5 text-sm tracking-widest rounded-2xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
                  View Activities <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/login" className="btn-outline flex items-center gap-3 px-7 py-3.5 text-sm tracking-widest rounded-2xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
                  Join Us
                </Link>
              </div>

              {/* One-shot scan line under the CTAs — animates once on mount
                  via the .scan-line class (CSS keyframe). No JS needed. */}
              <span className="scan-line mt-4" aria-hidden="true" />

              <HeroTicker />
            </div>

            {/* RIGHT — logo orbit */}
            <div className="hero-logo flex justify-center lg:justify-end">
              <LogoOrbit />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[2]">
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.56rem", letterSpacing: "0.45em", color: "rgba(var(--blue-rgb), 0.4)", textTransform: "uppercase" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, position: "relative", background: "rgba(var(--blue-rgb), 0.12)", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "100%", height: "45%", background: "linear-gradient(to bottom,transparent,var(--blue))", animation: "scanV 1.8s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* ══════ MARQUEE ══════════════════════════════════════ */}
      {/* 2-tone marquee — alternating cyan and black strips. Each item
          gets a slightly different color weight so the strip reads as a
          deliberate brand element instead of a single-color CSS test. */}
      <div className="w-full overflow-hidden py-3.5 relative z-10" style={{ background: "var(--blue)" }}>
        <div className="marquee-track">
          {Array(18).fill(null).map((_, i) => (
            <span
              key={i}
              className="mx-8 font-bold text-sm tracking-[.28em] whitespace-nowrap inline-flex items-center gap-8"
              style={{
                fontFamily: "'Poppins', sans-serif",
                color: i % 3 === 0 ? "rgba(0,0,0,0.35)" : "#000",
              }}
            >
              <span aria-hidden="true" style={{ color: i % 3 === 0 ? "rgba(0,0,0,0.4)" : "#000", fontSize: 8 }}>◆</span>
              LEGACY OF 70 YEARS
            </span>
          ))}
        </div>
      </div>

      {/* ══════ STATS ════════════════════════════════════════ */}
      <section className="relative z-10 py-20" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="reveal stat-card card-lift relative text-center p-5 sm:p-8 rounded-2xl border cursor-default overflow-hidden"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  transitionDelay: `${i * 0.06}s`,
                }}
              >
                {/* Subtle accent corner — a 1px gradient strip in the top-right
                    that brightens on hover. Gives the card direction. */}
                <span
                  aria-hidden="true"
                  className="absolute top-0 right-0 h-full w-12 pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg, transparent 50%, rgba(var(--blue-rgb), 0.08) 50%)",
                  }}
                />
                <LetterAnim
                  text={s.num}
                  tag="p"
                  className="font-black mb-2"
                  style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800, color: "var(--blue)", filter: "drop-shadow(0 0 12px var(--glow))" }}
                  delay={i * 0.1}
                />
                <p
                  className="text-xs tracking-wider uppercase"
                  style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PIONEER / ABOUT ══════════════════════════════ */}
      <PioneerSection />

      {/* ══════ VOICE OF LEADERS ════════════════════════════ */}
      <LeadersSection />

      {/* ══════ DEPARTMENTS ═════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
            <div>
              <SectionLabel>Structure</SectionLabel>
              <LetterAnim
                text="Our Departments"
                tag="h2"
                className="font-bold reveal"
                style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}
                slideDir="left"
              />
            </div>
            <p className="text-sm max-w-sm reveal" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
              Seven teams, one mission — each department runs independently and reports to the Executive Committee.
            </p>
          </div>
          {/* Bento-style asymmetric grid: first card spans 2 columns on lg,
             the rest fill a 2x3 grid. Replaces the 3-col-equal layout that
             read as a generic "feature row" template. */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
            {DEPTS.map((d, i) => (
              <button
                key={d.name}
                onClick={() => setDeptModal(d)}
                onMouseMove={e => {
                  const el = e.currentTarget as HTMLElement;
                  const rect = el.getBoundingClientRect();
                  const px = (e.clientX - rect.left) / rect.width - 0.5;
                  const py = (e.clientY - rect.top) / rect.height - 0.5;
                  el.style.transform = `translateY(-6px) perspective(800px) rotateX(${py * -10}deg) rotateY(${px * 10}deg)`;
                  el.style.boxShadow = `0 8px 32px ${d.color}33, 0 0 0 1px ${d.color}66`;
                }}
                className={`reveal dept-card group relative flex flex-col items-center gap-4 p-6 sm:p-8 rounded-3xl overflow-hidden text-left ${
                  i === 0 ? "col-span-2 md:col-span-2 lg:col-span-2" : ""
                }`}
                style={{
                  background: d.bg,
                  border: `1px solid ${d.border}`,
                  animationDelay: `${i * 0.07}s`,
                  transition: "transform 0.15s ease-out, box-shadow 0.3s, border-color 0.3s",
                  transformStyle: "preserve-3d",
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                {/* Glow corner */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${d.color}22, transparent 70%)` }}
                />
                {/* Number badge */}
                <div
                  className="absolute top-4 right-4 font-black opacity-20 pointer-events-none"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: d.color, fontSize: "2rem", lineHeight: 1 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 transition-transform group-hover:scale-110 duration-300">
                  <Image src={d.icon} alt={d.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 10px ${d.color})` }} />
                </div>
                <p
                  className="text-base sm:text-lg font-bold tracking-wide text-center"
                  style={{ fontFamily: "'Poppins',sans-serif", color: d.color }}
                >
                  {d.name}
                </p>
                <p
                  className="text-xs text-center line-clamp-2 px-2"
                  style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}
                >
                  {d.desc}
                </p>
                {/* Bottom bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ OLYMPIAD PULSE — countdown + leaderboard ═══════ */}
      <OlympiadPulse />

      {/* ══════ ACTIVITIES CAROUSEL ══════════════════════════ */}
      <ActivitiesCarousel />

      {/* ══════ SCIENCE MEDIA ════════════════════════════════ */}
      <ScienceMediaSection />

      {/* ══════ AUDRI CTA ════════════════════════════════════ */}
      <AudriCTA />

      {/* ══════ FINAL CTA ════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-36 text-center overflow-hidden">
        {/* Layered glow + radial — gives the section weight instead of feeling
           like a CTA button pair floating in a void. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(var(--blue-rgb), 0.08) 0%, transparent 65%), radial-gradient(ellipse 40% 35% at 50% 70%, rgba(var(--accent2-rgb), 0.05) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(var(--blue-rgb), 0.4), transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(var(--blue-rgb), 0.2), transparent)" }}
        />
        {/* Drifting ambient orb — softens the section, gives it motion.
            The `orb-drift` class (in globals.css) animates a figure-8
            over 14s; reduced-motion users get a static glow. */}
        <div
          aria-hidden="true"
          className="orb-drift absolute left-[12%] top-[20%] w-72 h-72 rounded-full pointer-events-none hidden md:block"
          style={{
            background: "radial-gradient(circle, rgba(var(--blue-rgb), 0.15) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        <div
          aria-hidden="true"
          className="orb-drift absolute right-[10%] bottom-[18%] w-64 h-64 rounded-full pointer-events-none hidden md:block"
          style={{
            background: "radial-gradient(circle, rgba(var(--accent2-rgb), 0.12) 0%, transparent 65%)",
            filter: "blur(36px)",
            animationDelay: "-7s", // offset so the two orbs never sync
          }}
        />
        {/* Atom decoration */}
        <div className="absolute right-8 top-8 opacity-15 pointer-events-none hidden lg:block">
          <AtomCanvas3D size={200} />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex justify-center reveal"><SectionLabel>Join Us</SectionLabel></div>
          <LetterAnim
            text="Be Part of the Legacy"
            tag="h2"
            className="font-bold mb-5"
            style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}
            slideDir="up"
          />
          <p className="text-base sm:text-lg leading-relaxed mb-10 reveal max-w-xl mx-auto" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
            Join thousands of science enthusiasts at weekly workshops, olympiads, and events — since 1955.
          </p>
          <div className="flex flex-wrap gap-4 justify-center reveal">
            <Link href="/register" className="btn-primary px-8 py-4 text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              BECOME A MEMBER
            </Link>
            <Link href="/olympiad" className="btn-outline flex items-center gap-2 px-8 py-4 text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              <Trophy size={15} /> TAKE OLYMPIAD
            </Link>
          </div>
          <p className="mt-6 text-xs reveal" style={{ color: "var(--muted)" }}>
            Already a member?{" "}
            <Link href="/login" className="link-underline transition-colors" style={{ color: "var(--blue)" }}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
      <ThemeToggle />
      <NDSCBot />
    </>
  );
}
