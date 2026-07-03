"use client";

import { useEffect, useRef } from "react";

export function GalaxyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number, W = 0, H = 0, t = 0;

    interface Star { x: number; y: number; r: number; tw: number; vx: number; vy: number; bright: boolean }

    let stars: Star[] = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      // Reduced from 320 → 90 stars; only 5 bright ones
      stars = [];
      for (let i = 0; i < 260; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.6 + 0.2,
          tw: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.022,
          vy: (Math.random() - 0.5) * 0.022,
          bright: i < 8,
        });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Nebula blobs — fewer, lighter
    const nebulae = [
      { cx: 0.15, cy: 0.2,  rx: 340, ry: 180, color: "rgba(0,100,200,0.045)" },
      { cx: 0.82, cy: 0.25, rx: 260, ry: 160, color: "rgba(0,200,255,0.032)" },
      { cx: 0.5,  cy: 0.55, rx: 380, ry: 220, color: "rgba(0,50,120,0.03)" },
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

    // Galaxy spiral — single, fewer points
    const drawGalaxy = (cx: number, cy: number, maxR: number, rotation: number, alpha: number) => {
      const arms = 2, pointsPerArm = 60;
      for (let arm = 0; arm < arms; arm++) {
        const armAngle = (arm / arms) * Math.PI * 2 + rotation;
        for (let p = 0; p < pointsPerArm; p++) {
          const frac = p / pointsPerArm;
          const r = frac * maxR;
          const angle = armAngle + frac * Math.PI * 3.2 + t * 0.006;
          const spread = frac * maxR * 0.14 * (Math.random() - 0.5);
          const x = cx + (r + spread) * Math.cos(angle);
          const y = cy + (r + spread) * Math.sin(angle) * 0.42;
          const a = alpha * (1 - frac) * 0.8;
          if (a < 0.003) continue;
          ctx.beginPath();
          ctx.arc(x, y, frac < 0.1 ? 1.0 : 0.55, 0, Math.PI * 2);
          ctx.fillStyle = arm === 0 ? `rgba(0,212,255,${a})` : `rgba(100,180,255,${a})`;
          ctx.fill();
        }
      }
    };

    // Electromagnetic wave
    const drawEMWave = (ox: number, oy: number, len: number, amp: number, freq: number, phase: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      for (let x = 0; x < len; x += 4) {
        const y = oy + amp * Math.sin((x / len) * Math.PI * freq * 2 + phase + t * 1.1);
        ctx.lineTo(ox + x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = 0.14;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Shooting stars
    const shooters: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    const spawnShooter = () => {
      shooters.push({ x: Math.random() * W, y: Math.random() * H * 0.5, vx: 6 + Math.random() * 8, vy: 2 + Math.random() * 4, life: 0, maxLife: 50 + Math.random() * 30 });
    };
    let nextShooter = 180;

    const draw = () => {
      t += 0.010;
      ctx.clearRect(0, 0, W, H);

      // BG gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000306");
      bg.addColorStop(0.35, "#010a18");
      bg.addColorStop(0.7, "#020c20");
      bg.addColorStop(1, "#000204");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebulae
      nebulae.forEach(n => drawNebula(n.cx * W, n.cy * H, n.rx, n.ry, n.color));

      // Single galaxy
      drawGalaxy(W * 0.72, H * 0.28, Math.min(W, H) * 0.30, t * 0.003, 0.85);

      // Stars — slow heavy drift
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0;
        s.tw += 0.008;
        const ao = s.bright ? 0.5 + 0.5 * Math.abs(Math.sin(s.tw)) : 0.22 + 0.38 * Math.abs(Math.sin(s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.bright ? s.r * 1.6 : s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + Math.round(75 * ao)},${220 + Math.round(35 * ao)},255,${ao})`;
        ctx.fill();
        if (s.bright) {
          const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
          sg.addColorStop(0, `rgba(0,212,255,${ao * 0.3})`);
          sg.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }
      }

      // EM waves — 2 only
      drawEMWave(W * 0.05, H * 0.4, W * 0.38, 16, 3, 0, "rgba(var(--blue-rgb), 1)");
      drawEMWave(W * 0.58, H * 0.55, W * 0.36, 12, 4, Math.PI, "rgba(100,180,255,1)");

      // Shooting stars
      nextShooter--;
      if (nextShooter <= 0) { spawnShooter(); nextShooter = 140 + Math.random() * 200; }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        if (sh.life > sh.maxLife) { shooters.splice(i, 1); continue; }
        const prog = sh.life / sh.maxLife;
        const alpha = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7;
        const grad = ctx.createLinearGradient(sh.x - sh.vx * 10, sh.y - sh.vy * 10, sh.x, sh.y);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, `rgba(180,230,255,${alpha * 0.9})`);
        ctx.beginPath();
        ctx.moveTo(sh.x - sh.vx * 10, sh.y - sh.vy * 10);
        ctx.lineTo(sh.x, sh.y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(sh.x, sh.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
      }

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
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" style={{ willChange: "transform" }} />;
}

/* ════════════════════════════════════════════════════════════
   3D ATOM CANVAS
════════════════════════════════════════════════════════════ */
