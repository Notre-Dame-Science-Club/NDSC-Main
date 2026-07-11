import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { isEligible, type SurveyRow, type AudienceMember } from '@/lib/survey'

// Public route — no auth required (the whole point is that logged-out
// visitors can be a valid audience via audience_type: 'all').
//
// GET, optional `Authorization: Bearer <token>` — same Bearer-token pattern
// as /api/member-profile. If present and valid, resolves the member's row
// (batch/is_organizer/is_executive) so audience matching can consider
// members/organizers/executives/alumni/custom, not just 'all'.
//
// Returns every currently eligible survey (active, inside its response
// window, audience-matched) with the full question set already stripped
// EXCEPT title/description/notification copy — the notification overlay
// only needs enough to decide whether to show a prompt; the full question
// list is fetched separately (GET /api/survey/[id]) only once the visitor
// actually opens it, and is re-checked for eligibility there too.
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

export async function GET(req: NextRequest) {
  const member = await getMemberFromRequest(req)

  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('*')
    .eq('is_active', true)
  if (error) return apiError(error, 400)

  const now = new Date()
  const eligible = (data || []).filter((s: SurveyRow) => isEligible(s, member, now))

  // Exclude surveys this member has already answered (unless the survey
  // allows multiple responses). Anonymous visitors can't be reliably
  // deduped server-side — the notification overlay handles that itself via
  // localStorage for the 'all' audience case.
  let answeredIds = new Set<string>()
  if (member && eligible.length > 0) {
    const { data: responses } = await supabaseAdmin
      .from('survey_responses')
      .select('survey_id')
      .eq('member_id', member.id)
      .in('survey_id', eligible.map((s: SurveyRow) => s.id))
    answeredIds = new Set((responses || []).map((r: any) => r.survey_id))
  }

  const result = eligible
    .filter((s: SurveyRow) => s.allow_multiple_responses || !answeredIds.has(s.id))
    .map((s: SurveyRow) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      cover_image_url: s.cover_image_url,
      show_notification: s.show_notification,
      notification_title: s.notification_title,
      notification_message: s.notification_message,
      question_count: (s.questions || []).length,
    }))

  return apiOk(result)
}
