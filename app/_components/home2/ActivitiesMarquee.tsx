"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActivitySession } from "../home/types";
import { extractYouTubeId } from "../home/utils";

function coverFor(s: ActivitySession): string | null {
  if (s.cover_image_url) return s.cover_image_url;
  if (s.youtube_url) {
    const vid = extractYouTubeId(s.youtube_url);
    if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Chapter 3. The same /api/activity-sessions-public endpoint the old
 * homepage carousel used — whatever Admin ▸ Activities has on file, newest
 * first, shows here automatically. Up to 15 are shown, duplicated once so
 * the CSS marquee (see .ch-marquee-track in home2.css) loops seamlessly.
 */
export default function ActivitiesMarquee() {
  const [sessions, setSessions] = useState<ActivitySession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity-sessions-public")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && Array.isArray(d)) setSessions(d.slice(0, 15)); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, []);

  const items = sessions && sessions.length ? sessions : PLACEHOLDER;
  const track = [...items, ...items]; // drawn twice; the loop only ever runs 50% left

  return (
    <section className="ch" id="ch-activities" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>03</b> — Live Feed</span>
        <span className="ch-rule" />
        <span className="k">FROM THE ADMIN PANEL</span>
      </div>
      <div className="ch-marquee-head">
        <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "14ch" }}>Latest activities.</h2>
        <p className="ch-marquee-tag" data-rv="fade">
          Every new activity added in Admin appears here automatically — covers pulled straight from
          Supabase.
        </p>
      </div>
      <div className="ch-marquee-wrap" data-rv="fade">
        <div className="ch-marquee-track">
          {track.map((s, i) => {
            const cover = coverFor(s);
            return (
              <Link
                key={`${s.id}-${i}`}
                href={s.slug ? `/activities/${s.slug}` : "/activities"}
                className="ch-mcard"
                data-cursor
              >
                <span className="bg" style={cover ? { backgroundImage: `url(${cover})` } : { background: "linear-gradient(150deg,#123,#0a1830)" }} />
                <span className="tag">{s.activity_types?.name?.toUpperCase() || "ACTIVITY"}</span>
                <span className="cap">
                  <b>{s.title}</b>
                  <span>VIEW ACTIVITY →</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="ch-marquee-foot" data-rv="fade">
        <Link className="ch-pill" href="/activities" data-cursor>All Activities →</Link>
      </div>
    </section>
  );
}

/** Shown only while the real feed is loading or empty, so the section never
 *  collapses to nothing on a fresh install. */
const PLACEHOLDER: ActivitySession[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `placeholder-${i}`,
  title: "Activity coming soon",
  slug: "",
  cover_image_url: null,
  session_date: null,
  youtube_url: null,
  activity_types: null,
}));
