import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// Lets an organizer decide, for an olympiad they're logged into, how
// participants see their results on the dashboard:
//   - result_published:      show the numeric score
//   - annotations_published: show the organizer's marked-up answer sheet
// These were previously admin-only (Admin → Olympiads). Organizers run day-to-day
// review, so they're better placed to know when marking is actually finished and
// ready to publish. Only these two booleans can be changed here — everything
// else about the olympiad still requires admin access.

const EDITABLE_FIELDS = ['result_published', 'annotations_published'] as const

export async function PUT(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { olympiadId, ...rest } = body

  if (!olympiadId || typeof olympiadId !== 'string') {
    return apiError('olympiadId is required.', 400)
  }
  // Make sure this organizer's session was actually granted access to this olympiad
  if (!session.olympiadIds.includes(olympiadId)) {
    return apiError('Forbidden.', 403)
  }

  const patch: Record<string, boolean> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in rest) {
      if (typeof rest[field] !== 'boolean') return apiError(`${field} must be a boolean.`, 400)
      patch[field] = rest[field]
    }
  }
  if (Object.keys(patch).length === 0) {
    return apiError('Nothing to update.', 400)
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .update(patch)
    .eq('id', olympiadId)
    .select('id, result_published, annotations_published')
    .single()

  if (error) {
    return apiError('Could not update settings.', 500)
  }

  return apiOk(data)
}
