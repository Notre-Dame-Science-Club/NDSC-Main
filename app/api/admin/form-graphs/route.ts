// Admin: list all form graphs (with a "create" helper to seed from an
// existing activity session or olympiad), or delete by id.
//
// Listing returns one row per graph with the owner_kind/owner_id/title and
// a node count. Creating a graph is owner-scoped: the body must include
// { owner_kind, owner_id, title }. We don't auto-create a starter node here
// — that happens in the per-graph detail route so we can also wire the
// graph's root_node_id back-reference.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormGraphBody } from '@/lib/formGraph'

export async function GET(_req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  // Pull graphs. Node counts come from a separate grouped count so the
  // query is O(graphs + 1) regardless of how many nodes exist.
  const { data: graphs, error: gErr } = await supabaseAdmin
    .from('form_graphs')
    .select('*')
    .order('updated_at', { ascending: false })

  if (gErr) return apiError(gErr, 400)

  const { data: counts, error: cErr } = await supabaseAdmin
    .from('form_nodes')
    .select('graph_id')

  if (cErr) return apiError(cErr, 400)

  const countMap: Record<string, number> = {}
  for (const r of counts || []) countMap[r.graph_id] = (countMap[r.graph_id] || 0) + 1

  // Resolve owner titles for the list view so admins see "Science Olympiad
  // 2025" instead of a bare UUID. One query per kind, batched in parallel.
  const activityIds = (graphs || []).filter(g => g.owner_kind === 'activity').map(g => g.owner_id)
  const olympiadIds = (graphs || []).filter(g => g.owner_kind === 'olympiad').map(g => g.owner_id)

  const [actRes, olyRes] = await Promise.all([
    activityIds.length
      ? supabaseAdmin.from('activity_sessions').select('id, title').in('id', activityIds)
      : Promise.resolve({ data: [], error: null } as any),
    olympiadIds.length
      ? supabaseAdmin.from('olympiads').select('id, name').in('id', olympiadIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  const actMap: Record<string, string> = Object.fromEntries((actRes.data || []).map((a: any) => [a.id, a.title]))
  const olyMap: Record<string, string> = Object.fromEntries((olyRes.data || []).map((o: any) => [o.id, o.name]))

  const out = (graphs || []).map((g: any) => ({
    ...g,
    node_count: countMap[g.id] || 0,
    owner_title: g.owner_kind === 'activity' ? actMap[g.owner_id] : olyMap[g.owner_id] || '(missing)',
  }))

  return apiOk({ graphs: out })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request body.', 400)
  if (!body.owner_kind || !body.owner_id) {
    return apiError('owner_kind and owner_id are required.', 400)
  }
  if (body.owner_kind !== 'activity' && body.owner_kind !== 'olympiad') {
    return apiError('owner_kind must be "activity" or "olympiad".', 400)
  }

  // Idempotency: if a graph already exists for this (owner_kind, owner_id),
  // return it instead of creating a duplicate. UNIQUE on the table would
  // also enforce this at the DB level; we handle it here for a friendlier
  // error message.
  const { data: existing } = await supabaseAdmin
    .from('form_graphs')
    .select('*')
    .eq('owner_kind', body.owner_kind)
    .eq('owner_id', body.owner_id)
    .maybeSingle()

  if (existing) return apiOk({ graph: existing, created: false })

  // Look up the owner so we can pre-fill the graph title.
  let ownerTitle = body.title || 'Untitled form graph'
  if (body.owner_kind === 'activity') {
    const { data: s } = await supabaseAdmin.from('activity_sessions').select('title').eq('id', body.owner_id).maybeSingle()
    if (s?.title) ownerTitle = s.title
  } else {
    const { data: o } = await supabaseAdmin.from('olympiads').select('name').eq('id', body.owner_id).maybeSingle()
    if (o?.name) ownerTitle = o.name
  }

  const packed = packFormGraphBody({ ...body, title: ownerTitle, settings: body.settings || {} })
  const { data, error } = await supabaseAdmin
    .from('form_graphs')
    .insert(packed)
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ graph: data, created: true })
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json().catch(() => ({}))
  if (!id) return apiError('id is required.', 400)
  // form_nodes has ON DELETE CASCADE → graph delete removes all nodes too.
  const { error } = await supabaseAdmin.from('form_graphs').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
