import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — no auth required.
// Uses supabaseAdmin so it bypasses RLS (which restricts anon reads).
// GET (no params)   -> list of all active olympiads (full data, incl. questions —
//                      used by the exam-taking flow and to resume a session)
// GET ?id=UUID      -> single olympiad by id (used by the activity dashboard
//                      to fetch relay/subject/scheduling info for a linked olympiad)
// GET ?listing=1    -> every STANDALONE olympiad (active or not) that is not
//                      already linked to an Activity online-submission leaf,
//                      with only the lightweight fields the public /olympiad
//                      list page needs to decide whether to show it as
//                      registrable or greyed-out (no `questions`/answer keys).
//                      Olympiads linked to an Activity category are
//                      deliberately excluded here — those are surfaced (when
//                      open) via /api/activity-online-categories-public
//                      instead, so the same round never shows up twice.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const listing = req.nextUrl.searchParams.get('listing')

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('olympiads')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return apiError('Olympiad not found.', 404)
    return apiOk({ olympiad: data })
  }

  if (listing) {
    const { data: linkedRows, error: linkError } = await supabaseAdmin
      .from('activity_reg_categories')
      .select('linked_olympiad_id')
      .not('linked_olympiad_id', 'is', null)
    if (linkError) return apiError(linkError, 400)
    const linkedIds = new Set((linkedRows || []).map((r: any) => r.linked_olympiad_id))

    const { data, error } = await supabaseAdmin
      .from('olympiads')
      .select('id, name, description, cover_image_url, is_active, mode, exam_type, registration_deadline, exam_date, scheduled_start_at, scheduled_end_at, eligibility, external_only, created_at, theme_bg_color, theme_accent_color, theme_header_logo_url')
      .order('created_at', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk((data || []).filter((o: any) => !linkedIds.has(o.id)))
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data)
}
