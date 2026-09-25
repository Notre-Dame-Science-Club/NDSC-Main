// Public: resolve a form graph by its owner.
//
// The runner mounts on the registration page with `ownerKind` + `ownerId`
// (e.g. 'activity' + '<session-uuid>' or 'olympiad' + '<olympiad-uuid>')
// and calls this to load the graph + every node in it. The runner then
// walks the tree itself, one node at a time, asking the user to fill in
// each form's fields.
//
// We only return enabled nodes — disabled nodes are invisible to the
// public. We also resolve a `default_appearance` for the graph so the
// runner can fall back to it for nodes that don't override appearance
// themselves.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import type { FormGraph, FormNode } from '@/lib/formGraph'
import { getOlympiadActivityLink } from '@/lib/server/olympiadActivityLink'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const ownerKind = url.searchParams.get('owner_kind')
  const ownerId = url.searchParams.get('owner_id')
  if (!ownerKind || !ownerId) return apiError('owner_kind and owner_id are required.', 400)
  if (ownerKind !== 'activity' && ownerKind !== 'olympiad') {
    return apiError("owner_kind must be 'activity' or 'olympiad'.", 400)
  }

  // If this is an olympiad, check if it's linked to an activity leaf.
  // Linked olympiads must not be independently registrable — they're gated
  // behind their parent activity's registration flow.
  if (ownerKind === 'olympiad') {
    const link = await getOlympiadActivityLink(ownerId)
    if (link) {
      return apiError(
        `This olympiad is part of "${link.session_title}" and must be registered through that activity.`,
        404,
        {
          code: 'linked_to_activity',
          session_slug: link.session_slug,
          category_id: link.category_id,
        }
      )
    }
  }

  const { data: graph, error } = await supabaseAdmin
    .from('form_graphs')
    .select('*')
    .eq('owner_kind', ownerKind)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!graph) return apiError('No form graph configured for this event.', 404)

  // Load all nodes in the graph. The runner filters by enabled; we don't
  // do it server-side so admins can see the full graph shape in the
  // network tab if they want to debug.
  const { data: nodes, error: nErr } = await supabaseAdmin
    .from('form_nodes')
    .select('*')
    .eq('graph_id', graph.id)
    .order('display_order', { ascending: true })
  if (nErr) return apiError(nErr, 400)

  // Pull the owner event/olympiad's own title/description/cover image so
  // a node can auto-pull them instead of the admin having to duplicate
  // that info into the node's own appearance fields (see
  // FormNodeAppearance.auto_pull_title/description/cover in lib/formGraph.ts).
  let ownerTitle: string | null = null
  let ownerDescription: string | null = null
  let ownerCoverImageUrl: string | null = null
  if (ownerKind === 'activity') {
    const { data: sess } = await supabaseAdmin
      .from('activity_sessions').select('title, description, cover_image_url').eq('id', ownerId).maybeSingle()
    ownerTitle = sess?.title ?? null
    ownerDescription = sess?.description ?? null
    ownerCoverImageUrl = sess?.cover_image_url ?? null
  } else {
    const { data: oly } = await supabaseAdmin
      .from('olympiads').select('name, description, cover_image_url').eq('id', ownerId).maybeSingle()
    ownerTitle = oly?.name ?? null
    ownerDescription = oly?.description ?? null
    ownerCoverImageUrl = oly?.cover_image_url ?? null
  }

  return apiOk({
    graph: graph as FormGraph,
    nodes: (nodes || []) as FormNode[],
    owner_title: ownerTitle,
    owner: { title: ownerTitle, description: ownerDescription, cover_image_url: ownerCoverImageUrl },
  })
}
