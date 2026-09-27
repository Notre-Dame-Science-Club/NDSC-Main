/**
 * uploadUrl.ts — Hostinger URL normalizer
 *
 * সমস্যা: upload.php বিভিন্ন সময় বিভিন্ন format এ URL return করে:
 *   Wrong:   https://uploads.ndscbd.net/uploads/covers/file.jpg  (extra /uploads/)
 *   Wrong:   https://ndscbd.net/uploads/covers/file.jpg          (old domain)
 *   Correct: https://uploads.ndscbd.net/covers/file.jpg          (correct)
 *
 * এই function সব format কে correct format এ convert করে।
 */

const UPLOADS_BASE = 'https://uploads.ndscbd.net'

export function normalizeUploadUrl(url: string | null | undefined): string {
  if (!url) return ''

  // Already correct format
  if (url.startsWith(`${UPLOADS_BASE}/`) && !url.includes(`${UPLOADS_BASE}/uploads/`)) {
    return url
  }

  // Pattern 1: https://uploads.ndscbd.net/uploads/folder/file.jpg
  //         → https://uploads.ndscbd.net/folder/file.jpg
  if (url.startsWith(`${UPLOADS_BASE}/uploads/`)) {
    return url.replace(`${UPLOADS_BASE}/uploads/`, `${UPLOADS_BASE}/`)
  }

  // Pattern 2: https://ndscbd.net/uploads/folder/file.jpg
  //         → https://uploads.ndscbd.net/folder/file.jpg
  if (url.startsWith('https://ndscbd.net/uploads/')) {
    return url.replace('https://ndscbd.net/uploads/', `${UPLOADS_BASE}/`)
  }
  if (url.startsWith('https://www.ndscbd.net/uploads/')) {
    return url.replace('https://www.ndscbd.net/uploads/', `${UPLOADS_BASE}/`)
  }

  // Pattern 3: https://arnob.ndscbd.net/uploads/folder/file.jpg
  //         → https://uploads.ndscbd.net/folder/file.jpg
  if (url.includes('ndscbd.net/uploads/')) {
    const afterUploads = url.split('ndscbd.net/uploads/')[1]
    return `${UPLOADS_BASE}/${afterUploads}`
  }

  return url
}

/**
 * Normalize an array of URLs (for gallery_urls etc.)
 */
export function normalizeUploadUrls(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return []
  return urls.map(normalizeUploadUrl).filter(Boolean)
}

/**
 * Walk any JSON-ish value (object / array / string) and normalize every
 * upload URL it contains.
 *
 * এটা read-side safety net: DB তে যদি আগে থেকেই broken URL save হয়ে থাকে
 * (যেমন publications.cover_image_url এ extra /uploads/), তাহলে API response
 * এ সেটা automatically fix হয়ে যাবে — DB migration চালানোর আগেও site ঠিক
 * দেখাবে। Strings যেগুলো upload URL না, সেগুলো unchanged থাকে।
 */
export function normalizeUploadUrlsDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return (isHostingerUrl(value) ? normalizeUploadUrl(value) : value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUploadUrlsDeep(item)) as unknown as T
  }
  if (value && typeof value === 'object') {
    // Only walk plain objects — Date, Map, Buffer, class instances etc. get
    // returned as-is so a deep copy never changes how they serialize.
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return value

    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeUploadUrlsDeep(val)
    }
    return out as unknown as T
  }
  return value
}

/**
 * Check if a URL is a Hostinger upload URL (any format)
 */
export function isHostingerUrl(url: string): boolean {
  return (
    url.includes('ndscbd.net/uploads/') ||
    url.startsWith(`${UPLOADS_BASE}/`)
  )
}
