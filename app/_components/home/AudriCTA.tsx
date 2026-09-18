"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { LetterAnim } from "./LetterAnim";
import { LoopingP } from "./LoopingP";
import { SectionLabel } from "./SectionLabel";

export function AudriCTA() {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/publications?latest=true&category=annual_magazine")
      .then(r => r.json())
      .then(d => { const pub = Array.isArray(d) ? d[0] : d; if (pub?.cover_image_url) setCover(pub.cover_image_url); })
      .catch(() => {});
  }, []);

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="reveal rounded-2xl border overflow-hidden p-8 sm:p-14 flex flex-col sm:flex-row items-center gap-8 sm:gap-12"
          style={{ borderColor: "var(--blue)", background: "linear-gradient(135deg,rgba(var(--blue-rgb), 0.04),rgba(var(--blue2-rgb), 0.04))" }}>
          <div className="flex-1">
            <SectionLabel>Annual Magazine</SectionLabel>
            {/* Bengali title uses a web-safe Bengali font stack */}
            <div className="mb-3">
              <LetterAnim
                text="AUDRI"
                tag="h2"
                className="font-black"
                style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }}
                slideDir="right"
              />
              <p className="font-semibold mt-1" style={{
                fontSize: "clamp(1.1rem,2vw,1.5rem)",
                fontFamily: "'Noto Serif Bengali', 'Kalpurush', 'SolaimanLipi', 'Hind Siliguri', serif",
                color: "var(--blue)",
                fontWeight: 700,
              }}>অদ্রি</p>
            </div>
            <LoopingP className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
              Annual science publication — articles on Quantum Entanglement, CRISPR, Neural Networks, and more.
            </LoopingP>
            <Link href="/publication" className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-bold text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              <BookOpen size={15} /> Read AUDRI
            </Link>
          </div>
          <div className="shrink-0">
            {cover ? (
              <Image src={cover} alt="AUDRI" width={180} height={240} className="rounded-xl object-contain shadow-2xl"
                style={{ filter: "drop-shadow(0 0 30px rgba(var(--blue-rgb), 0.4))" }} />
            ) : (
              // No published "annual_magazine" cover yet (or it hasn't
              // loaded) — show a styled placeholder instead of pointing
              // <Image> at /images/Audri-24.jpeg, a file that was never
              // actually added to /public/images. That missing file was
              // what caused the recurring "GET /_next/image?...Audri-24...
              // 400" console error: Next's image optimizer 400s when the
              // source it's asked to resize doesn't exist.
              <div className="w-[180px] h-[240px] rounded-xl shadow-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--blue-rgb), 0.12), rgba(var(--blue2-rgb), 0.12))",
                  border: "1px solid rgba(var(--blue-rgb), 0.3)",
                  filter: "drop-shadow(0 0 30px rgba(var(--blue-rgb), 0.4))",
                }}>
                <BookOpen size={48} style={{ color: "var(--blue)", opacity: 0.6 }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   THEME TOGGLE
════════════════════════════════════════════════════════════ */
