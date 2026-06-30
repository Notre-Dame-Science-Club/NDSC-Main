import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/relay-exam?registration_id=UUID&olympiad_id=UUID
// Returns current relay state for a team registration
export async function GET(req: NextRequest) {
  const registrationId = req.nextUrl.searchParams.get('registration_id')
  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!registrationId || !olympiadId) return NextResponse.json({ error: 'registration_id and olympiad_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('relay_exam_state')
    .select('*')
    .eq('registration_id', registrationId)
    .eq('olympiad_id', olympiadId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Also fetch olympiad subjects + registration team info
  const { data: olympiad } = await supabaseAdmin
    .from('olympiads')
    .select('relay_mode, relay_type, subjects, subject_assignment_mode, timer_minutes, scheduled_start_at, scheduled_end_at')
    .eq('id', olympiadId)
    .single()

  const { data: reg } = await supabaseAdmin
    .from('activity_registrations')
    .select('full_name, team_members')
    .eq('id', registrationId)
    .single()

  return NextResponse.json({ state: data || null, olympiad, registration: reg })
}

// POST /api/relay-exam
// Actions: 'start' | 'submit_member' | 'assign_subject'
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.action || !body?.registration_id || !body?.olympiad_id) {
    return NextResponse.json({ error: 'action, registration_id, olympiad_id required' }, { status: 400 })
  }

  const { action, registration_id, olympiad_id } = body

  const { data: olympiad } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('id', olympiad_id)
    .single()

  if (!olympiad) return NextResponse.json({ error: 'Olympiad not found.' }, { status: 404 })

  // Check scheduled start
  if (olympiad.scheduled_start_at && new Date() < new Date(olympiad.scheduled_start_at)) {
    return NextResponse.json({ error: 'Exam has not started yet.', scheduled_start_at: olympiad.scheduled_start_at }, { status: 403 })
  }
  if (olympiad.scheduled_end_at && new Date() > new Date(olympiad.scheduled_end_at)) {
    return NextResponse.json({ error: 'Exam time is over.' }, { status: 403 })
  }

  // ── START ──────────────────────────────────────────────────────
  if (action === 'start') {
    const { data: existing } = await supabaseAdmin
      .from('relay_exam_state')
      .select('id')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Relay already started.' }, { status: 409 })

    const { data, error } = await supabaseAdmin
      .from('relay_exam_state')
      .insert({
        registration_id,
        olympiad_id,
        current_member_index: 0,
        member_submissions: [],
        chain_values: {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ state: data })
  }

  // ── SUBMIT MEMBER ─────────────────────────────────────────────
  if (action === 'submit_member') {
    const { member_id, answers } = body
    if (!answers) return NextResponse.json({ error: 'answers required' }, { status: 400 })

    const { data: state } = await supabaseAdmin
      .from('relay_exam_state')
      .select('*')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .single()

    if (!state) return NextResponse.json({ error: 'Relay not started yet.' }, { status: 404 })
    if (state.completed_at) return NextResponse.json({ error: 'Relay already completed.' }, { status: 409 })

    const submissions: any[] = state.member_submissions || []
    const alreadySubmitted = submissions.find((s: any) => s.member_id === member_id)
    if (alreadySubmitted) return NextResponse.json({ error: 'This member has already submitted.' }, { status: 409 })

    // For chain mode: extract chain_values from this submission
    let newChainValues = { ...state.chain_values }
    if (olympiad.relay_type === 'chain') {
      const memberIndex = state.current_member_index
      Object.entries(answers).forEach(([qId, val]) => {
        newChainValues[`member${memberIndex + 1}.${qId}`] = val
      })
    }

    const newSubmissions = [...submissions, { member_id, answers, submitted_at: new Date().toISOString() }]
    const nextIndex = state.current_member_index + 1

    // Fetch team to know total members
    const { data: reg } = await supabaseAdmin
      .from('activity_registrations')
      .select('team_members')
      .eq('id', registration_id)
      .single()

    const teamSize = 1 + ((reg?.team_members as any[]) || []).length // leader + members
    const isComplete = nextIndex >= teamSize

    const { data: updated, error } = await supabaseAdmin
      .from('relay_exam_state')
      .update({
        current_member_index: nextIndex,
        member_submissions: newSubmissions,
        chain_values: newChainValues,
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq('id', state.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ state: updated, is_complete: isComplete })
  }

  // ── ASSIGN SUBJECT ────────────────────────────────────────────
  if (action === 'assign_subject') {
    const { member_id, subject_id } = body
    if (!member_id || !subject_id) return NextResponse.json({ error: 'member_id and subject_id required' }, { status: 400 })

    // Check subject not already taken by another member in same registration
    const { data: existing } = await supabaseAdmin
      .from('team_subject_assignments')
      .select('member_id')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .eq('subject_id', subject_id)
      .maybeSingle()

    if (existing && existing.member_id !== member_id) {
      return NextResponse.json({ error: 'This subject has already been taken by another team member.' }, { status: 409 })
    }

    // Upsert
    const { data, error } = await supabaseAdmin
      .from('team_subject_assignments')
      .upsert({ registration_id, member_id, olympiad_id, subject_id }, { onConflict: 'registration_id,member_id,olympiad_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ assignment: data })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
