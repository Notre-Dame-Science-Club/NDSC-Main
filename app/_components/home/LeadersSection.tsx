"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { LetterAnim } from "./LetterAnim";
import { SectionLabel } from "./SectionLabel";

export function LeadersSection() {
  const STATIC_QUOTES: Record<string, { full: string; link: string }> = {
    moderator: {
      full: "Notre Dame Science Club, since its founding in 1955 by the eminent scientist Fr. Richard William Timm, C.S.C., has exemplified the spirit of scientific curiosity and service to humanity. The club's motto — 'Science in Human Welfare' — is not merely a slogan but a living commitment that guides every activity, publication, and event we organize.",
      link: "/about#moderator",
    },
    gs: {
      full: "Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. Through national olympiads, weekly workshops, Science Sundays, research projects, and innovative STEM activities, NDSC nurtures young minds to become future scientists, innovators, and leaders.",
      link: "/about#gs",
    },
  };

  const leaders = [
    {
      key: "moderator",
      role: "Moderator",
      name: "Dr. Vincent Titas Rozario",
      img: "https://uploads.ndscbd.net/executives/1780621402_fdc8d88bf714.jpg",
    },
    {
      key: "gs",
      role: "General Secretary",
      name: "Fahim Faisal Arnob",
      img: "https://uploads.ndscbd.net/executives/1780619755_f8a427c9fe3d.jpg",
    },
  ];

  return (
    <section className="relative z-10 py-20 sm:py-24" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <div className="flex justify-center"><SectionLabel>Leadership</SectionLabel></div>
          <LetterAnim text="Voice of Our Leaders" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.6rem,3.5vw,2.4rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} delay={0.05} slideDir="right" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leaders.map(({ key, role, name, img }) => {
            const q = STATIC_QUOTES[key];
            return (
              <div key={key} className="reveal rounded-2xl border p-6 sm:p-8 flex flex-col" style={{ borderColor: "rgba(var(--blue-rgb), 0.18)", background: "rgba(var(--blue-rgb), 0.025)", animationDelay: key === "gs" ? "0.1s" : "0s" }}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative shrink-0 rounded-full overflow-hidden" style={{ width: 80, height: 80, border: "2.5px solid var(--blue)" }}>
                    <Image src={img} alt={name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--white)", fontFamily: "'Poppins',sans-serif" }}>{name}</p>
                    <p className="text-xs font-semibold mt-0.7" style={{ color: "var(--blue)", fontFamily: "'Poppins',sans-serif", letterSpacing: "0.15em" }}>{role}</p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed italic line-clamp-4" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
                    &ldquo;{q.full}&rdquo;
                  </p>
                </div>
                <Link href={q.link} className="mt-5 text-xs font-bold tracking-widest self-start flex items-center gap-1.5 group" style={{ color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.2em" }}>
                  READ MORE <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   DEPT MODAL
════════════════════════════════════════════════════════════ */
