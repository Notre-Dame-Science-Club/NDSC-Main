"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, BookOpen, Quote, Play, ChevronRight } from "lucide-react";

/* ══════════════════════════════════════════════════════════
   ATOM CANVAS
══════════════════════════════════════════════════════════ */
function AtomCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = 340, H = 340, t = 0, animId: number;
    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", resize); resize();
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38;
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.18);
      ng.addColorStop(0, "rgba(0,212,255,0.9)"); ng.addColorStop(0.5, "rgba(0,119,255,0.5)"); ng.addColorStop(1, "rgba(0,212,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
      [
        { tilt: 0, speed: 1.0, color: "rgba(0,212,255,0.5)" },
        { tilt: Math.PI / 3, speed: 1.4, color: "rgba(0,119,255,0.4)" },
        { tilt: -Math.PI / 3, speed: 0.7, color: "rgba(167,139,250,0.4)" },
      ].forEach(({ tilt, speed, color }, oi) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
        ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
        const angle = t * speed + (oi * Math.PI * 2) / 3;
        const ex = Math.cos(angle) * R, ey = Math.sin(angle) * R * 0.35;
        const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10);
        eg.addColorStop(0, "rgba(0,212,255,1)"); eg.addColorStop(0.4, "rgba(0,150,255,0.7)"); eg.addColorStop(1, "rgba(0,212,255,0)");
        ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.restore();
      });
      t += 0.018; animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute pointer-events-none z-[1] opacity-30" style={{ width: 320, height: 320, top: "10%", right: "2%" }} />;
}

