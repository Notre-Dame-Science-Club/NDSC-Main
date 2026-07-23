// Public: submit a single form node in a form graph.
//
// The runner calls this once per form node the user completes. The body
// has:
//   - graph_id  + node_id
//   - form       (built-in field values, only meaningful at the root node
//                 where the registration row is created)
//   - custom_answers
//   - team_members
//   - olympiad answers (mcq, short, photo) — only used when the graph
//     owner_kind is 'olympiad'
//
// The server decides what to do based on the node's role in the graph:
//
//   root node
//     - create the registration row, set form_graph_id / form_node_id /
//       submitted_node_ids = [node_id], write all built-ins to the
//       top-level columns
//   non-root node
//     - update the existing registration: merge custom_answers, append
//       the node id to submitted_node_ids, lift any olympiad question
//       fields into mcq_answers / short_answers / photo_answers
//   terminal node
//     - same as non-root, then mark exam_submitted_at (olympiad) or
//       just leave the row as final
//
// The response always tells the runner what's next:
//   { registration_id, next_node_id, done, node } where
//   - next_node_id is the FIRST child of the just-submitted node
//   - done = true when the submitted node is terminal OR the graph has
//     no further enabled children
//
// Anti-cheat enforcement (timer, no-copy) happens client-side via
// <AntiCheatProvider />. We rely on the same trust model the rest of
// the public registration API uses: a registration id is an unguessable
// UUID, so once the runner passes it back we trust it. (Re-grading the
// exam server-side and re-locking the dashboard if the timer was
// bypassed is a v2 concern.)

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { normalizeBlocks, HARD_MINIMUM_KEYS } from '@/lib/formBlocks'
import type { FormNode } from '@/lib/formGraph'

const OLYMPIAD_NODE_KINDS = new Set(['preset_olympiad_questions'])

type SubmitBody = {
  graph_id?: string
  node_id?: string
  registration_id?: string         // set on every non-root submit
  form?: Record<string, any>       // built-in values
  custom_answers?: Record<string, any>
  team_members?: any[]
  // olympiad question fields are merged into custom_answers by the client
  // (using `key` or `id`); the server lifts them to mcq_answers /
  // short_answers / photo_answers at the terminal submit.
}

function validateRequiredFields(node: FormNode, form: Record<string, any>, customAnswers: Record<string, any>) {
  const errors: string[] = []
  for (const f of normalizeBlocks(node.fields)) {
    if (f.kind !== 'field') continue
    if (!f.required) continue
    const v = (f as any).is_builtin
      ? form?.[(f as any).is_builtin]
      : customAnswers?.[f.key || f.id]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      errors.push(f.label || f.key || f.id)
    }
  }
  // Server-side hard minimum: for activity graphs the root must have these
  // regardless of what the schema says.
  if (node.parent_id === null) {
    for (const k of HARD_MINIMUM_KEYS) {
      if (!form?.[k] || (typeof form[k] === 'string' && !form[k].trim())) {
        errors.push(k)
      }
    }
  }
  return errors
}

