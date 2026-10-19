import type { CSSProperties } from "react";

const DEPARTMENTS = [
  { n: "01", name: "Administration", tint: "rgba(90,216,255,.13)", accent: "#5ad8ff", desc: "Oversees and coordinates all departments, ensuring smooth operations, effective planning, and execution across the organization. Leads field operations, outreach activities, sponsorship dealings, and overall organizational initiatives." },
  { n: "02", name: "Project", tint: "rgba(52,211,153,.13)", accent: "#34d399", desc: "Leads scientific research, experimentation, and innovation-based projects while encouraging members to explore ideas, develop practical solutions, and turn scientific concepts into impactful projects." },
  { n: "03", name: "Publication", tint: "rgba(167,139,250,.13)", accent: "#a78bfa", desc: "Manages all visual assets and event layouts. Designs official club materials, wall magazines, and the annual publication, AUDRI, to promote scientific writing." },
  { n: "04", name: "LWS", tint: "rgba(245,158,11,.13)", accent: "#f59e0b", desc: "Library, Workshop & Seminar (LWS) oversees academic initiatives, develops competition question papers, and coordinates workshops, training, and brainstorming sessions. It also prepares members for Olympiads and fosters scientific knowledge, academic excellence, and intellectual growth." },
  { n: "05", name: "ICT", tint: "rgba(248,113,113,.13)", accent: "#f87171", desc: "Drives NDSC’s digital initiatives by managing web development, website maintenance, technical infrastructure, and digital solutions. It leverages technology to enhance organizational efficiency, streamline operations, and strengthen the club’s digital presence." },
  { n: "06", name: "Quiz", tint: "rgba(96,165,250,.13)", accent: "#60a5fa", desc: "Selects dedicated teams (NDC Gold, NDC Red, NDC Green, NDC Blue) through Q-League to represent NDSC in the General Knowledge Competition, featuring diverse topics such as pop culture, sports, manga, movies, Nobel Prizes, history, and culture." },
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
