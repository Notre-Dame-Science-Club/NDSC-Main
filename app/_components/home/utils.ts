export function extractYouTubeId(url: string): string {
  const m = url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : url;
}

export function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

/* ════════════════════════════════════════════════════════════
   LETTER ANIMATION HOOK — slide in from left, loop, scroll-aware
════════════════════════════════════════════════════════════ */
