"use client";

import { useEffect, useRef } from "react";

export function AtomCanvas3D({ size = 340 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t = 0, animId: number;
    const W = size, H = size;
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.scale(2, 2); // HiDPI

    const cx = W / 2, cy = H / 2;
    const R = W * 0.40;

    // 3D → 2D projection with perspective
    const project = (x3: number, y3: number, z3: number, fov = 520): [number, number, number] => {
      const scale = fov / (fov + z3);
      return [cx + x3 * scale, cy + y3 * scale, scale];
    };

    // 3D orbit definition: rotX, rotY, rotZ tilt angles + color
    const orbitals = [
      { rx: 0,              ry: 0,              rz: 0,            speed: 0.55,  color: "0,212,255",   r: R,        eDot: 4.5  },
      { rx: Math.PI * 0.3,  ry: Math.PI * 0.1,  rz: Math.PI * 0.15, speed: 0.38,  color: "80,160,255",  r: R,        eDot: 4.0  },
      { rx: -Math.PI * 0.55,ry: Math.PI * 0.2,  rz: -Math.PI*0.1, speed: 0.70,  color: "160,100,255", r: R * 0.85, eDot: 3.5  },
      { rx: Math.PI * 0.5,  ry: -Math.PI * 0.25,rz: Math.PI * 0.3,speed: 0.44,  color: "0,230,180",   r: R * 0.92, eDot: 4.0  },
      { rx: Math.PI * 0.15, ry: Math.PI * 0.5,  rz: -Math.PI*0.2, speed: 0.62,  color: "100,200,255", r: R * 0.78, eDot: 3.0  },
    ];

    // Rotate a point around X then Y then Z axes
    const rotateXYZ = (px: number, py: number, pz: number, rx: number, ry: number, rz: number): [number, number, number] => {
      // X
      let y1 = py * Math.cos(rx) - pz * Math.sin(rx);
      let z1 = py * Math.sin(rx) + pz * Math.cos(rx);
      // Y
      let x2 = px * Math.cos(ry) + z1 * Math.sin(ry);
      let z2 = -px * Math.sin(ry) + z1 * Math.cos(ry);
      // Z
      let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
      let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
      return [x3, y3, z2];
    };

    // Slow global rotation for the whole atom
    let globalRY = 0, globalRX = 0;

    const drawOrbitArc = (orb: typeof orbitals[0], globalRx: number, globalRy: number) => {
      const segments = 120;
      // Collect projected points
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const lx = Math.cos(a) * orb.r;
        const ly = Math.sin(a) * orb.r;
        const lz = 0;
        // local orbit tilt
        let [x, y, z] = rotateXYZ(lx, ly, lz, orb.rx, orb.ry, orb.rz);
        // global slow rotation
        [x, y, z] = rotateXYZ(x, y, z, globalRx, globalRy, 0);
        const [px, py, ps] = project(x, y, z);
        pts.push([px, py, ps]);
      }
      // Draw orbit segments with depth-based alpha
      for (let i = 0; i < segments; i++) {
        const [x1, y1, s1] = pts[i];
        const [x2, y2, s2] = pts[i + 1];
        const depth = (s1 + s2) / 2; // ~0.6–1.2
        const alpha = 0.12 + (depth - 0.6) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${orb.color},${Math.max(0, Math.min(0.55, alpha))})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      globalRY = t * 0.06;
      globalRX = Math.sin(t * 0.04) * 0.22;

      // ── Nucleus ──────────────────────────────────────
      // Outer soft glow
      const ng2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.28);
      ng2.addColorStop(0, "rgba(0,212,255,0.08)");
      ng2.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = ng2; ctx.fill();

      // Core glow
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.13);
      ng.addColorStop(0, "rgba(255,255,255,0.95)");
      ng.addColorStop(0.25, "rgba(0,212,255,0.9)");
      ng.addColorStop(0.65, "rgba(0,80,200,0.55)");
      ng.addColorStop(1, "rgba(0,212,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = ng; ctx.fill();

      // Nucleus proton/neutron particles (tiny orbiting blobs)
      for (let n = 0; n < 6; n++) {
        const na = (n / 6) * Math.PI * 2 + t * 0.8;
        const even = n % 2 === 0;
        const nr = R * (even ? 0.055 : 0.068);
        const nz = Math.sin(na * 0.5) * R * 0.04;
        const [npx, npy, nps] = project(
          Math.cos(na) * nr,
          Math.sin(na) * nr * 0.6,
          nz
        );
        const nAlpha = 0.5 + nps * 0.4;
        ctx.beginPath(); ctx.arc(npx, npy, even ? 2.8 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = even ? `rgba(0,212,255,${nAlpha})` : `rgba(255,160,60,${nAlpha})`;
        ctx.fill();
      }

      // ── Draw orbit arcs (back-to-front by z) ─────────
      // Sort orbitals by z-depth of electron for correct layering
      const orbWithZ = orbitals.map((orb, oi) => {
        const angle = t * orb.speed + (oi / orbitals.length) * Math.PI * 2;
        const lx = Math.cos(angle) * orb.r;
        const ly = Math.sin(angle) * orb.r;
        let [x, y, z] = rotateXYZ(lx, ly, 0, orb.rx, orb.ry, orb.rz);
        [x, y, z] = rotateXYZ(x, y, z, globalRX, globalRY, 0);
        return { orb, oi, ex: x, ey: y, ez: z };
      });
      orbWithZ.sort((a, b) => a.ez - b.ez); // back first

      // Draw arcs
      for (const { orb } of orbWithZ) {
        drawOrbitArc(orb, globalRX, globalRY);
      }

      // ── Electrons ─────────────────────────────────────
      for (const { orb, oi, ex, ey, ez } of orbWithZ) {
        const angle = t * orb.speed + (oi / orbitals.length) * Math.PI * 2;
        const [epx, epy, eps] = project(ex, ey, ez);
        const depthAlpha = 0.5 + (eps - 0.6) * 1.2;
        const eDotR = orb.eDot * eps;

        // Trail
        const trailLen = 10;
        for (let tr = 1; tr <= trailLen; tr++) {
          const ta = angle - tr * 0.14;
          const tlx = Math.cos(ta) * orb.r, tly = Math.sin(ta) * orb.r;
          let [tx, ty, tz] = rotateXYZ(tlx, tly, 0, orb.rx, orb.ry, orb.rz);
          [tx, ty, tz] = rotateXYZ(tx, ty, tz, globalRX, globalRY, 0);
          const [tpx, tpy, tps] = project(tx, ty, tz);
          const tAlpha = (1 - tr / trailLen) * 0.35 * Math.max(0, depthAlpha);
          ctx.beginPath(); ctx.arc(tpx, tpy, Math.max(0.3, eDotR * (1 - tr / trailLen) * 0.7), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${orb.color},${tAlpha})`;
          ctx.fill();
        }

        if (depthAlpha < 0.05) continue; // behind, skip glow

        // Glow halo
        const glowR = eDotR * 3.5;
        const eg = ctx.createRadialGradient(epx, epy, 0, epx, epy, glowR);
        eg.addColorStop(0, `rgba(${orb.color},${Math.min(0.9, depthAlpha * 0.7)})`);
        eg.addColorStop(0.4, `rgba(${orb.color},${Math.min(0.35, depthAlpha * 0.3)})`);
        eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(epx, epy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = eg; ctx.fill();

        // Core dot
        const cg = ctx.createRadialGradient(epx - eDotR * 0.3, epy - eDotR * 0.3, 0, epx, epy, eDotR);
        cg.addColorStop(0, "#ffffff");
        cg.addColorStop(0.5, `rgba(${orb.color},${Math.min(1, depthAlpha)})`);
        cg.addColorStop(1, `rgba(${orb.color},0.5)`);
        ctx.beginPath(); ctx.arc(epx, epy, eDotR, 0, Math.PI * 2);
        ctx.fillStyle = cg; ctx.fill();
      }

      t += 0.018;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [size]);
  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, opacity: 0.92 }}
      className="pointer-events-none"
    />
  );
}


/* ════════════════════════════════════════════════════════════
   3D LOGO RING (hero right side)
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   QUANTUM ORBITAL 3D CANVAS — s, p, d orbitals behind logo
════════════════════════════════════════════════════════════ */
