import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiForbidden, apiOk } from '@/lib/api/response'
import { isEligible, validateAnswers, type SurveyRow, type AudienceMember } from '@/lib/survey'

async function getMemberFromRequest(req: NextRequest): Promise<AudienceMember> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, full_name, email, batch, is_organizer, is_executive')
    .eq('id', data.user.id)
    .single()
  return member || null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.survey_id) return apiError('Missing survey_id', 400)

  const { data: surveyRow, error } = await supabaseAdmin
    .from('surveys')
    .select('*')
    .eq('id', body.survey_id)
    .single()
  if (error || !surveyRow) return apiError('Survey not found.', 404)
  const survey = surveyRow as SurveyRow

  const member = await getMemberFromRequest(req)

  // Re-validate eligibility server-side — the client's view of "am I
  // allowed to see this" is a UX convenience, not a trust boundary.
  if (!isEligible(survey, member)) {
    return apiForbidden('This survey isn\u2019t open to you right now.')
  }

  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const validationError = validateAnswers(survey.questions || [], answers)
  if (validationError) return apiError(validationError, 400)

  if (member && !survey.allow_multiple_responses) {
    const { data: existing } = await supabaseAdmin
      .from('survey_responses')
      .select('id')
      .eq('survey_id', survey.id)
      .eq('member_id', member.id)
      .limit(1)
    if (existing?.length) return apiError('You\u2019ve already responded to this survey.', 409)
  }

  const { data, error: insertError } = await supabaseAdmin
    .from('survey_responses')
    .insert({
      survey_id: survey.id,
      member_id: member?.id || null,
      respondent_name: member ? (member as any).full_name : (typeof body.respondent_name === 'string' ? body.respondent_name.trim() || null : null),
      respondent_email: member ? (member as any).email : (typeof body.respondent_email === 'string' ? body.respondent_email.trim() || null : null),
      answers,
    })
    .select('id')
    .single()
  if (insertError) return apiError(insertError, 400)

  return apiOk({ success: true, id: data.id })
}
