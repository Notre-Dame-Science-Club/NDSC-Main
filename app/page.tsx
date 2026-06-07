"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, BookOpen, ChevronRight, ChevronLeft } from "lucide-react";

/* ════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════ */
type ActivitySession = {
  id: string; title: string; slug: string;
  cover_image_url: string | null; session_date: string | null;
  youtube_url?: string | null;
  activity_types: { name: string; slug: string } | null;
};
type MediaVideo = { id: string; title: string; youtube_url: string; display_order: number };
type Executive = {
  id: string; full_name: string; position: string; panel: string;
  photo_url: string | null; session_year?: string;
  quote?: string; link?: string;
};

/* ════════════════════════════════════════════════════════════
   STATIC DATA
════════════════════════════════════════════════════════════ */
const STATS = [
  { num: "70+",    label: "Years of Legacy" },
  { num: "20,000+", label: "Members & Alumni" },
  { num: "1,000+", label: "Workshops & Sessions" },
  { num: "1st",   label: "Science Club in S. Asia" },
];

const DEPTS = [
  { name: "Administration", icon: "https://ndscbd.net/uploads/gallery/admininstration-icon.png", color: "#00d4ff",  bg: "rgba(0,212,255,0.07)",  border: "rgba(0,212,255,0.28)",  desc: "Ensures smooth operation and management. Coordinates planning, logistics and execution of events." },
  { name: "Project",        icon: "https://ndscbd.net/uploads/gallery/project-icon.png",        color: "#34d399",  bg: "rgba(52,211,153,0.07)", border: "rgba(52,211,153,0.28)", desc: "Conducts scientific research and innovation-based projects. Encourages experimentation." },
  { name: "Publication",    icon: "https://ndscbd.net/uploads/gallery/publication-icon.png",    color: "#a78bfa",  bg: "rgba(167,139,250,0.07)",border: "rgba(167,139,250,0.28)",desc: "Publishes wall magazines, AUDRI journal. Promotes scientific writing and creative expression." },
  { name: "ICT",            icon: "https://ndscbd.net/uploads/gallery/ict-icon.png",            color: "#f87171",  bg: "rgba(248,113,113,0.07)",border: "rgba(248,113,113,0.28)",desc: "Handles digital media, website management and emerging technology workshops." },
  { name: "LWS",            icon: "https://ndscbd.net/uploads/gallery/lws-icon.png",            color: "#f59e0b",  bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.28)", desc: "Life & Welfare Science — biology, environment and health oriented activities." },
  { name: "Quiz",           icon: "https://ndscbd.net/uploads/gallery/quiz-icon.png",           color: "#60a5fa",  bg: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.28)", desc: "Hosts Q-League, BrainRain, Scienceophile. NDC Blue, NDC Green & NDC Gold quiz teams." },
];

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function extractYouTubeId(url: string): string {
  const m = url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : url;
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

/* ════════════════════════════════════════════════════════════
   LETTER ANIMATION HOOK — slide in from left, loop, scroll-aware
════════════════════════════════════════════════════════════ */
function LetterAnim({
  text, className = "", style = {}, tag = "span", delay = 0, loop = true, loopInterval = 4000,
  slideDir = "left",
}: {
  text: string; className?: string; style?: React.CSSProperties;
  tag?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  delay?: number; loop?: boolean; loopInterval?: number;
  slideDir?: "left" | "up" | "right";
}) {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "hidden">("hidden");
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const inView = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HOLD_MS = 3000;   // visible for 3s
  const OUT_MS  = 700;    // exit anim duration
  const IN_MS   = 600;    // enter anim duration
  const GAP_MS  = 400;    // gap between out and next in

  const runCycle = useCallback(() => {
    if (!inView.current) return;
    setKey(k => k + 1);
    setPhase("in");
    timerRef.current = setTimeout(() => {
      setPhase("hold");
      timerRef.current = setTimeout(() => {
        setPhase("out");
        timerRef.current = setTimeout(() => {
          setPhase("hidden");
          timerRef.current = setTimeout(() => {
            if (inView.current) runCycle();
          }, GAP_MS);
        }, OUT_MS);
      }, HOLD_MS);
    }, IN_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inView.current) {
          inView.current = true;
          runCycle();
        } else if (!entry.isIntersecting) {
          inView.current = false;
          if (timerRef.current) clearTimeout(timerRef.current);
          setPhase("hidden");
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [runCycle]);

  const letters = text.split("");
  const Tag = tag as React.ElementType;

  const getTransform = (visible: boolean, i: number) => {
    if (visible) return "none";
    if (slideDir === "left")  return `translateX(-${18 + i * 2}px) rotate(-4deg)`;
    if (slideDir === "right") return `translateX(${18 + i * 2}px) rotate(4deg)`;
    return `translateY(20px) rotate(8deg)`;
  };

  const isVisible = phase === "in" || phase === "hold";
  const isOut     = phase === "out";

  return (
    <Tag ref={ref} className={className} style={style}>
      {letters.map((ch, i) => (
        <span
          key={`${key}-${i}`}
          style={{
            display: "inline-block",
            whiteSpace: ch === " " ? "pre" : undefined,
            opacity: isOut ? 0 : isVisible ? 1 : 0,
            transform: isOut
              ? (slideDir === "left" ? `translateX(${14 + i}px) rotate(3deg)` : slideDir === "right" ? `translateX(-${14 + i}px)` : `translateY(-14px)`)
              : isVisible ? "none" : getTransform(false, i),
            transition: isOut
              ? `opacity ${OUT_MS}ms ease ${i * 0.012}s, transform ${OUT_MS}ms ease ${i * 0.012}s`
              : isVisible
                ? `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 0.028}s, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 0.028}s`
                : "none",
          }}
        >{ch}</span>
      ))}
    </Tag>
  );
}

/* ════════════════════════════════════════════════════════════
   LOOPING PARAGRAPH — fades out every 4s then fades back in
════════════════════════════════════════════════════════════ */
function LoopingP({ children, className = "", style = {}, delay = 0 }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("out");
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HOLD_MS = 4000;
  const FADE_MS = 600;

  const cycle = useCallback(() => {
    if (!inView.current) return;
    setPhase("in");
    timerRef.current = setTimeout(() => {
      setPhase("hold");
      timerRef.current = setTimeout(() => {
        setPhase("out");
        timerRef.current = setTimeout(() => {
          if (inView.current) cycle();
        }, FADE_MS + 200);
      }, HOLD_MS);
    }, FADE_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !inView.current) {
        inView.current = true;
        setTimeout(cycle, delay * 1000);
      } else if (!entry.isIntersecting) {
        inView.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        setPhase("out");
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cycle, delay]);

  const isVisible = phase === "in" || phase === "hold";
  return (
    <p
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : "translateY(8px)",
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}
    >
      {children}
    </p>
  );
}


function GalaxyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number, W = 0, H = 0, t = 0;

    interface Star { x: number; y: number; r: number; tw: number; vx: number; vy: number; bright: boolean }
    interface Particle { x: number; y: number; vx: number; vy: number; r: number; life: number; maxLife: number; color: string }

    let stars: Star[] = [];
    let particles: Particle[] = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      stars = [];
      for (let i = 0; i < 320; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.6 + 0.15,
          tw: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.04,
          bright: Math.random() < 0.12,
        });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Nebula blobs
    const nebulae = [
      { cx: 0.15, cy: 0.2,  rx: 380, ry: 200, color: "rgba(0,100,200,0.055)" },
      { cx: 0.85, cy: 0.25, rx: 300, ry: 180, color: "rgba(0,200,255,0.04)" },
      { cx: 0.5,  cy: 0.55, rx: 420, ry: 240, color: "rgba(0,50,120,0.038)" },
      { cx: 0.25, cy: 0.75, rx: 260, ry: 140, color: "rgba(80,0,180,0.03)" },
      { cx: 0.75, cy: 0.7,  rx: 300, ry: 160, color: "rgba(0,180,120,0.025)" },
    ];

    const drawNebula = (nx: number, ny: number, rx: number, ry: number, color: string) => {
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(rx, ry));
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny * (rx / ry), rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Galaxy spiral arms
    const drawGalaxy = (cx: number, cy: number, maxR: number, rotation: number, alpha: number) => {
      const arms = 3, pointsPerArm = 120;
      for (let arm = 0; arm < arms; arm++) {
        const armAngle = (arm / arms) * Math.PI * 2 + rotation;
        for (let p = 0; p < pointsPerArm; p++) {
          const frac = p / pointsPerArm;
          const r = frac * maxR;
          const angle = armAngle + frac * Math.PI * 3.2 + t * 0.008;
          const spread = frac * maxR * 0.18 * (Math.random() - 0.5);
          const x = cx + (r + spread) * Math.cos(angle);
          const y = cy + (r + spread) * Math.sin(angle) * 0.42;
          const a = alpha * (1 - frac) * 0.9;
          if (a < 0.002) continue;
          ctx.beginPath();
          ctx.arc(x, y, frac < 0.1 ? 1.2 : 0.6, 0, Math.PI * 2);
          ctx.fillStyle = arm === 0
            ? `rgba(0,212,255,${a})`
            : arm === 1 ? `rgba(100,180,255,${a})` : `rgba(180,100,255,${a * 0.7})`;
          ctx.fill();
        }
      }
    };

    // Blackhole with accretion disk
    const drawBlackhole = (bx: number, by: number, br: number) => {
      // Event horizon
      const bh = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bh.addColorStop(0, "rgba(0,0,0,1)");
      bh.addColorStop(0.6, "rgba(0,0,4,0.95)");
      bh.addColorStop(1, "rgba(0,0,8,0)");
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = bh;
      ctx.fill();

      // Accretion disk rings
      for (let ring = 0; ring < 5; ring++) {
        const rr = br * (1.4 + ring * 0.4);
        const intensity = (1 - ring / 5) * 0.22;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(1, 0.3);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        const ag = ctx.createRadialGradient(0, 0, rr * 0.85, 0, 0, rr * 1.15);
        const hue = ring < 2 ? `rgba(255,${140 + ring * 30},0,${intensity})` : `rgba(0,212,255,${intensity * 0.6})`;
        ag.addColorStop(0, "transparent");
        ag.addColorStop(0.5, hue);
        ag.addColorStop(1, "transparent");
        ctx.strokeStyle = hue;
        ctx.lineWidth = 2 + ring;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Lensing glow
      const lg = ctx.createRadialGradient(bx, by, br * 0.8, bx, by, br * 3);
      lg.addColorStop(0, "rgba(0,180,255,0.08)");
      lg.addColorStop(0.4, "rgba(0,100,200,0.04)");
      lg.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(bx, by, br * 3, 0, Math.PI * 2);
      ctx.fillStyle = lg; ctx.fill();
    };

    // Electromagnetic wave
    const drawEMWave = (ox: number, oy: number, len: number, amp: number, freq: number, phase: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      for (let x = 0; x < len; x += 2) {
        const y = oy + amp * Math.sin((x / len) * Math.PI * freq * 2 + phase + t * 1.2);
        ctx.lineTo(ox + x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.18;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Shooting stars
    const shooters: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    const spawnShooter = () => {
      shooters.push({ x: Math.random() * W, y: Math.random() * H * 0.5, vx: 6 + Math.random() * 8, vy: 2 + Math.random() * 4, life: 0, maxLife: 50 + Math.random() * 30 });
    };
    let nextShooter = 120;

    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, W, H);

      // BG gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000306");
      bg.addColorStop(0.3, "#010a18");
      bg.addColorStop(0.65, "#020c20");
      bg.addColorStop(1, "#000204");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebulae
      nebulae.forEach(n => drawNebula(n.cx * W, n.cy * H, n.rx, n.ry, n.color));

      // Galaxy
      drawGalaxy(W * 0.72, H * 0.28, Math.min(W, H) * 0.32, t * 0.003, 0.9);
      drawGalaxy(W * 0.18, H * 0.65, Math.min(W, H) * 0.18, -t * 0.004 + 1.2, 0.5);

      // Blackhole
      drawBlackhole(W * 0.88, H * 0.78, 38);

      // Stars
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0;
        s.tw += 0.012;
        const ao = s.bright ? 0.5 + 0.5 * Math.abs(Math.sin(s.tw)) : 0.25 + 0.35 * Math.abs(Math.sin(s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.bright ? s.r * 1.4 : s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + Math.round(75 * ao)},${220 + Math.round(35 * ao)},255,${ao})`;
        ctx.fill();
        if (s.bright) {
          const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
          sg.addColorStop(0, `rgba(0,212,255,${ao * 0.25})`);
          sg.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }
      }

      // EM waves across screen
      drawEMWave(W * 0.05, H * 0.4, W * 0.4, 18, 3, 0, "rgba(0,212,255,1)");
      drawEMWave(W * 0.55, H * 0.55, W * 0.4, 14, 4, Math.PI, "rgba(100,180,255,1)");
      drawEMWave(W * 0.1,  H * 0.7,  W * 0.3, 10, 5, 0.5, "rgba(180,100,255,1)");

      // Shooting stars
      nextShooter--;
      if (nextShooter <= 0) { spawnShooter(); nextShooter = 80 + Math.random() * 160; }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        if (sh.life > sh.maxLife) { shooters.splice(i, 1); continue; }
        const prog = sh.life / sh.maxLife;
        const alpha = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7;
        const tail = 80;
        const grad = ctx.createLinearGradient(sh.x - sh.vx * (tail / sh.vx), sh.y - sh.vy * (tail / sh.vx), sh.x, sh.y);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, `rgba(180,230,255,${alpha * 0.9})`);
        ctx.beginPath();
        ctx.moveTo(sh.x - sh.vx * 12, sh.y - sh.vy * 12);
        ctx.lineTo(sh.x, sh.y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(sh.x, sh.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
      }

      // Water ripple lower half
      const waterTop = H * 0.62, rows = 80, rowH = (H - waterTop) / rows;
      const ripples = [
        { cx: 0.5, cy: 0.78, amp: 16, freq: 0.013, speed: 0.65 },
        { cx: 0.25, cy: 0.88, amp: 9, freq: 0.02, speed: 0.45 },
        { cx: 0.75, cy: 0.82, amp: 11, freq: 0.016, speed: 0.55 },
      ];
      for (let row = 0; row < rows; row++) {
        const y = waterTop + row * rowH, depth = row / rows;
        const cols = Math.max(6, Math.round(55 - depth * 38)), segW = W / cols;
        for (let col = 0; col < cols; col++) {
          const x = col * segW; let wave = 0;
          for (const rp of ripples) {
            const dx = x / W - rp.cx, dy = (y / H - rp.cy) * 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            wave += rp.amp * Math.sin(dist * W * rp.freq - t * rp.speed) * Math.exp(-dist * 3.5);
          }
          wave *= (1 - depth);
          const intensity = Math.max(0, Math.sin(wave * 0.3 + t * 0.4) * 0.5 + 0.5);
          const alpha = (0.03 + intensity * 0.14) * (1 - depth * 0.85);
          ctx.fillStyle = `rgba(${Math.round(intensity * 18)},${Math.round(55 + intensity * 130 - depth * 35)},${Math.round(110 + intensity * 130 - depth * 28)},${alpha})`;
          ctx.fillRect(x, y + wave * depth * 0.25, segW + 1, rowH + 1);
        }
      }
      const horizGrad = ctx.createLinearGradient(0, 0, W, 0);
      horizGrad.addColorStop(0, "transparent");
      horizGrad.addColorStop(0.3, "rgba(0,200,255,0.14)");
      horizGrad.addColorStop(0.5, "rgba(0,212,255,0.24)");
      horizGrad.addColorStop(0.7, "rgba(0,200,255,0.14)");
      horizGrad.addColorStop(1, "transparent");
      ctx.fillStyle = horizGrad;
      ctx.fillRect(0, waterTop - 1, W, 3 + Math.sin(t * 0.5) * 1);

      // Vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" />;
}

/* ════════════════════════════════════════════════════════════
   3D ATOM CANVAS
════════════════════════════════════════════════════════════ */
function AtomCanvas3D({ size = 340 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t = 0, animId: number;
    const W = size, H = size;
    canvas.width = W; canvas.height = H;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const R = W * 0.42;

      // Nucleus glow
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.16);
      ng.addColorStop(0, "rgba(0,212,255,1)");
      ng.addColorStop(0.4, "rgba(0,100,255,0.7)");
      ng.addColorStop(1, "rgba(0,212,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = ng; ctx.fill();

      // Nucleus particles
      for (let n = 0; n < 4; n++) {
        const na = (n / 4) * Math.PI * 2 + t * 0.5;
        const nr = R * 0.07;
        const nx = cx + nr * Math.cos(na), ny = cy + nr * Math.sin(na) * 0.6;
        ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = n % 2 === 0 ? "rgba(0,212,255,0.9)" : "rgba(255,180,0,0.9)";
        ctx.fill();
      }

      // Orbital planes
      const orbitals = [
        { tilt: 0,             tiltY: 0.32, speed: 1.0,  color: "rgba(0,212,255,0.55)",  eColor: "rgba(0,212,255,1)",    rScale: 1.0,  eDot: 4,   eGlow: 12 },
        { tilt: Math.PI/3,     tiltY: 0.28, speed: 1.55, color: "rgba(0,130,255,0.4)",   eColor: "rgba(80,180,255,1)",   rScale: 1.0,  eDot: 4,   eGlow: 12 },
        { tilt: -Math.PI/3,    tiltY: 0.26, speed: 0.72, color: "rgba(167,100,255,0.4)", eColor: "rgba(200,150,255,1)",  rScale: 0.72, eDot: 2.5, eGlow: 7  },
        { tilt: Math.PI/2,     tiltY: 0.22, speed: 1.2,  color: "rgba(0,255,180,0.3)",   eColor: "rgba(0,255,180,0.9)", rScale: 1.0,  eDot: 4,   eGlow: 12 },
      ];

      orbitals.forEach(({ tilt, tiltY, speed, color, eColor, rScale, eDot, eGlow }, oi) => {
        const oR = R * rScale;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);

        // Orbit ellipse
        ctx.beginPath();
        ctx.ellipse(0, 0, oR, oR * tiltY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 0.9; ctx.stroke();

        // Electron
        const angle = t * speed + (oi * Math.PI * 2) / orbitals.length;
        const ex = Math.cos(angle) * oR;
        const ey = Math.sin(angle) * oR * tiltY;

        // Electron trail
        for (let tr = 1; tr <= 8; tr++) {
          const ta = angle - tr * 0.18;
          const tx2 = Math.cos(ta) * oR, ty2 = Math.sin(ta) * oR * tiltY;
          ctx.beginPath(); ctx.arc(tx2, ty2, Math.max(0.1, (eDot - 0.5) - tr * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = eColor.replace("1)", `${(1 - tr / 9) * 0.4})`);
          ctx.fill();
        }

        // Electron glow
        const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, eGlow);
        eg.addColorStop(0, eColor);
        eg.addColorStop(0.4, eColor.replace("1)", "0.5)"));
        eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(ex, ey, eGlow, 0, Math.PI * 2);
        ctx.fillStyle = eg; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, eDot, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.restore();
      });

      t += 0.022;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [size]);
  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, opacity: 0.88 }}
      className="pointer-events-none"
    />
  );
}

/* ════════════════════════════════════════════════════════════
   3D LOGO RING (hero right side)
════════════════════════════════════════════════════════════ */
function LogoOrbit() {
  // Desktop: 513px (380 * 1.35), mobile keeps 300px
  return (
    <div className="logo-float logo-orbit-wrap relative flex items-center justify-center">
      {/* Outer ring */}
      <div className="absolute rounded-full logo-ring-outer" style={{ border: "1px dashed rgba(0,212,255,0.16)", animation: "spinSlow 70s linear infinite" }}>
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <div key={i} className="logo-dot-outer" style={{ position: "absolute", top: "50%", left: "50%", width: i % 2 === 0 ? 8 : 4, height: i % 2 === 0 ? 8 : 4, borderRadius: "50%", background: i % 2 === 0 ? "var(--blue)" : "rgba(0,212,255,0.4)", boxShadow: i % 2 === 0 ? "0 0 12px var(--blue)" : "none", transform: `rotate(${deg}deg) translateX(var(--orbit-outer-r)) translateY(-50%)` }} />
        ))}
      </div>
      {/* Mid ring */}
      <div className="absolute rounded-full logo-ring-mid" style={{ top: "50%", left: "50%", border: "1px solid rgba(0,212,255,0.22)", animation: "spinSlow 40s linear infinite reverse" }}>
        {[60, 180, 300].map((deg, i) => (
          <div key={i} className="logo-dot-mid" style={{ position: "absolute", top: "50%", left: "50%", width: 5, height: 5, borderRadius: "50%", background: "rgba(0,212,255,0.65)", boxShadow: "0 0 8px rgba(0,212,255,0.8)", transform: `rotate(${deg}deg) translateX(var(--orbit-mid-r)) translateY(-50%)` }} />
        ))}
      </div>
      {/* Inner ring */}
      <div className="absolute rounded-full logo-ring-inner" style={{ top: "50%", left: "50%", border: "1px solid rgba(167,139,250,0.18)", animation: "spinSlow 25s linear infinite" }} />
      {/* Core */}
      <div className="absolute rounded-full overflow-hidden flex items-center justify-center logo-core" style={{ top: "50%", left: "50%", background: "radial-gradient(circle at 38% 32%, rgba(0,50,90,0.92), rgba(0,4,12,0.97))", animation: "borderCycle 3.5s ease infinite", border: "2px solid rgba(0,212,255,0.45)" }}>
        <div className="absolute left-0 right-0" style={{ height: 2, top: 0, background: "linear-gradient(90deg,transparent,rgba(0,212,255,0.55),transparent)", animation: "scanV 2.8s linear infinite" }} />
        <Image src="/images/logo-2.0.svg" alt="NDSC 70 Years" width={230} height={230} className="object-contain relative z-10 logo-img" style={{ filter: "drop-shadow(0 0 24px rgba(0,212,255,0.7))", animation: "spinSlow 30s linear infinite" }} priority />
      </div>
      {/* Arc text */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 513 513">
        <defs><path id="arcHero" d="M 67,256 A 189,189 0 1,1 446,256" /></defs>
        <text fontSize="9" letterSpacing="5.5" fill="rgba(0,212,255,0.3)" fontFamily="'Share Tech Mono',monospace" textAnchor="middle">
          <textPath href="#arcHero" startOffset="50%">SCIENCE IN HUMAN WELFARE • 1955–2025 •</textPath>
        </text>
      </svg>
      {/* 70yr badge — right side, shows 70-logo image */}
      <div className="absolute rounded-full flex items-center justify-center logo-badge" style={{ background: "rgba(0,0,0,0.97)", border: "2px solid var(--blue)", boxShadow: "0 0 28px rgba(0,212,255,0.6)", animation: "pulse 2.5s ease infinite", overflow: "hidden" }}>
        <Image src="/images/70-logo.png" alt="NDSC 70 Years" width={56} height={56} className="object-contain p-1" style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.5))" }} />
      </div>
      {/* NDC logo badge — left side, mirrored position */}
      <div className="absolute rounded-full flex items-center justify-center logo-badge-ndc" style={{ background: "rgba(0,0,0,0.97)", border: "2px solid var(--blue)", boxShadow: "0 0 28px rgba(0,212,255,0.6)", animation: "pulse 2.5s ease infinite 0.8s", overflow: "hidden" }}>
        <Image src="/images/ndc-logo.svg" alt="Notre Dame College" width={56} height={56} className="object-contain p-1" style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.4))" }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HERO TICKER
════════════════════════════════════════════════════════════ */
function HeroTicker() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/admin/homepage-settings").then(r => r.json()).then(d => setSettings(d)).catch(() => {});
  }, []);
  if (!settings.last_event_label && !settings.next_event_label) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-1" style={{ animation: "fadeUp 0.7s ease 1.1s both" }}>
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

/* ════════════════════════════════════════════════════════════
   SECTION LABEL
════════════════════════════════════════════════════════════ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", fontFamily: "'Share Tech Mono',monospace", fontSize: "0.72rem", letterSpacing: "0.35em", color: "var(--blue)", textTransform: "uppercase" }}>
      <span style={{ display: "inline-block", width: 28, height: 1, background: "var(--blue)", flexShrink: 0 }} />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   REVEAL HOOK
════════════════════════════════════════════════════════════ */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } }),
      { threshold: 0.08, rootMargin: "-20px" }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ════════════════════════════════════════════════════════════
   PIONEER / ABOUT SECTION
════════════════════════════════════════════════════════════ */
function PioneerSection() {
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
                border: "1.5px solid rgba(0,212,255,0.25)",
                background: "var(--card)",
                boxShadow: "0 0 60px rgba(0,212,255,0.1)",
              }}
            >
              {founder?.photo_url ? (
                <Image src={founder.photo_url} alt={founder.full_name} fill className="object-cover object-top" />
              ) : (
                <Image
                  src="https://ndscbd.net/uploads/executives/1780729148_fe4addabb0f8.jpeg"
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
function LeadersSection() {
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
      img: "https://ndscbd.net/uploads/executives/1780621402_fdc8d88bf714.jpg",
    },
    {
      key: "gs",
      role: "General Secretary",
      name: "Fahim Faisal Arnob",
      img: "https://ndscbd.net/uploads/executives/1780619755_f8a427c9fe3d.jpg",
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
              <div key={key} className="reveal rounded-2xl border p-6 sm:p-8 flex flex-col" style={{ borderColor: "rgba(0,212,255,0.18)", background: "rgba(0,212,255,0.025)", animationDelay: key === "gs" ? "0.1s" : "0s" }}>
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
function DeptModal({ dept, onClose }: { dept: typeof DEPTS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl border p-8 text-center" style={{ borderColor: dept.color, background: "var(--bg2)" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xs font-bold" style={{ color: "var(--muted)" }}>✕</button>
        <div className="w-20 h-20 mx-auto mb-4 relative">
          <Image src={dept.icon} alt={dept.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 12px ${dept.color})` }} />
        </div>
        <h3 className="text-xl font-black mb-3" style={{ color: dept.color, fontFamily: "'Poppins',sans-serif" }}>{dept.name}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>{dept.desc}</p>
        <Link href="/about#departments" onClick={onClose} className="inline-block mt-5 px-5 py-2 rounded-lg text-xs font-black tracking-widest border" style={{ borderColor: dept.color, color: dept.color }}>
          Learn More →
        </Link>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ACTIVITIES CAROUSEL — dynamic, auto-advance
════════════════════════════════════════════════════════════ */
function ActivitiesCarousel() {
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [current, setCurrent] = useState(0);
  const [activityTypes, setActivityTypes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/activity-sessions-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d); });
    fetch("/api/activity-types-public").then(r => r.json()).then(d => { if (Array.isArray(d)) setActivityTypes(d); });
  }, []);

  const total = sessions.length;
  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  // Auto-advance every 2.8s
  useEffect(() => {
    if (isPaused || total === 0) return;
    const id = setInterval(next, 2800);
    autoRef.current = id;
    return () => clearInterval(id);
  }, [isPaused, total, next]);

  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; isDragging.current = true; setIsPaused(true); };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = startX.current - e.clientX;
    if (diff > 50) next(); else if (diff < -50) prev();
    setTimeout(() => setIsPaused(false), 3000);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) next(); else if (e.deltaX < -30) prev();
    }
  };

  if (sessions.length === 0) return null;
  const getIdx = (offset: number) => (current + offset + total) % total;

  const getCover = (s: ActivitySession) => {
    if (s.cover_image_url) return s.cover_image_url;
    if (s.youtube_url) {
      const vid = extractYouTubeId(s.youtube_url);
      return `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
    }
    return null;
  };

  return (
    <section className="relative z-10 py-20" style={{ background: "var(--bg2)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <div className="flex justify-center"><SectionLabel>Recent</SectionLabel></div>
          <LetterAnim text="Latest Activities" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800, color: "var(--white)" }} slideDir="up" />
          <LatestActivitiesSubtitle />
          <p className="text-xs mt-3 reveal" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.2em" }}>
            SWIPE · DRAG · USE ARROWS · AUTO-ADVANCES
          </p>
        </div>

        <div
          className="relative select-none"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{ touchAction: "pan-y" }}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-6" style={{ minHeight: 420, overflow: "hidden" }}>
            {([-1, 0, 1] as const).map(offset => {
              const s = sessions[getIdx(offset)];
              const isCurrent = offset === 0;
              const cover = getCover(s);
              return (
                <div
                  key={`${s.id}-${offset}`}
                  onClick={() => { if (offset === -1) prev(); else if (offset === 1) next(); else window.location.href = `/activities/${s.slug}`; }}
                  className="relative rounded-2xl overflow-hidden border flex-shrink-0 cursor-pointer transition-all duration-500"
                  style={{
                    width: isCurrent ? "min(380px,82vw)" : "min(240px,45vw)",
                    height: isCurrent ? 400 : 290,
                    opacity: isCurrent ? 1 : 0.42,
                    transform: isCurrent ? "scale(1)" : "scale(0.91)",
                    borderColor: isCurrent ? "var(--blue)" : "var(--border)",
                    background: "var(--bg2)",
                    boxShadow: isCurrent ? "0 0 70px rgba(0,212,255,0.18)" : "none",
                    transition: "all 0.5s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  {cover ? (
                    <Image src={cover} alt={s.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(0,212,255,0.1),rgba(0,40,80,0.8))" }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)", fontSize: 40 }}>NDSC</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {s.activity_types && (
                        <span className="text-xs tracking-widest px-2 py-1 rounded mb-2 inline-block" style={{ background: "rgba(0,212,255,0.15)", color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace" }}>
                          {s.activity_types.name}
                        </span>
                      )}
                      <h3 className="text-lg font-bold leading-tight mb-1" style={{ fontFamily: "'Poppins',sans-serif" }}>{s.title}</h3>
                      {s.session_date && <p className="text-xs" style={{ color: "var(--muted)" }}>{formatDate(s.session_date)}</p>}
                      <span className="text-xs font-bold mt-3 inline-flex items-center gap-1" style={{ color: "var(--blue)" }}>View Details →</span>
                    </div>
                  )}
                  {/* Progress bar for current */}
                  {isCurrent && !isPaused && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "rgba(0,212,255,0.2)" }}>
                      <div key={current} className="h-full" style={{ background: "var(--blue)", animation: "progressBar 2.8s linear forwards" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => { prev(); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
            aria-label="Previous activity"
            className="absolute left-0 sm:-left-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => { next(); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
            aria-label="Next activity"
            className="absolute right-0 sm:-right-5 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full border z-20 transition-all hover:scale-110"
            style={{ background: "rgba(2,8,16,0.95)", borderColor: "var(--blue)", color: "var(--blue)" }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8 flex-wrap">
          {sessions.map((s, i) => (
            <button key={s.id} onClick={() => { setCurrent(i); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
              aria-label={`Go to activity ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{ width: i === current ? 26 : 8, height: 8, background: i === current ? "var(--blue)" : "rgba(0,212,255,0.22)" }} />
          ))}
        </div>

        {/* Activity type links */}
        {activityTypes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {activityTypes.map(t => (
              <a key={t.id} href={`/activities?type=${t.slug}`}
                className="px-5 py-2 rounded-full border text-xs font-bold tracking-widest transition-all hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                {t.name}
              </a>
            ))}
            <a href="/activities"
              className="px-5 py-2 rounded-full border text-xs font-bold tracking-widest transition-all hover:border-[var(--blue)]"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Share Tech Mono',monospace" }}>
              ALL ACTIVITIES →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCIENCE MEDIA
════════════════════════════════════════════════════════════ */

/* Looping subtitle for Latest Activities */
function LatestActivitiesSubtitle() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // 3s hold, then fade out 0.5s, wait 0.5s, fade in again — total cycle ~4s
    const cycle = () => {
      setVisible(true);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        const showTimer = setTimeout(() => cycle(), 1000); // 1s gap (fade out 500ms + 500ms pause)
        return showTimer;
      }, 3000);
      return hideTimer;
    };
    const t = cycle();
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="mt-2 text-sm font-medium"
      style={{
        fontFamily: "'Share Tech Mono',monospace",
        color: "var(--blue)",
        letterSpacing: "0.2em",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
      EXPLORE WHAT WE&apos;VE BEEN UP TO
    </p>
  );
}

