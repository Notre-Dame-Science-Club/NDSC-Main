import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { countAudience, parseNoticeInput, summarizeAudiences } from '@/lib/notices'
import { fetchAudienceUsers } from '@/lib/server/noticeAudience'

// Helpers for the notice editor.
//   GET  -> the colleges and batches that actually exist on file (with head-counts), so the
//           admin picks values that will really match rather than guessing how people typed them.
//   POST -> live "this notice would reach N of M people" for an audience that is being edited.
//           The audience goes through the same cleaning as saving, then the same matcher members hit.

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { users, error } = await fetchAudienceUsers()
  if (error) return apiError(error, 400)
  return apiOk({ ...summarizeAudiences(users), total: users.length })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const parsed = parseNoticeInput(
    { audience_colleges: body?.audience_colleges ?? [], audience_batches: body?.audience_batches ?? [] },
    { partial: true }
  )
  if (!parsed.ok) return apiError(parsed.error, 400)

  const { users, error } = await fetchAudienceUsers()
  if (error) return apiError(error, 400)
  return apiOk({ count: countAudience(parsed.value, users), total: users.length })
}
