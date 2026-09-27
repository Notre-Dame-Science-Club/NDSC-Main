// Admin: auto-create an olympiad + its form_graph + root node, and link it to
// the calling form_node's behavior.linked_olympiad_id. Used by the node editor
// page's "Link this leaf to an Olympiad" checkbox when there's no olympiad in
// the DB yet to choose from.
//
// This is a specialized create-and-link operation that runs server-side — the
// olympiad + its question graph are committed immediately, not just staged
// locally. The admin doesn't need to hit "Save node" to persist the link.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormGraphBody, packFormNodeBody } from '@/lib/formGraph'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { id: nodeId } = await ctx.params

  // 1. Fetch the calling node to get its label and check if it's already linked
  const { data: node, error: nodeErr } = await supabaseAdmin
    .from('form_nodes')
    .select('id, label, behavior')
    .eq('id', nodeId)
    .maybeSingle()

  if (nodeErr) return apiError(nodeErr, 400)
  if (!node) return apiError('Node not found.', 404)

  // Short-circuit if the node is already linked to an olympiad
  if (node.behavior?.linked_olympiad_id) {
    // Fetch the existing olympiad and its graph to return the expected shape
    const { data: existingOlympiad } = await supabaseAdmin
      .from('olympiads')
      .select('*')
      .eq('id', node.behavior.linked_olympiad_id)
      .maybeSingle()

    const { data: existingGraph } = await supabaseAdmin
      .from('form_graphs')
      .select('id')
      .eq('owner_kind', 'olympiad')
      .eq('owner_id', node.behavior.linked_olympiad_id)
      .maybeSingle()

    return apiOk({
      olympiad: existingOlympiad || { id: node.behavior.linked_olympiad_id },
      exam_graph_id: existingGraph?.id || null,
      already_linked: true,
    })
  }

  // 2. Create the olympiad row, named after the form_node's label
  const olympiadName = node.label || 'Untitled Olympiad'
  const { data: olympiad, error: olympiadErr } = await supabaseAdmin
    .from('olympiads')
    .insert({
      name: olympiadName,
      description: '',
      is_active: true,
      timer_minutes: 60,
      exam_type: 'mixed',
      exam_mode: 'mixed',
      question_display: 'all_at_once',
      relay_mode: false,
      relay_type: 'sequential',
      subjects: [],
      subject_assignment_mode: 'self_select',
      external_only: false,
      result_published: false,
      annotations_published: false,
    })
    .select()
    .single()

  if (olympiadErr) {
    return apiError(`Failed to create olympiad: ${olympiadErr.message}`, 400)
  }

  // 3. Create the olympiad's form_graph (owner_kind='olympiad', owner_id=new olympiad id)
  const graphBody = packFormGraphBody({
    owner_kind: 'olympiad',
    owner_id: olympiad.id,
    title: olympiadName,
    settings: {
      anti_cheat: 'none',
      timer_minutes: 60,
      default_appearance: {},
    },
  })

  const { data: graph, error: graphErr } = await supabaseAdmin
    .from('form_graphs')
    .insert(graphBody)
    .select()
    .single()

  if (graphErr) {
    // Clean up the orphaned olympiad
    await supabaseAdmin.from('olympiads').delete().eq('id', olympiad.id)
    return apiError(`Failed to create olympiad graph: ${graphErr.message}`, 400)
  }

  // 4. Create the root node for the olympiad's graph. Following the pattern in
  //    app/api/admin/form-graphs/[id]/nodes/route.ts, we create a 'starter' node
  //    for the root. This gives the admin a blank slate to attach a
  //    preset_olympiad_questions node to.
  const rootNodeBody = packFormNodeBody({
    graph_id: graph.id,
    parent_id: null,
    position: { x: 100, y: 100 },
    label: 'Start',
    kind: 'starter',
    enabled: true,
    is_terminal: false,
    fields: [],
    appearance: {},
    behavior: {},
    display_order: 0,
  })

  const { data: rootNode, error: rootNodeErr } = await supabaseAdmin
    .from('form_nodes')
    .insert(rootNodeBody)
    .select()
    .single()

  if (rootNodeErr) {
    // Clean up the orphaned graph and olympiad
    await supabaseAdmin.from('form_graphs').delete().eq('id', graph.id)
    await supabaseAdmin.from('olympiads').delete().eq('id', olympiad.id)
    return apiError(`Failed to create root node: ${rootNodeErr.message}`, 400)
  }

  // 5. Wire the graph's root_node_id back to the new root
  const { error: graphUpdateErr } = await supabaseAdmin
    .from('form_graphs')
    .update({ root_node_id: rootNode.id })
    .eq('id', graph.id)

  if (graphUpdateErr) {
    // Clean up all three orphaned rows
    await supabaseAdmin.from('form_nodes').delete().eq('id', rootNode.id)
    await supabaseAdmin.from('form_graphs').delete().eq('id', graph.id)
    await supabaseAdmin.from('olympiads').delete().eq('id', olympiad.id)
    return apiError(`Failed to update graph root: ${graphUpdateErr.message}`, 400)
  }

  // 6. Update the calling node's behavior.linked_olympiad_id to point at the new olympiad
  const { error: nodeLinkErr } = await supabaseAdmin
    .from('form_nodes')
    .update({
      behavior: {
        ...(node.behavior || {}),
        linked_olympiad_id: olympiad.id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', nodeId)

  if (nodeLinkErr) {
    // Clean up all created rows on failure
    await supabaseAdmin.from('form_nodes').delete().eq('id', rootNode.id)
    await supabaseAdmin.from('form_graphs').delete().eq('id', graph.id)
    await supabaseAdmin.from('olympiads').delete().eq('id', olympiad.id)
    return apiError(`Failed to link node to olympiad: ${nodeLinkErr.message}`, 400)
  }

  // 7. Return the shape the frontend expects
  return apiOk({
    olympiad,
    exam_graph_id: graph.id,
  })
}
