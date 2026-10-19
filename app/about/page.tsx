"use client";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Landmark, Microscope, Globe2, Trophy, Newspaper, Globe, Sparkles } from "lucide-react";
import "../_components/home2/home2.css"; // shared .ch-* design (departments + leaders match the homepage)
import "./about.css";

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
/* Copied verbatim from the homepage Departments chapter
   (app/_components/home2/DepartmentsSection.tsx) — keep the two in sync. R&D is a
   team, not a department, so it is not listed here. */
const DEPT_PLATES = [
  { n: "01", name: "Administration", tint: "rgba(90,216,255,.13)", accent: "#5ad8ff", desc: "Oversees and coordinates all departments, ensuring smooth operations, effective planning, and execution across the organization. Leads field operations, outreach activities, sponsorship dealings, and overall organizational initiatives." },
  { n: "02", name: "Project", tint: "rgba(52,211,153,.13)", accent: "#34d399", desc: "Leads scientific research, experimentation, and innovation-based projects while encouraging members to explore ideas, develop practical solutions, and turn scientific concepts into impactful projects." },
  { n: "03", name: "Publication", tint: "rgba(167,139,250,.13)", accent: "#a78bfa", desc: "Manages all visual assets and event layouts. Designs official club materials, wall magazines, and the annual publication, AUDRI, to promote scientific writing." },
  { n: "04", name: "LWS", tint: "rgba(245,158,11,.13)", accent: "#f59e0b", desc: "Library, Workshop & Seminar (LWS) oversees academic initiatives, develops competition question papers, and coordinates workshops, training, and brainstorming sessions. It also prepares members for Olympiads and fosters scientific knowledge, academic excellence, and intellectual growth." },
  { n: "05", name: "ICT", tint: "rgba(248,113,113,.13)", accent: "#f87171", desc: "Drives NDSC’s digital initiatives by managing web development, website maintenance, technical infrastructure, and digital solutions. It leverages technology to enhance organizational efficiency, streamline operations, and strengthen the club’s digital presence." },
  { n: "06", name: "Quiz", tint: "rgba(96,165,250,.13)", accent: "#60a5fa", desc: "Selects dedicated teams (NDC Gold, NDC Red, NDC Green, NDC Blue) through Q-League to represent NDSC in the General Knowledge Competition, featuring diverse topics such as pop culture, sports, manga, movies, Nobel Prizes, history, and culture." },
];

const GOALS = [
  { title: "Promote Science Education",   desc: "Foster a culture of scientific thinking and curiosity among students of Notre Dame College and across Bangladesh." },
  { title: "Organize Olympiads",          desc: "Host science olympiads to challenge and recognize talented students at national and international level." },
  { title: "Research & Innovation",       desc: "Encourage student-led research projects and innovative experiments across all scientific disciplines." },
  { title: "Scientific Awareness",        desc: "Spread science awareness through events, publications, media, and community outreach programs." },
  { title: "Develop Future Scientists",   desc: "Mentor the next generation of scientists, researchers, engineers and innovators in Bangladesh." },
];

