"use client";

import { useCallback, useRef } from "react";

/**
 * Rather than a true pixel crop (which would mean re-encoding and storing
 * a second image per layout), this stores one focal point per layout as a
 * percentage and renders the same original file with
 * `object-fit: cover; object-position: {x}% {y}%`. One upload, two
 * previews — click or drag inside either box to move that layout's focal
 * point; the other layout's is untouched.
 */
export default function FocalPointPicker({
  label,
  imageUrl,
  aspect,
  x,
  y,
  onChange,
}: {
  label: string;
  imageUrl: string | null;
  /** CSS aspect-ratio, e.g. "16/9" or "3/4" — matches the real tile shape. */
  aspect: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const setFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const nx = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
      const ny = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
      onChange(Math.round(nx), Math.round(ny));
    },
    [onChange]
  );

  return (
    <div>
      <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label} <span style={{ opacity: 0.6 }}>· click or drag to set focus</span>
      </label>
      <div
        ref={boxRef}
        onMouseDown={(e) => {
          setFromEvent(e.clientX, e.clientY);
          const onMove = (ev: MouseEvent) => setFromEvent(ev.clientX, ev.clientY);
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: aspect,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--bg2)",
          cursor: imageUrl ? "crosshair" : "default",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${x}% ${y}%`,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: "var(--muted)" }}>
            Upload a photo first
          </div>
        )}
        {imageUrl && (
          <div
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 16,
              height: 16,
              marginLeft: -8,
              marginTop: -8,
              borderRadius: "50%",
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.5)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
