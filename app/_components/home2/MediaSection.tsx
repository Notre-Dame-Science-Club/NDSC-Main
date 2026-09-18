"use client";

import { useEffect, useState } from "react";
import type { MediaVideo } from "../home/types";
import { extractYouTubeId } from "../home/utils";

/**
 * Chapter 5. Same /api/science-media endpoint, same YouTube embed and
 * thumbnail-list pattern as the original ScienceMediaSection — new layout
 * only. Renders nothing (not even the chapter shell) when there are no
 * videos yet, same as before.
 */
export default function MediaSection() {
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/science-media")
      .then((r) => r.json())
      .then((d: MediaVideo[]) => { if (!cancelled && Array.isArray(d) && d.length) setVideos(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (videos.length === 0) return null;
  const activeId = extractYouTubeId(videos[active]?.youtube_url || "");

  return (
    <section className="ch" id="ch-media" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>05</b> — Media</span>
        <span className="ch-rule" />
        <span className="k">NDSC OFFICIAL</span>
      </div>
      <div className="ch-story-grid" style={{ marginBottom: "clamp(30px,5vh,56px)" }}>
        <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "12ch" }}>Science media.</h2>
        <p className="ch-body-lg" data-rv="up" style={{ paddingTop: 8 }}>
          Sessions, festival recaps and explainers — the channel where the club&apos;s year gets
          documented.
        </p>
      </div>
      <div className="ch-media-grid" data-rv="up">
        <div className="ch-media-main">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${activeId}`}
            title="NDSC"
            style={{ border: 0 }}
            allowFullScreen
          />
        </div>
        <div className="ch-media-list">
          {videos.slice(0, 6).map((v, i) => {
            const vid = extractYouTubeId(v.youtube_url);
            return (
              <button
                key={v.id}
                type="button"
                className="ch-media-item"
                data-cursor
                onClick={() => setActive(i)}
                style={{ borderColor: active === i ? "var(--blue)" : undefined, background: "none", textAlign: "left", cursor: "pointer" }}
              >
                <span className="thumb" style={{ backgroundImage: `url(https://img.youtube.com/vi/${vid}/mqdefault.jpg)` }} />
                <span className="tx">
                  <b>{v.title}</b>
                  <span>{active === i ? "NOW PLAYING" : `#${i + 1}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
