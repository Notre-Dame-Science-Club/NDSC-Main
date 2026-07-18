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
    // Team is optional: allow 0 members (solo registration). Required: enforce min.
    const min = category.team_optional ? 0 : (category.team_size_min || 1)
    const max = category.team_size_max || 99
    if (members.length < min || members.length > max) {
      const lowerBound = category.team_optional
        ? (category.team_size_min || 0)
        : min
      const upperBound = max
      return apiError(
        `This category accepts between ${lowerBound} and ${upperBound} team member${upperBound === 1 ? '' : 's'} (not counting yourself as leader).`,
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

  // ── Unique field duplicate check ──────────────────────────────────────
  // Walks the segment's form_field_schema (the new V8 unified field list)
  // and the legacy custom_fields / team_member_fields shapes. Any field
  // with `unique_field: true` is enforced across the entire activity
  // session (not just this category) so a duplicate is caught even when
  // the second attempt is in a different segment of the same event.
  //
  // For top-level built-in columns (college_roll, email, etc.) the value
  // is read from the top-level body. For custom answers, from
  // `custom_answers[key]`. For team members, from `team_members[i].<col>`.
  // When a clash is found the error message names the field, the value,
  // and (when known) the existing registrant so the user can recover
  // gracefully — the live /api/activity-unique-check endpoint surfaces
  // the same info to the form before submit.
  const TOP_LEVEL_COLS = new Set([
    'full_name', 'phone', 'email', 'college',
    'college_roll', 'hsc_session', 'division',
  ])
  const norm = (v: any) => (v === undefined || v === null ? '' : String(v).trim().toLowerCase())

  // Collect every unique-flagged field. New shape first (form_field_schema),
  // then legacy fallback. Each entry has { label, source, key } where
  // `source` describes where to read/write the value.
  const uniqueFields: { label: string; source: 'top_level' | 'custom'; key: string; builtinCol?: string }[] = []
  if (Array.isArray(category.form_field_schema)) {
    for (const f of category.form_field_schema) {
      if (!f || !f.unique_field) continue
      const builtinCol = f.is_builtin as string | undefined
      if (builtinCol && TOP_LEVEL_COLS.has(builtinCol)) {
        uniqueFields.push({ label: f.label || builtinCol, source: 'top_level', key: builtinCol, builtinCol })
      } else {
        // Custom key in custom_answers
        const k = (f.key || f.id || builtinCol || '') as string
        if (!k) continue
        uniqueFields.push({ label: f.label || k, source: 'custom', key: k, builtinCol })
      }
    }
  }
  // Legacy fallback — if the segment has no form_field_schema (older event)
  // or admin never set unique_field on the new schema, still honor the old
  // shape.
  for (const f of (category.custom_fields || [])) {
    if (!f?.unique_field || !f.key) continue
    if (!uniqueFields.some(x => x.source === 'custom' && x.key === f.key)) {
      uniqueFields.push({ label: f.label || f.key, source: 'custom', key: f.key })
    }
  }

  // Team-member unique fields (legacy `team_member_fields` shape, plus any
  // team fields admins add inline).
  const uniqueTeamFields: { label: string; key: string }[] = []
  for (const f of (category.team_member_fields || [])) {
    if (f?.unique_field && f.key) uniqueTeamFields.push({ label: f.label || f.key, key: f.key })
  }

  if (uniqueFields.length > 0 || uniqueTeamFields.length > 0) {
    const { data: existingRegs } = await supabaseAdmin
      .from('activity_registrations')
      .select('id, full_name, email, college_roll, custom_answers, team_members')
      .eq('activity_session_id', category.activity_session_id)

    // For each unique field, check the leader values across existing
    // registrations AND any team members in those registrations. The
    // first match wins and is reported with the existing registrant's
    // name so the message is actionable.
    for (const f of uniqueFields) {
      const incomingRaw = f.source === 'top_level' ? body[f.key] : custom_answers?.[f.key]
      const incomingNorm = norm(incomingRaw)
      if (!incomingNorm) continue
      const incomingDisplay = String(incomingRaw).trim()

      for (const r of (existingRegs || [])) {
        // Leader column clash
        let leaderVal: any
        if (f.source === 'top_level') {
          leaderVal = (r as any)[f.key]
        } else {
          leaderVal = (r as any).custom_answers?.[f.key]
        }
        if (norm(leaderVal) === incomingNorm) {
          return apiError(
            `"${f.label}" with value "${incomingDisplay}" is already registered for this event${r.full_name ? ` by ${r.full_name}` : ''}. ` +
            `Duplicate entries aren't allowed for unique fields.`,
            409
          )
        }
        // Team member clash
        for (const m of ((r as any).team_members || [])) {
          let mVal: any
          if (f.source === 'top_level') {
            if (f.key === 'full_name') mVal = m.full_name
            else if (f.key === 'email') mVal = m.email
            else if (f.key === 'college_roll') mVal = m.college_roll
            else if (f.key === 'phone') mVal = m.phone
            else mVal = m[f.key]
          } else {
            mVal = m.custom_answers?.[f.key]
          }
          if (norm(mVal) === incomingNorm) {
            return apiError(
              `"${f.label}" with value "${incomingDisplay}" is already on team "${r.full_name || 'someone'}'s team" for this event. ` +
              `If that's you, open your team dashboard instead of re-registering.`,
              409
            )
          }
        }
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
