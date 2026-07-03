"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
const DEPTS = [
  {
    name: "Administration",
    icon: "/images/admininstration-icon.svg",
    color: "var(--blue)",
    bg: "rgba(var(--blue-rgb), 0.08)",
    border: "rgba(var(--blue-rgb), 0.3)",
    desc: "Ensures smooth operation and management of club activities. Coordinates planning, logistics and execution of all events and programs. Maintains the official records, communication, and institutional memory of NDSC.",
  },
  {
    name: "Project",
    icon: "/images/project-icon.svg",
    color: "var(--cat-teal)",
    bg: "rgba(var(--cat-teal-rgb), 0.08)",
    border: "rgba(var(--cat-teal-rgb), 0.3)",
    desc: "Conducts scientific research and innovation-based projects. Encourages experimentation, analytical development, and student-led innovation. Organizes the Annual Science Festival — the biggest science fair platform in Bangladesh.",
  },
  {
    name: "Publication",
    icon: "/images/publication-icon.svg",
    color: "var(--accent2)",
    bg: "rgba(var(--accent2-rgb), 0.08)",
    border: "rgba(var(--accent2-rgb), 0.3)",
    desc: "Handles graphics, publishes wall magazines, journals and the annual AUDRI publication. Promotes scientific writing, knowledge sharing, and creative expression. Manages STEM Insights — the monthly digital science magazine.",
  },
  {
    name: "ICT",
    icon: "/images/ict-icon.svg",
    color: "var(--cat-red)",
    bg: "rgba(var(--cat-red-rgb), 0.08)",
    border: "rgba(var(--cat-red-rgb), 0.3)",
    desc: "Handles digital media, website management, and tech support. Maintains digital infrastructure and online presence of the club. Organizes national ICT fairs and workshops on programming, AI, robotics, and emerging technology.",
  },
  {
    name: "LWS",
    icon: "/images/lws-icon.svg",
    color: "var(--cat-amber)",
    bg: "rgba(var(--cat-amber-rgb), 0.08)",
    border: "rgba(var(--cat-amber-rgb), 0.3)",
    desc: "Library, Workshop & Seminar — the club's academics department. Manages the club library, organizes academic workshops, and hosts seminars bridging theoretical knowledge with practical learning.",
  },
  {
    name: "Quiz",
    icon: "/images/quiz-icon.svg",
    color: "var(--info)",
    bg: "rgba(var(--info-rgb), 0.08)",
    border: "rgba(var(--info-rgb), 0.3)",
    desc: "Hosts Q-League, BrainRain, and Scienceophile — premier national quiz competitions. NDC Blue, NDC Green & NDC Gold are NDSC's prestigious national quiz teams. Prepares members for national and international science olympiads.",
  },
  {
    name: "R&D",
    icon: "/images/r&d-icon.svg",
    color: "var(--cat-orange)",
    bg: "rgba(var(--cat-orange-rgb), 0.08)",
    border: "rgba(var(--cat-orange-rgb), 0.3)",
    desc: "Research & Development — drives olympiad preparation, academic seminars, and student-led scientific innovation programs. Coordinates with national and international academic bodies for research collaboration and student recognition.",
  },
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
    year: "1953–1955", label: "Foundation", color: "var(--blue)", icon: "🏛️",
    summary: "Fr. Richard William Timm, C.S.C. begins lab sessions in 1953. The Science Club is officially inaugurated on September 18, 1955, with 19 founding student members.",
    milestones: [
      { y: "1953", text: "Fr. Timm starts laying the groundwork by hosting advanced laboratory experimentation sessions for interested students at the Motijheel campus." },
      { y: "1955", text: "September 18 — 'The Science Club' is formally inaugurated with 19 pioneering student members as the first non-institutional, student-centric science club in the region." },
    ],
  },
  {
    year: "1960s", label: "Science Fairs", color: "var(--cat-teal)", icon: "🔬",
    summary: "NDSC pioneers the first-ever college-level Annual Science Fairs in East Pakistan, expanding to multi-institutional festivals impacting youth across Dhaka.",
    milestones: [
      { y: "1960s", text: "First college-level Annual Science Fairs introduced in East Pakistan — the first of their kind in the entire region." },
      { y: "1960s", text: "Internal exhibitions grow into multi-institutional festivals, profoundly impacting youth in Dhaka." },
      { y: "1960s", text: "Publications and seminars continuously bridge the gap between theoretical knowledge and practical engineering." },
    ],
  },
  {
    year: "1970s", label: "War & Reform", color: "var(--accent2)", icon: "🌏",
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
    year: "1980s", label: "Championships", color: "var(--cat-amber)", icon: "🏆",
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
    year: "1990s", label: "Publications", color: "var(--cat-red)", icon: "📰",
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
    year: "2000s", label: "Global Reach", color: "var(--info)", icon: "🌐",
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
    year: "2010s–2026", label: "Platinum Era", color: "var(--cat-orange)", icon: "✨",
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
        style={{ maxHeight: expanded ? "9999px" : `${previewLines * 1.9 * 14}px` }}
      >
        {children}
        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, var(--bg))" }}
          />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-2 text-xs font-black tracking-widest px-4 py-2 rounded-lg border transition-all hover:bg-[var(--blue)] hover:text-black group"
        style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}
      >
        {expanded ? "SHOW LESS ▲" : "READ MORE ▼"}
      </button>
    </div>
  );
}

