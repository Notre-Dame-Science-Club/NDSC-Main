import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Olympiad | Notre Dame Science Club (NDSC)",
  description: "Participate in NDSC online olympiads — Physics, Chemistry, Biology, Math. Register now and test your knowledge.",
  alternates: { canonical: "https://ndscbd.net/olympiad" },
  openGraph: {
    title: "NDSC Olympiad | Notre Dame Science Club",
    description: "Online science olympiads by NDSC — Physics, Chemistry, Biology, Math.",
    url: "https://ndscbd.net/olympiad",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
  },
};

import Link from "next/link";
import { Trophy, Clock, BookOpen, Award } from "lucide-react";

const olympiads = [
  { title: "Physics Olympiad 2025", status: "upcoming", date: "July 15, 2025", questions: 40, duration: "90 min", desc: "Test your physics knowledge across mechanics, electromagnetism, thermodynamics, and modern physics." },
  { title: "Chemistry Olympiad 2025", status: "upcoming", date: "August 1, 2025", questions: 35, duration: "75 min", desc: "Organic, inorganic, and physical chemistry questions from national syllabus and beyond." },
  { title: "Biology Olympiad 2025", status: "upcoming", date: "August 20, 2025", questions: 40, duration: "90 min", desc: "Genetics, cell biology, ecology, and evolution — challenging questions for science enthusiasts." },
  { title: "Math Olympiad 2025", status: "upcoming", date: "September 5, 2025", questions: 30, duration: "120 min", desc: "Number theory, combinatorics, geometry, and algebra. Sharpen your mathematical reasoning." },
  { title: "Science General Quiz 2025", status: "past", date: "May 10, 2025", questions: 50, duration: "60 min", desc: "Broad science general knowledge covering all domains." },
];

export default function OlympiadPage() {
  return (
    <div className="min-h-screen relative z-10" style={{ paddingTop: "72px" }}>
      <div
        className="py-20 text-center border-b"
        style={{ background: "linear-gradient(180deg, var(--bg2), var(--bg))", borderColor: "var(--border)" }}
      >
        <div className="section-label justify-center mb-2">Online Exam</div>
        <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          NDSC <span style={{ color: "var(--blue)" }}>OLYMPIAD</span>
        </h1>
        <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--muted)" }}>
          Participate in our online olympiads. Login to access exams, track your scores, and earn certificates.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
        {olympiads.map((o) => (
          <div
            key={o.title}
            className="flex flex-col md:flex-row gap-6 p-6 rounded-xl border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    background: o.status === "upcoming" ? "#00d4ff22" : "#ffffff11",
                    color: o.status === "upcoming" ? "var(--blue)" : "var(--muted)",
                  }}
                >
                  {o.status === "upcoming" ? "● UPCOMING" : "○ PAST"}
                </span>
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
                  <Clock size={12} /> {o.date}
                </span>
              </div>
              <h3 className="font-black text-base mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>{o.title}</h3>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--muted)" }}>{o.desc}</p>
              <div className="flex gap-6 text-xs" style={{ color: "var(--muted)" }}>
                <span className="flex items-center gap-1"><BookOpen size={12} /> {o.questions} Questions</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {o.duration}</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center">
              {o.status === "upcoming" ? (
                <Link
                  href="/members/login"
                  className="px-6 py-3 font-black text-sm tracking-widest rounded"
                  style={{ background: "var(--blue)", color: "#000", fontFamily: "'Orbitron', sans-serif" }}
                >
                  REGISTER
                </Link>
              ) : (
                <button
                  className="px-6 py-3 font-black text-sm tracking-widest rounded cursor-not-allowed"
                  style={{ background: "var(--border)", color: "var(--muted)", fontFamily: "'Orbitron', sans-serif" }}
                  disabled
                >
                  CLOSED
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
