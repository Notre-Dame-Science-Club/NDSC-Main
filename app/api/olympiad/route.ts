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
    // activity_reg_categories is still very much alive (see
    // /api/admin/online-categories and /api/activity-online-categories-public),
    // and form_nodes can carry the same kind of link via
    // behavior.linked_olympiad_id (see the form-builder node editor). An
    // olympiad referenced by either is surfaced through the Activity flow
    // instead — via /api/activity-online-categories-public — so it must be
    // excluded here, or the same round shows up twice with two separate,
    // disconnected registration paths.
    const [{ data: v1Links }, { data: nodes }] = await Promise.all([
      supabaseAdmin.from('activity_reg_categories').select('linked_olympiad_id').not('linked_olympiad_id', 'is', null),
      supabaseAdmin.from('form_nodes').select('behavior'),
    ])
    const linkedIds = new Set<string>()
    for (const row of v1Links || []) if (row.linked_olympiad_id) linkedIds.add(row.linked_olympiad_id)
    for (const n of nodes || []) {
      const linkedId = (n as any).behavior?.linked_olympiad_id
      if (linkedId) linkedIds.add(linkedId)
    }

    const { data, error } = await supabaseAdmin
      .from('olympiads')
      .select('id, name, description, cover_image_url, is_active, mode, exam_type, registration_deadline, scheduled_start_at, scheduled_end_at, eligibility, external_only, created_at, theme_bg_color, theme_accent_color, theme_header_logo_url')
      .order('created_at', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk((data || []).filter(o => !linkedIds.has(o.id)))
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data)
}
