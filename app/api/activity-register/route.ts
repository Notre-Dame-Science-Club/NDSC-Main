import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { resolveRegistrationIdentity, denyResponse } from '@/lib/server/registrationAccess'
import { normalizeEmail, normalizePhone, normalizeRoll } from '@/lib/identity'

// B11/B12: a registration id is no longer proof of identity. The caller must be
// the registration's leader (bearer token) or a team member (bearer-linked or a
// signed team token). Optional `slug` must match the registration's event, so a
// stale ?reg= or localStorage id from another event is rejected.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Missing id', 400)

  const idn = await resolveRegistrationIdentity(req, id)
  if (idn.ok === false) return denyResponse(idn)
  const registration: any = idn.registration

  const { data: session } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .eq('id', registration.activity_session_id)
    .single()

  const slugParam = req.nextUrl.searchParams.get('slug')
  if (slugParam && (session as any)?.slug !== slugParam) {
    return apiError('This registration belongs to a different event.', 404, { code: 'wrong_event' })
  }

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
      .not('completed_at', 'is', null)   // B2/B12: drafts are not registrations
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

  // B5: password hashes must never reach a client.
  const safeRegistration: any = { ...registration }
  if (Array.isArray(safeRegistration.team_members)) {
    safeRegistration.team_members = safeRegistration.team_members
      .map(({ password_hash, password, ...m }: any) => m)
  }

  return apiOk({
    registration: safeRegistration,
    category: categoryWithFlags,
    session,
    node_label: nodeLabel,
    siblings,
    disable_multi_segment_enroll: disableMultiSegmentEnroll,
    viewer: { role: idn.role, participant_id: idn.participantId },
  })
}

// B11: only the registration's LEADER may edit, identity fields are re-checked for
// uniqueness (same normalization as everywhere else), email is stored lowercased,
// and the edit window is enforced server-side.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) return apiError('A registration id is required.', 400)

  const idn = await resolveRegistrationIdentity(req, body.id)
  if (idn.ok === false) return denyResponse(idn)
  if (idn.role !== 'leader') return apiError('Only the team leader can edit these details.', 403)
  const existing: any = idn.registration

  if (existing.edit_locked_at && new Date(existing.edit_locked_at).getTime() <= Date.now()) {
    return apiError('The edit window for this registration has closed.', 403)
  }

  const allowedFields = ['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session', 'project_name']
  const patch: Record<string, any> = {}
  for (const key of allowedFields) {
    if (body[key] !== undefined) patch[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
  }
  if (patch.email !== undefined) patch.email = normalizeEmail(patch.email)
  for (const k of ['full_name', 'phone', 'email', 'college', 'college_roll']) {
    if (patch[k] !== undefined && !patch[k]) return apiError(`${k.replace('_', ' ')} cannot be empty.`, 400)
  }

  if (patch.college_roll !== undefined || patch.college !== undefined) {
    const rollError = validateCollegeRoll(patch.college ?? existing.college, patch.college_roll ?? existing.college_roll)
    if (rollError) return apiError(rollError, 400)
  }

  // Uniqueness: a changed identifier must not collide with anyone else's COMPLETE
  // registration in this event (leader or team member). Compared in code after
  // normalization, so no string-built PostgREST filters.
  const changed: Array<[string, string, (v: unknown) => string]> = []
  if (patch.email !== undefined && normalizeEmail(existing.email) !== patch.email) changed.push(['email', 'email', normalizeEmail])
  if (patch.phone !== undefined && normalizePhone(existing.phone) !== normalizePhone(patch.phone)) changed.push(['phone', 'phone number', normalizePhone])
  if (patch.college_roll !== undefined && normalizeRoll(existing.college_roll) !== normalizeRoll(patch.college_roll)) changed.push(['college_roll', 'college roll', normalizeRoll])
  if (changed.length) {
    const { data: others } = await supabaseAdmin
      .from('activity_registrations')
      .select('id, email, phone, college_roll, team_members')
      .eq('activity_session_id', existing.activity_session_id)
      .neq('id', existing.id)
      .not('completed_at', 'is', null)
    for (const [col, label, norm] of changed) {
      const mine = norm(patch[col])
      for (const o of (others || []) as any[]) {
        const hitLeader = norm(o[col]) === mine
        const hitTeam = (Array.isArray(o.team_members) ? o.team_members : []).some((m: any) => norm(m?.[col]) === mine)
        if (mine && (hitLeader || hitTeam)) {
          return apiError(`That ${label} is already registered for this event.`, 409, { existing_registration_id: o.id })
        }
      }
      // Also against this registration's own team members.
      const own = (Array.isArray(existing.team_members) ? existing.team_members : []).some((m: any) => norm(m?.[col]) === mine)
      if (mine && own) return apiError(`That ${label} is already used by one of your team members.`, 409)
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('activity_registrations')
    .update(patch)
    .eq('id', existing.id)

  if (updateError) return apiError(updateError, 400)
  return apiOk({ success: true })
}
