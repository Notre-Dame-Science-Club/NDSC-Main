"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { ActivitySession } from "./types";
import { extractYouTubeId, formatDate } from "./utils";
import { LetterAnim } from "./LetterAnim";
import { SectionLabel } from "./SectionLabel";
import { LatestActivitiesSubtitle } from "./LatestActivitiesSubtitle";

export function ActivitiesCarousel() {
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [current, setCurrent] = useState(0);
  const [activityTypes, setActivityTypes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/activity-sessions-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d); });
    fetch("/api/activity-types-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setActivityTypes(d); });
  }, []);

  const total = sessions.length;
  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  // Auto-advance every 2.8s
  useEffect(() => {
    if (isPaused || total === 0) return;
    const id = setInterval(next, 2800);
    autoRef.current = id;
    return () => clearInterval(id);
  }, [isPaused, total, next]);

  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; isDragging.current = true; setIsPaused(true); };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = startX.current - e.clientX;
    if (diff > 50) next(); else if (diff < -50) prev();
    setTimeout(() => setIsPaused(false), 3000);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) next(); else if (e.deltaX < -30) prev();
    }
  };

  if (sessions.length === 0) return null;
  const getIdx = (offset: number) => (current + offset + total) % total;

  const getCover = (s: ActivitySession) => {
    if (s.cover_image_url) return s.cover_image_url;
    if (s.youtube_url) {
      const vid = extractYouTubeId(s.youtube_url);
      return `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
    }
    return null;
  };

  return (
    <section className="relative z-10 py-20" style={{ background: "var(--bg2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <div className="flex justify-center"><SectionLabel>Recent</SectionLabel></div>
          <LetterAnim text="Latest Activities" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800, color: "var(--white)" }} slideDir="up" />
          <LatestActivitiesSubtitle />
          <p className="text-xs mt-3 reveal" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.2em" }}>
            SWIPE · DRAG · USE ARROWS · AUTO-ADVANCES
          </p>
        </div>

        <div
          className="relative select-none"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{ touchAction: "pan-y" }}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-6" style={{ minHeight: 420, overflow: "hidden" }}>
            {([-1, 0, 1] as const).map(offset => {
              const s = sessions[getIdx(offset)];
              const isCurrent = offset === 0;
              const cover = getCover(s);
              return (
                <div
                  key={`${s.id}-${offset}`}
                  onClick={() => { if (offset === -1) prev(); else if (offset === 1) next(); else window.location.href = `/activities/${s.slug}`; }}
                  className="relative rounded-2xl overflow-hidden border flex-shrink-0 cursor-pointer transition-all duration-500"
                  style={{
                    width: isCurrent ? "min(380px,82vw)" : "min(240px,45vw)",
                    height: isCurrent ? 400 : 290,
                    opacity: isCurrent ? 1 : 0.42,
                    transform: isCurrent ? "scale(1)" : "scale(0.91)",
                    borderColor: isCurrent ? "var(--blue)" : "var(--border)",
                    background: "var(--bg2)",
                    boxShadow: isCurrent ? "0 0 70px rgba(var(--blue-rgb), 0.18)" : "none",
                    transition: "all 0.5s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  {cover ? (
                    <Image src={cover} alt={s.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(var(--blue-rgb), 0.1),rgba(0,40,80,0.8))" }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", fontSize: 40 }}>NDSC</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {s.activity_types && (
                        <span className="text-xs tracking-widest px-2 py-1 rounded mb-2 inline-block" style={{ background: "rgba(var(--blue-rgb), 0.15)", color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace" }}>
                          {s.activity_types.name}
                        </span>
                      )}
                      <h3 className="text-lg font-bold leading-tight mb-1" style={{ fontFamily: "'Poppins',sans-serif" }}>{s.title}</h3>
                      {s.session_date && <p className="text-xs" style={{ color: "var(--muted)" }}>{formatDate(s.session_date)}</p>}
                      <span className="text-xs font-bold mt-3 inline-flex items-center gap-1" style={{ color: "var(--blue)" }}>View Details →</span>
                    </div>
                  )}
                  {/* Progress bar for current */}
                  {isCurrent && !isPaused && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "rgba(var(--blue-rgb), 0.2)" }}>
                      <div key={current} className="h-full" style={{ background: "var(--blue)", animation: "progressBar 2.8s linear forwards" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => { prev(); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
            aria-label="Previous activity"
            className="absolute left-0 sm:-left-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => { next(); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
            aria-label="Next activity"
            className="absolute right-0 sm:-right-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8 flex-wrap">
          {sessions.map((s, i) => (
            <button key={s.id} onClick={() => { setCurrent(i); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
              aria-label={`Go to activity ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{ width: i === current ? 26 : 8, height: 8, background: i === current ? "var(--blue)" : "rgba(var(--blue-rgb), 0.22)" }} />
          ))}
        </div>

        {/* Activity type links */}
        {activityTypes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {activityTypes.map(t => (
              <a key={t.id} href={`/activities?type=${t.slug}`}
                className="px-5 py-2 rounded-full border text-xs font-bold tracking-widest transition-all hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                {t.name}
              </a>
            ))}
            <a href="/activities"
              className="px-5 py-2 rounded-full border text-xs font-bold tracking-widest transition-all hover:border-[var(--blue)]"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace" }}>
              ALL ACTIVITIES →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCIENCE MEDIA
════════════════════════════════════════════════════════════ */

/* Looping subtitle for Latest Activities */
