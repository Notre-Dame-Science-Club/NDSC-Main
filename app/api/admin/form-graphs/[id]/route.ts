// Admin: get / update / delete a single form graph, plus the list of nodes
// it owns (for the diagram view to render in one round-trip).
//
// The PUT path is mostly used by the diagram for the "Save layout" button
// (updates positions of all nodes in one shot) and to rename the graph or
// tweak graph-level settings. Per-node edits go through /api/admin/form-nodes/[id].

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormGraphBody } from '@/lib/formGraph'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const { data: graph, error: gErr } = await supabaseAdmin
    .from('form_graphs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (gErr) return apiError(gErr, 400)
  if (!graph) return apiError('Graph not found.', 404)

  const { data: nodes, error: nErr } = await supabaseAdmin
    .from('form_nodes')
    .select('*')
    .eq('graph_id', id)
    .order('display_order', { ascending: true })

  if (nErr) return apiError(nErr, 400)

  return apiOk({ graph, nodes: nodes || [] })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request body.', 400)

  // "Save layout" path: body is { node_positions: { [nodeId]: {x,y} } }.
  // We do this as one batch update — Postgres handles 50-row updates
  // comfortably and the diagram saves often during dragging.
  if (body.node_positions && typeof body.node_positions === 'object') {
    const entries = Object.entries(body.node_positions as Record<string, { x: number; y: number }>)
    const updates = await Promise.all(entries.map(([nodeId, pos]) =>
      supabaseAdmin.from('form_nodes')
        .update({ position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 } })
        .eq('id', nodeId)
        .eq('graph_id', id)  // belt-and-suspenders: don't update other graphs
    ))
    for (const u of updates) if (u.error) return apiError(u.error, 400)
    return apiOk({ success: true, updated: entries.length })
  }

  // Plain graph-level update: title, settings, root_node_id, etc.
  const packed = packFormGraphBody(body)
  packed.updated_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('form_graphs')
    .update(packed)
    .eq('id', id)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk({ graph: data })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('form_graphs').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
