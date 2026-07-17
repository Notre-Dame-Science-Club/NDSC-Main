import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// Full CRUD for the recursive activity_reg_categories tree. A category with
// no children is a "leaf" — that's the node registration actually happens
// against, and where custom_fields / team / payment / online-submission
// settings live. Non-leaf categories are pure organizational layers
// (Offline/Online, Class 5/Class 9-10, etc.) and ignore those columns.
//
// The online-submission auto-link (requirement: a leaf category that's
// really "submit your work online" becomes a real Olympiad under the hood)
// is handled here: when a leaf is saved with is_online_submission = true and
// it doesn't already have a linked_olympiad_id, this route creates a real
// row in `olympiads` for it and stores the new id back on the category.
// From that point on, the Activity registration flow for that leaf simply
// redirects into the existing Olympiad registration flow instead of using
// its own form — Activity and Olympiad are two faces of the same thing.

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('*')
    .eq('activity_session_id', sessionId)
    .order('display_order', { ascending: true })

  if (error) return apiError(error, 400)

  const categories = data || []
  const olympiadIds = [...new Set(categories.map(c => c.linked_olympiad_id).filter(Boolean))]
  if (olympiadIds.length > 0) {
    const { data: olympiads } = await supabaseAdmin
      .from('olympiads')
      .select('id, exam_type, relay_mode, relay_type')
      .in('id', olympiadIds)
    const byId = new Map((olympiads || []).map(o => [o.id, o]))
    for (const c of categories) {
      if (c.linked_olympiad_id) (c as any).linked_olympiad = byId.get(c.linked_olympiad_id) || null
    }
  }

  return apiOk({ categories })
}

async function createLinkedOlympiad(categoryName: string, sessionTitle: string) {
  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .insert({
      name: `${sessionTitle} — ${categoryName}`,
      description: `Online submission round for "${categoryName}" (part of the "${sessionTitle}" activity).`,
      mode: 'photo_submit',
      exam_type: 'photo_only',
      is_active: true,
      result_published: false,
      annotations_published: false,
      registration_fields: [],
      questions: [],
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

// Activity Admin exposes a single "Online Type" selector (Pure Submission /
// Full Quiz System / Mixed / Science Relay) that is really shorthand for the
// linked Olympiad's exam_type + relay_mode/relay_type columns — those stay
// the source of truth, but Activity Admin is now the place that sets them
// (Olympiad Admin shows them read-only for linked olympiads).
function onlineTypeToOlympiadPatch(onlineType: string): Record<string, any> | null {
  switch (onlineType) {
    case 'pure_submission': return { exam_type: 'photo_only', relay_mode: false }
    case 'full_quiz': return { exam_type: 'live_only', relay_mode: false }
    case 'mixed': return { exam_type: 'mixed', relay_mode: false }
    case 'science_relay': return { exam_type: 'live_only', relay_mode: true }
    default: return null
  }
}

async function applyOnlineType(linkedOlympiadId: string, onlineType: string) {
  const patch = onlineTypeToOlympiadPatch(onlineType)
  if (!patch) return
  await supabaseAdmin.from('olympiads').update(patch).eq('id', linkedOlympiadId)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.activity_session_id || !body.name?.trim()) {
    return apiError('activity_session_id and name are required.', 400)
  }

  const insertData: Record<string, any> = {
    activity_session_id: body.activity_session_id,
    parent_id: body.parent_id || null,
    name: body.name.trim(),
    description: body.description || null,
    display_order: body.display_order ?? 0,
    custom_fields: body.custom_fields || [],
    form_field_schema: body.form_field_schema || [],
    is_segment: body.is_segment ?? false,
    icon: body.icon || null,
    bg_image_url: body.bg_image_url || null,
    requires_team: body.requires_team ?? false,
    team_size_min: body.team_size_min ?? null,
    team_size_max: body.team_size_max ?? null,
    team_member_fields: body.team_member_fields || [],
    requires_payment: body.requires_payment ?? false,
    payment_amount: body.payment_amount ?? null,
    payment_label: body.payment_label || null,
    is_online_submission: body.is_online_submission ?? false,
    schedule_date: body.schedule_date || null,
    schedule_time: body.schedule_time || null,
    schedule_room: body.schedule_room || null,
    edit_window_hours: body.edit_window_hours ?? null,
    registration_open: body.registration_open ?? true,
  }

  // Auto-create the linked Olympiad if this is a new online-submission leaf.
  if (insertData.is_online_submission) {
    const { data: session } = await supabaseAdmin
      .from('activity_sessions')
      .select('title')
      .eq('id', body.activity_session_id)
      .single()
    try {
      insertData.linked_olympiad_id = await createLinkedOlympiad(insertData.name, session?.title || 'Activity')
      if (body.online_type) await applyOnlineType(insertData.linked_olympiad_id, body.online_type)
    } catch (e: any) {
      return apiError(`Could not create the linked olympiad: ${e.message}`, 400)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('activity_reg_categories')
    .insert(insertData)
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ category: data })
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return apiError('A category id is required.', 400)
  }
  const { id, online_type, ...rest } = body

  // If is_online_submission is being turned on and there's no link yet, create one now.
  if (rest.is_online_submission) {
    const { data: existing } = await supabaseAdmin
      .from('activity_reg_categories')
      .select('linked_olympiad_id, name, activity_session_id')
      .eq('id', id)
      .single()

    if (existing && !existing.linked_olympiad_id) {
      const { data: session } = await supabaseAdmin
        .from('activity_sessions')
        .select('title')
        .eq('id', existing.activity_session_id)
        .single()
      try {
        rest.linked_olympiad_id = await createLinkedOlympiad(rest.name || existing.name, session?.title || 'Activity')
      } catch (e: any) {
        return apiError(`Could not create the linked olympiad: ${e.message}`, 400)
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('activity_reg_categories')
    .update(rest)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 400)

  // online_type is Activity Admin's shorthand for the linked olympiad's
  // exam_type/relay_mode/relay_type — apply it there, not on this table.
  if (online_type && data?.linked_olympiad_id) {
    await applyOnlineType(data.linked_olympiad_id, online_type)
    const { data: olympiad } = await supabaseAdmin
      .from('olympiads')
      .select('id, exam_type, relay_mode, relay_type')
      .eq('id', data.linked_olympiad_id)
      .single()
    if (olympiad) (data as any).linked_olympiad = olympiad
  }

  return apiOk({ category: data })
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return apiError('A category id is required.', 400)
  }

  // ON DELETE CASCADE on parent_id handles deleting all descendants; the
  // linked Olympiad (if any) is intentionally NOT deleted automatically —
  // it may already have real registrations, so admin should delete that
  // separately and deliberately from the Olympiads admin page if needed.
  const { error } = await supabaseAdmin
    .from('activity_reg_categories')
    .delete()
    .eq('id', body.id)

  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
