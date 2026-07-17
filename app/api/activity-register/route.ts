import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { hashPassword } from '@/lib/password'
import { sendEmail } from '@/lib/email'
import { apiError, apiOk } from '@/lib/api/response'

type TeamMemberInput = {
  full_name: string
  phone?: string
  email: string
  college_roll: string
  password: string
  custom_answers?: Record<string, string>
}

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

  return apiOk({ registration, category, session })
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request.', 400)

  const {
    category_id,
    full_name, phone, email, college, college_roll, hsc_session, division,
    project_name,
    custom_answers,
    team_members, // TeamMemberInput[] — only relevant if the category requires_team
    member_id, // optional — set if the registrant was a logged-in member
  } = body

  if (!category_id) return apiError('category_id is required.', 400)
  if (!full_name?.trim()) return apiError('Name is required.', 400)
  if (!phone?.trim()) return apiError('Phone number is required.', 400)
  if (!email?.trim()) return apiError('Email is required.', 400)
  if (!college?.trim()) return apiError('College is required.', 400)

  const rollError = validateCollegeRoll(college, college_roll)
  if (rollError) return apiError(rollError, 400)

  // Load category first (needed below) before validating project_name,
  // since project_name_enabled lives on the category.
  // Load the leaf category to know what's actually required here (team,
  // payment, custom fields) — never trust the client's claims about its own
  // requirements, since this is a public route.
  const { data: category, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('*')
    .eq('id', category_id)
    .single()

  if (catError || !category) {
    return apiError('Registration category not found.', 404)
  }

  // Registration must be open on this leaf AND on every ancestor above it
  // (closing a primary field closes everything nested under it too).
  {
    let node: any = category
    while (node) {
      if (node.registration_open === false) {
        return apiError('Registration is closed for this category.', 403)
      }
      if (!node.parent_id) break
      const { data: parent } = await supabaseAdmin
        .from('activity_reg_categories')
        .select('id, parent_id, registration_open')
        .eq('id', node.parent_id)
        .single()
      node = parent
    }
  }

  // Validate required custom fields (legacy `custom_fields` shape — the
  // pre-segment-redesign per-category extras. Still honored for backward
  // compat with existing rows.)
  for (const field of category.custom_fields || []) {
    const val = custom_answers?.[field.key]
    const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)
    if (field.required && isEmpty) {
      return apiError(`"${field.label}" is required.`, 400)
    }
    if ((field.type === 'photo' || field.type === 'file') && Array.isArray(val)) {
      const maxFiles = field.max_files && field.max_files > 1 ? field.max_files : 1
      if (val.length > maxFiles) {
        return apiError(`"${field.label}" allows at most ${maxFiles} file${maxFiles > 1 ? 's' : ''}.`, 400)
      }
    }
  }

  // Validate the new unified form_field_schema. Built-in fields' values
  // live on the top-level body (full_name, phone, etc.); all other fields
  // live in custom_answers. We also re-enforce the hard minimum
  // (full_name, phone, email, college_roll) here as a backstop for the
  // case where admin deleted a built-in field from the schema and the
  // client never sent it.
  const HARD_MIN = ['full_name', 'phone', 'email', 'college_roll']
  for (const key of HARD_MIN) {
    if (!body[key]?.toString().trim()) {
      return apiError(`"${key.replace(/_/g, ' ')}" is required.`, 400)
    }
  }
  if (Array.isArray(category.form_field_schema)) {
    for (const field of category.form_field_schema) {
      if (!field || !field.required) continue
      // For built-in fields the value is on the top-level body, mapped by
      // the field's is_builtin key.
      const builtinKey = field.is_builtin as string | undefined
      const value = builtinKey
        ? body[builtinKey]
        : custom_answers?.[field.key ?? field.id]
      const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
      if (isEmpty) {
        return apiError(`"${field.label || field.key || field.id}" is required.`, 400)
      }
      // Photo / file field max-files cap
      if ((field.type === 'photo' || field.type === 'file') && Array.isArray(value)) {
        const maxFiles = field.max_files && field.max_files > 1 ? field.max_files : 1
        if (value.length > maxFiles) {
          return apiError(`"${field.label}" allows at most ${maxFiles} file${maxFiles > 1 ? 's' : ''}.`, 400)
        }
      }
    }
  }

  if (category.project_name_enabled && !project_name?.trim()) {
    return apiError(`"${category.project_name_label || 'Project Name'}" is required.`, 400)
  }

  // Validate + prepare team members
  let preparedTeamMembers: any[] = []
  if (category.requires_team) {
    const members: TeamMemberInput[] = Array.isArray(team_members) ? team_members : []
    const min = category.team_size_min || 1
    const max = category.team_size_max || 99
    if (members.length < min || members.length > max) {
      return apiError(
        `This category requires between ${min} and ${max} team members (not counting yourself as leader).`,
        400
      )
    }
    for (const m of members) {
      if (!m.full_name?.trim() || !m.email?.trim() || !m.college_roll?.trim() || !m.password) {
        return apiError('Every team member needs a name, email, college roll, and password.', 400)
      }
      if (m.password.length < 6) {
        return apiError('Team member passwords must be at least 6 characters.', 400)
      }
      const memberRollError = validateCollegeRoll(college, m.college_roll)
      if (memberRollError) return apiError(`Team member "${m.full_name}": ${memberRollError}`, 400)

      for (const field of category.team_member_fields || []) {
        if (field.required && !m.custom_answers?.[field.key]) {
          return apiError(`Team member "${m.full_name}" is missing required field "${field.label}".`, 400)
        }
      }
    }
    preparedTeamMembers = members.map(m => ({
      id: Math.random().toString(36).slice(2, 9),
      full_name: m.full_name.trim(),
      phone: m.phone?.trim() || '',
      email: m.email.trim(),
      college_roll: m.college_roll.trim(),
      password_hash: hashPassword(m.password),
      custom_answers: m.custom_answers || {},
      is_leader: false,
    }))
  }

  const paymentStatus = category.requires_payment ? 'pending' : 'not_required'

  // "Unique field" duplicate check (admin-configurable per custom field).
  // Scope is the whole activity session, not just this category — e.g. a
  // school ID marked unique should be caught as a duplicate even if the
  // second attempt is under a different segment/round of the same event.
  const uniqueCategoryFields = (category.custom_fields || []).filter((f: any) => f.unique_field)
  const uniqueTeamFields = (category.team_member_fields || []).filter((f: any) => f.unique_field)

  if (uniqueCategoryFields.length > 0 || uniqueTeamFields.length > 0) {
    const norm = (v: any) => (v === undefined || v === null ? '' : String(v).trim().toLowerCase())

    const { data: existingRegs } = await supabaseAdmin
      .from('activity_registrations')
      .select('custom_answers, team_members')
      .eq('activity_session_id', category.activity_session_id)

    for (const field of uniqueCategoryFields) {
      const incoming = norm(custom_answers?.[field.key])
      if (!incoming) continue
      const clash = (existingRegs || []).some(
        (r: any) => norm(r.custom_answers?.[field.key]) === incoming
      )
      if (clash) {
        return apiError(
          `"${field.label}" is already registered for this event. Duplicate entries aren't allowed for this field.`,
          409
        )
      }
    }

    for (const field of uniqueTeamFields) {
      const incomingValues = preparedTeamMembers
        .map(m => norm(m.custom_answers?.[field.key]))
        .filter(Boolean)

      // Duplicates within this same submission (two of your own teammates)
      if (new Set(incomingValues).size !== incomingValues.length) {
        return apiError(`"${field.label}" must be unique across your own team members.`, 400)
      }

      for (const v of incomingValues) {
        const clash = (existingRegs || []).some((r: any) =>
          (r.team_members || []).some((m: any) => norm(m.custom_answers?.[field.key]) === v)
        )
        if (clash) {
          return apiError(
            `"${field.label}" is already registered by another team for this event.`,
            409
          )
        }
      }
    }
  }

  let editLockedAt: string | null = null
  if (category.edit_window_hours !== null && category.edit_window_hours !== undefined) {
    editLockedAt = new Date(Date.now() + category.edit_window_hours * 3600 * 1000).toISOString()
  }

  const { data: registration, error: insertError } = await supabaseAdmin
    .from('activity_registrations')
    .insert({
      category_id,
      activity_session_id: category.activity_session_id,
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      college: college.trim(),
      college_roll: college_roll.trim(),
      hsc_session: hsc_session?.trim() || null,
      division: division?.trim() || null,
      project_name: category.project_name_enabled ? (project_name?.trim() || null) : null,
      custom_answers: custom_answers || {},
      team_members: preparedTeamMembers,
      member_id: member_id || null,
      payment_status: paymentStatus,
      payment_amount: category.requires_payment ? category.payment_amount : null,
      edit_locked_at: editLockedAt,
    })
    .select()
    .single()

  if (insertError) {
    return apiError(insertError, 400)
  }

  // Email every team member their info + password, best-effort (a failed
  // email shouldn't fail the whole registration — the leader can always be
  // told to share the password manually as a fallback).
  if (preparedTeamMembers.length > 0) {
    const { data: session } = await supabaseAdmin
      .from('activity_sessions')
      .select('title')
      .eq('id', category.activity_session_id)
      .single()

    for (let i = 0; i < team_members.length; i++) {
      const original = team_members[i] as TeamMemberInput
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0066cc;">You're registered for ${session?.title || 'an NDSC event'}!</h2>
          <p>${full_name} added you to their team for <strong>${category.name}</strong>.</p>
          <p>Use these details to log in to your own dashboard:</p>
          <p>Email: <strong>${original.email}</strong><br/>Password: <strong>${original.password}</strong></p>
          <p style="font-size:12px;color:#888;margin-top:24px;">Notre Dame Science Club — ndscbd.net</p>
        </div>
      `
      await sendEmail(original.email, `You're on a team for ${session?.title || 'an NDSC event'}`, html).catch(() => {})
    }
  }

  return apiOk({ registration })
}
