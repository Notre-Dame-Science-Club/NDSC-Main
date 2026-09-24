"use client";

import { useEffect, useRef, useState } from "react";
import { GLANCE_ITEMS } from "./glanceGalleryContent";

type GlanceRow = {
  slot_key: string;
  image_url: string | null;
  desktop_focal_x: number;
  desktop_focal_y: number;
  mobile_focal_x: number;
  mobile_focal_y: number;
  learn_more_url: string | null;
};

/**
 * Sits after Departments, before the live Activities feed. Title and
 * description come from glanceGalleryContent.ts (fixed, per the brief);
 * the photo and the "Learn More" destination come from /api/glance-gallery,
 * matched by slot_key.
 *
 * Hover behaviour matches the approved preview exactly: the description is
 * collapsed with max-height (not opacity alone — opacity still reserves
 * the box's full height, which is what pushed titles toward the middle of
 * the tile in an earlier pass), the title rises slightly on hover, the
 * photo starts clean/full-colour and only darkens on hover, and the admin
 * "slot" labels from the preview are gone — this is the live version.
 *
 * Mobile has no hover, so tapping-and-holding one tile to read it was the
 * only way in. Below 820px this component instead tracks scroll position
 * and marks whichever tile's centre sits closest to the viewport's centre
 * as "active" — CSS gives .active the exact same treatment as :hover
 * (see home2.css), so the description of the tile currently in the middle
 * of the screen reveals itself automatically as the visitor scrolls.
 */
export default function GlanceGallerySection() {
  const [rows, setRows] = useState<Record<string, GlanceRow>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const tileRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/glance-gallery")
      .then((r) => r.json())
      .then((d: GlanceRow[]) => {
        if (cancelled || !Array.isArray(d)) return;
        const map: Record<string, GlanceRow> = {};
        d.forEach((r) => { map[r.slot_key] = r; });
        setRows(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width:820px)");
    let raf = 0;

    function computeActive() {
      raf = 0;
      if (!mq.matches) {
        setActiveKey(null);
        return;
      }
      const viewportCenter = window.innerHeight / 2;
      let bestKey: string | null = null;
      let bestDist = Infinity;
      for (const key in tileRefs.current) {
        const el = tileRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (dist < bestDist) { bestDist = dist; bestKey = key; }
      }
      setActiveKey(bestKey);
    }
    function onScrollOrResize() {
      if (raf) return;
      raf = requestAnimationFrame(computeActive);
    }
    computeActive();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    mq.addEventListener("change", computeActive);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      mq.removeEventListener("change", computeActive);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="ch">
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>02B</b> — In practice</span>
        <span className="ch-rule" />
        <span className="k">A YEAR, IN PICTURES</span>
      </div>
      <h2 className="ch-display ch-sec" data-rv="up">What we do, at a glance.</h2>
      <p className="ch-body-lg" data-rv="up" style={{ marginTop: 14, marginBottom: 36, maxWidth: "70ch" }}>
        From scientific exploration to large-scale events, NDSC creates opportunities to learn,
        experiment, compete, collaborate, and lead.
      </p>

      <div className="ch-glance-grid">
        {GLANCE_ITEMS.map((item) => {
          const row = rows[item.slotKey];
          const Tag = row?.learn_more_url ? "a" : "div";
          return (
            <Tag
              key={item.slotKey}
              ref={(el: any) => { tileRefs.current[item.slotKey] = el; }}
              {...(row?.learn_more_url
                ? { href: row.learn_more_url, target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className={"ch-glance-tile" + (item.big ? " big" : "") + (activeKey === item.slotKey ? " active" : "")}
              data-cursor
            >
              {row?.image_url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="ph desktop-only"
                    src={row.image_url}
                    alt=""
                    style={{ objectPosition: `${row.desktop_focal_x}% ${row.desktop_focal_y}%` }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="ph mobile-only"
                    src={row.image_url}
                    alt=""
                    style={{ objectPosition: `${row.mobile_focal_x}% ${row.mobile_focal_y}%` }}
                  />
                </>
              )}
              <span className="base">
                <span className="small-title">{item.small}</span>
                <span className="hover-title">{item.title}</span>
                <span className="reveal">
                  <span className="desc" dangerouslySetInnerHTML={{ __html: item.descriptionHtml }} />
                  {row?.learn_more_url && (
                    <span className="more">
                      Learn More
                      <svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.4" /></svg>
                    </span>
                  )}
                </span>
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

