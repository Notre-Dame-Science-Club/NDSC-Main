import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getOrganizerSession()
  if (!session || session.olympiadIds.length === 0) {
    return apiError('Unauthorized', 401)
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, questions')
    .in('id', session.olympiadIds)

  if (error) {
    return apiError('Could not load olympiads.', 500)
  }

  return apiOk({ olympiads: data || [] })
}
