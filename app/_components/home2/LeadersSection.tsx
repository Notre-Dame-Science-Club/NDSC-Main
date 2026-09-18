import Link from "next/link";
import Image from "next/image";

/**
 * Chapter 4. Same copy, same photos, same /about#moderator and /about#gs
 * links as the original LeadersSection — only the visual treatment changes
 * here. The quotes are split into words client-side by <HomeChrome> for
 * the staggered reveal (see .ch-leader-card q .qword in home2.css).
 */
const LEADERS = [
  {
    key: "moderator",
    role: "Moderator",
    name: "Dr. Vincent Titas Rozario",
    img: "https://uploads.ndscbd.net/executives/1780621402_fdc8d88bf714.jpg",
    quote:
      "Notre Dame Science Club, since its founding in 1955 by the eminent scientist Fr. Richard William Timm, C.S.C., has exemplified the spirit of scientific curiosity and service to humanity. The club's motto — 'Science in Human Welfare' — is not merely a slogan but a living commitment that guides every activity, publication, and event we organize.",
    link: "/about#moderator",
  },
  {
    key: "gs",
    role: "General Secretary",
    name: "Fahim Faisal Arnob",
    img: "https://uploads.ndscbd.net/executives/1780619755_f8a427c9fe3d.jpg",
    quote:
      "Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. Through national olympiads, weekly workshops, Science Sundays, research projects, and innovative STEM activities, NDSC nurtures young minds to become future scientists, innovators, and leaders.",
    link: "/about#gs",
  },
];

export default function LeadersSection() {
  return (
    <section className="ch" id="ch-leaders" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>04</b> — Leadership</span>
        <span className="ch-rule" />
        <span className="k">2025–26</span>
      </div>
      <div className="ch-story-grid" style={{ marginBottom: "clamp(30px,5vh,56px)" }}>
        <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "12ch" }}>Voice of our leaders.</h2>
        <p className="ch-body-lg" data-rv="up" style={{ paddingTop: 8 }}>
          The people carrying the club&apos;s motto — Science in Human Welfare — into this session.
        </p>
      </div>
      <div className="ch-leaders-grid">
        {LEADERS.map((l) => (
          <div className="ch-leader-card" data-rv="up" data-cursor key={l.key}>
            <div className="head">
              <div className="ch-lc-avatar">
                <Image src={l.img} alt={l.name} width={92} height={92} />
              </div>
              <div>
                <b className="name">{l.name}</b>
                <span className="role">{l.role}</span>
              </div>
            </div>
            <q>{l.quote}</q>
            <Link className="ch-arrowlink" href={l.link} data-cursor>
              <span>Read more</span>
              <span className="ar">
                <svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" /></svg>
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
