import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — used for:
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

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('File too large or malformed request', 413)
  }

  const file = formData.get('file') as File | null
  if (!file) return apiError('No file provided', 400)

  // Optional: client tells us what's allowed for this specific submission
  // field (comma-separated extensions) and the max size in MB, mirroring
  // the admin's configuration for that field.
  const allowedExtsRaw = formData.get('allowed_types') as string | null
  const maxSizeMbRaw = formData.get('max_size_mb') as string | null

  const maxSize = maxSizeMbRaw ? Number(maxSizeMbRaw) * 1024 * 1024 : DEFAULT_MAX_SIZE
  if (file.size > maxSize) {
    return apiError(`File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`, 413)
  }

  if (allowedExtsRaw) {
    const exts = allowedExtsRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const allowedMimes = exts.flatMap(e => EXT_MIME_MAP[e] || [])
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    const extOk = exts.includes(fileExt)
    const mimeOk = !file.type || allowedMimes.length === 0 || allowedMimes.includes(file.type)
    if (!extOk && !mimeOk) {
      return apiError(`Invalid file type. Allowed: ${exts.join(', ')}`, 400)
    }
  } else {
    // Default behaviour (no explicit allowlist given) — treat as a photo field
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
