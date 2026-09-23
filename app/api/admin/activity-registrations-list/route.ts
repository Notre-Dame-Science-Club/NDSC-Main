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

  const [{ data: categories, error: catError }, { data: graph }] = await Promise.all([
    supabaseAdmin
      .from('activity_reg_categories')
      .select('id, name, parent_id, is_online_submission, is_segment, form_field_schema, team_member_fields')
      .eq('activity_session_id', sessionId),
    supabaseAdmin
      .from('form_graphs').select('id, root_node_id').eq('owner_kind', 'activity').eq('owner_id', sessionId).maybeSingle(),
  ])
  if (catError) return apiError(catError, 400)

  const catById = new Map((categories || []).map(c => [c.id, c]))
  const breadcrumbFor = (categoryId: string) => {
    const names: string[] = []
    let node: any = catById.get(categoryId)
    while (node) { names.unshift(node.name); node = node.parent_id ? catById.get(node.parent_id) : null }
    return names
  }
  // Top-level ancestor id of a v1 category (walks up to the row whose
  // parent_id is null) — used for segment_id below.
  const topAncestorFor = (categoryId: string): string | null => {
    let node: any = catById.get(categoryId)
    if (!node) return null
    while (node.parent_id) node = catById.get(node.parent_id) || node
    return node?.id ?? null
  }

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
    const isV2 = !r.category_id && !!r.form_graph_id
    const lastNodeId = isV2 && Array.isArray(r.submitted_node_ids) && r.submitted_node_ids.length
      ? r.submitted_node_ids[r.submitted_node_ids.length - 1]
      : null
    return {
      ...r,
      // category_id is only set for registrations from the old segment/
      // category system. Anything through the Form Builder graph has
      // category_id = null and form_graph_id set instead.
      breadcrumb: r.category_id ? breadcrumbFor(r.category_id) : (isV2 ? breadcrumbForPath(r.submitted_node_ids as any) : []),
      segment_id: r.category_id ? topAncestorFor(r.category_id) : (isV2 && Array.isArray(r.submitted_node_ids) && r.submitted_node_ids.length > 1 ? r.submitted_node_ids[1] : null),
      is_online_category: catById.get(r.category_id)?.is_online_submission || false,
      // Whether this row actually finished its path (reached a true leaf)
      // vs. is still mid-tree / abandoned. Only meaningful for v2 — v1
      // rows are always "finished" the moment they're created.
      is_terminal: r.category_id ? true : (lastNodeId ? !!nodeById.get(lastNodeId)?.is_terminal : null),
      team_size: 1 + ((r.team_members as any[]) || []).length,
    }
  })

  // Top-level is_segment rows (v1) + top-level form_nodes (v2, i.e. the
  // graph root's direct children), used to build the segment-filter chip
  // row in the admin Registrants view. Includes form_field_schema so the
  // detail modal can render answers in the order the user actually filled
  // them in, and team_member_fields so per-member custom_answers can be
  // rendered in the modal's TEAM MEMBERS section.
  const v1Segments = (categories || [])
    .filter((c: any) => c.is_segment && !c.parent_id)
    .map((c: any) => ({ id: c.id, name: c.name, form_field_schema: c.form_field_schema || [], team_member_fields: c.team_member_fields || [] }))
  const v2Segments = graph
    ? Array.from(nodeById.values())
        .filter((n: any) => n.parent_id === graph.root_node_id)
        .map((n: any) => ({
          id: n.id,
          name: n.label,
          form_field_schema: n.fields || [],
          team_member_fields: n.behavior?.require_team?.fields || [],
        }))
    : []
  const segments = [...v1Segments, ...v2Segments]

  return apiOk({ registrations: result, segments })
}
