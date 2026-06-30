import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/activity-submission?registration_id=UUID
// Returns existing submission(s) for a registration.
export async function GET(req: NextRequest) {
  const regId = req.nextUrl.searchParams.get('registration_id')
  if (!regId) return NextResponse.json({ error: 'registration_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('activity_submissions')
    .select('*')
    .eq('registration_id', regId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ submissions: data || [] })
}

// POST /api/activity-submission
// Creates or updates a submission for a registration.
// Body: { registration_id, submitted_by, answers, is_final }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.registration_id) {
    return NextResponse.json({ error: 'registration_id is required.' }, { status: 400 })
  }

  // Load registration + category to verify permission
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('activity_registrations')
    .select('*, activity_reg_categories(submission_config, submission_who, activity_session_id)')
    .eq('id', body.registration_id)
    .single()

  if (regErr || !reg) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })

  const category = reg.activity_reg_categories as any
  const submittedBy = body.submitted_by || 'leader'

  // Permission check: submission_who
  if (category?.submission_who === 'leader' && submittedBy !== 'leader') {
    return NextResponse.json({ error: 'Only the team leader can submit for this category.' }, { status: 403 })
  }

  // Validate required submission fields
  const config: any[] = category?.submission_config || []
  for (const field of config) {
    if (field.required) {
      const val = body.answers?.[field.id]
      if (!val || (Array.isArray(val) && val.length === 0)) {
        return NextResponse.json({ error: `"${field.title}" is required.` }, { status: 400 })
      }
    }
  }

  // Upsert: if a non-final submission exists from same submitter, update it
  const { data: existing } = await supabaseAdmin
    .from('activity_submissions')
    .select('id, is_final')
    .eq('registration_id', body.registration_id)
    .eq('submitted_by', submittedBy)
    .maybeSingle()

  if (existing?.is_final) {
    return NextResponse.json({ error: 'This submission has already been finalised and cannot be changed.' }, { status: 403 })
  }

  let result
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('activity_submissions')
      .update({ answers: body.answers || {}, is_final: body.is_final ?? false, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    result = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('activity_submissions')
      .insert({
        registration_id: body.registration_id,
        category_id: reg.category_id,
        activity_session_id: reg.activity_session_id,
        submitted_by: submittedBy,
        answers: body.answers || {},
        is_final: body.is_final ?? false,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    result = data
  }

  return NextResponse.json({ submission: result })
}
