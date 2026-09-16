// Admin: re-parent a form node.
//
// Dragging a node in the diagram (or dragging a connection between nodes)
// ends up here. We accept either an explicit `parent_id` or a `target_id`
// (the node the dragged node should become a child of) plus a `position`
// (x, y on the canvas).
//
// Invariants we enforce:
//   1. The target parent must be in the same graph as the dragged node.
//      Moving a node between graphs is not allowed — delete + re-add.
//   2. The new parent cannot be the node itself, and cannot be a descendant
//      of the node (which would create a cycle in the tree).
//   3. The graph's root must remain a root (parent_id = null). If a user
//      tries to reparent the root to something else we reject the request.
//   4. display_order is preserved on the new parent — we put the moved
//      node at the END of the new sibling list so admins can re-order
//      via the diagram afterwards.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

type Ctx = { params: Promise<{ id: string }> }

async function collectDescendantIds(rootId: string): Promise<Set<string>> {
  const all = new Set<string>([rootId])
  let frontier = [rootId]
  while (frontier.length) {
    const { data: children } = await supabaseAdmin
      .from('form_nodes').select('id').in('parent_id', frontier)
    const ids = (children || []).map((c: any) => c.id)
    if (!ids.length) break
    ids.forEach(id => all.add(id))
    frontier = ids
  }
  return all
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = await req.json().catch(() => null) as { parent_id?: string | null; position?: { x: number; y: number } } | null
  if (!body) return apiError('Invalid request body.', 400)

  // Load the dragged node and its graph.
  const { data: node, error: fErr } = await supabaseAdmin
    .from('form_nodes').select('id, graph_id, parent_id').eq('id', id).maybeSingle()
  if (fErr) return apiError(fErr, 400)
  if (!node) return apiError('Node not found.', 404)

  // Rule 3: don't allow re-parenting the root. The graph's entry point
  // must always be a node with parent_id = null.
  if (node.parent_id === null && body.parent_id !== null && body.parent_id !== undefined) {
    return apiError("You can't attach the graph's root to another node.", 400)
  }

  // If the caller didn't pass a parent_id, this is a no-op. Still allow a
  // position-only update below.
  let newParentId: string | null | undefined = body.parent_id

  if (newParentId === id) {
    return apiError("A node can't be its own parent.", 400)
  }

  if (newParentId) {
    // Verify the new parent exists and is in the same graph.
    const { data: parent, error: pErr } = await supabaseAdmin
      .from('form_nodes').select('id, graph_id').eq('id', newParentId).maybeSingle()
    if (pErr) return apiError(pErr, 400)
    if (!parent) return apiError('Target parent not found.', 404)
    if (parent.graph_id !== node.graph_id) {
      return apiError("Can't move a node into a different graph.", 400)
    }

    // Rule 2: forbid creating a cycle. If newParentId is a descendant of
    // the dragged node, we'd loop forever.
    const descendants = await collectDescendantIds(id)
    if (descendants.has(newParentId)) {
      return apiError("Can't re-parent a node under one of its own descendants.", 400)
    }
  }

  // Compute display_order on the new parent — push to the end.
  let display_order: number | undefined
  if (newParentId !== undefined) {
    const { data: siblings } = await supabaseAdmin
      .from('form_nodes').select('display_order').eq('graph_id', node.graph_id).eq('parent_id', newParentId)
    const maxOrder = (siblings || []).reduce((m: number, r: any) => Math.max(m, r.display_order ?? 0), 0)
    display_order = maxOrder + 1
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (newParentId !== undefined) patch.parent_id = newParentId
  if (body.position) patch.position = body.position
  if (display_order !== undefined) patch.display_order = display_order

  const { data, error } = await supabaseAdmin
    .from('form_nodes').update(patch).eq('id', id).select().single()
  if (error) return apiError(error, 400)
  return apiOk({ node: data })
}