function CollapsibleText2({
  children,
  previewLines = 6,
  bg = "var(--bg2)",
}: {
  children: React.ReactNode;
  previewLines?: number;
  bg?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div
        className="relative overflow-hidden transition-all duration-500"
        style={{ maxHeight: expanded ? "9999px" : `${previewLines * 1.9 * 14}px` }}
      >
        {children}
        {!expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent, ${bg})` }}
          />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-2 text-xs font-black tracking-widest px-4 py-2 rounded-lg border transition-all hover:bg-[var(--blue)] hover:text-black"
        style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}
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

  return (
    <div className="min-h-screen relative z-10" style={{ paddingTop: "64px" }}>

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section
        className="py-20 sm:py-28 border-b relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,var(--bg2),var(--bg))", borderColor: "var(--border)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "60px 60px", opacity: 0.12,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(var(--blue-rgb), 0.06) 0%, transparent 70%)" }}
        />

        {/* Hero heading — centered */}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center mb-10">
          <div className="section-label justify-center mb-3">[ EST. 1955 ]</div>
          <h1 className="text-4xl sm:text-6xl font-black mb-5" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            ABOUT <span style={{ color: "var(--blue)" }}>NDSC</span>
          </h1>
        </div>

        {/* About article — collapsed, left-aligned, inside hero */}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div
            className="p-6 sm:p-8 rounded-2xl border"
            style={{ borderColor: "rgba(var(--blue-rgb), 0.2)", background: "rgba(var(--blue-rgb), 0.03)" }}
          >
            <div className="section-label mb-3">[ Who We Are ]</div>
            <CollapsibleText previewLines={5}>
              <div className="space-y-4 text-sm leading-[1.9]" style={{ color: "var(--muted)" }}>
                <p>
                  Notre Dame Science Club, also known as <strong style={{ color: "var(--white)" }}>NDSC</strong>, is the most promising, versatile, and eminent co-curricular activities club of Notre Dame College, Dhaka. It began its inception in <strong style={{ color: "var(--blue)" }}>1955</strong> with a singular mission — to ignite a passion for science among students. It holds the proud distinction of being the <strong style={{ color: "var(--blue)" }}>pioneer science club of the Indian Subcontinent</strong>. Holding the noble motto &ldquo;Science in Human Welfare,&rdquo; the eminent scientist <strong style={{ color: "var(--white)" }}>Fr. Richard William Timm, C.S.C.</strong> inaugurated the flag of NDSC on September 18, 1955, alongside 19 founding student members.
                </p>
                <p>
                  The NDSC has a long history of inspiring its followers to rediscover their innate passion for science by serving as the country&apos;s <strong style={{ color: "var(--white)" }}>oldest and most prestigious scientific club</strong>. NDSC provides necessary guidelines to budding scientists and is the trailblazer in spreading scientific awareness among the people. We foster a love of science and an eagerness to learn more about the world&apos;s mysteries, touch the untouched, and see the unseen. For the last few decades, NDSC has turned into the most prominent club to organize numerous <strong style={{ color: "var(--white)" }}>science fairs</strong> — the ultimate platform for student project demonstrations across the nation.
                </p>
                <p>
                  Besides its events and competitions, NDSC has provided the momentum to research advanced knowledge. The official quiz teams of Notre Dame Science Club — <strong style={{ color: "var(--blue)" }}>&quot;NDC Blue&quot;, &quot;NDC Green&quot; &amp; &quot;NDC Gold&quot;</strong> — are prestigious platforms for quizzers working relentlessly to uphold the glory of competitive science. These teams have represented Bangladesh at national and international levels, earning glory for the institution and inspiring a culture of intellectual excellence.
                </p>
                <p>
                  Every year, distinguished members of NDSC compete in <strong style={{ color: "var(--white)" }}>international science fairs</strong> and bring honour to the institution. The club has secured remarkable positions at global competitions — including 2nd place at the International Science Festival in Lucknow, India (2006), and 8th place globally out of 128 competing international teams at the ISSF (2007). Run by experienced moderators and a dedicated executive panel, NDSC continues to be the pioneer of the science movement in Bangladesh and will upgrade the noble cause of promoting science in every sphere of life.
                </p>
                <p>
                  Today, as NDSC celebrates its <strong style={{ color: "var(--blue)" }}>70th Anniversary — the Platinum Jubilee</strong> — it stands not just as a college club, but as an institution that has systematically defined the landscape of scientific education, secular thought, and technological innovation in Bangladesh for seven glorious decades. With over <strong style={{ color: "var(--white)" }}>5000 alumni members</strong> across the globe, more than 100 events hosted, and 7 specialized departments working in unison, NDSC remains the benchmark of scientific co-curricular excellence in the region.
                </p>
              </div>
            </CollapsibleText>
          </div>
        </div>
      </section>

      {/* ══ HISTORY ARTICLE ═══════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Historical Narrative</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            OUR <span style={{ color: "var(--blue)" }}>LEGACY</span>
          </h2>
          <p className="text-xs mb-8" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.1em" }}>
            A Comprehensive Historical Account (1955 – 2026)
          </p>

          {/* Pull quote */}
          <div className="relative pl-5 mb-8 border-l-2" style={{ borderColor: "var(--blue)" }}>
            <p className="text-base sm:text-lg font-semibold italic leading-relaxed" style={{ color: "var(--white)" }}>
              &ldquo;The pioneer science club of the Indian Subcontinent — 70 years of igniting curiosity, innovation, and scientific excellence.&rdquo;
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

      {/* ══ DEPARTMENTS ═════════════════════════════════════════ */}
      <section id="departments" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Structure</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            OUR <span style={{ color: "var(--blue)" }}>DEPARTMENTS</span>
          </h2>
          <p className="text-sm mb-12 max-w-xl" style={{ color: "var(--muted)" }}>
            NDSC is structured into 7 specialized departments, each driving a unique aspect of our scientific mission.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {DEPTS.map((d, i) => (
              <div
                key={d.name}
                className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 cursor-default"
                style={{
                  background: d.bg,
                  border: `1px solid ${d.border}`,
                  boxShadow: `0 0 0 0 ${d.color}00`,
                  transition: "transform 0.3s, box-shadow 0.3s, border-color 0.3s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = `0 8px 32px ${d.color}33, 0 0 0 1px ${d.color}66`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "0 0 0 0 transparent";
                }}
              >
                {/* Glow corner accent */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${d.color}20, transparent 70%)` }}
                />
                {/* Number badge */}
                <div
                  className="absolute top-4 right-4 text-xs font-black opacity-20"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: d.color, fontSize: "2rem", lineHeight: 1 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div className="relative p-6">
                  <div className="relative w-14 h-14 mb-5">
                    <Image
                      src={d.icon}
                      alt={d.name}
                      fill
                      className="object-contain"
                      style={{ filter: `drop-shadow(0 0 10px ${d.color})` }}
                    />
                  </div>
                  <h3
                    className="font-black text-sm tracking-wider mb-3"
                    style={{ fontFamily: "'Orbitron',sans-serif", color: d.color }}
                  >
                    {d.name}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {d.desc}
                  </p>
                  {/* Bottom color bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MODERATOR MESSAGE ════════════════════════════════════ */}
      <section id="moderator" className="py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Message</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-8" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            FROM THE <span style={{ color: "var(--accent2)" }}>MODERATOR</span>
          </h2>
          <div
            className="p-6 sm:p-10 rounded-2xl border relative overflow-hidden"
            style={{ borderColor: "rgba(var(--accent2-rgb), 0.35)", background: "rgba(var(--accent2-rgb), 0.04)" }}
          >
            <div
              className="absolute top-4 right-6 text-9xl font-black leading-none select-none pointer-events-none"
              style={{ color: "rgba(var(--accent2-rgb), 0.06)", fontFamily: "'Orbitron',sans-serif" }}
            >"</div>
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-start mb-6">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: "var(--accent2)" }}>
                <Image src="https://uploads.ndscbd.net/executives/1780621402_fdc8d88bf714.jpg" alt="Moderator" fill className="object-cover" />
              </div>
              <div>
                <h3 className="font-black text-base" style={{ fontFamily: "'Orbitron',sans-serif" }}>Dr. Vincent Titas Rozario</h3>
                <p className="text-sm font-bold" style={{ color: "var(--accent2)" }}>Moderator</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Notre Dame Science Club</p>
              </div>
            </div>
            <CollapsibleText2 previewLines={5} bg="var(--bg2)">
              <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                <p>&ldquo;For nearly seven decades, Notre Dame Science Club has stood as a beacon of intellectual curiosity, disciplined inquiry, and service to humanity. I have witnessed how this club transforms young minds — nurturing not just scientific knowledge, but the values of integrity, perseverance, and compassion.</p>
                <p>Science, when practised with a humane heart, becomes a force for good in our world. The legacy of our founder, Fr. Richard William Timm, C.S.C., continues to inspire every student who walks through the doors of this institution. Notre Dame Science Club has always been a place where curiosity is celebrated, questions are welcomed, and excellence is expected.</p>
                <p>I urge every member to carry forward the spirit of our founding motto: <em style={{ color: "var(--accent2)" }}>Science in Human Welfare</em>. This is not merely a slogan — it is a responsibility. A responsibility to use your knowledge, your talents, and your passion to serve the community, the nation, and humanity at large.</p>
                <p>The future of Bangladesh rests in the hands of young scientists like you. Let your curiosity be the compass, your dedication the fuel, and your compassion the guiding light. NDSC will always be your launchpad — your family — as you take flight toward a future of scientific greatness.&rdquo;</p>
              </div>
            </CollapsibleText2>
          </div>
        </div>
      </section>

      {/* ══ GS MESSAGE ══════════════════════════════════════════ */}
      <section id="gs" className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Message</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-8" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            FROM THE <span style={{ color: "var(--blue)" }}>GENERAL SECRETARY</span>
          </h2>
          <div
            className="p-6 sm:p-10 rounded-2xl border relative overflow-hidden"
            style={{ borderColor: "rgba(var(--blue-rgb), .3)", background: "rgba(var(--blue-rgb), .03)" }}
          >
            <div
              className="absolute top-4 right-6 text-9xl font-black leading-none select-none pointer-events-none"
              style={{ color: "rgba(var(--blue-rgb), 0.05)", fontFamily: "'Orbitron',sans-serif" }}
            >"</div>
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-start mb-6">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: "var(--blue)" }}>
                <Image src="https://uploads.ndscbd.net/executives/1780619755_f8a427c9fe3d.jpg" alt="GS" fill className="object-cover" />
              </div>
              <div>
                <h3 className="font-black text-base" style={{ fontFamily: "'Orbitron',sans-serif" }}>Fahim Faisal Arnob</h3>
                <p className="text-sm font-bold" style={{ color: "var(--blue)" }}>General Secretary</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Notre Dame Science Club · 2025–2026</p>
              </div>
            </div>
            <CollapsibleText previewLines={5}>
              <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                <p>&ldquo;Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. As your General Secretary, I am committed to taking NDSC to new heights, fostering innovation, scientific thinking, and brotherhood among our members. Together, we will uphold our 70-year legacy and write new chapters of excellence.</p>
                <p>Notre Dame Science Club (NDSC) is a pioneer in the Indian Subcontinent for organizing its annual and government-supported science festivals. With strong global alumni connections and exceptional professionalism, NDSC offers a perfect family environment for science enthusiasts.</p>
                <p>Science is not confined to textbooks; it lives in every experiment we conduct, every question we ask, and every problem we dare to solve. I invite every student of Notre Dame College to be part of this magnificent journey. Whether you are passionate about physics, chemistry, biology, technology, or simply curious about the world — NDSC is your home.</p>
                <p>Let us carry forward the noble motto of our founders: <em style={{ color: "var(--blue)" }}>Science in Human Welfare</em>. Together, we will make NDSC not just the oldest, but the greatest science club in Bangladesh.&rdquo;</p>
              </div>
            </CollapsibleText>
            <Link
              href="/executives"
              className="inline-block mt-6 px-5 py-2 text-xs font-black tracking-widest rounded-lg border transition-all hover:bg-[var(--blue)] hover:text-black"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}
            >
              VIEW ALL EXECUTIVES →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ MOTTO ════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 text-center" style={{ background: "var(--bg2)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border mx-auto mb-8 flex items-center justify-center"
            style={{ borderColor: "var(--border)" }}>
            <div className="absolute inset-0 rounded-full border border-dashed"
              style={{ borderColor: "var(--blue)", opacity: .4, animation: "spin 10s linear infinite" }} />
            <div className="absolute inset-[-12px] rounded-full border border-dashed"
              style={{ borderColor: "var(--blue2)", opacity: .2, animation: "spin 16s linear infinite reverse" }} />
            <Image src="/images/cropped-logo.png" alt="NDSC" width={80} height={80} className="object-contain relative z-10" />
          </div>
          <div className="section-label justify-center mb-3">Our Motto</div>
          <h2 className="text-3xl sm:text-5xl font-black mb-5" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            <span style={{ color: "var(--blue)" }}>SCIENCE</span> IN<br />HUMAN WELFARE
          </h2>
          <p className="text-sm sm:text-base leading-relaxed max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            This motto reflects our belief that science is not just an academic pursuit — it is a tool
            for improving lives, solving real-world problems, and creating a better future for humanity.
            Every activity we organize, every article we publish, and every olympiad we host is guided by this core principle.
          </p>
        </div>
      </section>

      {/* ══ FULL MILESTONES TABLE ════════════════════════════════ */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Chronological Record</div>
          <h2 className="text-2xl sm:text-4xl font-black mb-3" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            KEY <span style={{ color: "var(--blue)" }}>MILESTONES</span>
          </h2>
          <p className="text-sm mb-12 max-w-xl" style={{ color: "var(--muted)" }}>
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
                      fontFamily: "'Share Tech Mono', monospace",
                      background: activeEra === i ? e.color : "transparent",
                      color: activeEra === i ? "#000" : "var(--muted)",
                      borderColor: activeEra === i ? e.color : "var(--border)",
                      boxShadow: activeEra === i ? `0 0 14px ${e.color}55` : "none",
                    }}
                  >
                    {e.icon} {e.year}
                  </button>
                ))}
              </div>

              {/* Active era detail card */}
              <div
                className="p-6 sm:p-8 rounded-2xl border mb-6 transition-all duration-300"
                style={{ borderColor: ERAS[activeEra].color + "55", background: ERAS[activeEra].color + "0a" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{ERAS[activeEra].icon}</span>
                  <div>
                    <p
                      className="text-xs font-bold tracking-widest"
                      style={{ fontFamily: "'Share Tech Mono', monospace", color: ERAS[activeEra].color }}
                    >
                      {ERAS[activeEra].year}
                    </p>
                    <h4 className="text-base sm:text-lg font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
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
                          fontFamily: "'Share Tech Mono',monospace",
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
                        borderColor: activeEra === i ? e.color + "66" : "var(--border)",
                        background: activeEra === i ? e.color + "0d" : "var(--card)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span>{e.icon}</span>
                        <span
                          className="text-xs font-black tracking-wider"
                          style={{ fontFamily: "'Orbitron',sans-serif", color: activeEra === i ? e.color : "var(--muted)", fontSize: "0.65rem" }}
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
                                style={{ fontFamily: "'Share Tech Mono',monospace", color: e.color, minWidth: "4rem", fontSize: "0.6rem" }}
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

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-14">
            {[["70+", "Years of Legacy"], ["5000+", "Alumni Members"], ["100+", "Events Hosted"], ["7", "Departments"]].map(([n, l]) => (
              <div
                key={l}
                className="p-5 rounded-xl border text-center card-hover"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <p
                  className="text-2xl sm:text-3xl font-black mb-1"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", filter: "drop-shadow(0 0 8px var(--glow))" }}
                >
                  {n}
                </p>
                <p className="text-xs tracking-wider uppercase" style={{ color: "var(--muted)" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ GOALS ════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="section-label mb-2">Mission</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-10" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            OUR <span style={{ color: "var(--blue)" }}>GOALS</span>
          </h2>
          <div className="space-y-4">
            {GOALS.map((g, i) => (
              <div
                key={g.title}
                className="flex gap-5 p-5 sm:p-6 rounded-xl border transition-all hover:border-[var(--blue)] hover:translate-x-1"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <span
                  className="text-xl sm:text-2xl font-black shrink-0 opacity-25 leading-none pt-1"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ fontFamily: "'Orbitron',sans-serif" }}>{g.title}</h3>
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