import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/member-activity-registrations?member_id=UUID
// Returns all activity registrations for a member, with session + category info.
// Used by the member dashboard to show enrolled events list.
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id')
  if (!memberId) return apiError('member_id is required', 400)

  const { data: regs, error } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, category_id, activity_session_id, full_name, payment_status, created_at, project_name')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error) return apiError(error, 400)
  if (!regs || regs.length === 0) return apiOk({ registrations: [] })

  // Batch-fetch sessions and categories
  const sessionIds = [...new Set(regs.map(r => r.activity_session_id))]
  const categoryIds = [...new Set(regs.map(r => r.category_id))]

  const [{ data: sessions }, { data: categories }] = await Promise.all([
    supabaseAdmin
      .from('activity_sessions')
      .select('id, title, slug, is_upcoming, cover_image_url')
      .in('id', sessionIds),
    supabaseAdmin
      .from('activity_reg_categories')
      .select('id, name, is_online_submission, linked_olympiad_id, schedule_date, schedule_time, schedule_room, submission_config')
      .in('id', categoryIds),
  ])

  const sessionMap = Object.fromEntries((sessions || []).map(s => [s.id, s]))
  const categoryMap = Object.fromEntries((categories || []).map(c => [c.id, c]))

  const enriched = regs.map(r => ({
    ...r,
    session: sessionMap[r.activity_session_id] || null,
    category: categoryMap[r.category_id] || null,
  }))

  return apiOk({ registrations: enriched })
}
