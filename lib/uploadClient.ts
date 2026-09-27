/**
 * lib/uploadClient.ts
 *
 * The direct-to-Hostinger upload flow already used by the Publications
 * admin page, pulled out so new admin pages (Legacy Gallery, Glance
 * Gallery) don't each carry their own copy of it. Gets a one-time signed
 * token from /api/admin/upload-token, then posts the file straight to
 * Hostinger — bypasses Vercel entirely, so it isn't subject to Vercel's
 * request-size limits.
 */
import { normalizeUploadUrl } from "@/lib/uploadUrl";

const BUCKET_TO_FOLDER: Record<string, string> = {
  "activity-covers": "covers",
  "activity-gallery": "gallery",
  "activity-pdfs": "pdfs",
  "executive-photos": "executives",
  "legacy-gallery": "legacy-gallery",
  "glance-gallery": "glance-gallery",
  covers: "covers",
  gallery: "gallery",
  pdfs: "pdfs",
  executives: "executives",
  misc: "misc",
};

export function uploadFile(
  file: File,
  bucket: string,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  return new Promise(async (resolve) => {
    let uploadUrl: string;
    let secret: string;
    try {
      const res = await fetch("/api/admin/upload-token");
      const data = await res.json();
      if (!data.uploadUrl || !data.secret) {
        resolve(null);
        return;
      }
      uploadUrl = data.uploadUrl;
      secret = data.secret;
    } catch {
      resolve(null);
      return;
    }

    const folder = BUCKET_TO_FOLDER[bucket] ?? "misc";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve(data.url ? normalizeUploadUrl(data.url) : null);
      } catch {
        resolve(null);
      }
    });
    xhr.addEventListener("error", () => resolve(null));
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("X-Upload-Secret", secret);
    xhr.send(fd);
  });
}
