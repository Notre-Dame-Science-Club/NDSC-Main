"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Executive } from "./types";
import { LetterAnim } from "./LetterAnim";
import { LoopingP } from "./LoopingP";
import { SectionLabel } from "./SectionLabel";

/* ════════════════════════════════════════════════════════════
   PIONEER / ABOUT SECTION
════════════════════════════════════════════════════════════ */
export function PioneerSection() {
  const [founder, setFounder] = useState<Executive | null>(null);

  useEffect(() => {
    fetch("/api/executives?panel=founder")
      .then(r => r.json())
      .then((d: Executive[]) => {
        if (Array.isArray(d) && d.length > 0) setFounder(d[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative z-10 py-20 sm:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* items-stretch so both columns take same height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* LEFT — founder image: fills full height of the article column */}
          <div className="reveal flex flex-col items-center lg:items-start h-full">
            <div
              className="pioneer-img-wrap relative rounded-2xl overflow-hidden w-full"
              style={{
                /* no fixed aspectRatio — let it grow to match article height */
                minHeight: 340,
                flex: 1,
                border: "1.5px solid rgba(var(--blue-rgb), 0.25)",
                background: "var(--card)",
                boxShadow: "0 0 60px rgba(var(--blue-rgb), 0.1)",
              }}
            >
              {founder?.photo_url ? (
                <Image src={founder.photo_url} alt={founder.full_name} fill className="object-cover object-top" />
              ) : (
                <Image
                  src="https://uploads.ndscbd.net/executives/1780729148_fe4addabb0f8.jpeg"
                  alt="Fr. Richard William Timm, C.S.C."
                  fill
                  className="object-cover object-top"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center" style={{ background: "linear-gradient(to top, rgba(2,8,16,0.95), transparent)" }}>
                <p className="font-bold text-sm" style={{ color: "var(--white)", fontFamily: "'Poppins',sans-serif" }}>
                  {founder?.full_name || "Fr. Richard William Timm, C.S.C."}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.2em" }}>
                  FOUNDER
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — article */}
          <div className="reveal flex flex-col justify-between" style={{ animationDelay: "0.15s" }}>
            <div>
              <SectionLabel>Who We Are</SectionLabel>
              <LetterAnim
                text="Indian-Sub Continent's Pioneer Science Club"
                tag="h2"
                className="font-black mb-4 leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800, color: "var(--white)" }}
                delay={0.1}
                slideDir="left"
              />
              {/* Paragraphs — gap matches the ~1rem space between paragraphs themselves */}
              <div className="space-y-3 text-sm leading-[1.9]" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
                <LoopingP delay={0.5}>
                  Notre Dame Science Club, also known as <strong style={{ color: "var(--white)" }}>NDSC</strong>, is the most promising, versatile, and eminent co-curricular activities club of Notre Dame College, Dhaka. It began its inception in <strong style={{ color: "var(--blue)" }}>1955</strong> with a singular mission — to ignite a passion for science among students. It holds the proud distinction of being the <strong style={{ color: "var(--blue)" }}>pioneer science club of the Indian Subcontinent</strong>.
                </LoopingP>
                <LoopingP delay={1.2}>
                  Holding the noble motto &ldquo;Science in Human Welfare,&rdquo; the eminent scientist <strong style={{ color: "var(--white)" }}>Fr. Richard William Timm, C.S.C.</strong> inaugurated the flag of NDSC on September 18, 1955, alongside 19 founding student members.
                </LoopingP>
                <LoopingP delay={2.0}>
                  The NDSC has a long history of inspiring its followers to rediscover their innate passion for science by serving as the country&apos;s <strong style={{ color: "var(--white)" }}>oldest and most prestigious scientific club</strong>. NDSC provides necessary guidelines to budding scientists and is the trailblazer in spreading scientific awareness among the people.
                </LoopingP>
              </div>
            </div>
            <Link
              href="/about#about-article"
              className="mt-5 self-start flex items-center gap-2 text-xs font-bold tracking-widest group"
              style={{ color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.25em" }}
            >
              READ MORE
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   VOICE OF LEADERS — STATIC (current session 2025-26)
════════════════════════════════════════════════════════════ */
