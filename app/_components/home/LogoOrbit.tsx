"use client";

import Image from "next/image";
import { QuantumOrbitalCanvas } from "./QuantumOrbitalCanvas";

export function LogoOrbit() {
  return (
    <div className="logo-float logo-orbit-wrap relative flex items-center justify-center">
      {/* Quantum orbital cloud — renders to 100% of parent, z-index behind rings */}
      <QuantumOrbitalCanvas size={460} />
      {/* Outer ring */}
      <div className="absolute rounded-full logo-ring-outer" style={{ border: "1px dashed rgba(var(--blue-rgb), 0.16)", animation: "spinSlow 70s linear infinite" }}>
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <div key={i} className="logo-dot-outer" style={{ position: "absolute", top: "50%", left: "50%", width: i % 2 === 0 ? 8 : 4, height: i % 2 === 0 ? 8 : 4, borderRadius: "50%", background: i % 2 === 0 ? "var(--blue)" : "rgba(var(--blue-rgb), 0.4)", boxShadow: i % 2 === 0 ? "0 0 12px var(--blue)" : "none", transform: `rotate(${deg}deg) translateX(var(--orbit-outer-r)) translateY(-50%)` }} />
        ))}
      </div>
      {/* Mid ring */}
      <div className="absolute rounded-full logo-ring-mid" style={{ top: "50%", left: "50%", border: "1px solid rgba(var(--blue-rgb), 0.22)", animation: "spinSlow 40s linear infinite reverse" }}>
        {[60, 180, 300].map((deg, i) => (
          <div key={i} className="logo-dot-mid" style={{ position: "absolute", top: "50%", left: "50%", width: 5, height: 5, borderRadius: "50%", background: "rgba(var(--blue-rgb), 0.65)", boxShadow: "0 0 8px rgba(var(--blue-rgb), 0.8)", transform: `rotate(${deg}deg) translateX(var(--orbit-mid-r)) translateY(-50%)` }} />
        ))}
      </div>
      {/* Inner ring */}
      <div className="absolute rounded-full logo-ring-inner" style={{ top: "50%", left: "50%", border: "1px solid rgba(var(--accent2-rgb), 0.18)", animation: "spinSlow 25s linear infinite" }} />
      {/* Core */}
      <div className="absolute rounded-full overflow-hidden flex items-center justify-center logo-core" style={{ top: "50%", left: "50%", background: "radial-gradient(circle at 38% 32%, rgba(0,50,90,0.92), rgba(0,4,12,0.97))", animation: "borderCycle 3.5s ease infinite", border: "2px solid rgba(var(--blue-rgb), 0.45)" }}>
        <div className="absolute left-0 right-0" style={{ height: 2, top: 0, background: "linear-gradient(90deg,transparent,rgba(var(--blue-rgb), 0.55),transparent)", animation: "scanV 2.8s linear infinite" }} />
        <Image src="/images/logo-2.0.svg" alt="NDSC 70 Years" width={230} height={230} className="object-contain relative z-10 logo-img" style={{ filter: "drop-shadow(0 0 24px rgba(var(--blue-rgb), 0.7))", animation: "spinSlow 30s linear infinite" }} priority />
      </div>
      {/* Arc text */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 513 513">
        <defs><path id="arcHero" d="M 67,256 A 189,189 0 1,1 446,256" /></defs>
        <text fontSize="9" letterSpacing="5.5" fill="rgba(var(--blue-rgb), 0.3)" fontFamily="'Share Tech Mono',monospace" textAnchor="middle">
          <textPath href="#arcHero" startOffset="50%">SCIENCE IN HUMAN WELFARE • 1955–2025 •</textPath>
        </text>
      </svg>
      {/* 70yr badge — right side, shows 70-logo image */}
      <div className="absolute rounded-full flex items-center justify-center logo-badge" style={{ background: "rgba(0,0,0,0.97)", border: "2px solid var(--blue)", boxShadow: "0 0 28px rgba(var(--blue-rgb), 0.6)", animation: "pulse 2.5s ease infinite", overflow: "hidden" }}>
        <Image src="/images/70-logo.png" alt="NDSC 70 Years" width={56} height={56} className="object-contain p-1" style={{ filter: "drop-shadow(0 0 8px rgba(var(--blue-rgb), 0.5))" }} />
      </div>
      {/* NDC logo badge — left side, mirrored position */}
      <div className="absolute rounded-full flex items-center justify-center logo-badge-ndc" style={{ background: "rgba(0,0,0,0.97)", border: "2px solid var(--blue)", boxShadow: "0 0 28px rgba(var(--blue-rgb), 0.6)", animation: "pulse 2.5s ease infinite 0.8s", overflow: "hidden" }}>
        <Image src="/images/ndc-logo.svg" alt="Notre Dame College" width={56} height={56} className="object-contain p-1" style={{ filter: "drop-shadow(0 0 8px rgba(var(--blue-rgb), 0.4))" }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HERO TICKER
════════════════════════════════════════════════════════════ */
