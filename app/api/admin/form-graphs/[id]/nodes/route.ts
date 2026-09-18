// Admin: add a new node to a graph. Used by the diagram view's "+ Add"
// toolbar buttons. The kind, parent_id, and (for preset_*) seed fields
// come from the request body.
//
// We auto-position new nodes slightly offset from the cursor position
// (passed as `at: {x,y}`) so they don't all land on top of each other.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormNodeBody } from '@/lib/formGraph'
import { builtinFieldDefs } from '@/lib/formBlocks'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id: graphId } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request body.', 400)

  // Confirm the graph exists before we try to add a node to it.
  const { data: graph, error: gErr } = await supabaseAdmin
    .from('form_graphs').select('id, root_node_id').eq('id', graphId).maybeSingle()
  if (gErr) return apiError(gErr, 400)
  if (!graph) return apiError('Graph not found.', 404)

  // If this is the first node, make it the graph's root and force
  // kind='starter'. A graph must always have exactly one root.
  let kind = body.kind || 'blank'
  let parentId: string | null = body.parent_id || null
  let isTerminal = !!body.is_terminal

  if (!graph.root_node_id) {
    parentId = null
    kind = 'starter'
    isTerminal = false
  } else if (!parentId) {
    // Caller didn't say where to attach — error. The diagram's "+ Add"
    // button always passes parent_id of the currently-selected node.
    return apiError('parent_id is required when the graph already has a root.', 400)
  }

  // Seed fields for the preset_* kinds. 'blank' starts empty.
  let fields: any[] = []
  let label = body.label || 'Untitled form'
  switch (kind) {
    case 'preset_common_details':
      fields = builtinFieldDefs()
      label = body.label || 'Common details'
      break
    case 'preset_olympiad_questions':
      fields = []   // populated from olympiads.questions on first save (see PUT)
      label = body.label || 'Questions'
      break
    case 'preset_team_info':
      fields = []
      label = body.label || 'Team info'
      break
    case 'blank':
    case 'starter':
    default:
      label = body.label || (kind === 'starter' ? 'Starter' : 'Blank form')
  }

  // Position: place near the cursor with a small offset, falling back to
  // a sensible default.
  const at = body.at && typeof body.at === 'object' ? body.at : { x: 100, y: 100 }

  const packed = packFormNodeBody({
    graph_id: graphId,
    parent_id: parentId,
    position: { x: Number(at.x) || 100, y: Number(at.y) || 100 },
    label,
    kind,
    enabled: true,
    is_terminal: isTerminal,
    fields,
    appearance: body.appearance || {},
    behavior: body.behavior || {},
    display_order: body.display_order || 0,
  })

  const { data: node, error } = await supabaseAdmin
    .from('form_nodes')
    .insert(packed)
    .select()
    .single()

  if (error) return apiError(error, 400)

  // If this is the new root, wire graph.root_node_id back. For an existing
  // graph the root is already set; we don't allow re-rooting via this path.
  if (!graph.root_node_id) {
    await supabaseAdmin.from('form_graphs').update({ root_node_id: node.id }).eq('id', graphId)
  }

  return apiOk({ node })
}
