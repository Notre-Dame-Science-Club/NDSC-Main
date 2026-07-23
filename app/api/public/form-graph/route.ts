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

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const ownerKind = url.searchParams.get('owner_kind')
  const ownerId = url.searchParams.get('owner_id')
  if (!ownerKind || !ownerId) return apiError('owner_kind and owner_id are required.', 400)
  if (ownerKind !== 'activity' && ownerKind !== 'olympiad') {
    return apiError("owner_kind must be 'activity' or 'olympiad'.", 400)
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

  // Pull the owner's display title so the runner can show something
  // meaningful before any node's title kicks in.
  let ownerTitle: string | null = null
  if (ownerKind === 'activity') {
    const { data: sess } = await supabaseAdmin
      .from('activity_sessions').select('title').eq('id', ownerId).maybeSingle()
    ownerTitle = sess?.title ?? null
  } else {
    const { data: oly } = await supabaseAdmin
      .from('olympiads').select('name').eq('id', ownerId).maybeSingle()
    ownerTitle = oly?.name ?? null
  }

  return apiOk({
    graph: graph as FormGraph,
    nodes: (nodes || []) as FormNode[],
    owner_title: ownerTitle,
  })
}
