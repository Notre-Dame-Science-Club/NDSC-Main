import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — used by the membership sign-up form (payment slip photo)
// and by members adding an achievement/certificate image from their
// dashboard. Same proxy pattern as /api/olympiad-upload: the Hostinger
// secret stays server-side, never reaches the browser, and the folder is
// fixed server-side so a client can't redirect uploads elsewhere.

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ALLOWED_FOLDERS = ['membership-slips', 'achievements'] as const

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('File too large or malformed request', 413)
  }

  const file = formData.get('file') as File | null
  const requestedFolder = formData.get('folder') as string | null
  const folder = ALLOWED_FOLDERS.includes(requestedFolder as any) ? requestedFolder! : 'membership-slips'

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

  const hostingerUploadUrl = process.env.HOSTINGER_UPLOAD_URL
  const uploadSecret = process.env.UPLOAD_SECRET

  if (!hostingerUploadUrl || !uploadSecret) {
    return apiError('Upload configuration missing.', 500)
  }

  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', folder)

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
