import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { resolveAudience, type EmailAudienceFilters } from '@/lib/email/audience'

// POST /api/admin/emailing/audience-preview — preview recipient count + sample
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const { audience_source, audience_filters } = body as {
    audience_source: 'members' | 'users' | 'both'
    audience_filters: EmailAudienceFilters
  }

  if (!audience_source || !['members', 'users', 'both'].includes(audience_source)) {
    return apiError('Invalid audience_source')
  }

  const recipients = await resolveAudience(audience_source, audience_filters || {})

  return apiOk({
    count: recipients.length,
    sample: recipients.slice(0, 10),
  })
}
