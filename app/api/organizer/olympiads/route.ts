import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'
import { getOlympiadQuestionFields } from '@/lib/server/olympiadQuestions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getOrganizerSession()
  if (!session || session.olympiadIds.length === 0) {
    return apiError('Unauthorized', 401)
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, result_published, annotations_published')
    .in('id', session.olympiadIds)

  if (error) {
    return apiError('Could not load olympiads.', 500)
  }

  // `questions` used to be a column on this row — now it's the olympiad's
  // form-graph question node fields, fetched per olympiad.
  const olympiads = await Promise.all((data || []).map(async o => ({
    ...o, questions: await getOlympiadQuestionFields(o.id),
  })))

  return apiOk({ olympiads })
}
