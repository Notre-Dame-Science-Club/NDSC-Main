import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET ?sessionId=UUID — every registrant across the whole category tree
// (v1) AND the form-graph (v2) for this Activity session, with a
// breadcrumb showing exactly which category/segment/subsegment/leaf they
// registered under. Deliberately does NOT include submission file content
// or exam answers/marks — that view belongs on the Olympiad admin page /
// organizer page for online leaves, this is just "who registered for
// what" so nothing duplicates between the two admin surfaces.
//
// `segment_id` is a uniform "which top-level bucket did they pick" field
// used by the admin UI's segment-filter chips, computed the same way for
// both systems: the top-level ancestor of wherever the registration
// actually landed (a v1 category's topmost parent, or submitted_node_ids[1]
// for a v2 graph). A registration's exact leaf — including any
// subsegment several levels below that top-level bucket — is still fully
// visible in `breadcrumb`, since every leaf is its own independent
// registration slot (see form-graph/submit/route.ts).
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  // v2 only - load the form graph for this session
  const { data: graph } = await supabaseAdmin
    .from('form_graphs').select('id, root_node_id').eq('owner_kind', 'activity').eq('owner_id', sessionId).maybeSingle()

  // v2 nodes for this session's graph, if any. Loaded regardless of
  // whether any registrations exist yet so the segment chips still show
  // up as soon as the Form Builder tree is set up.
  let nodeById = new Map<string, any>()
  if (graph) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('id, parent_id, label, fields, behavior, is_terminal').eq('graph_id', graph.id)
    nodeById = new Map((nodes || []).map(n => [n.id, n]))
  }
  const breadcrumbForPath = (submittedNodeIds: string[] | null | undefined): string[] => {
    if (!Array.isArray(submittedNodeIds) || !submittedNodeIds.length) return ['Form Builder']
    const names = submittedNodeIds.map(id => nodeById.get(id)?.label).filter(Boolean)
    return names.length ? names : ['Form Builder']
  }

  const { data: registrations, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, category_id, form_graph_id, form_node_id, submitted_node_ids, full_name, phone, email, college, college_roll, hsc_session, project_name, custom_answers, team_members, team_name, payment_status, created_at')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (regError) return apiError(regError, 400)

  const result = (registrations || []).map(r => {
    const lastNodeId = Array.isArray(r.submitted_node_ids) && r.submitted_node_ids.length
      ? r.submitted_node_ids[r.submitted_node_ids.length - 1]
      : null

    const fieldSchema = Array.isArray(r.submitted_node_ids)
      ? (r.submitted_node_ids as string[]).flatMap(id => (nodeById.get(id)?.fields as any[]) || [])
      : []
    const teamFieldSchema = Array.isArray(r.submitted_node_ids)
      ? (r.submitted_node_ids as string[]).flatMap(id => nodeById.get(id)?.behavior?.require_team?.fields || [])
      : []

    return {
      ...r,
      field_schema: fieldSchema,
      team_field_schema: teamFieldSchema,
      breadcrumb: breadcrumbForPath(r.submitted_node_ids as any),
      segment_id: Array.isArray(r.submitted_node_ids) && r.submitted_node_ids.length > 1 ? r.submitted_node_ids[1] : null,
      is_online_category: false, // v2 doesn't use this flag anymore
      is_terminal: lastNodeId ? !!nodeById.get(lastNodeId)?.is_terminal : null,
      team_size: 1 + ((r.team_members as any[]) || []).length,
    }
  })

  // v2 segments only - top-level form_nodes (graph root's direct children)
  const segments = graph
    ? Array.from(nodeById.values())
        .filter((n: any) => n.parent_id === graph.root_node_id)
        .map((n: any) => ({
          id: n.id,
          name: n.label,
          form_field_schema: n.fields || [],
          team_member_fields: n.behavior?.require_team?.fields || [],
        }))
    : []

  return apiOk({ registrations: result, segments })
}
