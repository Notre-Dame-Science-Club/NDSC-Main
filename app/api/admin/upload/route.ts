import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BUCKET_TO_FOLDER: Record<string, string> = {
  'activity-covers':  'covers',
  'activity-gallery': 'gallery',
  'activity-pdfs':    'pdfs',
  'executive-photos': 'executives',
  'covers':           'covers',
  'gallery':          'gallery',
  'pdfs':             'pdfs',
  'executives':       'executives',
  'misc':             'misc',
  'publications':     'publications',
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'File too large or malformed request' }, { status: 413 })
  }

  const file = formData.get('file') as File
  const bucketOrFolder = (formData.get('folder') || formData.get('bucket') || 'misc') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum size is 200MB.' }, { status: 413 })
  }

  const folder = BUCKET_TO_FOLDER[bucketOrFolder] ?? bucketOrFolder

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
    return NextResponse.json({ error: 'Could not reach Hostinger upload server' }, { status: 502 })
  }

  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) }
  catch { return NextResponse.json({ error: 'Invalid response from upload server: ' + text }, { status: 502 }) }

  if (!res.ok || !data.success) {
    return NextResponse.json({ error: data.error || 'Upload failed' }, { status: 400 })
  }

  // ✅ Normalize the URL before returning — fixes /uploads/ prefix issue
  const cleanUrl = normalizeUploadUrl(data.url)

  return NextResponse.json({ url: cleanUrl })
}
