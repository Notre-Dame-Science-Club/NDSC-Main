import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/emailing/event-options
//   — no query: every activity session + every olympiad (flagged as a
//     "child" of an activity when it has parent_activity_session_id, or
//     when it's linked in as an online-submission category), for the
//     top-level pickers in the mass-emailing audience builder.
//   — ?sessionId=X: that session's v1 categories (activity_reg_categories)
//     and v2 top-level segments (form_nodes), so the admin can narrow to a
//     single category/segment ("submission bucket") within the event.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const sessionId = req.nextUrl.searchParams.get('sessionId')

  if (sessionId) {
    const { data: categories, error: catError } = await supabaseAdmin
      .from('activity_reg_categories')
      .select('id, name, parent_id')
      .eq('activity_session_id', sessionId)
      .order('display_order', { ascending: true })
    if (catError) return apiError(catError, 400)

    const { data: graph } = await supabaseAdmin
      .from('form_graphs')
      .select('id, root_node_id')
      .eq('owner_kind', 'activity')
      .eq('owner_id', sessionId)
      .maybeSingle()

    let segments: { id: string; name: string }[] = []
    if (graph) {
      const { data: nodes } = await supabaseAdmin
        .from('form_nodes')
        .select('id, label, parent_id')
        .eq('graph_id', graph.id)
      segments = (nodes || [])
        .filter(n => n.parent_id === graph.root_node_id)
        .map(n => ({ id: n.id, name: n.label }))
    }

    return apiOk({ categories: categories || [], segments })
  }

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, session_date')
    .order('session_date', { ascending: false })
  if (sessionsError) return apiError(sessionsError, 400)

  const { data: olympiads, error: olympiadsError } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, parent_activity_session_id')
    .order('created_at', { ascending: false })
  if (olympiadsError) return apiError(olympiadsError, 400)

  const sessionTitleById = new Map((sessions || []).map(s => [s.id, s.title]))

  return apiOk({
    sessions: (sessions || []).map(s => ({ id: s.id, title: s.title, date: s.session_date })),
    olympiads: (olympiads || []).map(o => ({
      id: o.id,
      name: o.name,
      is_child: !!o.parent_activity_session_id,
      parent_title: o.parent_activity_session_id ? sessionTitleById.get(o.parent_activity_session_id) : null,
    })),
  })
}