function ScienceMediaSection() {
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch("/api/science-media").then(r => r.json()).then((d: MediaVideo[]) => { if (Array.isArray(d) && d.length) setVideos(d); });
  }, []);

  if (videos.length === 0) return null;
  const activeId = extractYouTubeId(videos[active]?.youtube_url || "");

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="flex justify-center"><SectionLabel>Media</SectionLabel></div>
          <LetterAnim text="Science Media" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} slideDir="right" />
          <LetterAnim text="Check Out Our Science Media" tag="p" className="reveal mt-2" style={{ fontSize: "clamp(0.95rem,1.8vw,1.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 500, color: "var(--blue)" }} slideDir="right" delay={0.08} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", aspectRatio: "16/9", alignSelf: "stretch" }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${activeId}`} title="NDSC" frameBorder="0" allowFullScreen />
          </div>
          {/* Scrollable video list — same height as player */}
          <div className="flex flex-col rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-black tracking-widest" style={{ fontFamily: "'Share Tech Mono',monospace", color: "var(--blue)" }}>
                ALL VIDEOS ({videos.length})
              </p>
              <a href="https://www.youtube.com/@NDSCOfficial" target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                YT →
              </a>
            </div>
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto" style={{
              maxHeight: "calc((100vw - 48px) * 9/16 * 2/3)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(0,212,255,0.3) transparent",
            }}>
              {videos.map((v, i) => {
                const vid = extractYouTubeId(v.youtube_url);
                return (
                  <button key={v.id} onClick={() => setActive(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-b hover:bg-[rgba(0,212,255,0.04)]"
                    style={{
                      borderColor: "rgba(255,255,255,0.04)",
                      background: active === i ? "rgba(0,212,255,0.08)" : "transparent",
                      borderLeft: active === i ? "3px solid var(--blue)" : "3px solid transparent",
                    }}>
                    <div className="relative shrink-0 rounded-md overflow-hidden" style={{ width: 68, height: 42 }}>
                      <Image src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt={v.title} fill className="object-cover" />
                      {active === i && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,212,255,0.2)" }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--blue)" }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="black"><path d="M5 3l14 9-14 9V3z"/></svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold line-clamp-2 leading-tight" style={{ color: active === i ? "var(--blue)" : "var(--white)", fontFamily: "'Poppins',sans-serif" }}>
                        {v.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>
                        #{i + 1}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDRI CTA
════════════════════════════════════════════════════════════ */
function AudriCTA() {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/publications?latest=true&category=annual_magazine")
      .then(r => r.json())
      .then(d => { const pub = Array.isArray(d) ? d[0] : d; if (pub?.cover_image_url) setCover(pub.cover_image_url); })
      .catch(() => {});
  }, []);

  return (
    <section className="relative z-10 py-16 sm:py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="reveal rounded-2xl border overflow-hidden p-8 sm:p-14 flex flex-col sm:flex-row items-center gap-8 sm:gap-12"
          style={{ borderColor: "var(--blue)", background: "linear-gradient(135deg,rgba(0,212,255,0.04),rgba(0,119,255,0.04))" }}>
          <div className="flex-1">
            <SectionLabel>Annual Magazine</SectionLabel>
            {/* Bengali title uses a web-safe Bengali font stack */}
            <div className="mb-3">
              <LetterAnim
                text="AUDRI"
                tag="h2"
                className="font-black"
                style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }}
                slideDir="right"
              />
              <p className="font-semibold mt-1" style={{
                fontSize: "clamp(1.1rem,2vw,1.5rem)",
                fontFamily: "'Noto Serif Bengali', 'Kalpurush', 'SolaimanLipi', 'Hind Siliguri', serif",
                color: "var(--blue)",
                fontWeight: 700,
              }}>অদ্রি</p>
            </div>
            <LoopingP className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
              Annual science publication — articles on Quantum Entanglement, CRISPR, Neural Networks, and more.
            </LoopingP>
            <Link href="/publication" className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-bold text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              <BookOpen size={15} /> Read AUDRI
            </Link>
          </div>
          <div className="shrink-0">
            <Image src={cover || "/images/Audri-24.jpeg"} alt="AUDRI" width={180} height={240} className="rounded-xl object-contain shadow-2xl"
              style={{ filter: "drop-shadow(0 0 30px rgba(0,212,255,0.4))" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   THEME TOGGLE
════════════════════════════════════════════════════════════ */
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
    <button onClick={toggle} className="theme-toggle" title="Toggle theme" aria-label="Toggle theme">{dark ? "☀" : "🌙"}</button>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function HomePage() {
  useReveal();
  const [deptModal, setDeptModal] = useState<typeof DEPTS[0] | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700&display=swap');

        /* ── Logo Orbit Responsive ─────────────────── */
        .logo-orbit-wrap { --s: 460px; width: var(--s); height: var(--s); }
        .logo-ring-outer { width: var(--s); height: var(--s); --orbit-outer-r: calc(var(--s)/2 - 1px); }
        .logo-ring-mid   { width: calc(var(--s)*0.79); height: calc(var(--s)*0.79); margin-top: calc(var(--s)*-0.395); margin-left: calc(var(--s)*-0.395); --orbit-mid-r: calc(var(--s)*0.392); }
        .logo-ring-inner { width: calc(var(--s)*0.63); height: calc(var(--s)*0.63); margin-top: calc(var(--s)*-0.315); margin-left: calc(var(--s)*-0.315); }
        .logo-core { width: calc(var(--s)*0.574); height: calc(var(--s)*0.574); margin-top: calc(var(--s)*-0.287); margin-left: calc(var(--s)*-0.287); }
        .logo-img  { width: calc(var(--s)*0.448) !important; height: calc(var(--s)*0.448) !important; }
        .logo-badge { width: 78px; height: 78px; bottom: calc(var(--s)*0.053); right: calc(var(--s)*0.034); }
        .logo-badge-ndc { width: 78px; height: 78px; bottom: calc(var(--s)*0.053); left: calc(var(--s)*0.034); }
        /* Desktop: shift LEFT slightly toward content */
        @media (min-width: 1024px) { .logo-float { margin-right: 0; margin-left: -1rem; margin-top: -2rem; } }
        /* Mobile: shrink to 300px */
        @media (max-width: 768px) {
          .logo-orbit-wrap { --s: 300px; }
        }

        /* ── Keyframes ─────────────────────────────── */
        @keyframes spinSlow    { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        @keyframes pulse       { 0%,100%{opacity:.55;}50%{opacity:1;} }
        @keyframes scanV       { 0%{top:-4px;}100%{top:104%;} }
        @keyframes borderCycle { 0%,100%{border-color:rgba(0,212,255,.3);box-shadow:0 0 40px rgba(0,212,255,.15);}50%{border-color:rgba(0,212,255,.78);box-shadow:0 0 80px rgba(0,212,255,.32);} }
        @keyframes floatY      { 0%,100%{transform:translateY(0);}50%{transform:translateY(-14px);} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:none;} }
        @keyframes fadeSlide   { from{opacity:0;transform:translateX(-20px);}to{opacity:1;transform:none;} }
        @keyframes scaleIn     { from{opacity:0;transform:scale(0.85);}to{opacity:1;transform:scale(1);} }
        @keyframes marquee     { from{transform:translateX(0);}to{transform:translateX(-50%);} }
        @keyframes progressBar { from{width:0;}to{width:100%;} }
        @keyframes glowPulse   { 0%,100%{filter:drop-shadow(0 0 14px rgba(0,212,255,0.4));}50%{filter:drop-shadow(0 0 32px rgba(0,212,255,0.9));} }
        @keyframes shimmer     { 0%{background-position:200% center;}100%{background-position:-200% center;} }

        /* ── Hero ─────────────────────────────────── */
        .hero-badge  { animation: fadeSlide 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        .hero-h1-l1  { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .hero-h1-l2  { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.28s both; }
        .hero-h1-l3  { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.41s both; }
        .hero-h1-l4  { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.54s both; }
        .hero-sub    { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.62s both; }
        .hero-desc   { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.74s both; }
        .hero-btns   { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.88s both; }
        .hero-logo   { animation: scaleIn 1s cubic-bezier(0.22,1,0.36,1) 0.3s both; }
        .logo-float  { animation: floatY 5.5s ease-in-out infinite; }

        /* ── Reveal ───────────────────────────────── */
        .reveal { opacity:0; transform:translateY(24px); transition:opacity .75s cubic-bezier(0.22,1,0.36,1), transform .75s cubic-bezier(0.22,1,0.36,1); }
        .reveal.visible { opacity:1; transform:none; }

        /* ── Marquee ──────────────────────────────── */
        .marquee-track { display:flex; width:max-content; animation:marquee 24s linear infinite; }

        /* ── Buttons ──────────────────────────────── */
        .btn-primary { background:var(--blue); color:#000; transition:all .3s; box-shadow:0 0 28px rgba(0,212,255,.35); font-weight:700; }
        .btn-primary:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 0 50px rgba(0,212,255,.55); }
        .btn-outline { border:1.5px solid rgba(0,212,255,.55); color:var(--blue); transition:all .3s; font-weight:700; }
        .btn-outline:hover { background:var(--blue); color:#000; border-color:var(--blue); transform:translateY(-2px); }

        /* ── Cards ────────────────────────────────── */
        .stat-card:hover { border-color:var(--blue)!important; background:rgba(0,212,255,.04)!important; transform:translateY(-4px); }
        .dept-card { transition:all .3s; }
        .dept-card:hover { transform:translateY(-6px); }

        /* ── Ticker pill ──────────────────────────── */
        .ticker-pill {
          display:inline-flex; align-items:center; gap:0.5rem; padding:0.35rem 0.9rem;
          border-radius:999px; border:1px solid rgba(0,212,255,0.3);
          background:rgba(0,212,255,0.06); color:var(--blue);
          font-size:0.72rem; font-family:'Share Tech Mono',monospace;
          letter-spacing:0.15em; white-space:nowrap; transition:all .25s;
        }
        .ticker-pill:hover { border-color:var(--blue); background:rgba(0,212,255,0.12); }

        /* ── Pioneer section image ────────────────── */
        .pioneer-img-wrap::after {
          content:''; position:absolute; inset:0; border-radius:inherit;
          box-shadow:inset 0 0 40px rgba(0,212,255,0.06);
          pointer-events:none;
        }

        /* ── Mobile ───────────────────────────────── */
        @media (max-width:480px) { .hero-h1-size { font-size:clamp(2.5rem,11vw,3.8rem)!important; } }
      `}</style>

      <GalaxyCanvas />
      {deptModal && <DeptModal dept={deptModal} onClose={() => setDeptModal(null)} />}

      {/* ══════ HERO ══════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-[1]" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.015) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

        {/* Atom — top-left, subtle */}
        <div className="absolute z-[1] opacity-25" style={{ top: "8%", left: "-20px", pointerEvents: "none" }}>
          <AtomCanvas3D size={260} />
        </div>

        <div className="relative z-[2] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-5">
              <div className="hero-badge flex">
                <span className="ticker-pill">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  SINCE 1955 · DHAKA, BANGLADESH
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                {[
                  { text: "Join the",      color: "var(--white)",       cls: "hero-h1-l1", outline: false },
                  { text: "Community",     color: "var(--blue)",        cls: "hero-h1-l2", outline: false },
                  { text: "of Science",    color: "var(--white)",       cls: "hero-h1-l3", outline: false },
                  { text: "Enthusiasts",   color: "transparent",        cls: "hero-h1-l4", outline: true  },
                ].map((line, i) => (
                  <div key={i} className="overflow-hidden">
                    <h1
                      className={`${line.cls} font-black block hero-h1-size`}
                      style={{
                        fontSize: "clamp(2.4rem,5vw,4.4rem)",
                        fontFamily: "'Poppins',sans-serif",
                        fontWeight: 800,
                        lineHeight: 1.02,
                        letterSpacing: "-0.025em",
                        color: line.outline ? "transparent" : line.color,
                        WebkitTextStroke: line.outline ? "1.5px var(--blue)" : undefined,
                        filter: line.color === "var(--blue)" ? "drop-shadow(0 0 20px rgba(0,212,255,0.5))" : undefined,
                      }}
                    >{line.text}</h1>
                  </div>
                ))}
              </div>

              <div className="hero-sub flex items-center gap-4">
                <div style={{ height: 1, width: 36, background: "linear-gradient(to right, var(--blue), transparent)" }} />
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.67rem", letterSpacing: "0.3em", color: "var(--muted)", textTransform: "uppercase" }}>
                  Science in Human Welfare
                </span>
              </div>

              <p className="hero-desc text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)", maxWidth: 420, fontFamily: "'Poppins',sans-serif" }}>
                The <span style={{ color: "var(--white)", fontWeight: 600 }}>first college-level science club</span> in the Indian Subcontinent — shaping scientists, innovators &amp; leaders for{" "}
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>70 years</span>.
              </p>

              <div className="hero-btns flex flex-wrap gap-4">
                <Link href="/activities" className="btn-primary group flex items-center gap-3 px-7 py-3.5 text-sm tracking-widest rounded-2xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
                  View Activities <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/login" className="btn-outline flex items-center gap-3 px-7 py-3.5 text-sm tracking-widest rounded-2xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
                  Join Us
                </Link>
              </div>

              <HeroTicker />
            </div>

            {/* RIGHT — logo orbit */}
            <div className="hero-logo flex justify-center lg:justify-end">
              <LogoOrbit />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[2]">
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "0.56rem", letterSpacing: "0.45em", color: "rgba(0,212,255,0.4)", textTransform: "uppercase" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, position: "relative", background: "rgba(0,212,255,0.12)", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "100%", height: "45%", background: "linear-gradient(to bottom,transparent,var(--blue))", animation: "scanV 1.8s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* ══════ MARQUEE ══════════════════════════════════════ */}
      <div className="w-full overflow-hidden py-3.5 relative z-10" style={{ background: "var(--blue)" }}>
        <div className="marquee-track">
          {Array(18).fill("✦ LEGACY OF 70 YEARS").map((txt, i) => (
            <span key={i} className="mx-8 font-bold text-sm tracking-[.28em] whitespace-nowrap text-black" style={{ fontFamily: "'Poppins',sans-serif" }}>{txt}</span>
          ))}
        </div>
      </div>

      {/* ══════ STATS ════════════════════════════════════════ */}
      <section className="relative z-10 py-16" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => (
              <div key={s.label} className="reveal stat-card text-center p-5 sm:p-8 rounded-2xl border cursor-default transition-all"
                style={{ borderColor: "var(--border)", background: "var(--card)", animationDelay: `${i * 0.09}s` }}>
                <LetterAnim text={s.num} tag="p" className="font-black mb-2" style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800, color: "var(--blue)", filter: "drop-shadow(0 0 12px var(--glow))" }} delay={i * 0.12} />
                <p className="text-xs tracking-wider uppercase" style={{ color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PIONEER / ABOUT ══════════════════════════════ */}
      <PioneerSection />

      {/* ══════ VOICE OF LEADERS ════════════════════════════ */}
      <LeadersSection />

      {/* ══════ DEPARTMENTS ═════════════════════════════════ */}
      <section className="relative z-10 py-20" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="flex justify-center"><SectionLabel>Structure</SectionLabel></div>
            <LetterAnim text="Our Departments" tag="h2" className="font-black reveal" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} slideDir="left" />
            <p className="text-sm mt-3 max-w-xl mx-auto reveal" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>Click on a department to learn more.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
            {DEPTS.map((d, i) => (
              <button key={d.name} onClick={() => setDeptModal(d)}
                className="reveal dept-card group relative flex flex-col items-center gap-4 p-6 sm:p-8 rounded-3xl overflow-hidden text-left"
                style={{
                  background: d.bg,
                  border: `1px solid ${d.border}`,
                  animationDelay: `${i * 0.07}s`,
                  transition: "transform 0.3s, box-shadow 0.3s, border-color 0.3s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = `0 8px 32px ${d.color}33, 0 0 0 1px ${d.color}66`;
                  el.style.transform = "translateY(-6px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}>
                {/* Glow corner */}
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${d.color}22, transparent 70%)` }} />
                {/* Number badge */}
                <div className="absolute top-4 right-4 font-black opacity-20 pointer-events-none"
                  style={{ fontFamily: "'Orbitron',sans-serif", color: d.color, fontSize: "2rem", lineHeight: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 transition-transform group-hover:scale-110 duration-300">
                  {/* DEPT ICONS from Hostinger — replace icon paths in DEPTS array above with your Hostinger URLs */}
                  <Image src={d.icon} alt={d.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 10px ${d.color})` }} />
                </div>
                <p className="text-base sm:text-lg font-bold tracking-wide text-center" style={{ fontFamily: "'Poppins',sans-serif", color: d.color }}>{d.name}</p>
                <p className="text-xs text-center line-clamp-2 px-2" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>{d.desc}</p>
                {/* Bottom bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ ACTIVITIES CAROUSEL ══════════════════════════ */}
      <ActivitiesCarousel />

      {/* ══════ SCIENCE MEDIA ════════════════════════════════ */}
      <ScienceMediaSection />

      {/* ══════ AUDRI CTA ════════════════════════════════════ */}
      <AudriCTA />

      {/* ══════ FINAL CTA ════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,212,255,0.05) 0%, transparent 70%)" }} />
        {/* Atom decoration */}
        <div className="absolute right-8 top-8 opacity-15 pointer-events-none hidden lg:block">
          <AtomCanvas3D size={200} />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex justify-center"><SectionLabel>Join Us</SectionLabel></div>
          <LetterAnim text="Be Part of the Legacy" tag="h2" className="font-black mb-5 reveal" style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontFamily: "'Poppins',sans-serif", fontWeight: 800 }} slideDir="up" />
          <p className="text-sm sm:text-base leading-relaxed mb-8 reveal" style={{ color: "var(--muted)", fontFamily: "'Poppins',sans-serif" }}>
            Join thousands of science enthusiasts. Participate in olympiads, workshops, and events.
          </p>
          <div className="flex flex-wrap gap-4 justify-center reveal">
            <Link href="/register" className="btn-primary px-7 py-4 text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              BECOME A MEMBER
            </Link>
            <Link href="/olympiad" className="btn-outline flex items-center gap-2 px-7 py-4 text-sm tracking-widest rounded-xl" style={{ fontFamily: "'Poppins',sans-serif" }}>
              <Trophy size={15} /> TAKE OLYMPIAD
            </Link>
          </div>
        </div>
      </section>

      <ThemeToggle />
    </>
  );
}