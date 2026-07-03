"use client";

import Link from "next/link";
import Image from "next/image";
import { DEPTS } from "./data";

export function DeptModal({ dept, onClose }: { dept: typeof DEPTS[0]; onClose: () => void }) {
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
