"use client";

import { useEffect, useState } from "react";

type LegacyPhoto = {
  id: string;
  image_url: string | null;
  year_label: string | null;
  desktop_focal_x: number;
  desktop_focal_y: number;
  mobile_focal_x: number;
  mobile_focal_y: number;
};

/**
 * Sits between LegacySection (the intro) and FounderSection. Fetches
 * /api/legacy-gallery — up to 10 admin-managed photos, landscape/square on
 * desktop rather than portrait, so old group shots and hall photos don't
 * get stretched tall. Renders nothing while there's no real data yet
 * (no placeholder gradients on the live site — those were preview-only).
 */
export default function LegacyGallerySection() {
  const [photos, setPhotos] = useState<LegacyPhoto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/legacy-gallery")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhotos(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setPhotos([]); });
    return () => { cancelled = true; };
  }, []);

  if (!photos || photos.length === 0) return null;

  return (
    <div className="ch" style={{ paddingTop: 0, paddingBottom: "clamp(30px,5vh,60px)" }}>
      <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "16ch", marginBottom: 14 }}>
        Pioneer <em style={{ fontStyle: "normal", color: "var(--accent, #d9b56a)" }}>and oldest.</em>
      </h2>
      <p className="ch-body-lg" data-rv="up" style={{ maxWidth: "62ch", marginBottom: 30 }}>
        Old, low-quality photographs — kept as they are, grain and all — are what actually proves
        &quot;oldest&quot; instead of just claiming it.
      </p>
      <div className="ch-legacy-grid" data-rv="up">
        {photos.map((p) => (
          <div key={p.id} className="ch-legacy-tile">
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="ch-legacy-img-desktop"
                src={p.image_url}
                alt=""
                style={{ objectPosition: `${p.desktop_focal_x}% ${p.desktop_focal_y}%` }}
              />
            )}
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="ch-legacy-img-mobile"
                src={p.image_url}
                alt=""
                style={{ objectPosition: `${p.mobile_focal_x}% ${p.mobile_focal_y}%` }}
              />
            )}
            {p.year_label && <span className="ch-legacy-year">{p.year_label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