export async function POST(req: NextRequest) {
  const body: SubmitBody = await req.json().catch(() => ({}))
  if (!body?.graph_id || !body?.node_id) {
    return apiError('graph_id and node_id are required.', 400)
  }

  // Load the node + graph together so we know the owner's kind and the
  // node's place in the tree.
  const { data: node, error: nErr } = await supabaseAdmin
    .from('form_nodes').select('*').eq('id', body.node_id).maybeSingle()
  if (nErr) return apiError(nErr, 400)
  if (!node) return apiError('Node not found.', 404)
  if (node.graph_id !== body.graph_id) {
    return apiError("Node doesn't belong to that graph.", 400)
  }
  if (!node.enabled) return apiError("This form is currently disabled.", 403)

  const { data: graph, error: gErr } = await supabaseAdmin
    .from('form_graphs').select('*').eq('id', body.graph_id).maybeSingle()
  if (gErr) return apiError(gErr, 400)
  if (!graph) return apiError('Graph not found.', 404)

  // Validate the inputs against the node's schema. We never trust the
  // client's claim about which fields are required — we re-derive it
  // from the node's `fields` JSONB.
  const form = body.form || {}
  const custom = body.custom_answers || {}
  const errors = validateRequiredFields(node as any, form, custom)
  if (errors.length) {
    return apiError(`Missing required field(s): ${errors.join(', ')}`, 400)
  }

  // Root node = creating a registration. Non-root = appending to one.
  // If registration_id was provided, it must already exist.
  let registrationId: string | null = body.registration_id || null
  const isOlympiad = graph.owner_kind === 'olympiad'
  const table = isOlympiad ? 'olympiad_registrations' : 'activity_registrations'
  const isRoot = node.parent_id === null

  if (isRoot) {
    if (registrationId) return apiError("Can't supply a registration id for the root submit.", 400)
    if (isOlympiad) {
      const rollError = validateCollegeRoll(form.college, form.college_roll)
      if (rollError) return apiError(rollError, 400)
      // mcq_answers / short_answers / photo_answers are JSONB, and we
      // lift any olympiad question fields from `custom` into them here.
      const { mcq, short, photo } = splitOlympiadAnswers(node as any, custom)
      const insert: Record<string, any> = {
        olympiad_id: graph.owner_id,
        full_name: form.full_name || null,
        phone: form.phone || null,
        email: form.email || null,
        college: form.college || null,
        college_roll: form.college_roll || null,
        hsc_session: form.hsc_session || null,
        custom_answers: custom,
        mcq_answers: mcq,
        short_answers: short,
        photo_answers: photo,
        form_graph_id: graph.id,
        form_node_id: node.id,
        submitted_node_ids: [node.id],
      }
      const { data, error } = await supabaseAdmin.from(table).insert(insert).select('id').single()
      if (error) return apiError(error, 400)
      registrationId = data.id
    } else {
      const rollError = validateCollegeRoll(form.college, form.college_roll)
      if (rollError) return apiError(rollError, 400)
      const insert: Record<string, any> = {
        activity_session_id: graph.owner_id,
        full_name: form.full_name || null,
        phone: form.phone || null,
        email: form.email || null,
        college: form.college || null,
        college_roll: form.college_roll || null,
        hsc_session: form.hsc_session || null,
        division: form.division || null,
        project_name: form.project_name || null,
        custom_answers: custom,
        team_members: body.team_members || [],
        form_graph_id: graph.id,
        form_node_id: node.id,
        submitted_node_ids: [node.id],
      }
      const { data, error } = await supabaseAdmin.from(table).insert(insert).select('id').single()
      if (error) return apiError(error, 400)
      registrationId = data.id
    }
  } else {
    if (!registrationId) return apiError("registration_id is required for non-root submits.", 400)
    // Load the existing registration so we can merge.
    const { data: existing, error: rErr } = await supabaseAdmin
      .from(table).select('*').eq('id', registrationId).maybeSingle()
    if (rErr) return apiError(rErr, 400)
    if (!existing) return apiError('Registration not found.', 404)
    if (existing.form_graph_id !== graph.id) {
      return apiError("Registration isn't on this form graph.", 400)
    }

    // Merge into the appropriate column shape.
    const patch: Record<string, any> = {
      form_node_id: node.id,
      submitted_node_ids: [...(existing.submitted_node_ids || []), node.id],
    }
    if (isOlympiad) {
      // Lift olympiad question fields into the dedicated columns.
      const { mcq, short, photo } = splitOlympiadAnswers(node as any, custom)
      patch.custom_answers = { ...(existing.custom_answers || {}), ...custom }
      patch.mcq_answers = { ...(existing.mcq_answers || {}), ...mcq }
      patch.short_answers = { ...(existing.short_answers || {}), ...short }
      patch.photo_answers = [...(existing.photo_answers || []), ...photo]
    } else {
      patch.custom_answers = { ...(existing.custom_answers || {}), ...custom }
      if (body.team_members && body.team_members.length) {
        patch.team_members = [...(existing.team_members || []), ...body.team_members]
      }
    }
    const { error: uErr } = await supabaseAdmin.from(table).update(patch).eq('id', registrationId)
    if (uErr) return apiError(uErr, 400)
  }

  // Figure out the next step. For an olympiad, the questions node sets
  // exam_started_at the FIRST time it's entered and exam_submitted_at
  // when its form is submitted (or the terminal node is submitted).
  if (isOlympiad) {
    await maybeMarkOlympiadTimers(table as any, registrationId, graph, node as any)
  }

  // Look up the next enabled child node. If the just-submitted node is
  // terminal OR has no enabled children, the flow is done.
  const { data: children } = await supabaseAdmin
    .from('form_nodes')
    .select('id, is_terminal, enabled, display_order')
    .eq('parent_id', node.id)
    .eq('enabled', true)
    .order('display_order', { ascending: true })

  const nextNodeId = (children && children.length) ? children[0].id : null
  const isDone = !!node.is_terminal || !nextNodeId

  return apiOk({
    registration_id: registrationId,
    next_node_id: nextNodeId,
    done: isDone,
    is_olympiad: isOlympiad,
  })
}

// Splits a node's olympiad question fields (mcq / checkbox / short_answer /
// photo) out of the generic custom_answers bag into the dedicated columns
// on olympiad_registrations. Returns the per-bucket maps / array. We do
// the split server-side so the client never has to know about it.
function splitOlympiadAnswers(node: FormNode, custom: Record<string, any>) {
  const mcq: Record<string, any> = {}
  const short: Record<string, any> = {}
  const photo: string[] = []
  for (const f of normalizeBlocks(node.fields)) {
    if (f.kind !== 'field') continue
    const k = f.key || f.id
    const v = custom[k]
    if (v === undefined) continue
    if (f.type === 'mcq') mcq[k] = v
    else if (f.type === 'checkbox') mcq[k] = v
    else if (f.type === 'short_answer') short[k] = v
    else if (f.type === 'photo') {
      if (Array.isArray(v)) photo.push(...v.filter((x: any) => typeof x === 'string'))
      else if (typeof v === 'string') photo.push(v)
    }
  }
  return { mcq, short, photo }
}

// For olympiad graphs, set exam_started_at the first time the registrant
// ENTERS the questions node (i.e. on its non-root submit OR — if the
// root is the questions node — on its root submit). Set exam_submitted_at
// when the questions node OR a downstream terminal node is submitted.
async function maybeMarkOlympiadTimers(table: string, registrationId: string, graph: any, node: FormNode) {
  const isQuestionsNode = node.kind === 'preset_olympiad_questions' || OLYMPIAD_NODE_KINDS.has(node.kind as any)
  if (!isQuestionsNode) return
  // exam_started_at is set the first time we see this node — the runner
  // doesn't submit a question node on entry, only on submit, so by the
  // time we get here exam_started_at might still be null. We approximate
  // "started" as the time of submit, which is the conservative choice.
  const patch: Record<string, any> = { exam_started_at: new Date().toISOString() }
  if (node.is_terminal) patch.exam_submitted_at = new Date().toISOString()
  await supabaseAdmin.from(table).update(patch).eq('id', registrationId)
}
