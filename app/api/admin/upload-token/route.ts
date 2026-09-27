import { apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  // Only handed out once the admin session above is confirmed.
  return apiOk({
    uploadUrl: process.env.HOSTINGER_UPLOAD_URL,
    secret: process.env.UPLOAD_SECRET,
  })
}
