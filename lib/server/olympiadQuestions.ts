// Server-only helper. Exam questions for an olympiad used to live in the
// standalone `olympiads.questions` jsonb column, edited by a bespoke editor
// in the admin Olympiad tab. That's gone — questions are now just ALL fields
// (any FieldBlockType) on the olympiad's form_graph nodes, edited via Form
// Builder. This centralizes the one query needed to fetch them, so relay-exam
// scoring, the public olympiad route, and the registrations CSV export all read
// the same source.
//
// NEW BEHAVIOR: Every field (kind: 'field', any type) on EVERY node of the
// olympiad's form_graph counts as a question, EXCEPT fields on nodes with kind
// 'preset_common_details' or 'preset_team_info' (those are registration/identity
// info, not exam content).

import { supabaseAdmin } from '@/lib/supabase'
import type { FormBlock } from '@/lib/formBlocks'

// Node kinds that contain identity/registration info, NOT exam questions
const IDENTITY_NODE_KINDS = new Set(['preset_common_details', 'preset_team_info'])

export async function getOlympiadQuestionFields(olympiadId: string): Promise<FormBlock[]> {
  const { data: graph } = await supabaseAdmin
    .from('form_graphs')
    .select('id')
    .eq('owner_kind', 'olympiad')
    .eq('owner_id', olympiadId)
    .maybeSingle()

  if (!graph) return []

  // Fetch ALL nodes in the graph (not just preset_olympiad_questions)
  const { data: nodes } = await supabaseAdmin
    .from('form_nodes')
    .select('fields, display_order, kind')
    .eq('graph_id', graph.id)
    .order('display_order', { ascending: true })

  const all: FormBlock[] = []
  for (const n of nodes || []) {
    // Skip identity/registration nodes — their fields aren't exam questions
    if (IDENTITY_NODE_KINDS.has((n as any).kind)) continue

    for (const f of (n.fields as FormBlock[]) || []) {
      // Include ALL field blocks, regardless of type
      if (f.kind === 'field') all.push(f)
    }
  }
  return all
}
