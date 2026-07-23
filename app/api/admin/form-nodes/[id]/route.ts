// Admin: get / update / delete a single form node.
//
// Update handles all node-level edits: label, fields, appearance, behavior,
// parent_id, enabled, is_terminal, position, display_order. The diagram
// view uses this for inline toggles; the node editor page uses it for the
// "Save node" button.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormNodeBody } from '@/lib/formGraph'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const { data, error } = await supabaseAdmin
    .from('form_nodes').select('*').eq('id', id).maybeSingle()
  if (error) return apiError(error, 400)
  if (!data) return apiError('Node not found.', 404)
  return apiOk({ node: data })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request body.', 400)

  // Re-parenting (parent_id change) and root reassignment are not
  // allowed through this endpoint — that's an admin-only operation that
  // the diagram view handles explicitly so we can keep invariants simple.
  // We silently drop those keys if present.
  const safe = { ...body }
  delete safe.id
  delete safe.graph_id
  delete safe.parent_id
  delete safe.created_at

  const packed = packFormNodeBody(safe)
  packed.updated_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('form_nodes').update(packed).eq('id', id).select().single()
  if (error) return apiError(error, 400)
  return apiOk({ node: data })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  // Don't allow deleting the graph's root — that would leave the runner
  // with no entry point. The diagram view disables the delete button on
  // the root; this is the server-side backstop.
  const { data: node, error: fErr } = await supabaseAdmin
    .from('form_nodes').select('id, graph_id, parent_id').eq('id', id).maybeSingle()
  if (fErr) return apiError(fErr, 400)
  if (!node) return apiOk({ success: true })  // already gone
  if (node.parent_id === null) {
    return apiError("You can't delete the graph's root node. Delete the whole graph instead.", 400)
  }

  // Cascade-delete all descendants of this node so we don't leave orphans
  // pointing at a non-existent parent. We do this iteratively in case
  // the tree is deeper than expected.
  let toDelete = [id]
  const all: string[] = [id]
  while (toDelete.length) {
    const { data: children } = await supabaseAdmin
      .from('form_nodes').select('id').in('parent_id', toDelete)
    const childIds = (children || []).map((c: any) => c.id)
    if (!childIds.length) break
    all.push(...childIds)
    toDelete = childIds
  }
  const { error } = await supabaseAdmin.from('form_nodes').delete().in('id', all)
  if (error) return apiError(error, 400)
  return apiOk({ success: true, deleted: all.length })
}
