import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiError, apiOk } from '@/lib/api/response'
import { checkRateLimitShared, clientIp, tooManyRequests } from '@/lib/api/rateLimit'
import { sniffImageType, declaredFamily } from '@/lib/api/imageSniff'

// Public route — anyone registering for an olympiad needs this, so there is
// intentionally NO auth cookie check here (unlike /api/admin/upload).
//
// Because this is public, it must be locked down harder than the admin route:
//   - fixed max size (15MB — matches the UI copy already shown to students)
//   - fixed folder ('olympiad-answers') — the client can never choose the folder
//   - image mimetypes only
// The Hostinger secret never reaches the browser; this route proxies the
// upload server-side, the same way /api/admin/upload does.

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const FOLDER = 'olympiad-answers'

export async function POST(req: NextRequest) {
  const rl = await checkRateLimitShared(`olympiad-upload:ip:${clientIp(req)}`, 30, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec, 'Too many uploads. Please try again later.')

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('File too large or malformed request', 413)
  }

  const file = formData.get('file') as File | null

  if (!file) {
    return apiError('No file provided', 400)
  }

  if (file.size > MAX_SIZE) {
    return apiOk(
      { error: `File too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB.` },
      { status: 413 }
    )
  }

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return apiOk(
      { error: 'Invalid file type. Please upload a JPG, PNG, WEBP, or HEIC image.' },
      { status: 400 }
    )
  }

  // Don't trust the declared MIME type: check the real file signature, and
  // require it to agree with what the client claimed.
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const actual = sniffImageType(head)
  const claimed = file.type ? declaredFamily(file.type) : null
  if (!actual || (file.type && claimed !== actual)) {
    return apiOk(
      { error: 'Invalid file. Please upload a real JPG, PNG, WEBP, or HEIC image.' },
      { status: 400 }
    )
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
    res = await fetch(hostingerUploadUrl, {
      method: 'POST',
      headers: { 'X-Upload-Secret': uploadSecret },
      body: fd,
    })
  } catch {
    return apiError('Could not reach the upload server. Please try again.', 502)
  }

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    return apiError('Invalid response from upload server.', 502)
  }

  if (!res.ok || !data.success) {
    return apiError(data.error || 'Upload failed. Please try again.', 400)
  }

  const cleanUrl = normalizeUploadUrl(data.url)

  return apiOk({ url: cleanUrl })
}
