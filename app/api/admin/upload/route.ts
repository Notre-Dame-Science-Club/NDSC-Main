import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

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
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('File too large or malformed request', 413)
  }

  const file = formData.get('file') as File
  const bucketOrFolder = (formData.get('folder') || formData.get('bucket') || 'misc') as string

  if (!file) return apiError('No file provided', 400)

  if (file.size > 200 * 1024 * 1024) {
    return apiError('File too large. Maximum size is 200MB.', 413)
  }

  const folder = BUCKET_TO_FOLDER[bucketOrFolder] ?? bucketOrFolder

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
    return apiError('Could not reach Hostinger upload server', 502)
  }

  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) }
  catch { return apiError('Invalid response from upload server: ' + text, 502) }

  if (!res.ok || !data.success) {
    return apiError(data.error || 'Upload failed', 400)
  }

  // Normalize the URL before returning — fixes /uploads/ prefix issue
  const cleanUrl = normalizeUploadUrl(data.url)

  return apiOk({ url: cleanUrl })
}
