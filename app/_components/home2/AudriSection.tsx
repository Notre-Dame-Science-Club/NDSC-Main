"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Chapter 6. Same /api/publications?latest=true&category=annual_magazine
 * fetch as the original AudriCTA — new layout only. Falls back to the
 * atom-mark plate (no <img>) when no cover has been published yet, same
 * as before.
 */
export default function AudriSection() {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/publications?latest=true&category=annual_magazine")
      .then((r) => r.json())
      .then((d) => {
        const pub = Array.isArray(d) ? d[0] : d;
        if (!cancelled && pub?.cover_image_url) setCover(pub.cover_image_url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="ch" id="ch-audri" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>06</b> — Publication</span>
        <span className="ch-rule" />
        <span className="k">ANNUAL</span>
      </div>
      <div className="ch-audri-grid">
        <div className="ch-audri-cover" data-rv="fade">
          <span className="spine" />
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="AUDRI cover" />
          ) : (
            <div className="mark">
              <svg viewBox="0 0 52 52" fill="none" aria-hidden="true">
                <circle cx="26" cy="26" r="3.2" fill="#a78bfa" />
                <ellipse cx="26" cy="26" rx="21" ry="8" stroke="#a78bfa" strokeOpacity=".6" strokeWidth="1" />
                <ellipse cx="26" cy="26" rx="21" ry="8" stroke="#a78bfa" strokeOpacity=".35" strokeWidth="1" transform="rotate(60 26 26)" />
                <ellipse cx="26" cy="26" rx="21" ry="8" stroke="#a78bfa" strokeOpacity=".35" strokeWidth="1" transform="rotate(120 26 26)" />
              </svg>
            </div>
          )}
          <div className="tx"><b>অদ্রি</b><span>AUDRI · ANNUAL PUBLICATION</span></div>
        </div>
        <div className="ch-story-copy">
          <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "12ch", marginBottom: 20 }}>
            AUDRI — the club&apos;s own journal.
          </h2>
          <p className="ch-body-lg" data-rv="up">
            Annual science publication — articles on quantum entanglement, CRISPR, neural networks and
            more, alongside the wall magazine, Trimatrik and Abhishkar Focus that run through the
            session.
          </p>
          <Link className="ch-arrowlink" href="/publication" data-cursor>
            <span>Read AUDRI</span>
            <span className="ar">
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" /></svg>
            </span>
          </Link>
          <div className="ch-pub-chips" data-rv="up">
            <span data-cursor>Wall Magazine</span>
            <span data-cursor>Trimatrik</span>
            <span data-cursor>Abhishkar Focus</span>
          </div>
        </div>
      </div>
    </section>
  );
}
