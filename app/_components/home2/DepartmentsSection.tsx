import type { CSSProperties } from "react";

const DEPARTMENTS = [
  { n: "01", name: "Administration", tint: "rgba(90,216,255,.13)", accent: "#5ad8ff", desc: "Ensures smooth operation and management. Coordinates planning, logistics and execution of every event." },
  { n: "02", name: "Project", tint: "rgba(52,211,153,.13)", accent: "#34d399", desc: "Conducts scientific research and innovation-based projects. Encourages experimentation." },
  { n: "03", name: "Publication", tint: "rgba(167,139,250,.13)", accent: "#a78bfa", desc: "Publishes wall magazines and the AUDRI journal. Promotes scientific writing." },
  { n: "04", name: "ICT", tint: "rgba(248,113,113,.13)", accent: "#f87171", desc: "Handles digital media, website management and emerging technology workshops." },
  { n: "05", name: "LWS", tint: "rgba(245,158,11,.13)", accent: "#f59e0b", desc: "Library, Workshop & Seminar — the academics department." },
  { n: "06", name: "Quiz", tint: "rgba(96,165,250,.13)", accent: "#60a5fa", desc: "Q-League, BrainRain, Scienceophile — NDC Blue, Green & Gold." },
];

/**
 * Chapter 2. Six plates in a clean 3×2 grid. Earlier this used an
 * asymmetric span (two wide plates, four narrow) which overflowed a
 * 6-column track at some widths and stranded "Quiz" alone on its own row,
 * far from "LWS" — a plain three-per-row grid can't do that.
 */
export default function DepartmentsSection() {
  return (
    <section className="ch" id="ch-depts" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>02</b> — Structure</span>
        <span className="ch-rule" />
        <span className="k">SIX TEAMS</span>
      </div>
      <div className="ch-story-grid" style={{ marginBottom: "clamp(34px,6vh,72px)" }}>
        <h2 className="ch-display ch-sec" data-rv="up">Six departments. One mission.</h2>
        <p className="ch-body-lg" data-rv="up" style={{ paddingTop: 8 }}>
          Each department runs independently and reports to the Executive Committee —
          administration, research, publication, technology, academics and quiz.
        </p>
      </div>
      <div className="ch-plates">
        {DEPARTMENTS.map((d) => (
          <div key={d.n} className="ch-plate" data-rv="up" data-cursor style={{ "--tint": d.tint, "--accent": d.accent } as CSSProperties}>
            <span className="orb" />
            <span className="k">{d.n}</span>
            <h3>{d.name}</h3>
            <p>{d.desc}</p>
            <i className="bar" />
          </div>
        ))}
      </div>
    </section>
  );
}
