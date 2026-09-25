import { supabaseAdmin } from '@/lib/supabase'

import { apiError, apiOk } from '@/lib/api/response'

// Public, no params — used by the /olympiad page to show one card per
// online-submission segment (v2 form_nodes with linked olympiad).
//
// Returns one card per leaf node that has a linked olympiad
// (behavior->>'linked_olympiad_id' is non-null), filtered to sessions
// that are published, is_upcoming, and have registration_enabled = true.
//
// IMPORTANT: category_id points to the specific LEAF node ID for deep-linking.
export async function GET() {
  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug, description, cover_image_url')
    .eq('is_published', true)
    .eq('is_upcoming', true)
    .eq('registration_enabled', true)

  if (sessionError) return apiError(sessionError, 400)
  if (!sessions || sessions.length === 0) return apiOk([])

  const sessionIds = sessions.map(s => s.id)
  const sessionById = new Map(sessions.map(s => [s.id, s]))

  // Load all form graphs that belong to the qualifying sessions
  const { data: graphs } = await supabaseAdmin
    .from('form_graphs')
    .select('id, owner_id')
    .eq('owner_kind', 'activity')
    .in('owner_id', sessionIds)

  const graphIds = (graphs || []).map((g: any) => g.id)
  const graphById = new Map((graphs || []).map((g: any) => [g.id, g]))

  const cards: any[] = []
  if (graphIds.length > 0) {
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes')
      .select('id, label, parent_id, graph_id, behavior, enabled')
      .in('graph_id', graphIds)

    for (const node of nodes || []) {
      // Only include enabled leaf nodes with a linked olympiad
      if (!node.enabled) continue
      if (!node.behavior?.linked_olympiad_id) continue

      // Check if this is a leaf (no children)
      const hasChildren = (nodes || []).some((n: any) => n.parent_id === node.id)
      if (hasChildren) continue

      const graph = graphById.get(node.graph_id)
      if (!graph) continue

      const session = sessionById.get(graph.owner_id)
      if (!session || !session.slug) continue

      // Use the node's own label as the card title
      cards.push({
        category_id: node.id, // The v2 node ID
        name: node.label,
        description: null, // v2 nodes don't have descriptions at this level
        session_id: graph.owner_id,
        session_slug: session.slug,
        session_title: session.title,
        cover_image_url: session.cover_image_url || null,
        is_v2: true,
      })
    }
  }

  return apiOk(cards)
}
