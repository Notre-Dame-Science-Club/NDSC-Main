import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/surveys/responses?survey_id=UUID
// Mirrors /api/admin/olympiad-registrations's ?olympiad_id= query pattern.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const surveyId = req.nextUrl.searchParams.get('survey_id')
  if (!surveyId) return apiError('Missing survey_id', 400)

  const { data: responses, error } = await supabaseAdmin
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)

  // Attach member name/email where a response is tied to a logged-in
  // member, so the admin table doesn't just show a bare UUID.
  const memberIds = Array.from(new Set((responses || []).map((r: any) => r.member_id).filter(Boolean)))
  let memberMap: Record<string, { full_name: string; email: string }> = {}
  if (memberIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from('members')
      .select('id, full_name, email')
      .in('id', memberIds)
    memberMap = Object.fromEntries((members || []).map((m: any) => [m.id, { full_name: m.full_name, email: m.email }]))
  }

  const enriched = (responses || []).map((r: any) => ({
    ...r,
    member: r.member_id ? memberMap[r.member_id] || null : null,
  }))

  return apiOk(enriched)
}