/* All 40+ milestones from PDF */
const ERAS = [
  {
    year: "1953–1955", label: "Foundation", color: "var(--blue)", icon: Landmark,
    summary: "Fr. Richard William Timm, C.S.C. begins lab sessions in 1953. The Science Club is officially inaugurated on September 18, 1955, with 19 founding student members.",
    milestones: [
      { y: "1953", text: "Fr. Timm starts laying the groundwork by hosting advanced laboratory experimentation sessions for interested students at the Motijheel campus." },
      { y: "1955", text: "September 18 — 'The Science Club' is formally inaugurated with 19 pioneering student members as the first non-institutional, student-centric science club in the region." },
    ],
  },
  {
    year: "1960s", label: "Science Fairs", color: "var(--cat-teal)", icon: Microscope,
    summary: "NDSC pioneers the first-ever college-level Annual Science Fairs in East Pakistan, expanding to multi-institutional festivals impacting youth across Dhaka.",
    milestones: [
      { y: "1960s", text: "First college-level Annual Science Fairs introduced in East Pakistan — the first of their kind in the entire region." },
      { y: "1960s", text: "Internal exhibitions grow into multi-institutional festivals, profoundly impacting youth in Dhaka." },
      { y: "1960s", text: "Publications and seminars continuously bridge the gap between theoretical knowledge and practical engineering." },
    ],
  },
  {
    year: "1970s", label: "War & Reform", color: "var(--accent2)", icon: Globe2,
    summary: "Relief work during the 1970 cyclone & 1971 Liberation War. Constitution amended for inclusivity in 1972. Topped the 1st National Science Fair of independent Bangladesh in 1973. Presidential visit in 1977. BTV broadcast in 1978.",
    milestones: [
      { y: "1970 (Nov)", text: "Bhola Cyclone — club suspends academic displays to lead field relief teams across affected communities." },
      { y: "1971", text: "Liberation War — under Principal Fr. Julian Bat, the club operates as a humanitarian shelter and coordination point for emergency relief." },
      { y: "1972 (Jun)", text: "6th Club Director Mr. Tamal Kanti Dutt is appointed. Constitution radically amended to formally allow female students from the science department full voting and participation rights." },
      { y: "1973", text: "NDSC secures major top accolades at the historic 1st National Science Fair of independent Bangladesh." },
      { y: "1977 (Mar)", text: "President Ziaur Rahman visits the central NDSC model exhibition at Hotel Intercontinental, praising the 40 independent projects showcased." },
      { y: "1978 (Jan)", text: "Club editorial board invited for a special 25-minute live science awareness broadcast on Bangladesh Television (BTV)." },
      { y: "1978", text: "Vice President Richard Stuart hosts a national seminar on mineral extraction prospects in the Bay of Bengal with Union Oil Company." },
      { y: "1979", text: "Mr. Amar Chand Das Talukdar takes over as newly appointed Club Director." },
    ],
  },
  {
    year: "1980s", label: "Championships", color: "var(--cat-amber)", icon: Trophy,
    summary: "Electronic scoreboard invention (1984), low-cost offset printing (1987). 9/10 national awards at Mahakhali Fair (1982). National debate champion (1983). 5th place globally for steam-pump design (1988). Geiger-Müller counter earns Japanese government recognition (1989).",
    milestones: [
      { y: "1982 (Feb)", text: "NDSC wins 9 distinct national awards out of 10 submitted project categories at the Mahakhali National Fair." },
      { y: "1983", text: "Club debate panel wins 1st place in the prestigious National Science Week Debate Championship." },
      { y: "1984 (Jan)", text: "Electronic scoreboard invented by club members — wins 1st place at Shishu Academy Science Exhibition." },
      { y: "1987", text: "Low-cost offset printing technique developed — clinches 1st prize at the 10th National Science & Technology Week." },
      { y: "1988", text: "Led by Fr. Joseph S. Peixotto, C.S.C. and Fr. Benjamin Costa, C.S.C. — the club administers emergency medical drives across Sirajdikhan and Lauhajang during floods." },
      { y: "1988", text: "NDSC secures 5th place globally for inventing a low-cost steam-powered water pump optimized for rural irrigation." },
      { y: "1989", text: "Club President Imran Zulkarnain builds a cost-effective Geiger-Müller radiation counter, earning a research nomination from the Government of Japan." },
    ],
  },
  {
    year: "1990s", label: "Publications", color: "var(--cat-red)", icon: Newspaper,
    summary: "First Inter-College GK & Science Competition (1990). 36th Anniversary Grand Reunion (1992). Library inaugurated (1992). Wall magazine 'Mohona' launched (1993). UNESCO Week representation (1994). 40th Anniversary souvenir 'Arghya' (1995). National Science Week champion 4 consecutive times (1997). Permanent office suite inaugurated (1998).",
    milestones: [
      { y: "1990 (Dec 20)", text: "Club organizes the historic first-ever Inter-College General Knowledge and Science Competition in Dhaka." },
      { y: "1991", text: "Organizes a massive national symposium titled 'Natural Disasters & Mitigation Strategies' at the Bangladesh Science Museum." },
      { y: "1992 (Jan)", text: "Dedicated Notre Dame Science Club Library officially opened to all students by Principal Fr. Peixotto." },
      { y: "1992 (Nov)", text: "36th Anniversary Grand Reunion — prominent scientist Dr. Abdullah Al-Muti Sharafuddin serves as Chief Guest. Planning Minister Dr. Moyeen Khan (former NDSC member) also graces the event." },
      { y: "1993", text: "Wall magazine 'Mohona' introduced — large-format science wall-magazine designed to showcase original student research." },
      { y: "1994", text: "NDSC projects chosen as primary exhibits representing college-level scientific innovations at the National UNESCO Week." },
      { y: "1995", text: "40th Anniversary Celebrations — publishes the historic commemorative souvenir 'Arghya'." },
      { y: "1997", text: "NDSC secures the absolute Championship trophy across the 12th, 13th, 14th, and 17th central National Science Weeks." },
      { y: "1998", text: "Permanent premium office suite inaugurated on the 5th floor of the newly constructed six-story college building." },
    ],
  },
  {
    year: "2000s", label: "Global Reach", color: "var(--info)", icon: Globe,
    summary: "1st National Science Festival (2001). Website & 'Ablaze' digital magazine launched (2003). 3rd National ICT Fair (2005). Golden Jubilee 2005. 2nd place at International Science Festival, Lucknow India (2006). 8th globally out of 128 teams at ISSF 2007. Cultural Fusion Fair (2008). 19th GK Festival (2009).",
    milestones: [
      { y: "2001", text: "Annual Science Fair upgraded to the 'First National Science Festival', welcoming schools from all over Bangladesh." },
      { y: "2003", text: "Official website (www.ndscbd.org) launched; country's first digital student science magazine 'Ablaze' released." },
      { y: "2004", text: "Organizes a 5-day educational research tour to Darjeeling, India, expanding geographic learning boundaries." },
      { y: "2005 (Sept)", text: "Under Notre Dame University President Rev. Edward Mallay, CSC, the extensive plan for the 50th Golden Jubilee is officially drafted." },
      { y: "2005 (Nov)", text: "Hosts the 3rd National ICT Fair, drawing participation from over 19 top-tier institutions, chaired by Dr. Mohammad Kaykobad." },
      { y: "2006 (Feb)", text: "Golden Jubilee (50th Anniversary) celebrated with a massive multi-day festival." },
      { y: "2006", text: "10-member NDSC team wins 2nd Place at the International Science Festival in Lucknow, India — competing against teams from India, Pakistan, Nepal, Bhutan, Thailand, and Sri Lanka." },
      { y: "2007 (Aug)", text: "11-member delegation led by Co-Director Mr. Titas Rozario secures 8th position out of 128 global teams at the ISSF in India." },
      { y: "2008", text: "'Education and Cultural Fusion Fair' initiated under Principal Fr. Benjamin Costa, connecting over 45 academic institutions." },
      { y: "2009 (Jul)", text: "Minister of Science & Communications Mr. Yeafesh Osman inaugurates the 19th NDSC National GK Festival." },
      { y: "2009", text: "BCSIR National Fair — NDSC secures both 1st and 2nd prizes in primary project presentation categories." },
    ],
  },
  {
    year: "2010s–2026", label: "Platinum Era", color: "var(--cat-orange)", icon: Sparkles,
    summary: "Sweeps 20th National GK Festival — 1st in Astronomy, Biology & Math (2010). Education Secretary as Chief Guest at 21st Festival (2011). BCSIR dominance (2012). Diamond Jubilee 60th Anniversary (2015). Platinum Jubilee 70th Anniversary (2025–2026).",
    milestones: [
      { y: "2010 (Sept)", text: "Sweeping National Olympiads — NDSC wins absolute 1st place in Astronomy, 1st in Biology, and 1st in the Math Olympiad at the 20th National GK Festival, inaugurated by Industries Minister Mr. Dilip Barua." },
      { y: "2011", text: "21st Science Festival — Education Secretary Dr. Kamal Abdul Naser Chowdhury serves as Chief Guest, appreciating NDSC's contribution to standardizing science pedagogy." },
      { y: "2012", text: "BCSIR Science Fair — wins 1st & 3rd prizes in Physical Sciences and 1st prize in Information Technology projects." },
      { y: "2015", text: "60th Anniversary (Diamond Jubilee) — historical legacy magazine published, documenting 60 years of profound club history." },
      { y: "2025–26", text: "70th Anniversary (Platinum Jubilee) — NDSC officially completes 70 monumental years of pioneering science communication, youth development, and scientific excellence in Bangladesh." },
    ],
  },
];