/* ══════════════════════════════════════════════════════════
   HERO TICKER
══════════════════════════════════════════════════════════ */
function HeroTicker() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/admin/homepage-settings").then(r => r.json()).then(d => setSettings(d)).catch(() => {});
  }, []);
  if (!settings.last_event_label && !settings.next_event_label) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-1" style={{ animation: "tickerIn 0.6s ease both", animationDelay: "1s" }}>
      {settings.last_event_label && (
        <a href={settings.last_event_url || "/activities"} className="ticker-pill">
          <span style={{ color: "var(--muted)" }}>◷</span>{settings.last_event_label}
        </a>
      )}
      {settings.next_event_label && (
        <a href={settings.next_event_url || "/activities"} className="ticker-pill"
          style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.06)", color: "var(--accent2)" }}>
          <span>◈</span>{settings.next_event_label}
        </a>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════════════════ */
function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem("ndsc-theme") || "dark";
    setDark(t === "dark");
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    localStorage.setItem("ndsc-theme", next);
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  };
  return (
    <button onClick={toggle} className="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
      {dark ? "☀" : "🌙"}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   WATER RIPPLE + DEEP SPACE BACKGROUND CANVAS
══════════════════════════════════════════════════════════════ */
function WaterSpaceCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number, W = 0, H = 0, t = 0;
    interface Star { x: number; y: number; r: number; o: number; tw: number }
    let stars: Star[] = [];
    const resize = () => {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; stars = [];
      for (let i = 0; i < 180; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, o: Math.random(), tw: Math.random() * Math.PI * 2 });
    };
    resize(); window.addEventListener("resize", resize);
    const ripples = [
      { cx: 0.5, cy: 0.75, amp: 18, freq: 0.012, speed: 0.7 },
      { cx: 0.3, cy: 0.85, amp: 10, freq: 0.018, speed: 0.5 },
      { cx: 0.7, cy: 0.8, amp: 12, freq: 0.015, speed: 0.6 },
    ];
    const draw = () => {
      t += 0.016; ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000408"); bg.addColorStop(0.45, "#020c1a"); bg.addColorStop(0.7, "#030e20"); bg.addColorStop(1, "#000204");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const paintNebula = (x: number, y: number, rx: number, ry: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        g.addColorStop(0, color); g.addColorStop(1, "transparent");
        ctx.save(); ctx.scale(1, ry / rx); ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y * (rx / ry), rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      };
      paintNebula(W * 0.2, H * 0.25, 320, 180, "rgba(0,80,160,0.09)");
      paintNebula(W * 0.8, H * 0.3, 260, 160, "rgba(0,180,255,0.06)");
      paintNebula(W * 0.5, H * 0.5, 400, 250, "rgba(0,40,100,0.05)");
      for (const s of stars) {
        s.tw += 0.015; const ao = 0.3 + 0.7 * Math.abs(Math.sin(s.tw));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + Math.round(75 * ao)},${220 + Math.round(35 * ao)},255,${ao * 0.85})`; ctx.fill();
      }
      const waterTop = H * 0.6, rows = 90, rowH = (H - waterTop) / rows;
      for (let row = 0; row < rows; row++) {
        const y = waterTop + row * rowH, depth = row / rows;
        const cols = Math.max(8, Math.round(60 - depth * 40)), segW = W / cols;
        for (let col = 0; col < cols; col++) {
          const x = col * segW; let wave = 0;
          for (const rp of ripples) {
            const dx = x / W - rp.cx, dy = (y / H - rp.cy) * 2, dist = Math.sqrt(dx * dx + dy * dy);
            wave += rp.amp * Math.sin(dist * W * rp.freq - t * rp.speed) * Math.exp(-dist * 3.5);
          }
          wave *= (1 - depth);
          const intensity = Math.max(0, Math.sin(wave * 0.3 + t * 0.4) * 0.5 + 0.5);
          const alpha = (0.04 + intensity * 0.18) * (1 - depth * 0.8);
          ctx.fillStyle = `rgba(${Math.round(intensity * 20)},${Math.round(60 + intensity * 140 - depth * 40)},${Math.round(120 + intensity * 135 - depth * 30)},${alpha})`;
          ctx.fillRect(x, y + wave * depth * 0.3, segW + 1, rowH + 1);
        }
      }
      const horizGrad = ctx.createLinearGradient(0, 0, W, 0);
      horizGrad.addColorStop(0, "transparent"); horizGrad.addColorStop(0.2, "rgba(0,200,255,0.12)");
      horizGrad.addColorStop(0.5, "rgba(0,212,255,0.22)"); horizGrad.addColorStop(0.8, "rgba(0,200,255,0.12)"); horizGrad.addColorStop(1, "transparent");
      ctx.fillStyle = horizGrad; ctx.fillRect(0, waterTop - 1, W, 3 + Math.sin(t * 0.5) * 1);
      for (let i = 0; i < 5; i++) {
        const lx = W * (0.1 + i * 0.2 + Math.sin(t * 0.1 + i) * 0.04);
        const lg = ctx.createLinearGradient(lx, waterTop, lx, H);
        lg.addColorStop(0, `rgba(0,200,255,${0.04 + Math.sin(t * 0.3 + i) * 0.02})`); lg.addColorStop(1, "transparent");
        ctx.fillStyle = lg; ctx.beginPath();
        ctx.moveTo(lx - 40, waterTop); ctx.lineTo(lx + 40, waterTop); ctx.lineTo(lx + 10, H); ctx.lineTo(lx - 10, H);
        ctx.closePath(); ctx.fill();
      }
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "transparent"); vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
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
  { num: "70+", label: "Years of Legacy" },
  { num: "20,000+", label: "Members & Alumni" },
  { num: "1,000+", label: "Workshops & Sessions" },
  { num: "1st", label: "Science Club in S. Asia" },
];

const DEPTS = [
  { name: "Administration", icon: "/images/admininstration-icon.png", short: "Administration", color: "#00d4ff", desc: "Ensures smooth operation and management of club activities. Coordinates planning, logistics and execution of events." },
  { name: "Project", icon: "/images/project.png", short: "Project", color: "#34d399", desc: "Conducts scientific research and innovation-based projects. Encourages experimentation and analytical development." },
  { name: "Publication", icon: "/images/publication.png", short: "Publication", color: "#00d4ff", desc: "Handles graphics, publishes wall magazines, journals and annual publications (AUDRI). Promotes scientific writing." },
  { name: "ICT", icon: "/images/ict.png", short: "ICT", color: "#34d399", desc: "Handles digital media, website management and tech support. Maintains digital infrastructure of the club." },
  { name: "LWS", icon: "/images/lws.png", short: "LWS", color: "#00d4ff", desc: "Life & Welfare Science — biology, environment and health oriented activities and awareness programs." },
  { name: "Quiz", icon: "/images/quiz.png", short: "Quiz", color: "#34d399", desc: "Hosts Q-League, BrainRain, Scienceophile. NDC Blue, NDC Green & NDC Gold — NDSC's prestigious quiz teams." },
];

const QUOTES = [
  {
    role: "Moderator",
    name: "Dr. Vincent Titas Rozario",
    image: "/images/Titas-sir.jpg",
    full: "Notre Dame Science Club, since its founding in 1955 by the eminent scientist Fr. Richard William Timm, C.S.C., has exemplified the spirit of scientific curiosity and service to humanity. The club's motto — 'Science in Human Welfare' — is not merely a slogan but a living commitment that guides every activity, publication, and event we organize. I am proud to guide this generation of science enthusiasts as they carry forward a 70-year legacy of excellence, innovation, and national pride.",
    link: "/about#moderator",
  },
  {
    role: "General Secretary",
    name: "Fahim Faisal Arnob",
    image: "/images/panel-26/gs.jpg",
    full: "Notre Dame Science Club has always been more than just a club — it is a family, a community of dreamers and doers. NDSC is a pioneer in the Indian Subcontinent for organizing its annual and government-supported science festivals. Through national olympiads, weekly workshops, Science Sundays, research projects, and innovative STEM activities, NDSC nurtures young minds to become future scientists, innovators, and leaders.",
    link: "/about#gs",
  },
];

/* ══════════════════════════════════════════════════════════════
   SCIENCE MEDIA — dynamic from DB
══════════════════════════════════════════════════════════════ */
type MediaVideo = { id: string; title: string; youtube_url: string; display_order: number };

function extractYouTubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : url;
}

function ScienceMediaSection() {
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [active, setActive] = useState(0);
  const [title, setTitle] = useState("Check Out Our Science Media");

  useEffect(() => {
    fetch("/api/science-media").then(r => r.json()).then((d: MediaVideo[]) => { if (Array.isArray(d) && d.length) setVideos(d); });
    fetch("/api/admin/homepage-settings").then(r => r.json()).then(d => { if (d?.science_media_title) setTitle(d.science_media_title); });
  }, []);

  if (videos.length === 0) return null;
  const activeId = extractYouTubeId(videos[active]?.youtube_url || "");
  const words = title.split(" ");

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionLabel>Media</SectionLabel>
        <h2 className="text-2xl sm:text-3xl font-black mb-10 reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          {words.map((w, i) => (
            <span key={i} style={{ color: i >= words.length - 2 ? "var(--blue)" : undefined }}>{w} </span>
          ))}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", aspectRatio: "16/9" }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${activeId}`} title="NDSC" frameBorder="0" allowFullScreen />
          </div>
          <div className="flex flex-col gap-3">
            {videos.map((v, i) => {
              const vid = extractYouTubeId(v.youtube_url);
              return (
                <button key={v.id} onClick={() => setActive(i)}
                  className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:-translate-y-0.5"
                  style={{ borderColor: active === i ? "var(--blue)" : "var(--border)", background: active === i ? "#00d4ff11" : "var(--card)" }}>
                  <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 72, height: 45 }}>
                    <Image src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt={v.title} fill className="object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={14} className="fill-white text-white" />
                    </div>
                  </div>
                  <p className="text-xs font-medium" style={{ color: active === i ? "var(--blue)" : "var(--white)" }}>{v.title}</p>
                </button>
              );
            })}
            <a href="https://www.youtube.com/@NDSCOfficial" target="_blank" rel="noopener noreferrer"
              className="mt-auto py-3 text-center text-xs font-black tracking-widest border rounded-xl transition-all hover:bg-[var(--blue)] hover:text-black"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
              VIEW ALL VIDEOS →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   ACTIVITIES CAROUSEL — dynamic, swipeable
