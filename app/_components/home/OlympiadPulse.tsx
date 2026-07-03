"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PulseOlympiad, Leaderboard } from "./types";
import { useCountdown } from "./hooks";
import { LetterAnim } from "./LetterAnim";
import { SectionLabel } from "./SectionLabel";

/* ════════════════════════════════════════════════════════════
   OLYMPIAD PULSE — live countdown to the next olympiad + a
   teaser leaderboard for olympiads whose results are published.
   New "high-tech" homepage widget.
════════════════════════════════════════════════════════════ */
export function OlympiadPulse() {
  const [olympiads, setOlympiads] = useState<PulseOlympiad[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);

  useEffect(() => {
    fetch("/api/olympiad").then(r => r.json()).then(d => { if (Array.isArray(d)) setOlympiads(d); }).catch(() => {});
    fetch("/api/olympiad-leaderboard").then(r => r.json()).then(d => setLeaderboards(d.leaderboards || [])).catch(() => {});
  }, []);

  const next = olympiads
    .filter(o => o.exam_date && new Date(o.exam_date).getTime() > Date.now())
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())[0];

  const left = useCountdown(next?.exam_date || null);

  if (!next && leaderboards.length === 0) return null;

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="flex justify-center"><SectionLabel>Olympiad Pulse</SectionLabel></div>
          <LetterAnim text="What's Happening Now" tag="h2" className="font-black reveal"
            style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} slideDir="left" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Countdown */}
          {next && left && (
            <div className="reveal rounded-3xl p-7 sm:p-8 relative overflow-hidden"
              style={{ background: "rgba(var(--blue-rgb), 0.06)", border: "1px solid rgba(var(--blue-rgb), 0.25)" }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle at top right, rgba(var(--blue-rgb), 0.18), transparent 70%)" }} />
              <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace" }}>
                NEXT UP
              </p>
              <h3 className="text-lg sm:text-xl font-bold mb-5" style={{ color: "var(--white)", fontFamily: "'Poppins',sans-serif" }}>{next.name}</h3>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[{ v: left.d, l: "Days" }, { v: left.h, l: "Hrs" }, { v: left.m, l: "Min" }, { v: left.s, l: "Sec" }].map(u => (
                  <div key={u.l} className="text-center rounded-xl py-3" style={{ background: "rgba(var(--blue-rgb), 0.08)", border: "1px solid rgba(var(--blue-rgb), 0.2)" }}>
                    <p className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
                      {String(u.v).padStart(2, "0")}
                    </p>
                    <p className="text-[10px] mt-1 tracking-wider" style={{ color: "var(--muted)" }}>{u.l}</p>
                  </div>
                ))}
              </div>
              <Link href="/olympiad" className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold hover:gap-2.5 transition-all" style={{ color: "var(--blue)" }}>
                Register now <ChevronRight size={15} />
              </Link>
            </div>
          )}

          {/* Leaderboard */}
          {leaderboards[0] && (
            <div className="reveal rounded-3xl p-7 sm:p-8" style={{ background: "rgba(var(--warning-rgb), 0.05)", border: "1px solid rgba(var(--warning-rgb), 0.25)" }}>
              <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "var(--warning)", fontFamily: "'Share Tech Mono',monospace" }}>
                LEADERBOARD
              </p>
              <h3 className="text-lg sm:text-xl font-bold mb-5" style={{ color: "var(--white)", fontFamily: "'Poppins',sans-serif" }}>
                {leaderboards[0].olympiad_name}
              </h3>
              <div className="space-y-2">
                {leaderboards[0].entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: i === 0 ? "rgba(var(--warning-rgb), 0.1)" : "rgba(255,255,255,0.02)" }}>
                    <span className="w-6 text-center font-black text-sm" style={{ color: i === 0 ? "var(--warning)" : "var(--muted)", fontFamily: "'Orbitron',sans-serif" }}>
                      {i === 0 ? "🏆" : `#${i + 1}`}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--white)" }}>{e.name}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: "var(--warning)" }}>{e.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
