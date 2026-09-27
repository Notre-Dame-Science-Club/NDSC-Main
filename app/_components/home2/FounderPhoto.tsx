"use client";

/**
 * Just the <img> and its onError fallback, split out from LegacySection.tsx.
 *
 * A Server Component (LegacySection has no "use client", and shouldn't
 * need one just for this) can't attach an event handler to a plain DOM
 * element — React has nowhere to serialize the function to. Isolating the
 * one element that actually needs interactivity here keeps the rest of the
 * section server-rendered.
 */
export default function FounderPhoto() {
  return (
    <img
      src="/images/founder-cutout.png"
      alt="Fr. Richard William Timm, C.S.C."
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
