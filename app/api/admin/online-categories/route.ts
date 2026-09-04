import { supabaseAdmin } from '@/lib/supabase'

import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET — every activity_reg_categories leaf with a linked_olympiad_id, across
// ALL activity sessions, with enough breadcrumb info (session + ancestor
// names) for the Admin Olympiad page to label each olympiad as
// "Activity-derived" and link back to where its registration structure is
// actually edited. This is what lets the Olympiad admin page stop being a
// freestanding olympiad manager and instead just be the "online content"
// editor for whatever Activity has marked as an online leaf.
export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data: linkedLeaves, error } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, name, parent_id, activity_session_id, linked_olympiad_id, custom_fields, requires_team, requires_payment, registration_open')
    .not('linked_olympiad_id', 'is', null)

  if (error) return apiError(error, 400)
  if (!linkedLeaves || linkedLeaves.length === 0) return apiOk([])

  const sessionIds = [...new Set(linkedLeaves.map(c => c.activity_session_id))]
  const { data: sessions } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug')
    .in('id', sessionIds)
  const sessionById = new Map((sessions || []).map(s => [s.id, s]))

  // Need ancestor names for breadcrumb — fetch every category per touched session.
  const { data: allCats } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, name, parent_id, activity_session_id')
    .in('activity_session_id', sessionIds)
  const catById = new Map((allCats || []).map(c => [c.id, c]))

  const result = linkedLeaves.map(leaf => {
    const breadcrumb: string[] = []
    let node: any = catById.get(leaf.id)
    while (node) { breadcrumb.unshift(node.name); node = node.parent_id ? catById.get(node.parent_id) : null }
    const session = sessionById.get(leaf.activity_session_id)
    return {
      olympiad_id: leaf.linked_olympiad_id,
      category_id: leaf.id,
      session_id: leaf.activity_session_id,
      session_title: session?.title,
      session_slug: session?.slug,
      breadcrumb,
      registration_open: leaf.registration_open !== false,
      requires_team: leaf.requires_team,
      requires_payment: leaf.requires_payment,
      custom_fields: leaf.custom_fields || [],
    }
  })

  return apiOk(result)
}
