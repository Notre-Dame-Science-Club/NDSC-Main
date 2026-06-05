"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, BookOpen, Quote, Play, ChevronRight } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   WATER RIPPLE + DEEP SPACE BACKGROUND CANVAS
══════════════════════════════════════════════════════════════ */
function WaterSpaceCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let W = 0, H = 0;
    let t = 0;

    // Stars
    interface Star { x: number; y: number; r: number; o: number; tw: number }
    let stars: Star[] = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      stars = [];
      for (let i = 0; i < 180; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, o: Math.random(), tw: Math.random() * Math.PI * 2 });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Ripple sources
    const ripples = [
      { cx: 0.5, cy: 0.75, amp: 18, freq: 0.012, speed: 0.7 },
      { cx: 0.3, cy: 0.85, amp: 10, freq: 0.018, speed: 0.5 },
      { cx: 0.7, cy: 0.8,  amp: 12, freq: 0.015, speed: 0.6 },
    ];

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // ── Deep space gradient bg ──────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0,   "#000408");
      bg.addColorStop(0.45,"#020c1a");
      bg.addColorStop(0.7, "#030e20");
      bg.addColorStop(1,   "#000204");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Nebula glow patches ─────────────────────────────────
      const paintNebula = (x: number, y: number, rx: number, ry: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        g.addColorStop(0, color);
        g.addColorStop(1, "transparent");
        ctx.save();
        ctx.scale(1, ry / rx);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y * (rx / ry), rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      paintNebula(W * 0.2, H * 0.25, 320, 180, "rgba(0,80,160,0.09)");
      paintNebula(W * 0.8, H * 0.3,  260, 160, "rgba(0,180,255,0.06)");
      paintNebula(W * 0.5, H * 0.5,  400, 250, "rgba(0,40,100,0.05)");

      // ── Stars with twinkle ──────────────────────────────────
      for (const s of stars) {
        s.tw += 0.015;
        const ao = 0.3 + 0.7 * Math.abs(Math.sin(s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + Math.round(75 * ao)},${220 + Math.round(35 * ao)},255,${ao * 0.85})`;
        ctx.fill();
      }

      // ── Water surface (lower 40% of screen) ────────────────
      const waterTop = H * 0.6;
      const rows = 90;
      const rowH = (H - waterTop) / rows;

      for (let row = 0; row < rows; row++) {
        const y = waterTop + row * rowH;
        const depth = row / rows; // 0 = surface, 1 = deep
        const cols = Math.max(8, Math.round(60 - depth * 40));
        const segW = W / cols;

        for (let col = 0; col < cols; col++) {
          const x = col * segW;
          // combine ripple sources
          let wave = 0;
          for (const rp of ripples) {
            const dx = x / W - rp.cx;
            const dy = (y / H - rp.cy) * 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            wave += rp.amp * Math.sin(dist * W * rp.freq - t * rp.speed) * Math.exp(-dist * 3.5);
          }
          wave *= (1 - depth);

          // Light reflection intensity
          const intensity = Math.max(0, Math.sin(wave * 0.3 + t * 0.4) * 0.5 + 0.5);
          const alpha = (0.04 + intensity * 0.18) * (1 - depth * 0.8);

          // Color — cyan near surface, deep blue below
          const r = Math.round(0 + intensity * 20);
          const g = Math.round(60 + intensity * 140 - depth * 40);
          const b = Math.round(120 + intensity * 135 - depth * 30);

          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(x, y + wave * depth * 0.3, segW + 1, rowH + 1);
        }
      }

      // ── Water horizon glow line ─────────────────────────────
      const horizGrad = ctx.createLinearGradient(0, 0, W, 0);
      horizGrad.addColorStop(0,   "transparent");
      horizGrad.addColorStop(0.2, "rgba(0,200,255,0.12)");
      horizGrad.addColorStop(0.5, "rgba(0,212,255,0.22)");
      horizGrad.addColorStop(0.8, "rgba(0,200,255,0.12)");
      horizGrad.addColorStop(1,   "transparent");
      ctx.fillStyle = horizGrad;
      ctx.fillRect(0, waterTop - 1, W, 3 + Math.sin(t * 0.5) * 1);

      // ── Vertical light shafts from horizon ─────────────────
      for (let i = 0; i < 5; i++) {
        const lx = W * (0.1 + i * 0.2 + Math.sin(t * 0.1 + i) * 0.04);
        const lg = ctx.createLinearGradient(lx, waterTop, lx, H);
        lg.addColorStop(0, `rgba(0,200,255,${0.04 + Math.sin(t * 0.3 + i) * 0.02})`);
        lg.addColorStop(1, "transparent");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(lx - 40, waterTop);
        ctx.lineTo(lx + 40, waterTop);
        ctx.lineTo(lx + 10, H);
        ctx.lineTo(lx - 10, H);
        ctx.closePath();
        ctx.fill();
      }

      // ── Atmospheric vignette ────────────────────────────────
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" />;
}

/* ══════════════════════════════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════════════════════════════ */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } }),
      { threshold: 0.08, rootMargin: "-30px" }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ══════════════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════════════ */
const STATS = [
  { num: "70+",    label: "Years of Legacy" },
  { num: "20,000+", label: "Members" },
  { num: "100+",  label: "Events Hosted" },
  { num: "1st",   label: "Science Club in S. Asia" },
];

const DEPTS = [
  { name: "Administration", icon: "/images/admininstration-icon.png", short: "Administration", color: "#00d4ff",
    desc: "Ensures smooth operation and management of club activities. Coordinates planning, logistics and execution of events." },
  { name: "Project", icon: "/images/project.png", short: "Project", color: "#34d399",
    desc: "Conducts scientific research and innovation-based projects. Encourages experimentation and analytical development." },
  { name: "Publication", icon: "/images/publication.png", short: "Publication", color: "#00d4ff",
    desc: "Handles graphics, publishes wall magazines, journals and annual publications (AUDRI). Promotes scientific writing." },
  { name: "ICT", icon: "/images/ict.png", short: "ICT", color: "#34d399",
    desc: "Handles digital media, website management and tech support. Maintains digital infrastructure of the club." },
  { name: "LWS", icon: "/images/lws.png", short: "LWS", color: "#00d4ff",
    desc: "Life & Welfare Science — biology, environment and health oriented activities and awareness programs." },
  { name: "Quiz", icon: "/images/quiz.png", short: "Quiz", color: "#34d399",
    desc: "Hosts Q-League, BrainRain, Scienceophile. NDC Blue, NDC Green & NDC Gold — NDSC's prestigious quiz teams." },
];

const EVENTS = [
  { title: "Workshop on Higher Studies in Japan", img: "/images/020.jpg", date: "2024", href: "https://www.facebook.com/share/p/18Mn2w5GZL/" },
  { title: "47th National Science & Technology Week", img: "/images/021.jpg", date: "15 Feb 2025", href: "#" },
  { title: "Notre Dame Annual Science Festival 2025 & 35th GKC", img: "/images/022.JPG", date: "05 Jan 2025", href: "#" },
  { title: "70th Anniversary Celebration", img: "/images/012.jpg", date: "2024", href: "https://www.facebook.com/share/p/18Mn2w5GZL/" },
  { title: "AIUB Campus Tour & Workshop on Robotics", img: "/images/001.jpg", date: "10 March 2026", href: "https://www.facebook.com/share/p/1CHJxskgfQ/" },
  { title: "Physics Olympiad Workshop", img: "/images/010.jpg", date: "2024", href: "https://www.facebook.com/share/p/18Mn2w5GZL/" },
  { title: "SciencePhile 4.0", img: "/images/sciencephile4.0.png", date: "2024", href: "https://www.facebook.com/share/p/18Mn2w5GZL/" },
  { title: "QLeague session 24-25", img: "/images/Qleague-25-26.png", date: "2024", href: "https://www.facebook.com/share/p/18CNrgv5M6/" },
  { title: "Notre Dame Annual Science Festival 2024 & 34th GKC", img: "/images/011.jpg", date: "2024", href: "https://www.facebook.com/share/p/18CNrgv5M6/" },
];

const QUOTES = [
  {
    role: "Moderator",
    name: "Dr. Vincent Titas Rozario",
    image: "/images/Titas-sir.jpg",
    panel: "Notre Dame Science Club",
    full: "Notre Dame Science Club, since its founding in 1955 by the eminent scientist Fr. Richard William Timm, C.S.C., has exemplified the spirit of scientific curiosity and service to humanity. The club's motto — 'Science in Human Welfare' — is not merely a slogan but a living commitment that guides every activity, publication, and event we organize. I am proud to guide this generation of science enthusiasts as they carry forward a 70-year legacy of excellence, innovation, and national pride.",
    link: "/about",
  },
  {
    role: "General Secretary",
    name: "Fahim Faisal Arnob",
    image: "/images/panel-26/gs.jpg",
    panel: "Notre Dame Science Club",
    full: "Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. NDSC is a pioneer in the Indian Subcontinent for organizing its annual and government-supported science festivals. Through national olympiads, weekly workshops, Science Sundays, research projects, and innovative STEM activities, NDSC nurtures young minds to become future scientists, innovators, and leaders.",
    link: "/about",
  },
];

const VIDEOS = [
  { id: "CXvLpiRFWqg", title: "NDSC Feature" },
  { id: "CXvLpiRFWqg", title: "Science & Society" },
  { id: "CXvLpiRFWqg", title: "Holographic Universe" },
];

/* ──────────────────────────────────────────────────────────── */
function DeptModal({ dept, onClose }: { dept: typeof DEPTS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.88)" }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: dept.color, background: "var(--bg2)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xs font-bold"
          style={{ color: "var(--muted)" }}>✕</button>
        <div className="w-20 h-20 mx-auto mb-4 relative">
          <Image src={dept.icon} alt={dept.name} fill className="object-contain"
            style={{ filter: `drop-shadow(0 0 12px ${dept.color})` }} />
        </div>
        <h3 className="text-xl font-black mb-3" style={{ color: dept.color }}>{dept.name}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{dept.desc}</p>
        <Link href="/about#departments" onClick={onClose}
          className="inline-block mt-5 px-5 py-2 rounded-lg text-xs font-black tracking-widest border"
          style={{ borderColor: dept.color, color: dept.color }}>Learn More →</Link>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", fontFamily: "'Share Tech Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.35em", color: "var(--blue)", textTransform: "uppercase" }}>
      <span style={{ display: "inline-block", width: 28, height: 1, background: "var(--blue)", flexShrink: 0 }} />
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  useReveal();
  const [activeVideo, setActiveVideo] = useState(0);
  const [deptModal, setDeptModal] = useState<typeof DEPTS[0] | null>(null);

  return (
    <>
      <style>{`
        /* ── Keyframes ─────────────────────────────────── */
        @keyframes riseWord   { from { opacity:0; transform:translateY(60px) skewY(4deg); } to { opacity:1; transform:none; } }
        @keyframes fadeSlide  { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:none; } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:none; } }
        @keyframes scaleGlow  { from { opacity:0; transform:scale(0.82); } to { opacity:1; transform:scale(1); } }
        @keyframes spinSlow   { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes spinRev    { from { transform:rotate(0deg); } to { transform:rotate(-360deg); } }
        @keyframes pulse      { 0%,100%{opacity:.55;} 50%{opacity:1;} }
        @keyframes marquee    { from{transform:translateX(0);} to{transform:translateX(-50%);} }
        @keyframes marqueeH   { from{transform:translateX(0);} to{transform:translateX(-50%);} }
        @keyframes scanV      { 0%{top:-4px;} 100%{top:104%;} }
        @keyframes borderCycle{ 0%,100%{border-color:rgba(0,212,255,.3);box-shadow:0 0 40px rgba(0,212,255,.15);} 50%{border-color:rgba(0,212,255,.75);box-shadow:0 0 80px rgba(0,212,255,.3);} }
        @keyframes floatY     { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-14px);} }
        @keyframes gradShift  { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }

        /* ── Hero word animations ──────────────────────── */
        .hw1 { animation: riseWord 1s cubic-bezier(.16,1,.3,1) .05s both; }
        .hw2 { animation: riseWord 1s cubic-bezier(.16,1,.3,1) .18s both; }
        .hw3 { animation: riseWord 1s cubic-bezier(.16,1,.3,1) .31s both; }
        .hw4 { animation: riseWord 1s cubic-bezier(.16,1,.3,1) .44s both; }
        .hs1 { animation: fadeSlide .9s ease .55s both; }
        .hs2 { animation: fadeUp   .9s ease .68s both; }
        .hs3 { animation: fadeUp   .9s ease .80s both; }
        .logo-in { animation: scaleGlow 1.2s cubic-bezier(.34,1.56,.64,1) .2s both; }

        /* ── Reveal ────────────────────────────────────── */
        .reveal { opacity:0; transform:translateY(28px); transition:opacity .7s ease, transform .7s ease; }
        .reveal.visible { opacity:1; transform:none; }

        /* ── Marquees ──────────────────────────────────── */
        .marquee-track { display:flex; width:max-content; animation:marquee 22s linear infinite; }
        .marquee-events-track { display:flex; animation:marqueeH 45s linear infinite; will-change:transform; }
        .marquee-events-track:hover { animation-play-state:paused; }

        /* ── Stat card hover ───────────────────────────── */
        .stat-card { transition:all .3s; }
        .stat-card:hover { border-color:var(--blue)!important; background:rgba(0,212,255,.05)!important; transform:translateY(-4px); }

        /* ── Dept card hover ───────────────────────────── */
        .dept-card { transition:all .3s; }
        .dept-card:hover { transform:translateY(-6px); }
        .dept-icon { transition:all .35s; }
        .dept-card:hover .dept-icon { transform:scale(1.12); }

        /* ── CTA button glow ───────────────────────────── */
        .btn-primary { 
          background: var(--blue); color:#000;
          transition:all .3s;
          box-shadow: 0 0 30px rgba(0,212,255,.35);
        }
        .btn-primary:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 0 50px rgba(0,212,255,.55); }
        .btn-outline { 
          border:1.5px solid rgba(0,212,255,.55); color:var(--blue);
          transition:all .3s;
        }
        .btn-outline:hover { background:var(--blue); color:#000; border-color:var(--blue); transform:translateY(-2px); }

        /* ── Animated gradient headline ────────────────── */
        .grad-headline {
          background: linear-gradient(90deg, #00d4ff, #38bdf8, #ffffff, #00d4ff);
          background-size: 300% 300%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradShift 5s ease infinite;
        }

        /* ── Logo float ────────────────────────────────── */
        .logo-float { animation: floatY 6s ease-in-out infinite; }

        /* ── Mobile tweaks ─────────────────────────────── */
        @media (max-width:768px) {
          .hero-grid { grid-template-columns: 1fr !important; text-align:center; }
          .hero-logo-wrap { justify-content:center !important; margin-top:2rem; }
          .logo-ring-outer { width:260px!important; height:260px!important; }
          .logo-ring-mid   { width:200px!important; height:200px!important; }
          .logo-core       { width:160px!important; height:160px!important; }
          .hero-actions    { justify-content:center !important; }
          .hero-badge      { justify-content:center !important; }
        }
        @media (max-width:480px) {
          .hero-h1-size { font-size: clamp(2.6rem,12vw,4rem) !important; }
        }
      `}</style>

      <WaterSpaceCanvas />
      {deptModal && <DeptModal dept={deptModal} onClose={() => setDeptModal(null)} />}

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">

        {/* subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-[1]" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.018) 1px,transparent 1px)",
          backgroundSize: "72px 72px",
        }} />

        {/* main content — z-[2] so it sits above canvas */}
        <div className="relative z-[2] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 w-full">
          <div className="hero-grid grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">

            {/* ── LEFT: Text ───────────────────────────────── */}
            <div className="space-y-6 max-w-2xl">

              {/* pill badge */}
              <div className="hero-badge hs1 inline-flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-60" />
                  <span className="relative rounded-full h-2.5 w-2.5 bg-cyan-400" />
                </span>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.7rem", letterSpacing: "0.3em", color: "var(--blue)" }}>
                  SINCE 1955 · DHAKA, BANGLADESH
                </span>
              </div>

              {/* GIANT headline — 4 lines, each word a separate animation */}
              <div className="overflow-hidden leading-none space-y-0.5">
                <div className="overflow-hidden">
                  <h1 className="hw1 font-black hero-h1-size"
                    style={{ fontSize: "clamp(3.2rem,6.5vw,5.8rem)", fontFamily: "'Orbitron',sans-serif", color: "var(--white)", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                    WHERE
                  </h1>
                </div>
                <div className="overflow-hidden">
                  <h1 className="hw2 font-black hero-h1-size grad-headline"
                    style={{ fontSize: "clamp(3.2rem,6.5vw,5.8rem)", fontFamily: "'Orbitron',sans-serif", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                    CURIOSITY
                  </h1>
                </div>
                <div className="overflow-hidden">
                  <h1 className="hw3 font-black hero-h1-size"
                    style={{ fontSize: "clamp(3.2rem,6.5vw,5.8rem)", fontFamily: "'Orbitron',sans-serif", color: "var(--white)", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                    MEETS
                  </h1>
                </div>
                <div className="overflow-hidden">
                  <h1 className="hw4 font-black hero-h1-size"
                    style={{
                      fontSize: "clamp(3.2rem,6.5vw,5.8rem)", fontFamily: "'Orbitron',sans-serif",
                      lineHeight: 0.95, letterSpacing: "-0.02em",
                      color: "transparent", WebkitTextStroke: "1.5px var(--blue)",
                      filter: "drop-shadow(0 0 28px rgba(0,212,255,0.5))",
                    }}>
                    PURPOSE
                  </h1>
                </div>
              </div>

              {/* divider line */}
              <div className="hs1 flex items-center gap-4" style={{ animationDelay: "0.6s" }}>
                <div style={{ height: 1, width: 48, background: "linear-gradient(to right, var(--blue), transparent)" }} />
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.68rem", letterSpacing: "0.25em", color: "var(--muted)", textTransform: "uppercase" }}>
                  Science in Human Welfare
                </span>
              </div>

              {/* description — tight, impactful */}
              <p className="hs2 text-base sm:text-lg leading-relaxed"
                style={{ color: "var(--muted)", maxWidth: 440, animationDelay: "0.72s" }}>
                The <span style={{ color: "var(--white)", fontWeight: 700 }}>first college-level science club</span> in the Indian Subcontinent —
                shaping scientists, innovators &amp; leaders for <span style={{ color: "var(--blue)" }}>70 years</span>.
              </p>

              {/* CTAs */}
              <div className="hs3 hero-actions flex flex-wrap gap-4" style={{ animationDelay: "0.85s" }}>
                <Link href="/activities"
                  className="btn-primary group flex items-center gap-3 px-8 py-4 font-black text-sm tracking-widest rounded-2xl"
                  style={{ fontFamily: "'Orbitron',sans-serif" }}>
                  Explore Activities
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/members"
                  className="btn-outline flex items-center gap-3 px-8 py-4 font-black text-sm tracking-widest rounded-2xl"
                  style={{ fontFamily: "'Orbitron',sans-serif" }}>
                  Join NDSC
                </Link>
              </div>
            </div>

            {/* ── RIGHT: Logo ──────────────────────────────── */}
            <div className="hero-logo-wrap logo-in flex justify-center lg:justify-end">
              <div className="logo-float relative flex items-center justify-center"
                style={{ width: 400, height: 400 }}>

                {/* outermost dashed orbit */}
                <div className="absolute rounded-full logo-ring-outer"
                  style={{
                    width: 400, height: 400,
                    border: "1px dashed rgba(0,212,255,0.12)",
                    animation: "spinSlow 70s linear infinite",
                  }}>
                  {[0, 90, 180, 270].map((deg, i) => (
                    <div key={i} style={{
                      position: "absolute", top: "50%", left: "50%",
                      width: i % 2 === 0 ? 7 : 4, height: i % 2 === 0 ? 7 : 4,
                      borderRadius: "50%",
                      background: i % 2 === 0 ? "var(--blue)" : "rgba(0,212,255,0.4)",
                      boxShadow: i % 2 === 0 ? "0 0 10px var(--blue)" : "none",
                      transform: `rotate(${deg}deg) translateX(199px) translateY(-50%)`,
                    }} />
                  ))}
                </div>

                {/* mid ring */}
                <div className="absolute rounded-full logo-ring-mid"
                  style={{
                    width: 318, height: 318,
                    top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    animation: "spinRev 45s linear infinite",
                  }}>
                  {[60, 180, 300].map((deg, i) => (
                    <div key={i} style={{
                      position: "absolute", top: "50%", left: "50%",
                      width: 5, height: 5, borderRadius: "50%",
                      background: "rgba(0,212,255,0.6)",
                      transform: `rotate(${deg}deg) translateX(158px) translateY(-50%)`,
                    }} />
                  ))}
                </div>

                {/* core glow ring */}
                <div className="absolute rounded-full logo-core overflow-hidden"
                  style={{
                    width: 240, height: 240,
                    top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                    background: "radial-gradient(circle at 38% 32%, rgba(0,50,90,0.9), rgba(0,4,12,0.97))",
                    animation: "borderCycle 3.5s ease infinite",
                    border: "2px solid rgba(0,212,255,0.4)",
                  }}>
                  {/* scan line */}
                  <div className="absolute left-0 right-0" style={{
                    height: 2, top: 0,
                    background: "linear-gradient(90deg,transparent,rgba(0,212,255,0.5),transparent)",
                    animation: "scanV 3s linear infinite",
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image src="/images/logo-2.0.png" alt="NDSC" width={185} height={185}
                      className="object-contain"
                      style={{ filter: "drop-shadow(0 0 22px rgba(0,212,255,0.65))", animation: "spinSlow 28s linear infinite" }}
                      priority />
                  </div>
                </div>

                {/* arc SVG label */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
                  <defs>
                    <path id="arc1" d="M 60,200 A 140,140 0 1,1 340,200" />
                    <path id="arc2" d="M 80,215 A 120,120 0 0,0 320,215" />
                  </defs>
                  <text fontSize="9.5" letterSpacing="5" fill="rgba(0,212,255,0.3)" fontFamily="'Share Tech Mono',monospace" textAnchor="middle">
                    <textPath href="#arc1" startOffset="50%">SCIENCE IN HUMAN WELFARE • 1955–2025 •</textPath>
                  </text>
                </svg>

                {/* 70 years badge */}
                <div className="absolute rounded-full flex items-center justify-center"
                  style={{
                    width: 72, height: 72, bottom: 26, right: 18,
                    background: "rgba(2,8,16,0.96)",
                    border: "2px solid var(--blue)",
                    boxShadow: "0 0 24px rgba(0,212,255,0.45)",
                    animation: "pulse 2.5s ease infinite",
                  }}>
                  <div className="text-center leading-none">
                    <p className="font-black text-[22px]" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)" }}>70</p>
                    <p style={{ fontSize: 7, letterSpacing: "0.2em", color: "var(--muted)", textTransform: "uppercase" }}>YRS</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[2]">
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.45em", color: "rgba(0,212,255,0.4)", textTransform: "uppercase" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, position: "relative", background: "rgba(0,212,255,0.12)", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "100%", height: "45%", background: "linear-gradient(to bottom,transparent,var(--blue))", animation: "scanV 1.8s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          MARQUEE
      ════════════════════════════════════════════════════════ */}
      <div className="w-full overflow-hidden py-3.5 relative z-10" style={{ background: "var(--blue)" }}>
        <div className="marquee-track">
          {Array(16).fill("✦ LEGACY OF 70 YEARS").map((t, i) => (
            <span key={i} className="mx-8 font-black text-sm tracking-[.3em] whitespace-nowrap text-black"
              style={{ fontFamily: "'Orbitron',sans-serif" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          STATS
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-16" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => (
              <div key={s.label} className="reveal stat-card text-center p-5 sm:p-8 rounded-2xl border cursor-default"
                style={{ borderColor: "var(--border)", background: "var(--card)", animationDelay: `${i * 0.1}s` }}>
                <p className="text-3xl sm:text-5xl font-black mb-2"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", filter: "drop-shadow(0 0 12px var(--glow))" }}>
                  {s.num}
                </p>
                <p className="text-xs tracking-wider uppercase" style={{ color: "var(--muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          LEADERSHIP
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionLabel>Leadership</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-black mb-10 reveal"
            style={{ fontFamily: "'Orbitron',sans-serif" }}>
            WORD FROM <span style={{ color: "var(--blue)" }}>LEADERSHIP</span>
          </h2>
          <div className="space-y-6">
            {QUOTES.map((q) => (
              <div key={q.role} className="reveal rounded-2xl border p-6 sm:p-8 lg:p-10"
                style={{ borderColor: "rgba(0,212,255,.2)", background: "rgba(0,212,255,.03)" }}>
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
                  <div className="flex-shrink-0 flex flex-col items-center lg:items-start text-center lg:text-left w-full lg:w-64">
                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden mb-4 shadow-xl"
                      style={{ border: "3px solid var(--blue)" }}>
                      <Image src={q.image} alt={q.name} fill className="object-cover" />
                    </div>
                    <h4 className="text-lg font-black" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--white)" }}>{q.name}</h4>
                    <p className="font-semibold text-sm mt-1" style={{ color: "var(--blue)" }}>{q.role}</p>
                  </div>
                  <div className="flex-1 pt-1">
                    <Quote size={26} className="mb-3" style={{ color: "var(--blue)", opacity: 0.35 }} />
                    <p className="text-sm sm:text-base leading-relaxed italic" style={{ color: "var(--muted)" }}>"{q.full}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          DEPARTMENTS
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-20" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="reveal" style={{ display: "flex", justifyContent: "center" }}>
              <SectionLabel>Structure</SectionLabel>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              OUR <span style={{ color: "var(--blue)" }}>DEPARTMENTS</span>
            </h2>
            <p className="text-sm mt-3 max-w-xl mx-auto reveal" style={{ color: "var(--muted)" }}>
              Click on a department to learn more.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
            {DEPTS.map((d, i) => (
              <button key={d.name} onClick={() => setDeptModal(d)}
                className="reveal dept-card group flex flex-col items-center gap-4 p-6 sm:p-8 rounded-3xl border"
                style={{ borderColor: "var(--border)", background: "var(--card)", animationDelay: `${i * 0.08}s` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = d.color; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                <div className="dept-icon relative w-20 h-20 sm:w-24 sm:h-24">
                  <Image src={d.icon} alt={d.name} fill className="object-contain"
                    style={{ filter: `drop-shadow(0 0 10px ${d.color})` }} />
                </div>
                <p className="text-base sm:text-lg font-black tracking-wider text-center"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: i % 2 === 0 ? "var(--blue)" : "#a78bfa" }}>
                  {d.short}
                </p>
                <p className="text-xs text-center line-clamp-2 px-2" style={{ color: "var(--muted)" }}>{d.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          VIDEOS
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel>Media</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-black mb-10 reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            SCIENCE <span style={{ color: "var(--blue)" }}>MEDIA</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl overflow-hidden border"
              style={{ borderColor: "var(--border)", aspectRatio: "16/9" }}>
              <iframe width="100%" height="100%"
                src={`https://www.youtube.com/embed/${VIDEOS[activeVideo].id}`}
                title="NDSC" frameBorder="0" allowFullScreen />
            </div>
            <div className="flex flex-col gap-3">
              {VIDEOS.map((v, i) => (
                <button key={i} onClick={() => setActiveVideo(i)}
                  className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:-translate-y-0.5"
                  style={{ borderColor: activeVideo === i ? "var(--blue)" : "var(--border)", background: activeVideo === i ? "#00d4ff11" : "var(--card)" }}>
                  <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 72, height: 45 }}>
                    <Image src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`} alt={v.title} fill className="object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={14} className="fill-white text-white" />
                    </div>
                  </div>
                  <p className="text-xs font-medium" style={{ color: activeVideo === i ? "var(--blue)" : "var(--white)" }}>{v.title}</p>
                </button>
              ))}
              <a href="https://www.youtube.com/@NDSCOfficial" target="_blank" rel="noopener noreferrer"
                className="mt-auto py-3 text-center text-xs font-black tracking-widest border rounded-xl transition-all hover:bg-[var(--blue)] hover:text-black"
                style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
                VIEW ALL VIDEOS →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          EVENTS
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="reveal" style={{ display: "flex", justifyContent: "center" }}>
              <SectionLabel>Recent</SectionLabel>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              LATEST <span style={{ color: "var(--blue)" }}>EVENTS</span>
            </h2>
          </div>
          <div className="relative max-w-[1280px] mx-auto rounded-3xl border p-8"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="overflow-hidden">
              <div className="flex gap-6 marquee-events-track">
                {[...EVENTS, ...EVENTS].map((ev, i) => (
                  <a key={i} href={ev.href} target="_blank" rel="noopener noreferrer"
                    className="group flex-shrink-0 rounded-2xl overflow-hidden border transition-all"
                    style={{ width: 320, borderColor: "var(--border)", background: "var(--bg2)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                    <div className="relative overflow-hidden" style={{ height: 200 }}>
                      <Image src={ev.img} alt={ev.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <span className="absolute bottom-4 left-4 text-xs font-mono tracking-widest" style={{ color: "var(--muted)" }}>{ev.date}</span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-sm font-bold leading-tight mb-3 line-clamp-2 group-hover:text-[var(--blue)] transition-colors">{ev.title}</h3>
                      <span className="text-xs font-bold" style={{ color: "var(--blue)" }}>Learn More →</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
            <button onClick={() => { const el = document.querySelector('.marquee-events-track') as HTMLElement; if (el) el.style.animationPlayState = 'paused'; }}
              className="absolute -left-5 top-1/2 -translate-y-1/2 p-4 rounded-full border text-lg z-20 transition-all hover:scale-110"
              style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>←</button>
            <button onClick={() => { const el = document.querySelector('.marquee-events-track') as HTMLElement; if (el) el.style.animationPlayState = el.style.animationPlayState === 'paused' ? 'running' : 'paused'; }}
              className="absolute -right-5 top-1/2 -translate-y-1/2 p-4 rounded-full border text-lg z-20 transition-all hover:scale-110"
              style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>→</button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          PUBLICATION CTA
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="reveal rounded-2xl border overflow-hidden p-8 sm:p-14 flex flex-col sm:flex-row items-center gap-8 sm:gap-12"
            style={{ borderColor: "var(--blue)", background: "linear-gradient(135deg,rgba(0,212,255,0.04),rgba(0,119,255,0.04))" }}>
            <div className="flex-1">
              <SectionLabel>Annual Magazine</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Orbitron',sans-serif" }}>
                অদ্রি <span style={{ color: "var(--blue)" }}>(AUDRI)</span>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)" }}>
                Annual science publication — articles on Quantum Entanglement, CRISPR, Neural Networks, and more.
              </p>
              <Link href="/publication"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-black text-sm tracking-widest rounded-xl"
                style={{ fontFamily: "'Orbitron',sans-serif" }}>
                <BookOpen size={15} /> Read AUDRI
              </Link>
            </div>
            <div className="shrink-0">
              <Image src="/images/Audri-24.jpeg" alt="AUDRI" width={180} height={240}
                className="rounded-xl object-cover shadow-2xl"
                style={{ filter: "drop-shadow(0 0 30px var(--glow))" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FINAL CTA
      ════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,212,255,0.05) 0%, transparent 70%)",
        }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="reveal" style={{ display: "flex", justifyContent: "center" }}>
            <SectionLabel>Join Us</SectionLabel>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black mb-5 reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            BE PART OF THE <span style={{ color: "var(--blue)" }}>LEGACY</span>
          </h2>
          <p className="text-sm sm:text-base leading-relaxed mb-8 reveal" style={{ color: "var(--muted)" }}>
            Join thousands of science enthusiasts, participate in olympiads, workshops, and events.
          </p>
          <div className="flex flex-wrap gap-4 justify-center reveal">
            <Link href="/members"
              className="btn-primary px-7 py-4 font-black text-sm tracking-widest rounded-xl"
              style={{ fontFamily: "'Orbitron',sans-serif" }}>
              BECOME A MEMBER
            </Link>
            <Link href="/olympiad"
              className="btn-outline flex items-center gap-2 px-7 py-4 font-black text-sm tracking-widest rounded-xl"
              style={{ fontFamily: "'Orbitron',sans-serif" }}>
              <Trophy size={15} /> TAKE OLYMPIAD
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
