import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return apiError('Unauthorized', 401)

  const olympiadId = req.nextUrl.searchParams.get('olympiadId')
  if (!olympiadId) return apiError('olympiadId is required.', 400)

  // Make sure this organizer's session was actually granted access to this olympiad
  if (!session.olympiadIds.includes(olympiadId)) {
    return apiError('Forbidden.', 403)
  }

  const { data, error } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('*')
    .eq('olympiad_id', olympiadId)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError('Could not load registrations.', 500)
  }

  return apiOk({ registrations: data || [] })
}
