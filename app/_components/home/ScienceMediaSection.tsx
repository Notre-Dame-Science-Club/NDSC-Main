"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { MediaVideo } from "./types";
import { extractYouTubeId } from "./utils";
import { LetterAnim } from "./LetterAnim";
import { SectionLabel } from "./SectionLabel";

export function ScienceMediaSection() {
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch("/api/science-media").then(r => r.json()).then((d: MediaVideo[]) => { if (Array.isArray(d) && d.length) setVideos(d); });
  }, []);

  if (videos.length === 0) return null;
  const activeId = extractYouTubeId(videos[active]?.youtube_url || "");

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="flex justify-center"><SectionLabel>Media</SectionLabel></div>
          <LetterAnim text="Science Media" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} slideDir="right" />
          <LetterAnim text="Check Out Our Science Media" tag="p" className="reveal mt-2" style={{ fontSize: "clamp(0.95rem,1.8vw,1.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 500, color: "var(--blue)" }} slideDir="right" delay={0.08} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", aspectRatio: "16/9", alignSelf: "stretch" }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${activeId}`} title="NDSC" frameBorder="0" allowFullScreen />
          </div>
          {/* Scrollable video list — same height as player */}
          <div className="flex flex-col rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-black tracking-widest" style={{ fontFamily: "'Share Tech Mono',monospace", color: "var(--blue)" }}>
                ALL VIDEOS ({videos.length})
              </p>
              <a href="https://www.youtube.com/@NDSCOfficial" target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                YT →
              </a>
            </div>
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto" style={{
              maxHeight: "calc((100vw - 48px) * 9/16 * 2/3)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(var(--blue-rgb), 0.3) transparent",
            }}>
              {videos.map((v, i) => {
                const vid = extractYouTubeId(v.youtube_url);
                return (
                  <button key={v.id} onClick={() => setActive(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-b hover:bg-[rgba(var(--blue-rgb), 0.04)]"
                    style={{
                      borderColor: "rgba(255,255,255,0.04)",
                      background: active === i ? "rgba(var(--blue-rgb), 0.08)" : "transparent",
                      borderLeft: active === i ? "3px solid var(--blue)" : "3px solid transparent",
                    }}>
                    <div className="relative shrink-0 rounded-md overflow-hidden" style={{ width: 68, height: 42 }}>
                      <Image src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt={v.title} fill className="object-cover" />
                      {active === i && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(var(--blue-rgb), 0.2)" }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--blue)" }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="black"><path d="M5 3l14 9-14 9V3z"/></svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold line-clamp-2 leading-tight" style={{ color: active === i ? "var(--blue)" : "var(--white)", fontFamily: "'Poppins',sans-serif" }}>
                        {v.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                        #{i + 1}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDRI CTA
════════════════════════════════════════════════════════════ */
