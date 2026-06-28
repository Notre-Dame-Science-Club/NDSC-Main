import { NextRequest, NextResponse } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

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
    return NextResponse.json({ error: 'File too large or malformed request' }, { status: 413 })
  }

  const file = formData.get('file') as File | null
  const requestedFolder = formData.get('folder') as string | null
  const folder = ALLOWED_FOLDERS.includes(requestedFolder as any) ? requestedFolder! : 'membership-slips'

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
  fd.append('folder', folder)

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