/* Fade-out for collapsed text via a mask, so it works over any background. */
const FADE_MASK = {
  WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
  maskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
} as const;

/* `ERAS[].color` is a CSS variable ("var(--blue)"), so the old `color + "55"`
   hex-alpha trick produced invalid CSS (`var(--blue)55`) and silently dropped
   the borders/backgrounds. color-mix works with var() colours. */
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/* ═══════════════════════════════════════════
   DEPARTMENTS — same design as the homepage chapter, on a darker backdrop
═══════════════════════════════════════════ */
function DepartmentsSection() {
  return (
    <section id="departments" className="ab-sec ab-sec--deep py-16 sm:py-24">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="ch-head reveal">
          <span className="k"><b>Structure</b></span>
          <span className="ch-rule" />
          <span className="k">SIX TEAMS</span>
        </div>
        <div className="ch-story-grid reveal" style={{ marginBottom: "clamp(34px,6vh,72px)" }}>
          <h2 className="ch-display ch-sec">Six departments. One mission.</h2>
          <p className="ch-body-lg" style={{ paddingTop: 8 }}>
            Each department runs independently and reports to the Executive Committee —
            administration, research, publication, technology, academics and quiz.
          </p>
        </div>
        <div className="ch-plates ab-plates reveal" role="list">
          {DEPT_PLATES.map((d) => (
            <div
              key={d.n}
              className="ch-plate"
              role="listitem"
              style={{ "--tint": d.tint, "--accent": d.accent } as React.CSSProperties}
            >
              <span className="orb" />
              <span className="k">{d.n}</span>
              <h3>{d.name}</h3>
              <p>{d.desc}</p>
              <i className="bar" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   VOICE OF OUR LEADERS — same card design as the homepage chapter.
   ids "moderator" / "gs" are what the homepage's "Read more" links target
   (/about#moderator, /about#gs), so a matching hash opens that card.
═══════════════════════════════════════════ */
type Leader = {
  id: string;
  name: string;
  role: string;
  sub: string;
  img: string;
  paras: ReactNode[];
  extra?: { href: string; label: string };
};

const LEADERS: Leader[] = [
  {
    id: "moderator",
    name: "Dr. Vincent Titas Rozario",
    role: "Moderator",
    sub: "Notre Dame Science Club",
    img: "https://uploads.ndscbd.net/executives/1780621402_fdc8d88bf714.jpg",
    paras: [
      <>&ldquo;For nearly seven decades, Notre Dame Science Club has stood as a beacon of intellectual curiosity, disciplined inquiry, and service to humanity. I have witnessed how this club transforms young minds — nurturing not just scientific knowledge, but the values of integrity, perseverance, and compassion.</>,
      <>Science, when practised with a humane heart, becomes a force for good in our world. The legacy of our founder, Fr. Richard William Timm, C.S.C., continues to inspire every student who walks through the doors of this institution. Notre Dame Science Club has always been a place where curiosity is celebrated, questions are welcomed, and excellence is expected.</>,
      <>I urge every member to carry forward the spirit of our founding motto: <em style={{ color: "var(--blue)" }}>Science in Human Welfare</em>. This is not merely a slogan — it is a responsibility. A responsibility to use your knowledge, your talents, and your passion to serve the community, the nation, and humanity at large.</>,
      <>The future of Bangladesh rests in the hands of young scientists like you. Let your curiosity be the compass, your dedication the fuel, and your compassion the guiding light. NDSC will always be your launchpad — your family — as you take flight toward a future of scientific greatness.&rdquo;</>,
    ],
  },
  {
    id: "gs",
    name: "Fahim Faisal Arnob",
    role: "General Secretary",
    sub: "Notre Dame Science Club · 2025–2026",
    img: "https://uploads.ndscbd.net/executives/1780619755_f8a427c9fe3d.jpg",
    paras: [
      <>&ldquo;Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. As your General Secretary, I am committed to taking NDSC to new heights, fostering innovation, scientific thinking, and brotherhood among our members. Together, we will uphold our 70-year legacy and write new chapters of excellence.</>,
      <>Notre Dame Science Club (NDSC) is a pioneer in South Asia for organizing its annual and government-supported science festivals. With strong global alumni connections and exceptional professionalism, NDSC offers a perfect family environment for science enthusiasts.</>,
      <>Science is not confined to textbooks; it lives in every experiment we conduct, every question we ask, and every problem we dare to solve. I invite every student of Notre Dame College to be part of this magnificent journey. Whether you are passionate about physics, chemistry, biology, technology, or simply curious about the world — NDSC is your home.</>,
      <>Let us carry forward the noble motto of our founders: <em style={{ color: "var(--blue)" }}>Science in Human Welfare</em>. Together, we will make NDSC not just the oldest, but the greatest science club in Bangladesh.&rdquo;</>,
    ],
    extra: { href: "/executives", label: "View all executives" },
  },
];

const ArrowIcon = () => (
  <svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" /></svg>
);

function LeaderCard({ l }: { l: Leader }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => { if (window.location.hash === `#${l.id}`) setOpen(true); };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [l.id]);

  return (
    <article id={l.id} className="ch-leader-card ab-leader reveal">
      <div className="head">
        <div className="ch-lc-avatar">
          <Image src={l.img} alt={l.name} width={92} height={92} />
        </div>
        <div>
          <b className="name">{l.name}</b>
          <span className="role">{l.role}</span>
          <span className="ab-lc-sub">{l.sub}</span>
        </div>
      </div>

      <div className="ab-lc-text">
        {l.paras.map((p, i) => (
          <p key={i} className={!open && i === 0 ? "clamp" : undefined} hidden={!open && i > 0}>{p}</p>
        ))}
      </div>

      <div className="ab-lc-actions">
        <button type="button" className="ch-arrowlink" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span>{open ? "Show less" : "Read more"}</span>
          <span className="ar"><ArrowIcon /></span>
        </button>
        {l.extra && (
          <Link className="ch-arrowlink" href={l.extra.href}>
            <span>{l.extra.label}</span>
            <span className="ar"><ArrowIcon /></span>
          </Link>
        )}
      </div>
    </article>
  );
}

function LeadersSection() {
  return (
    <section id="leaders" className="ab-sec ab-sec--alt py-16 sm:py-24">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="ch-head reveal">
          <span className="k"><b>Leadership</b></span>
          <span className="ch-rule" />
          <span className="k">2025–26</span>
        </div>
        <div className="ch-story-grid reveal" style={{ marginBottom: "clamp(30px,5vh,56px)" }}>
          <h2 className="ch-display ch-sec" style={{ maxWidth: "12ch" }}>Voice of our leaders.</h2>
          <p className="ch-body-lg" style={{ paddingTop: 8 }}>
            The people carrying the club&apos;s motto — Science in Human Welfare — into this session.
          </p>
        </div>
        <div className="ch-leaders-grid ab-leaders-grid">
          {LEADERS.map((l) => <LeaderCard key={l.id} l={l} />)}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   COLLAPSIBLE SECTION component
═══════════════════════════════════════════ */
function CollapsibleText({
  children,
  previewLines = 6,
}: {
  children: React.ReactNode;
  previewLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div
        className="relative overflow-hidden transition-all duration-500"
        style={{ maxHeight: expanded ? "9999px" : `${previewLines * 1.9 * 14}px`, ...(expanded ? null : FADE_MASK) }}
      >
        {children}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-2 text-xs font-black tracking-widest px-4 py-2 rounded-lg border transition-all hover:bg-[var(--blue)] hover:text-black group"
        style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}
      >
        {expanded ? "SHOW LESS ▲" : "READ MORE ▼"}
      </button>
    </div>
  );
}

function CollapsibleText2({
  children,
  previewLines = 6,
}: {
  children: React.ReactNode;
  previewLines?: number;
  bg?: string; // kept so call sites don't change; the fade is a mask now
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div
        className="relative overflow-hidden transition-all duration-500"
        style={{ maxHeight: expanded ? "9999px" : `${previewLines * 1.9 * 14}px`, ...(expanded ? null : FADE_MASK) }}
      >
        {children}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-2 text-xs font-black tracking-widest px-4 py-2 rounded-lg border transition-all hover:bg-[var(--blue)] hover:text-black"
        style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}
      >
        {expanded ? "SHOW LESS ▲" : "READ MORE ▼"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE
═══════════════════════════════════════════ */
export default function AboutPage() {
  const [activeEra, setActiveEra] = useState(0);
  const [heroData, setHeroData] = useState({ videoUrl: '', posterUrl: '' });

  useEffect(() => {
    fetch('/api/admin/appearance-settings')
      .then(r => r.json())
      .then(d => setHeroData({ 
        videoUrl: d.about_hero_video_url || '', 
        posterUrl: d.about_hero_poster_url || '' 
      }));
  }, []);

  const { videoUrl, posterUrl } = heroData;

  return (
    <div className="ab-page min-h-screen relative z-10" style={{ paddingTop: "64px" }}>

      {/* ══ HERO WITH VIDEO BACKGROUND ══════════════════════════════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        {videoUrl && (
          <video
            autoPlay muted loop playsInline
            poster={posterUrl}
            className="absolute inset-0 w-full h-full object-cover z-0"
            aria-hidden="true"
            preload="metadata"
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        )}
        
        {/* Fallback: Poster only if no video */}
        {!videoUrl && posterUrl && (
          <div className="absolute inset-0 z-0" style={{ 
            backgroundImage: `url(${posterUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
        )}
        
        {/* Dark gradient overlay — ensures text contrast in both themes */}
        <div className="absolute inset-0 z-10" style={{ 
          background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.7) 100%)" 
        }} />
        
        {/* Subtle grid overlay — brand texture */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-10" 
          style={{ 
            backgroundImage: "linear-gradient(rgba(var(--blue-rgb),0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--blue-rgb),0.15) 1px,transparent 1px)", 
            backgroundSize: "60px 60px" 
          }}
        />
        
        {/* Radial glow — centered behind text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none z-10"
          style={{ background: "radial-gradient(circle, rgba(var(--blue-rgb), 0.08) 0%, transparent 70%)" }}
        />
        
        {/* Content */}
        <div className="relative z-20 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="reveal section-label justify-center mb-3">[ OUR SCIENCE CLUB ]</div>
          <h1 className="reveal text-4xl sm:text-6xl font-black mb-5" style={{ fontFamily: 'inherit' }}>
            ABOUT <span style={{ color: "var(--blue)" }}>NDSC</span>
          </h1>
          <p className="reveal text-sm sm:text-base mt-3 font-medium" style={{ color: "var(--muted)", fontFamily: 'inherit' }}>
            Our Science Club
          </p>
        </div>
      </section>

      {/* ══ WHO WE ARE — Collapsible Article ═════════════════════════════════════ */}
      <section className="ab-sec py-12 sm:py-16 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 lg:items-center">

            {/* Motto — desktop-only, fills the empty left column next to "Who We Are".
                Hidden on mobile since the original standalone Motto section further
                down the page (kept lg:hidden there) already covers mobile. */}
            <div className="hidden lg:flex lg:flex-col lg:items-start text-left">
              <div
                className="relative w-28 h-28 rounded-full mb-8 flex items-center justify-center"
                style={{ border: "1px solid var(--border)" }}
              >
                <span aria-hidden="true" className="absolute inset-[-6px] rounded-full conic-sweep" />
                <span
                  aria-hidden="true"
                  className="absolute inset-[-2px] rounded-full"
                  style={{ background: "radial-gradient(circle, transparent 60%, rgba(var(--blue-rgb), 0.12) 100%)" }}
                />
                <div className="logo-float-anim" style={{ animationDuration: "6s" }}>
                  <Image
                    src="/images/cropped-logo.png"
                    alt="NDSC"
                    width={72}
                    height={72}
                    className="object-contain relative z-10"
                    style={{ filter: "drop-shadow(0 0 14px rgba(var(--blue-rgb), 0.5))" }}
                  />
                </div>
              </div>
              <div className="section-label mb-3">Our Motto</div>
              <h2 className="text-3xl sm:text-4xl font-black mb-5" style={{ fontFamily: 'inherit' }}>
                <span style={{ color: "var(--blue)" }}>SCIENCE</span> IN<br />HUMAN WELFARE
              </h2>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
                This motto reflects our belief that science is not just an academic pursuit — it is a tool
                for improving lives, solving real-world problems, and creating a better future for humanity.
                Every activity we organize, every article we publish, and every olympiad we host is guided by this core principle.
              </p>
            </div>

          <div
            className="ab-card p-6 sm:p-8 rounded-2xl border"
            style={{ borderColor: "rgba(var(--blue-rgb), 0.28)" }}
          >
            <div className="section-label mb-3">[ Who We Are ]</div>
            <CollapsibleText previewLines={5}>
              <div className="space-y-4 text-sm leading-[1.9]" style={{ color: "var(--muted)" }}>
                <p>
                  Notre Dame Science Club, also known as <strong style={{ color: "var(--white)" }}>NDSC</strong>, is the most promising, versatile, and eminent co-curricular activities club of Notre Dame College, Dhaka. It began its inception in <strong style={{ color: "var(--blue)" }}>1955</strong> with a singular mission — to ignite a passion for science among students. It holds the proud distinction of being the <strong style={{ color: "var(--blue)" }}>pioneer science club of South Asia</strong>. Holding the noble motto &ldquo;Science in Human Welfare,&rdquo; the eminent scientist <strong style={{ color: "var(--white)" }}>Fr. Richard William Timm, C.S.C.</strong> inaugurated the flag of NDSC on September 18, 1955, alongside 19 founding student members.
                </p>
                <p>
                  The NDSC has a long history of inspiring its followers to rediscover their innate passion for science by serving as the country&apos;s <strong style={{ color: "var(--white)" }}>oldest and most prestigious scientific club</strong>. NDSC provides necessary guidelines to budding scientists and is the trailblazer in spreading scientific awareness among the people. We foster a love of science and an eagerness to learn more about the world&apos;s mysteries, touch the untouched, and see the unseen. For the last few decades, NDSC has turned into the most prominent club to organize numerous <strong style={{ color: "var(--white)" }}>science fairs</strong> — the ultimate platform for student project demonstrations across the nation.
                </p>
                <p>
                  Besides its events and competitions, NDSC has provided the momentum to research advanced knowledge. The official quiz teams of Notre Dame Science Club — <strong style={{ color: "var(--blue)" }}>"NDC Blue", "NDC Green" & "NDC Gold"</strong> — are prestigious platforms for quizzers working relentlessly to uphold the glory of competitive science. These teams have represented Bangladesh at national and international levels, earning glory for the institution and inspiring a culture of intellectual excellence.
                </p>
                <p>
                  Every year, distinguished members of NDSC compete in <strong style={{ color: "var(--white)" }}>international science fairs</strong> and bring honour to the institution. The club has secured remarkable positions at global competitions — including 2nd place at the International Science Festival in Lucknow, India (2006), and 8th place globally out of 128 competing international teams at the ISSF (2007). Run by experienced moderators and a dedicated executive panel, NDSC continues to be the pioneer of the science movement in Bangladesh and will upgrade the noble cause of promoting science in every sphere of life.
                </p>
                <p>
                  Today, as NDSC celebrates its <strong style={{ color: "var(--blue)" }}>70th Anniversary — the Platinum Jubilee</strong> — it stands not just as a college club, but as an institution that has systematically defined the landscape of scientific education, secular thought, and technological innovation in Bangladesh for seven glorious decades. With over <strong style={{ color: "var(--white)" }}>5000 alumni members</strong> across the globe, more than 100 events hosted, and 6 departments working in unison, NDSC remains the benchmark of scientific co-curricular excellence in the region.
                </p>
              </div>
            </CollapsibleText>
          </div>

          </div>
        </div>
      </section>

      {/* ══ HISTORY ARTICLE ═══════════════════════════════════ */}
      <section className="ab-sec ab-sec--alt py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="reveal section-label mb-2">Historical Narrative</div>
          <h2 className="reveal text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: 'inherit' }}>
            OUR <span style={{ color: "var(--blue)" }}>LEGACY</span>
          </h2>
          <p className="reveal text-xs mb-8" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
            A Comprehensive Historical Account (1955 – 2026)
          </p>

          {/* Pull quote */}
          <div className="reveal relative pl-5 mb-8 border-l-2" style={{ borderColor: "var(--blue)" }}>
            <p className="text-base sm:text-lg font-semibold italic leading-relaxed" style={{ color: "var(--white)" }}>
              &ldquo;The pioneer science club of South Asia — 70 years of igniting curiosity, innovation, and scientific excellence.&rdquo;
            </p>
          </div>

          <CollapsibleText2 previewLines={8} bg="var(--bg2)">
            <div className="space-y-5 text-sm leading-[1.9]" style={{ color: "var(--muted)" }}>
              <p>
                The institutional culture of nurturing scientific temperament outside the traditional classroom at Notre Dame College dates back to <strong style={{ color: "var(--blue)" }}>1953</strong>, under the visionary guidance of <strong style={{ color: "var(--white)" }}>Rev. Fr. Richard William Timm, C.S.C.</strong> He actively orchestrated co-curricular scientific initiatives for enthusiastic students in the newly constructed science laboratories of the Motijheel campus. These activities officially materialized on <strong style={{ color: "var(--blue)" }}>September 18, 1955</strong>, with the formal inauguration of &ldquo;The Science Club&rdquo; — breaking ground as the <strong style={{ color: "var(--blue)" }}>first non-institutional, student-centric club movement for science propagation</strong> in the region. Guided by Fr. Timm as founding director, 19 pioneering students embarked on a historic journey to demystify science, making it accessible, experimental, and deeply engaging.
              </p>
              <p>
                By the turn of the <strong style={{ color: "var(--white)" }}>1960s</strong>, NDSC redefined science education in East Pakistan by introducing the concept of the <strong style={{ color: "var(--white)" }}>Annual Science Fair</strong> at the college level — a first for the entire region. These exhibitions served as vital interactive platforms where students presented indigenous innovations, models, and research projects. As the decade progressed, these fairs expanded from internal displays to multi-institutional festivals, profoundly impacting the youth of Dhaka. Despite escalating socio-political unrest, the club&apos;s publications and seminars continuously bridged the gap between theoretical knowledge and practical engineering, cementing NDSC&apos;s reputation as a vanguard of public science.
              </p>
              <p>
                The <strong style={{ color: "var(--white)" }}>1970s</strong> brought immense challenges — the devastating cyclone of November 1970 and the bloody Liberation War of 1971. Under the leadership of College Principal Fr. Richard Timm and later Fr. Julian Bat, the club shifted its focus toward critical <strong style={{ color: "var(--white)" }}>humanitarian relief operations</strong>, providing essential medical aids and rehabilitation materials to war-ravaged communities. In the wake of an independent Bangladesh, the club underwent structural modernization. In June 1972, under the stewardship of the 6th Director, Mr. Tamal Kanti Dutt, the club&apos;s constitution was radically amended to formally allow <strong style={{ color: "var(--white)" }}>female students</strong> from the college&apos;s science department to participate actively. In 1973, NDSC proudly secured top accolades at the historic <strong style={{ color: "var(--blue)" }}>1st National Science Fair of independent Bangladesh</strong>. By 1978, the club&apos;s celebrated annual journal, <em>Cosmos</em>, launched television interviews and public science broadcasts, bringing science directly into living rooms across the nation through <strong style={{ color: "var(--white)" }}>Bangladesh Television (BTV)</strong>.
              </p>
              <p>
                The <strong style={{ color: "var(--white)" }}>1980s</strong> heralded a decade of unprecedented competitive dominance and technical innovation. Under the guidance of Directors like Mr. Amar Chand Das Talukdar and Mr. Amulya Krishna Banik, NDSC members developed pioneering tech projects. In January 1984, the club engineered an indigenous <strong style={{ color: "var(--white)" }}>electronic scoreboard</strong>, winning 1st prize at the National Science Exhibition. In 1987, the club developed an exceptionally <strong style={{ color: "var(--white)" }}>low-cost offset printing technique</strong>, clinching top honors at the 10th National Science and Technology Week. NDSC also secured 5th place <strong style={{ color: "var(--white)" }}>globally</strong> for inventing a low-cost steam-powered water pump optimized for rural irrigation. The decade concluded with Club President Imran Zulkarnain being nominated by the <strong style={{ color: "var(--blue)" }}>Government of Japan</strong> for an elite research internship following his exceptional invention of a cost-effective Geiger-Müller Survey Meter model.
              </p>
              <p>
                In the <strong style={{ color: "var(--white)" }}>1990s</strong>, the club scaled up its organizational capabilities. On December 20, 1990, the club organized the historic <strong style={{ color: "var(--white)" }}>first-ever Inter-College General Knowledge and Science Competition</strong> in Dhaka. Celebrating its 36th anniversary in 1992, the club organized a grand reunion graced by the Planning Minister and former NDSC member, <strong style={{ color: "var(--white)" }}>Dr. Moyeen Khan</strong>. This period saw the introduction of the massive wall-magazine <em style={{ color: "var(--white)" }}>Mohona</em> and high-caliber national educational tours spanning Chittagong, Cox&apos;s Bazar, Kaptai, and Teknaf. NDSC&apos;s projects were chosen as primary exhibits representing college-level innovation at the <strong style={{ color: "var(--white)" }}>National UNESCO Week (1994)</strong>. In 1997, the club swept the 12th, 13th, 14th, and 17th National Science Weeks as <strong style={{ color: "var(--blue)" }}>absolute champion</strong>. A monumental physical milestone was achieved in 1998, when a permanent, state-of-the-art modern office suite was inaugurated on the 5th floor of the newly constructed six-story college building.
              </p>
              <p>
                With the dawn of the new millennium, NDSC dynamically transitioned into the <strong style={{ color: "var(--white)" }}>digital age</strong>. In 2003, the club launched its official website (<strong style={{ color: "var(--blue)" }}>www.ndscbd.org</strong>) and premiered the country&apos;s first digital student science magazine, <em style={{ color: "var(--white)" }}>Ablaze</em>. The <strong style={{ color: "var(--blue)" }}>Golden Jubilee (50th Anniversary)</strong> was celebrated with monumental scale in 2005, including the 3rd National ICT Fair drawing participation from over 19 institutions chaired by Dr. Mohammad Kaykobad. International glory followed in 2006 when a 10-member NDSC delegation competed against teams from India, Pakistan, Nepal, Bhutan, Thailand, and Sri Lanka at the International Science Festival in Lucknow, India, securing an illustrious <strong style={{ color: "var(--white)" }}>2nd place overall</strong>. In 2007, NDSC placed <strong style={{ color: "var(--white)" }}>8th globally out of 128 competing international teams</strong> at the ISSF.
              </p>
              <p>
                Entering the <strong style={{ color: "var(--white)" }}>2010s</strong>, NDSC consistently dominated national science olympiads. At the 20th National GK Festival, NDSC swept championships across <strong style={{ color: "var(--white)" }}>Astronomy, General Knowledge, Biology, and Math Olympiads</strong>. In 2012, the club continued its dominance at the BCSIR Science Fair, winning 1st & 3rd prizes in Physical Sciences and 1st prize in Information Technology. The <strong style={{ color: "var(--blue)" }}>60th Anniversary (Diamond Jubilee)</strong> in 2015 was marked by the publication of a definitive historical legacy magazine. Through the mid-2010s to the historic benchmark of 2025/2026, Notre Dame Science Club reached its monumental <strong style={{ color: "var(--blue)" }}>70th Anniversary — the Platinum Jubilee</strong>. Today, it stands not just as a college club, but as an institution that has systematically defined the landscape of scientific education, secular thought, and technological innovation in Bangladesh for seven glorious decades.
              </p>
            </div>
          </CollapsibleText2>
        </div>
      </section>

      {/* ══ DEPARTMENTS (homepage design) ═══════════════════════ */}
      <DepartmentsSection />

      {/* ══ VOICE OF OUR LEADERS (homepage design) ══════════════ */}
      <LeadersSection />

      {/* ══ MOTTO ════════════════════════════════════════════════ */}
      {/* lg:hidden — on desktop this content now lives beside "Who We Are" above.
          On mobile it stays exactly where it was, unchanged. */}
      <section className="ab-sec ab-sec--alt py-20 sm:py-24 text-center lg:hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Motto mark — replaces the old two spinning dashed circles with
              a single conic-gradient sweep ring (one rotation, 6s) and a
              subtle scale-pulse on the inner logo. Reads as deliberate,
              not as a CSS demo. */}
          <div
            className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full mx-auto mb-10 flex items-center justify-center"
            style={{ border: "1px solid var(--border)" }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-[-6px] rounded-full conic-sweep"
            />
            <span
              aria-hidden="true"
              className="absolute inset-[-2px] rounded-full"
              style={{
                background: "radial-gradient(circle, transparent 60%, rgba(var(--blue-rgb), 0.12) 100%)",
              }}
            />
            <div
              className="logo-float-anim"
              style={{ animationDuration: "6s" }}
            >
              <Image
                src="/images/cropped-logo.png"
                alt="NDSC"
                width={84}
                height={84}
                className="object-contain relative z-10"
                style={{ filter: "drop-shadow(0 0 14px rgba(var(--blue-rgb), 0.5))" }}
              />
            </div>
          </div>
          <div className="reveal section-label justify-center mb-3">Our Motto</div>
          <h2
            className="reveal text-3xl sm:text-5xl font-black mb-5"
            style={{ fontFamily: 'inherit' }}
          >
            <span style={{ color: "var(--blue)" }}>SCIENCE</span> IN<br />HUMAN WELFARE
          </h2>
          <p
            className="reveal text-sm sm:text-base leading-relaxed max-w-xl mx-auto"
            style={{ color: "var(--muted)" }}
          >
            This motto reflects our belief that science is not just an academic pursuit — it is a tool
            for improving lives, solving real-world problems, and creating a better future for humanity.
            Every activity we organize, every article we publish, and every olympiad we host is guided by this core principle.
          </p>
        </div>
      </section>

      {/* ══ FULL MILESTONES TABLE ════════════════════════════════ */}
      <section className="ab-sec py-16 sm:py-24">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="reveal section-label mb-2">Chronological Record</div>
          <h2 className="reveal text-2xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'inherit' }}>
            KEY <span style={{ color: "var(--blue)" }}>MILESTONES</span>
          </h2>
          <p className="reveal text-sm mb-12 max-w-xl" style={{ color: "var(--muted)" }}>
            40+ key milestones chronicling NDSC&apos;s journey from 1953 to its 70th Anniversary in 2026.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 xl:gap-16 items-start">

            {/* Era selector pills */}
            <div className="xl:sticky xl:top-24">
              <div className="flex flex-wrap gap-2 mb-6">
                {ERAS.map((e, i) => (
                  <button
                    key={e.year}
                    onClick={() => setActiveEra(i)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: activeEra === i ? e.color : "transparent",
                      color: activeEra === i ? "#000" : "var(--muted)",
                      borderColor: activeEra === i ? e.color : "var(--border)",
                      boxShadow: activeEra === i ? `0 0 14px ${tint(e.color, 33)}` : "none",
                    }}
                  >
                    <e.icon size={13} className="inline mr-1 -mt-0.5" /> {e.year}
                  </button>
                ))}
              </div>

              {/* Active era detail card — key={activeEra} makes React remount
                  it on era change, so the .reveal class re-runs and gives
                  a clean crossfade between eras. */}
              {(() => { const EraIcon = ERAS[activeEra].icon; return (
              <div
                key={activeEra}
                className="reveal p-6 sm:p-8 rounded-2xl border mb-6"
                style={{ borderColor: tint(ERAS[activeEra].color, 40), background: `color-mix(in srgb, ${ERAS[activeEra].color} 9%, rgba(4,10,22,.9))` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <EraIcon size={30} style={{ color: ERAS[activeEra].color }} />
                  <div>
                    <p
                      className="text-xs font-bold tracking-widest"
                      style={{ fontFamily: "var(--font-mono)", color: ERAS[activeEra].color }}
                    >
                      {ERAS[activeEra].year}
                    </p>
                    <h4 className="text-base sm:text-lg font-black" style={{ fontFamily: 'inherit' }}>
                      {ERAS[activeEra].label}
                    </h4>
                  </div>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: "var(--muted)" }}>
                  {ERAS[activeEra].summary}
                </p>

                {/* Individual milestones */}
                <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  {ERAS[activeEra].milestones.map((m, mi) => (
                    <div key={mi} className="flex gap-3 items-start">
                      <span
                        className="shrink-0 text-xs font-black mt-0.5"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: ERAS[activeEra].color,
                          minWidth: "4.5rem",
                        }}
                      >
                        {m.y}
                      </span>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{m.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              ); })()}
            </div>

            {/* Right: compact all-era vertical timeline */}
            <div>
              <div className="relative pl-6 border-l-2" style={{ borderColor: "var(--border)" }}>
                {ERAS.map((e, i) => (
                  <button
                    key={e.year}
                    onClick={() => setActiveEra(i)}
                    className="relative w-full text-left mb-0 last:mb-0 group"
                  >
                    {/* dot */}
                    <div
                      className="absolute -left-[29px] top-3 w-3.5 h-3.5 rounded-full border-2 transition-all duration-200"
                      style={{
                        background: activeEra === i ? e.color : "var(--bg)",
                        borderColor: activeEra === i ? e.color : "var(--border)",
                        boxShadow: activeEra === i ? `0 0 10px ${e.color}` : "none",
                      }}
                    />
                    {/* connector line fill */}
                    {activeEra === i && (
                      <div
                        className="absolute -left-[28px] top-5 w-0.5"
                        style={{ background: e.color, height: "calc(100% - 12px)", opacity: 0.3 }}
                      />
                    )}

                    <div
                      className="mb-4 p-4 rounded-xl border transition-all duration-200"
                      style={{
                        borderColor: activeEra === i ? tint(e.color, 45) : "var(--border)",
                        background: activeEra === i ? `color-mix(in srgb, ${e.color} 9%, rgba(4,10,22,.9))` : "var(--card)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <e.icon size={13} style={{ color: activeEra === i ? e.color : "var(--muted)" }} />
                        <span
                          className="text-xs font-black tracking-wider"
                          style={{ fontFamily: 'inherit', color: activeEra === i ? e.color : "var(--muted)", fontSize: "0.65rem" }}
                        >
                          {e.year}
                        </span>
                        <span
                          className="ml-auto text-xs font-bold"
                          style={{ color: activeEra === i ? e.color : "var(--muted)" }}
                        >
                          {e.label}
                        </span>
                      </div>
                      {/* Show mini milestone list when active */}
                      {activeEra === i ? (
                        <div className="space-y-1.5 mt-2">
                          {e.milestones.map((m, mi) => (
                            <div key={mi} className="flex gap-2 items-start">
                              <span
                                className="shrink-0 text-xs font-bold"
                                style={{ fontFamily: "var(--font-mono)", color: e.color, minWidth: "4rem", fontSize: "0.6rem" }}
                              >
                                {m.y}
                              </span>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{m.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                          {e.summary}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats — same strip as the homepage (app/_components/home2/StatsStrip.tsx) */}
          <div className="ch-stats-grid ab-stats reveal mt-14">
            <div className="ch-stat"><b>70+</b><span>Years of Legacy</span></div>
            <div className="ch-stat"><b>20,000+</b><span>Members &amp; Alumni</span></div>
            <div className="ch-stat"><b>1,000+</b><span>Workshops &amp; Sessions</span></div>
            <div className="ch-stat"><b>1st</b><span>Science Club in S. Asia</span></div>
          </div>
        </div>
      </section>

      {/* ══ GOALS ════════════════════════════════════════════════ */}
      <section className="ab-sec ab-sec--alt py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="reveal section-label mb-2">Mission</div>
          <h2 className="reveal text-2xl sm:text-3xl font-black mb-10" style={{ fontFamily: 'inherit' }}>
            OUR <span style={{ color: "var(--blue)" }}>GOALS</span>
          </h2>
          <div className="space-y-4">
            {GOALS.map((g, i) => (
              <div
                key={g.title}
                className="reveal card-lift flex gap-5 p-5 sm:p-6 rounded-xl border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  transitionDelay: `${i * 0.06}s`,
                }}
              >
                <span
                  className="text-xl sm:text-2xl font-black shrink-0 opacity-25 leading-none pt-1"
                  style={{ fontFamily: 'inherit', color: "var(--blue)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'inherit' }}>{g.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
