import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiError, apiOk } from '@/lib/api/response'
import { authorizeSegmentAccess, denyResponse } from '@/lib/server/registrationAccess'

// S5: two modes.
//  - SUBMISSION mode (registration_id + field_id in the form data): caller must be
//    on that COMPLETE registration and the submission window must be open. Type and
//    size limits come from the segment's configured submission field on the server;
//    client-supplied allowed_types / max_size_mb are ignored.
//  - FORM mode (no registration_id): registration-form photo fields. Image types
//    only, fixed 10MB cap, per-IP rate limit. Client limits are ignored.
//
// Used for:
//  1. Photo/file-type custom fields on activity registration forms
//  2. Submission fields (Phase D) — answer sheets, project videos, PDFs, etc.
// The Hostinger secret stays server-side, folder is fixed, size/type are
// capped here based on either the default photo allowlist or an explicit
// extension list passed by the client (which itself reflects what the
// admin configured for that submission field — but we still re-validate
// server-side since client-side checks can be bypassed).

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB default (photo fields)
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// Extension -> mime types, used when the client specifies allowed_types
// (e.g. submission fields configured by admin: pdf, mp4, docx, etc.)
const EXT_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  txt: ['text/plain'],
}

const FOLDER = 'activity-registrations'
const HARD_MAX_MB = 100

// Best-effort per-IP limiter for anonymous form-mode uploads (in-memory, so it
// is per server instance; it slows abuse, it is not a hard guarantee).
const hits = new Map<string, number[]>()
function rateLimited(req: NextRequest): boolean {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const now = Date.now(), windowMs = 10 * 60 * 1000, max = 30
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs)
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k)
  return arr.length > max
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('File too large or malformed request', 413)
  }

  const file = formData.get('file') as File | null
  if (!file) return apiError('No file provided', 400)

  const registrationId = (formData.get('registration_id') as string | null) || null
  const fieldId = (formData.get('field_id') as string | null) || null

  let maxSize = DEFAULT_MAX_SIZE
  let exts: string[] | null = null   // null = photo/image mode

  if (registrationId) {
    if (!fieldId) return apiError('field_id is required with registration_id.', 400)
    const access = await authorizeSegmentAccess(req, registrationId, { need: 'submission' })
    if (access.ok === false) return denyResponse(access)
    const fields: any[] = Array.isArray((access.node as any)?.behavior?.submission?.fields)
      ? (access.node as any).behavior.submission.fields : []
    const field = fields.find((f: any) => f?.id === fieldId)
    if (!field) return apiError('Unknown submission field.', 400)
    const cfgExts = Array.isArray(field.file_types)
      ? field.file_types.map((e: any) => String(e).trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
      : []
    exts = cfgExts.length ? cfgExts : null
    const cfgMb = Number(field.max_file_size_mb)
    if (cfgMb > 0) maxSize = Math.min(cfgMb, HARD_MAX_MB) * 1024 * 1024
  } else {
    if (rateLimited(req)) return apiError('Too many uploads. Please wait a few minutes and try again.', 429)
  }

  if (file.size > maxSize) {
    return apiError(`File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`, 413)
  }

  if (exts) {
    const allowedMimes = exts.flatMap(e => EXT_MIME_MAP[e] || [])
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    const extOk = exts.includes(fileExt)
    // Extension must be allowed; a declared mime type must also agree when we know the mapping.
    const mimeOk = !file.type || allowedMimes.length === 0 || allowedMimes.includes(file.type)
    if (!extOk || !mimeOk) {
      return apiError(`Invalid file type. Allowed: ${exts.join(', ')}`, 400)
    }
  } else {
    // Photo fields (and submission fields with no configured types): images only.
    if (file.type && !IMAGE_TYPES.includes(file.type)) {
      return apiError('Invalid file type. Please upload a JPG, PNG, WEBP, or HEIC image.', 400)
    }
  }

  const hostingerUploadUrl = process.env.HOSTINGER_UPLOAD_URL
  const uploadSecret = process.env.UPLOAD_SECRET
  if (!hostingerUploadUrl || !uploadSecret) {
    return apiError('Upload configuration missing.', 500)
  }

  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', FOLDER)

  let res: Response
  try {
    res = await fetch(hostingerUploadUrl, { method: 'POST', headers: { 'X-Upload-Secret': uploadSecret }, body: fd })
  } catch {
    return apiError('Could not reach the upload server. Please try again.', 502)
  }

  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch {
    return apiError('Invalid response from upload server.', 502)
  }
  if (!res.ok || !data.success) {
    return apiError(data.error || 'Upload failed. Please try again.', 400)
  }

  return apiOk({ url: normalizeUploadUrl(data.url) })
}
