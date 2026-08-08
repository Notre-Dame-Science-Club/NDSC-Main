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
  let nodeBehavior: { is_online_submission?: boolean; linked_olympiad_id?: string | null } | null = null
  if ((registration as any).form_node_id) {
    const { data: fn } = await supabaseAdmin
      .from('form_nodes')
      .select('id, behavior')
      .eq('id', (registration as any).form_node_id)
      .maybeSingle()
    if (fn) {
      const b: any = (fn as any).behavior || {}
      nodeBehavior = {
        is_online_submission: !!b.is_online_submission,
        linked_olympiad_id: b.linked_olympiad_id ?? null,
      }
    }
  }

  // If the legacy v1 path set up the category with online flags, prefer
  // those — they're the canonical v1 source. v2 paths get nodeBehavior
  // instead. We merge so callers can read either name uniformly.
  const categoryWithFlags = category
    ? { ...category, ...(nodeBehavior || {}) }
    : null

  return apiOk({ registration, category: categoryWithFlags, session })
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
