import { supabaseAdmin } from '@/lib/supabase'

import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET — every leaf (v1 activity_reg_categories OR v2 form_nodes) with a
// linked_olympiad_id, across ALL activity sessions, with enough breadcrumb
// info (session + ancestor names) for the Admin Olympiad page to label each
// olympiad as "Activity-derived" and link back to where its registration
// structure is actually edited.
export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  // Fetch v1 links
  const { data: v1LinkedLeaves, error: v1Error } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, name, parent_id, activity_session_id, linked_olympiad_id, custom_fields, requires_team, requires_payment, registration_open')
    .not('linked_olympiad_id', 'is', null)

  if (v1Error) return apiError(v1Error, 400)

  // Fetch v2 links (form_nodes with behavior.linked_olympiad_id)
  const { data: allNodes, error: nodesError } = await supabaseAdmin
    .from('form_nodes')
    .select('id, label, parent_id, graph_id, behavior')

  if (nodesError) return apiError(nodesError, 400)

  const v2LinkedLeaves = (allNodes || []).filter((n: any) =>
    n.behavior?.linked_olympiad_id
  )

  // Build combined result
  const result: any[] = []

  // Process v1 leaves
  if (v1LinkedLeaves && v1LinkedLeaves.length > 0) {
    const sessionIds = [...new Set(v1LinkedLeaves.map(c => c.activity_session_id))]
    const { data: sessions } = await supabaseAdmin
      .from('activity_sessions')
      .select('id, title, slug')
      .in('id', sessionIds)
    const sessionById = new Map((sessions || []).map(s => [s.id, s]))

    const { data: allCats } = await supabaseAdmin
      .from('activity_reg_categories')
      .select('id, name, parent_id, activity_session_id')
      .in('activity_session_id', sessionIds)
    const catById = new Map((allCats || []).map(c => [c.id, c]))

    for (const leaf of v1LinkedLeaves) {
      const breadcrumb: string[] = []
      let node: any = catById.get(leaf.id)
      while (node) { breadcrumb.unshift(node.name); node = node.parent_id ? catById.get(node.parent_id) : null }
      const session = sessionById.get(leaf.activity_session_id)
      result.push({
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
        is_v2: false,
      })
    }
  }

  // Process v2 leaves
  if (v2LinkedLeaves.length > 0) {
    const graphIds = [...new Set(v2LinkedLeaves.map((n: any) => n.graph_id))]
    const { data: graphs } = await supabaseAdmin
      .from('form_graphs')
      .select('id, owner_kind, owner_id')
      .in('id', graphIds)
    const graphById = new Map((graphs || []).map(g => [g.id, g]))

    // Only include graphs owned by activity sessions
    const activityGraphs = (graphs || []).filter((g: any) => g.owner_kind === 'activity')
    const sessionIds = [...new Set(activityGraphs.map((g: any) => g.owner_id))]

    if (sessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('activity_sessions')
        .select('id, title, slug')
        .in('id', sessionIds)
      const sessionById = new Map((sessions || []).map(s => [s.id, s]))

      for (const leaf of v2LinkedLeaves) {
        const graph = graphById.get(leaf.graph_id)
        if (!graph || graph.owner_kind !== 'activity') continue

        // Build breadcrumb by walking parent_id within the same graph
        const siblingsInGraph = (allNodes || []).filter((n: any) => n.graph_id === leaf.graph_id)
        const nodeById = new Map(siblingsInGraph.map((n: any) => [n.id, n]))

        const breadcrumb: string[] = []
        let node = nodeById.get(leaf.id)
        while (node) {
          breadcrumb.unshift(node.label)
          node = node.parent_id ? nodeById.get(node.parent_id) : null
        }

        const session = sessionById.get(graph.owner_id)
        result.push({
          olympiad_id: leaf.behavior.linked_olympiad_id,
          category_id: leaf.id,
          session_id: graph.owner_id,
          session_title: session?.title,
          session_slug: session?.slug,
          breadcrumb,
          registration_open: true, // v2 doesn't have per-node registration_open flag yet
          requires_team: leaf.behavior?.requires_team ?? false,
          requires_payment: false, // v2 payment is handled elsewhere
          custom_fields: [], // v2 uses submission_config instead
          is_v2: true,
        })
      }
    }
  }

  return apiOk(result)
}
