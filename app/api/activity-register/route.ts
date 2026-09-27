import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'

// Public — same trust model as /api/olympiad-register's GET: a registration
// id is an unguessable UUID, so knowing it is treated as proof of identity
// for resuming a session / viewing a dashboard.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Missing id', 400)

  const { data: registration, error } = await supabaseAdmin
    .from('activity_registrations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !registration) {
    return apiError('Registration not found.', 404)
  }

  const { data: session } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .eq('id', registration.activity_session_id)
    .single()

  // All registrations are now v2 (form-graph). Fetch the leaf form_node
  // and surface its behavior for the dashboard.
  let categoryWithFlags: Record<string, any> | null = null
  let nodeLabel: string | null = null
  if ((registration as any).form_node_id) {
    const { data: fn } = await supabaseAdmin
      .from('form_nodes')
      .select('id, label, behavior')
      .eq('id', (registration as any).form_node_id)
      .maybeSingle()
    if (fn) {
      const b: any = (fn as any).behavior || {}
      nodeLabel = (fn as any).label || null
      // Build category-shaped object from node behavior for dashboard compatibility
      categoryWithFlags = {
        name: nodeLabel,
        linked_olympiad_id: b.linked_olympiad_id ?? null,
        submission: b.submission || null,
        schedule_date: b.schedule?.date ?? null,
        schedule_time: b.schedule?.time ?? null,
        schedule_room: b.schedule?.room ?? null,
      }
    }
  }

  // Sibling registrations: other registrations this same person has for
  // this same activity session — i.e. their other segments. An activity
  // can be segmented (multiple independent branches under one shared
  // form-graph root — see the submit route's `isSegmented` handling), and
  // someone can legitimately hold one registration per segment, but until
  // now the dashboard had no way to show that or offer registering for
  // another one — each dashboard view only ever knew about the single
  // registration id in the URL.
  //
  // Matched by member_id when the leader registered while logged in
  // (the reliable case); falls back to matching email for anonymous
  // registrations, since that's the same identity signal the submit
  // route itself uses for anonymous duplicate detection.
  let siblings: { id: string; label: string | null; created_at: string }[] = []
  if (registration.activity_session_id) {
    let sibQuery = supabaseAdmin
      .from('activity_registrations')
      .select('id, form_node_id, category_id, full_name, email, created_at')
      .eq('activity_session_id', registration.activity_session_id)
      .neq('id', registration.id)
    const { data: sibRows } = (registration as any).member_id
      ? await sibQuery.eq('member_id', (registration as any).member_id)
      : await sibQuery.eq('email', registration.email)
    if (sibRows?.length) {
      const nodeIds = [...new Set(sibRows.map((r: any) => r.form_node_id).filter(Boolean))]
      const labelsByNode = new Map<string, string>()
      if (nodeIds.length) {
        const { data: sibNodes } = await supabaseAdmin.from('form_nodes').select('id, label').in('id', nodeIds)
        for (const n of (sibNodes || [])) labelsByNode.set(n.id, n.label)
      }
      // v2 only - all registrations now use form_node_id
      siblings = sibRows.map((r: any) => ({
        id: r.id,
        label: (r.form_node_id && labelsByNode.get(r.form_node_id)) || null,
        created_at: r.created_at,
      }))
    }
  }

  // Root-node-only "disable multiple segment enroll" flag (see
  // FormNodeBehavior in lib/formGraph.ts) — same lookup as
  // app/activities/[slug]/page.tsx: find this activity's form_graphs row,
  // then the behavior jsonb on its root_node_id. The dashboard uses this
  // to hide its own "Register for another segment" button.
  let disableMultiSegmentEnroll = false
  if (registration.activity_session_id) {
    const { data: graphRow } = await supabaseAdmin
      .from('form_graphs')
      .select('root_node_id')
      .eq('owner_kind', 'activity')
      .eq('owner_id', registration.activity_session_id)
      .maybeSingle()
    if (graphRow?.root_node_id) {
      const { data: rootNode } = await supabaseAdmin
        .from('form_nodes')
        .select('behavior')
        .eq('id', graphRow.root_node_id)
        .maybeSingle()
      disableMultiSegmentEnroll = !!(rootNode as any)?.behavior?.disable_multi_segment_enroll
    }
  }

  return apiOk({
    registration,
    category: categoryWithFlags,
    session,
    node_label: nodeLabel,
    siblings,
    disable_multi_segment_enroll: disableMultiSegmentEnroll,
  })
}

// Lets a registrant edit their own basic info, but only while their edit
// window is still open (edit_locked_at, if set, must be in the future).
// This is enforced server-side — the dashboard UI also hides the edit
// button once closed, but that alone wouldn't stop a direct API call.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) return apiError('A registration id is required.', 400)

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('activity_registrations')
    .select('edit_locked_at, college')
    .eq('id', body.id)
    .single()

  if (fetchError || !existing) {
    return apiError('Registration not found.', 404)
  }
  if (existing.edit_locked_at && new Date(existing.edit_locked_at).getTime() <= Date.now()) {
    return apiError('The edit window for this registration has closed.', 403)
  }

  const allowedFields = ['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session', 'project_name']
  const patch: Record<string, any> = {}
  for (const key of allowedFields) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  if (patch.college_roll !== undefined) {
    const rollError = validateCollegeRoll(patch.college ?? existing.college, patch.college_roll)
    if (rollError) return apiError(rollError, 400)
  }

  const { error: updateError } = await supabaseAdmin
    .from('activity_registrations')
    .update(patch)
    .eq('id', body.id)

  if (updateError) return apiError(updateError, 400)
  return apiOk({ success: true })
}
