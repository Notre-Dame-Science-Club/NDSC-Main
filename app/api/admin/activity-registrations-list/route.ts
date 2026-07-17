import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET ?sessionId=UUID — every registrant across the whole category tree for
// this Activity session, with a breadcrumb showing exactly which category
// they registered under. Deliberately does NOT include submission file
// content or exam answers/marks — that view belongs on the Olympiad admin
// page / organizer page for online leaves, this is just "who registered
// for what" so nothing duplicates between the two admin surfaces.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  const { data: categories, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, name, parent_id, is_online_submission, is_segment, form_field_schema')
    .eq('activity_session_id', sessionId)

  if (catError) return apiError(catError, 400)

  const catById = new Map((categories || []).map(c => [c.id, c]))
  const breadcrumbFor = (categoryId: string) => {
    const names: string[] = []
    let node: any = catById.get(categoryId)
    while (node) { names.unshift(node.name); node = node.parent_id ? catById.get(node.parent_id) : null }
    return names
  }

  const { data: registrations, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, category_id, full_name, phone, email, college, college_roll, hsc_session, project_name, custom_answers, team_members, payment_status, created_at')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (regError) return apiError(regError, 400)

  const result = (registrations || []).map(r => ({
    ...r,
    breadcrumb: breadcrumbFor(r.category_id),
    is_online_category: catById.get(r.category_id)?.is_online_submission || false,
    team_size: 1 + ((r.team_members as any[]) || []).length,
  }))

  // Top-level is_segment rows, used to build the segment-filter chip row in
  // the admin Registrants view. Includes form_field_schema so the detail
  // modal can render answers in the order the user actually filled them in.
  const segments = (categories || [])
    .filter((c: any) => c.is_segment && !c.parent_id)
    .map((c: any) => ({ id: c.id, name: c.name, form_field_schema: c.form_field_schema || [] }))

  return apiOk({ registrations: result, segments })
}
