import { NextRequest, NextResponse } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

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
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'File too large or malformed request' }, { status: 413 })
  }

  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB.` },
      { status: 413 }
    )
  }

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Please upload a JPG, PNG, WEBP, or HEIC image.' },
      { status: 400 }
    )
  }

  const hostingerUploadUrl = process.env.HOSTINGER_UPLOAD_URL
  const uploadSecret = process.env.UPLOAD_SECRET

  if (!hostingerUploadUrl || !uploadSecret) {
    return NextResponse.json({ error: 'Upload configuration missing.' }, { status: 500 })
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
    return NextResponse.json({ error: 'Could not reach the upload server. Please try again.' }, { status: 502 })
  }

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid response from upload server.' }, { status: 502 })
  }

  if (!res.ok || !data.success) {
    return NextResponse.json({ error: data.error || 'Upload failed. Please try again.' }, { status: 400 })
  }

  const cleanUrl = normalizeUploadUrl(data.url)

  return NextResponse.json({ url: cleanUrl })
}
