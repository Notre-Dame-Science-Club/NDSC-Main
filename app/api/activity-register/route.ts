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

  const { data: category } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('*')
    .eq('id', registration.category_id)
    .single()

  const { data: session } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .eq('id', registration.activity_session_id)
    .single()

  // Phase 4: when the registration was created through v2 (form-graph),
  // also fetch the leaf form_node and lift its online-round flags into
  // the response. The dashboard reads `data.category.is_online_submission`
  // and `data.category.linked_olympiad_id` to decide whether to show the
  // exam / relay link. v2 registrations don't have a category_id (Phase
  // 6 will let us drop the column), but they DO have form_node_id, so we
  // fetch the node's behavior and surface it the same way the legacy
  // category object did — so dashboard logic stays unchanged for both.
  //
  // Also surface the node's `label` as `node_label` — v2 registrations
  // have no `category_id`, so `category` (and therefore the segment name
  // the dashboard used to show under the event title) was always null
  // for them. The node someone actually finished on IS effectively their
  // segment ("Science Olympiad", "Quiz Competition", etc.), so its label
  // is the right stand-in.
  let nodeBehavior: { is_online_submission?: boolean; linked_olympiad_id?: string | null } | null = null
  let nodeLabel: string | null = null
  if ((registration as any).form_node_id) {
    const { data: fn } = await supabaseAdmin
      .from('form_nodes')
      .select('id, label, behavior')
      .eq('id', (registration as any).form_node_id)
      .maybeSingle()
    if (fn) {
      const b: any = (fn as any).behavior || {}
      nodeBehavior = {
        is_online_submission: !!b.is_online_submission,
        linked_olympiad_id: b.linked_olympiad_id ?? null,
      }
      nodeLabel = (fn as any).label || null
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
      const categoryIds = [...new Set(sibRows.map((r: any) => r.category_id).filter(Boolean))]
      const namesByCategory = new Map<string, string>()
      if (categoryIds.length) {
        const { data: sibCats } = await supabaseAdmin.from('activity_reg_categories').select('id, name').in('id', categoryIds)
        for (const c of (sibCats || [])) namesByCategory.set(c.id, c.name)
      }
      siblings = sibRows.map((r: any) => ({
        id: r.id,
        label: (r.form_node_id && labelsByNode.get(r.form_node_id)) || (r.category_id && namesByCategory.get(r.category_id)) || null,
        created_at: r.created_at,
      }))
    }
  }

  // If the legacy v1 path set up the category with online flags, prefer
  // those — they're the canonical v1 source. v2 paths get nodeBehavior
  // instead. We merge so callers can read either name uniformly.
  const categoryWithFlags = category
    ? { ...category, ...(nodeBehavior || {}) }
    : null

  return apiOk({ registration, category: categoryWithFlags, session, node_label: nodeLabel, siblings })
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
