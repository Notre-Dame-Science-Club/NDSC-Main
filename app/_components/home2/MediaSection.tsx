"use client";

import { useEffect, useState } from "react";
import type { MediaVideo } from "../home/types";
import { extractYouTubeId } from "../home/utils";

/**
 * Chapter 5. Same /api/science-media endpoint, same YouTube embed and
 * thumbnail-list pattern as the original ScienceMediaSection — new layout
 * only.
 *
 * This used to `return null` (render nothing at all, not even the chapter
 * shell) whenever the fetch came back empty — which is indistinguishable,
 * on screen, from the section having been deleted. It now always renders
 * the chapter, with a designed "nothing published yet" state standing in
 * for the player until Admin ▸ Science Media has at least one active
 * video. That way "dynamic and currently empty" and "broken" never look
 * like the same thing.
 */
export default function MediaSection() {
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/science-media")
      .then((r) => r.json())
      .then((d: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(d) ? d : [];
        if (list.length) {
          setVideos(list as MediaVideo[]);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      })
      .catch(() => { if (!cancelled) setStatus("empty"); });
    return () => { cancelled = true; };
  }, []);

  const activeId = status === "ready" ? extractYouTubeId(videos[active]?.youtube_url || "") : "";

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

      {status !== "ready" ? (
        <div className="ch-media-empty" data-rv="up">
          <div className="ch-media-empty-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M8 5.6 18.4 12 8 18.4z" stroke="currentColor" strokeWidth="1.4" /></svg>
          </div>
          <b>{status === "loading" ? "Loading the reel…" : "Nothing published yet"}</b>
          <span>
            {status === "loading"
              ? "Fetching the latest from Admin ▸ Science Media."
              : "Videos added and switched on in Admin ▸ Science Media will show up here automatically."}
          </span>
        </div>
      ) : (
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
                  style={{
                    borderColor: active === i ? "var(--blue)" : undefined,
                    background: active === i ? "color-mix(in srgb, var(--blue) 8%, transparent)" : "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span className="thumb" style={{ backgroundImage: `url(https://img.youtube.com/vi/${vid}/mqdefault.jpg)` }} />
                  <span className="tx">
                    <b>{v.title}</b>
                    <span>
                      {active === i ? (
                        <>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--blue)", display: "inline-block", boxShadow: "0 0 6px var(--blue)" }} />
                          NOW PLAYING
                        </>
                      ) : (
                        `#${i + 1}`
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

