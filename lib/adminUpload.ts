/**
 * lib/adminUpload.ts
 *
 * Client-side helper for admin file uploads. Posts the file to the
 * server-side proxy at /api/admin/upload, which checks the admin session and
 * forwards to Hostinger using UPLOAD_SECRET. The secret never reaches the
 * browser (this replaces the old lib/uploadClient.ts + /api/admin/upload-token
 * flow that handed the secret to the client).
 *
 * NOTE: because the file now passes through our own server, it is subject to
 * the host's request-body cap (~4.5MB on Vercel serverless functions).
 */
import { normalizeUploadUrl } from '@/lib/uploadUrl'

const BODY_LIMIT_HINT =
  'The file is too large to upload through the server (limit is about 4.5MB on this host). Please use a smaller file.'

/** Uploads `file` and resolves with its public URL; rejects with a readable Error. */
export function uploadAdminFile(
  file: File,
  bucket: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', bucket)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status === 413) { reject(new Error(BODY_LIMIT_HINT)); return }
      let data: any = null
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON body */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.url) {
        resolve(normalizeUploadUrl(data.url))
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', '/api/admin/upload')
    xhr.send(fd)
  })
}

/** Same upload, but resolves null instead of rejecting (drop-in for the old uploadFile). */
export async function uploadFile(
  file: File,
  bucket: string,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  try {
    return await uploadAdminFile(file, bucket, onProgress)
  } catch {
    return null
  }
}