══════════════════════════════════════════════════════════════ */
type ActivitySession = {
  id: string; title: string; slug: string;
  cover_image_url: string | null; session_date: string | null;
  activity_types: { name: string; slug: string } | null;
};

function ActivitiesCarousel() {
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [current, setCurrent] = useState(0);
  const [activityTypes, setActivityTypes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const startX = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    fetch("/api/activity-sessions-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d); });
    fetch("/api/activity-types-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setActivityTypes(d); });
  }, []);

  const total = sessions.length;
  const prev = () => setCurrent(c => (c - 1 + total) % total);
  const next = () => setCurrent(c => (c + 1) % total);
  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; isDragging.current = true; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = startX.current - e.clientX;
    if (diff > 50) next(); else if (diff < -50) prev();
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) next(); else if (e.deltaX < -30) prev();
    }
  };

  if (sessions.length === 0) return null;

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
  };
  const getIdx = (offset: number) => (current + offset + total) % total;

  return (
    <section className="relative z-10 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="flex justify-center"><SectionLabel>Recent</SectionLabel></div>
          <h2 className="text-3xl sm:text-4xl font-black reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            OUR <span style={{ color: "var(--blue)" }}>ACTIVITIES</span>
          </h2>
          <p className="text-sm mt-3 reveal" style={{ color: "var(--muted)" }}>Swipe, drag or use arrows to explore</p>
        </div>

        <div className="relative select-none"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onWheel={onWheel} style={{ touchAction: "pan-y" }}>
          <div className="flex items-center justify-center gap-4 sm:gap-6" style={{ minHeight: 420, overflow: "hidden" }}>
            {([-1, 0, 1] as const).map(offset => {
              const s = sessions[getIdx(offset)];
              const isCurrent = offset === 0;
              return (
                <div key={`${s.id}-${offset}`}
                  onClick={() => { if (offset === -1) prev(); else if (offset === 1) next(); else window.location.href = `/activities/${s.slug}`; }}
                  className="relative rounded-2xl overflow-hidden border flex-shrink-0 cursor-pointer transition-all duration-500"
                  style={{
                    width: isCurrent ? "min(380px,82vw)" : "min(240px,45vw)",
                    height: isCurrent ? 400 : 300,
                    opacity: isCurrent ? 1 : 0.45,
                    transform: isCurrent ? "scale(1)" : "scale(0.92)",
                    borderColor: isCurrent ? "var(--blue)" : "var(--border)",
                    background: "var(--bg2)",
                    boxShadow: isCurrent ? "0 0 60px rgba(0,212,255,0.2)" : "none",
                  }}>
                  {s.cover_image_url ? (
                    <Image src={s.cover_image_url} alt={s.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,rgba(0,212,255,0.1),rgba(0,40,80,0.8))" }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", fontSize: 40 }}>NDSC</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {s.activity_types && (
                        <span className="text-xs font-mono tracking-widest px-2 py-1 rounded mb-2 inline-block"
                          style={{ background: "rgba(0,212,255,0.15)", color: "var(--blue)" }}>
                          {s.activity_types.name}
                        </span>
                      )}
                      <h3 className="text-lg font-black leading-tight mb-1">{s.title}</h3>
                      {s.session_date && <p className="text-xs" style={{ color: "var(--muted)" }}>{formatDate(s.session_date)}</p>}
                      <span className="text-xs font-bold mt-3 inline-block" style={{ color: "var(--blue)" }}>View Details →</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={prev}
            className="absolute left-0 sm:-left-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>←</button>
          <button onClick={next}
            className="absolute right-0 sm:-right-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>→</button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8 flex-wrap">
          {sessions.map((s, i) => (
            <button key={s.id} onClick={() => setCurrent(i)} className="rounded-full transition-all"
              style={{ width: i === current ? 24 : 8, height: 8, background: i === current ? "var(--blue)" : "rgba(0,212,255,0.25)" }} />
          ))}
        </div>

        {/* Activity type links */}
        {activityTypes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {activityTypes.map(t => (
              <a key={t.id} href={`/activities?type=${t.slug}`}
                className="px-5 py-2 rounded-full border text-xs font-black tracking-widest transition-all hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)", fontFamily: "'Orbitron',sans-serif" }}>
                {t.name}
              </a>
            ))}
            <a href="/activities"
              className="px-5 py-2 rounded-full border text-xs font-black tracking-widest transition-all hover:border-[var(--blue)]"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
              ALL ACTIVITIES →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUDRI CTA — dynamic latest cover from DB
══════════════════════════════════════════════════════════════ */
function AudriCTA() {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/publications?latest=true&category=annual_magazine")
      .then(r => r.json())
      .then(d => {
        const pub = Array.isArray(d) ? d[0] : d;
        if (pub?.cover_image_url) setCover(pub.cover_image_url);
      })
      .catch(() => {});
  }, []);

  return (
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
            <Image
              src={cover || "/images/Audri-24.jpeg"}
              alt="AUDRI" width={180} height={240}
              className="rounded-xl object-contain shadow-2xl"
              style={{ filter: "drop-shadow(0 0 30px rgba(0,212,255,0.4))" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── */
function DeptModal({ dept, onClose }: { dept: typeof DEPTS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.88)" }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: dept.color, background: "var(--bg2)" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xs font-bold" style={{ color: "var(--muted)" }}>✕</button>
        <div className="w-20 h-20 mx-auto mb-4 relative">
          <Image src={dept.icon} alt={dept.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 12px ${dept.color})` }} />
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
  const [deptModal, setDeptModal] = useState<typeof DEPTS[0] | null>(null);

  return (
    <>
      <style>{`
        @keyframes riseWord   { from{opacity:0;transform:translateY(60px) skewY(4deg);}to{opacity:1;transform:none;} }
        @keyframes fadeSlide  { from{opacity:0;transform:translateX(-24px);}to{opacity:1;transform:none;} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:none;} }
        @keyframes scaleGlow  { from{opacity:0;transform:scale(0.82);}to{opacity:1;transform:scale(1);} }
        @keyframes spinSlow   { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        @keyframes pulse      { 0%,100%{opacity:.55;}50%{opacity:1;} }
        @keyframes marquee    { from{transform:translateX(0);}to{transform:translateX(-50%);} }
        @keyframes scanV      { 0%{top:-4px;}100%{top:104%;} }
        @keyframes borderCycle{ 0%,100%{border-color:rgba(0,212,255,.3);box-shadow:0 0 40px rgba(0,212,255,.15);}50%{border-color:rgba(0,212,255,.75);box-shadow:0 0 80px rgba(0,212,255,.3);} }
        @keyframes floatY     { 0%,100%{transform:translateY(0);}50%{transform:translateY(-14px);} }
        @keyframes tickerIn   { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }

        .hero-badge-anim { animation:fadeSlide 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        .hero-word-anim  { display:inline-block; animation:riseWord 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-desc-anim  { animation:fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.65s both; }
        .hero-btn-anim   { animation:fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.85s both; }
        .hero-logo-anim  { animation:scaleGlow 1s cubic-bezier(0.22,1,0.36,1) 0.3s both; }
        .logo-float-anim { animation:floatY 5s ease-in-out infinite; }

        .reveal { opacity:0; transform:translateY(28px); transition:opacity .7s ease,transform .7s ease; }
        .reveal.visible { opacity:1; transform:none; }

        .marquee-track { display:flex; width:max-content; animation:marquee 22s linear infinite; }

        .stat-card { transition:all .3s; }
        .stat-card:hover { border-color:var(--blue)!important; background:rgba(0,212,255,.05)!important; transform:translateY(-4px); }

        .dept-card { transition:all .3s; }
        .dept-card:hover { transform:translateY(-6px); }
        .dept-icon { transition:all .35s; }
        .dept-card:hover .dept-icon { transform:scale(1.12); }

        .btn-primary { background:var(--blue); color:#000; transition:all .3s; box-shadow:0 0 30px rgba(0,212,255,.35); }
        .btn-primary:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 0 50px rgba(0,212,255,.55); }
        .btn-outline { border:1.5px solid rgba(0,212,255,.55); color:var(--blue); transition:all .3s; }
        .btn-outline:hover { background:var(--blue); color:#000; border-color:var(--blue); transform:translateY(-2px); }

        @media (max-width:480px) { .hero-h1-size { font-size:clamp(2.6rem,12vw,4rem)!important; } }
      `}</style>

      <WaterSpaceCanvas />
      {deptModal && <DeptModal dept={deptModal} onClose={() => setDeptModal(null)} />}

      {/* ════ HERO ════ */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-[1]" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.018) 1px,transparent 1px)",
          backgroundSize: "72px 72px",
        }} />
        <AtomCanvas />
        <div className="relative z-[2] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT */}
            <div className="flex flex-col gap-6">
              <div className="hero-badge-anim flex">
                <span className="ticker-pill">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  SINCE 1955 · DHAKA, BANGLADESH
                </span>
              </div>
              <div className="overflow-hidden">
                {[
                  { text: "Join the", color: "var(--white)", delay: "0.15s", outline: false },
                  { text: "Community", color: "var(--blue)", delay: "0.28s", outline: false },
                  { text: "of Science", color: "var(--white)", delay: "0.41s", outline: false },
                  { text: "Enthusiasts", color: "var(--white)", delay: "0.54s", outline: true },
                ].map((line, i) => (
                  <div key={i} className="overflow-hidden">
                    <h1 className="hero-word-anim hero-h1-size font-black block"
                      style={{
                        fontSize: "clamp(2.6rem,5.8vw,5.2rem)",
                        fontFamily: "'Montserrat','Orbitron',sans-serif",
                        lineHeight: 1.0, letterSpacing: "-0.02em",
                        animationDelay: line.delay,
                        color: line.outline ? "transparent" : line.color,
                        WebkitTextStroke: line.outline ? "1.5px var(--blue)" : undefined,
                        filter: line.color === "var(--blue)" ? "drop-shadow(0 0 20px rgba(0,212,255,0.5))" : undefined,
                      }}>
                      {line.text}
                    </h1>
                  </div>
                ))}
              </div>
              <div className="hero-desc-anim flex items-center gap-4">
                <div style={{ height: 1, width: 40, background: "linear-gradient(to right, var(--blue), transparent)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", letterSpacing: "0.28em", color: "var(--muted)", textTransform: "uppercase" }}>
                  Science in Human Welfare
                </span>
              </div>
              <p className="hero-desc-anim text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)", maxWidth: 420, animationDelay: "0.7s" }}>
                The <span style={{ color: "var(--white)", fontWeight: 600 }}>first college-level science club</span> in the
                Indian Subcontinent — shaping scientists, innovators &amp; leaders for{" "}
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>70 years</span>.
              </p>
              <div className="hero-btn-anim flex flex-wrap gap-4">
                <Link href="/activities"
                  className="btn-primary group flex items-center gap-3 px-7 py-3.5 font-black text-sm tracking-widest rounded-2xl"
                  style={{ fontFamily: "'Orbitron',sans-serif" }}>
                  View Activities <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/login"
                  className="btn-outline flex items-center gap-3 px-7 py-3.5 font-black text-sm tracking-widest rounded-2xl"
                  style={{ fontFamily: "'Orbitron',sans-serif" }}>
                  Join Us
                </Link>
              </div>
              <HeroTicker />
            </div>

            {/* RIGHT: 3D LOGO */}
            <div className="hero-logo-anim flex justify-center lg:justify-end">
              <div className="logo-float-anim relative flex items-center justify-center" style={{ width: 380, height: 380 }}>
                {/* Outer ring */}
                <div className="absolute rounded-full" style={{ width: 380, height: 380, border: "1px dashed rgba(0,212,255,0.14)", animation: "spinSlow 70s linear infinite" }}>
                  {[0, 72, 144, 216, 288].map((deg, i) => (
                    <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: i % 2 === 0 ? 7 : 4, height: i % 2 === 0 ? 7 : 4, borderRadius: "50%", background: i % 2 === 0 ? "var(--blue)" : "rgba(0,212,255,0.35)", boxShadow: i % 2 === 0 ? "0 0 10px var(--blue)" : "none", transform: `rotate(${deg}deg) translateX(189px) translateY(-50%)` }} />
                  ))}
                </div>
                {/* Mid ring */}
                <div className="absolute rounded-full" style={{ width: 296, height: 296, top: "50%", left: "50%", border: "1px solid rgba(0,212,255,0.2)", animation: "spinSlow 40s linear infinite reverse" }}>
                  {[45, 165, 285].map((deg, i) => (
                    <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: 5, height: 5, borderRadius: "50%", background: "rgba(0,212,255,0.6)", transform: `rotate(${deg}deg) translateX(147px) translateY(-50%)` }} />
                  ))}
                </div>
                {/* Core */}
                <div className="absolute rounded-full overflow-hidden flex items-center justify-center" style={{ width: 216, height: 216, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "radial-gradient(circle at 38% 32%, rgba(0,50,90,0.9), rgba(0,4,12,0.97))", animation: "borderCycle 3.5s ease infinite", border: "2px solid rgba(0,212,255,0.4)" }}>
                  <div className="absolute left-0 right-0" style={{ height: 2, top: 0, background: "linear-gradient(90deg,transparent,rgba(0,212,255,0.5),transparent)", animation: "scanV 3s linear infinite" }} />
                  <Image src="/images/logo-2.0.png" alt="NDSC" width={168} height={168} className="object-contain relative z-10"
                    style={{ filter: "drop-shadow(0 0 22px rgba(0,212,255,0.65))", animation: "spinSlow 28s linear infinite" }} priority />
                </div>
                {/* Arc text */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 380 380">
                  <defs><path id="arcHero" d="M 50,190 A 140,140 0 1,1 330,190" /></defs>
                  <text fontSize="9" letterSpacing="5" fill="rgba(0,212,255,0.28)" fontFamily="'Share Tech Mono',monospace" textAnchor="middle">
                    <textPath href="#arcHero" startOffset="50%">SCIENCE IN HUMAN WELFARE • 1955–2025 •</textPath>
                  </text>
                </svg>
                {/* 70yr badge */}
                <div className="absolute rounded-full flex items-center justify-center" style={{ width: 68, height: 68, bottom: 24, right: 16, background: "rgba(2,8,16,0.96)", border: "2px solid var(--blue)", boxShadow: "0 0 24px rgba(0,212,255,0.45)", animation: "pulse 2.5s ease infinite" }}>
                  <div className="text-center leading-none">
                    <p className="font-black" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", fontSize: 20 }}>70</p>
                    <p style={{ fontSize: 7, letterSpacing: "0.2em", color: "var(--muted)", textTransform: "uppercase" }}>YRS</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[2]">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.45em", color: "rgba(0,212,255,0.4)", textTransform: "uppercase" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, position: "relative", background: "rgba(0,212,255,0.12)", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "100%", height: "45%", background: "linear-gradient(to bottom,transparent,var(--blue))", animation: "scanV 1.8s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* ════ MARQUEE ════ */}
      <div className="w-full overflow-hidden py-3.5 relative z-10" style={{ background: "var(--blue)" }}>
        <div className="marquee-track">
          {Array(16).fill("✦ LEGACY OF 70 YEARS").map((txt, i) => (
            <span key={i} className="mx-8 font-black text-sm tracking-[.3em] whitespace-nowrap text-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>{txt}</span>
          ))}
        </div>
      </div>

      {/* ════ STATS ════ */}
      <section className="relative z-10 py-16" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => (
              <div key={s.label} className="reveal stat-card text-center p-5 sm:p-8 rounded-2xl border cursor-default"
                style={{ borderColor: "var(--border)", background: "var(--card)", animationDelay: `${i * 0.1}s` }}>
                <p className="text-3xl sm:text-5xl font-black mb-2" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", filter: "drop-shadow(0 0 12px var(--glow))" }}>{s.num}</p>
                <p className="text-xs tracking-wider uppercase" style={{ color: "var(--muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ VOICE OF LEADERS ════ */}
      <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg2)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="flex justify-center"><SectionLabel>Leadership</SectionLabel></div>
            <h2 className="text-2xl sm:text-3xl font-black reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              VOICE OF OUR <span style={{ color: "var(--blue)" }}>LEADERS</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {QUOTES.map((q) => (
              <div key={q.role} className="reveal rounded-2xl border p-6 sm:p-8 flex flex-col"
                style={{ borderColor: "rgba(0,212,255,.2)", background: "rgba(0,212,255,.03)" }}>
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden mb-3 shadow-xl" style={{ border: "3px solid var(--blue)" }}>
                    <Image src={q.image} alt={q.name} fill className="object-cover" />
                  </div>
                  <h4 className="text-base font-black" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--white)" }}>{q.name}</h4>
                  <p className="text-xs font-semibold mt-1" style={{ color: "var(--blue)" }}>{q.role}</p>
                </div>
                <div className="flex-1">
                  <Quote size={22} className="mb-2" style={{ color: "var(--blue)", opacity: 0.35 }} />
                  <p className="text-sm leading-relaxed italic line-clamp-4" style={{ color: "var(--muted)" }}>"{q.full}"</p>
                </div>
                <Link href={q.link} className="mt-4 text-xs font-black tracking-widest self-start" style={{ color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
                  READ MORE →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ DEPARTMENTS ════ */}
      <section className="relative z-10 py-20" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="flex justify-center"><SectionLabel>Structure</SectionLabel></div>
            <h2 className="text-3xl sm:text-4xl font-black reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              OUR <span style={{ color: "var(--blue)" }}>DEPARTMENTS</span>
            </h2>
            <p className="text-sm mt-3 max-w-xl mx-auto reveal" style={{ color: "var(--muted)" }}>Click on a department to learn more.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
            {DEPTS.map((d, i) => (
              <button key={d.name} onClick={() => setDeptModal(d)}
                className="reveal dept-card group flex flex-col items-center gap-4 p-6 sm:p-8 rounded-3xl border"
                style={{ borderColor: "var(--border)", background: "var(--card)", animationDelay: `${i * 0.08}s` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = d.color; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                <div className="dept-icon relative w-20 h-20 sm:w-24 sm:h-24">
                  <Image src={d.icon} alt={d.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 10px ${d.color})` }} />
                </div>
                <p className="text-base sm:text-lg font-black tracking-wider text-center"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: i % 2 === 0 ? "var(--blue)" : "#a78bfa" }}>{d.short}</p>
                <p className="text-xs text-center line-clamp-2 px-2" style={{ color: "var(--muted)" }}>{d.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SCIENCE MEDIA ════ */}
      <ScienceMediaSection />

      {/* ════ ACTIVITIES CAROUSEL ════ */}
      <ActivitiesCarousel />

      {/* ════ AUDRI CTA ════ */}
      <AudriCTA />

      {/* ════ FINAL CTA ════ */}
      <section className="relative z-10 py-20 sm:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,212,255,0.05) 0%, transparent 70%)" }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex justify-center"><SectionLabel>Join Us</SectionLabel></div>
          <h2 className="text-3xl sm:text-5xl font-black mb-5 reveal" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            BE PART OF THE <span style={{ color: "var(--blue)" }}>LEGACY</span>
          </h2>
          <p className="text-sm sm:text-base leading-relaxed mb-8 reveal" style={{ color: "var(--muted)" }}>
            Join thousands of science enthusiasts, participate in olympiads, workshops, and events.
          </p>
          <div className="flex flex-wrap gap-4 justify-center reveal">
            <Link href="/register" className="btn-primary px-7 py-4 font-black text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              BECOME A MEMBER
            </Link>
            <Link href="/olympiad" className="btn-outline flex items-center gap-2 px-7 py-4 font-black text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              <Trophy size={15} /> TAKE OLYMPIAD
            </Link>
          </div>
        </div>
      </section>

      <ThemeToggle />
    </>
  );
}