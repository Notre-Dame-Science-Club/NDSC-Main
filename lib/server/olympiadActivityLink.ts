import { supabaseAdmin } from '@/lib/supabase'

export type OlympiadActivityLink = {
  session_id: string
  session_slug: string | null
  session_title: string | null
  category_id: string
  is_v2: boolean
  breadcrumb: string[]
}

/**
 * Check if an olympiad is linked to an activity leaf (registration segment).
 * Returns link details if found in v2 (form_nodes) system, null if this is
 * a genuinely standalone olympiad.
 *
 * Used to:
 * - Gate /api/public/form-graph from loading olympiad graphs that must go
 *   through their parent activity's registration flow instead
 * - Filter /api/olympiad?listing=1 to exclude activity-linked olympiads
 * - Power /api/admin/online-categories to show v2 links
 * - Route olympiad directory cards to the correct activity deep-link
 */
export async function getOlympiadActivityLink(olympiadId: string): Promise<OlympiadActivityLink | null> {
  // Check v2: form_nodes where behavior->>'linked_olympiad_id' = olympiadId
  const { data: v2Nodes } = await supabaseAdmin
    .from('form_nodes')
    .select('id, label, parent_id, graph_id, behavior')

  const v2Leaf = (v2Nodes || []).find((n: any) =>
    n.behavior?.linked_olympiad_id === olympiadId
  )

  if (v2Leaf) {
    // Walk parent_id chain within same graph_id for breadcrumb
    const siblingsInGraph = (v2Nodes || []).filter((n: any) => n.graph_id === v2Leaf.graph_id)
    const nodeById = new Map(siblingsInGraph.map((n: any) => [n.id, n]))

    const breadcrumb: string[] = []
    let node = nodeById.get(v2Leaf.id)
    while (node) {
      breadcrumb.unshift(node.label)
      node = node.parent_id ? nodeById.get(node.parent_id) : null
    }

    // Resolve the graph's owner (must be an activity session for this link to make sense)
    const { data: graph } = await supabaseAdmin
      .from('form_graphs')
      .select('owner_kind, owner_id')
      .eq('id', v2Leaf.graph_id)
      .maybeSingle()

    if (!graph || graph.owner_kind !== 'activity') return null

    const { data: session } = await supabaseAdmin
      .from('activity_sessions')
      .select('id, title, slug')
      .eq('id', graph.owner_id)
      .maybeSingle()

    return {
      session_id: graph.owner_id,
      session_slug: session?.slug ?? null,
      session_title: session?.title ?? null,
      category_id: v2Leaf.id,
      is_v2: true,
      breadcrumb,
    }
  }

  return null
}
