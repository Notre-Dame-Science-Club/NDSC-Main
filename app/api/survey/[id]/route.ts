import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiForbidden, apiOk } from '@/lib/api/response'
import { isEligible, type SurveyRow, type AudienceMember } from '@/lib/survey'

// Public route. Re-checks eligibility server-side (never trust that a
// visitor reaching this URL was actually shown it by the notification
// overlay) before returning the question list.
async function getMemberFromRequest(req: NextRequest): Promise<AudienceMember> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, batch, is_organizer, is_executive')
    .eq('id', data.user.id)
    .single()
  return member || null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('surveys').select('*').eq('id', id).single()
  if (error || !data) return apiError('Survey not found.', 404)

  const survey = data as SurveyRow
  const member = await getMemberFromRequest(req)

  if (!isEligible(survey, member)) {
    return apiForbidden('This survey isn\u2019t available to you right now.')
  }

  let alreadyResponded = false
  if (member && !survey.allow_multiple_responses) {
    const { data: existing } = await supabaseAdmin
      .from('survey_responses')
      .select('id')
      .eq('survey_id', id)
      .eq('member_id', member.id)
      .limit(1)
    alreadyResponded = !!existing?.length
  }

  return apiOk({
    id: survey.id,
    title: survey.title,
    description: survey.description,
    cover_image_url: survey.cover_image_url,
    questions: survey.questions,
    allow_multiple_responses: survey.allow_multiple_responses,
    already_responded: alreadyResponded,
  })
}
