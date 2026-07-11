import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/relay-exam?registration_id=UUID&olympiad_id=UUID
// Returns current relay state for a team registration
export async function GET(req: NextRequest) {
  const registrationId = req.nextUrl.searchParams.get('registration_id')
  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!registrationId || !olympiadId) return apiError('registration_id and olympiad_id required', 400)

  const { data, error } = await supabaseAdmin
    .from('relay_exam_state')
    .select('*')
    .eq('registration_id', registrationId)
    .eq('olympiad_id', olympiadId)
    .maybeSingle()

  if (error) return apiError(error, 400)

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

  return apiOk({ state: data || null, olympiad, registration: reg })
}

// POST /api/relay-exam
// Actions: 'start' | 'submit_member' | 'assign_subject'
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.action || !body?.registration_id || !body?.olympiad_id) {
    return apiError('action, registration_id, olympiad_id required', 400)
  }

  const { action, registration_id, olympiad_id } = body

  const { data: olympiad } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('id', olympiad_id)
    .single()

  if (!olympiad) return apiError('Olympiad not found.', 404)

  // Check scheduled start
  if (olympiad.scheduled_start_at && new Date() < new Date(olympiad.scheduled_start_at)) {
    return NextResponse.json(
      { error: 'Exam has not started yet.', scheduled_start_at: olympiad.scheduled_start_at },
      { status: 403 }
    )
  }
  if (olympiad.scheduled_end_at && new Date() > new Date(olympiad.scheduled_end_at)) {
    return apiError('Exam time is over.', 403)
  }

  // ── START ──────────────────────────────────────────────────────
  if (action === 'start') {
    const { data: existing } = await supabaseAdmin
      .from('relay_exam_state')
      .select('id')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .maybeSingle()

    if (existing) return apiError('Relay already started.', 409)

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

    if (error) return apiError(error, 400)
    return apiOk({ state: data })
  }

  // ── SUBMIT MEMBER ─────────────────────────────────────────────
  if (action === 'submit_member') {
    const { member_id, answers } = body
    if (!answers) return apiError('answers required', 400)

    const { data: state } = await supabaseAdmin
      .from('relay_exam_state')
      .select('*')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .single()

    if (!state) return apiError('Relay not started yet.', 404)
    if (state.completed_at) return apiError('Relay already completed.', 409)

    const submissions: any[] = state.member_submissions || []
    const alreadySubmitted = submissions.find((s: any) => s.member_id === member_id)
    if (alreadySubmitted) return apiError('This member has already submitted.', 409)

    // For chain mode: extract chain_values from this submission
    let newChainValues = { ...state.chain_values }
    if (olympiad.relay_type === 'chain') {
      const memberIndex = state.current_member_index
      Object.entries(answers).forEach(([qId, val]) => {
        newChainValues[`member${memberIndex + 1}.${qId}`] = val
      })
    }

    // Auto-score MCQ + build a per-question breakdown now, same as the
    // legacy olympiad exam engine — this is what the results screen reads
    // from once the admin publishes results, so a student sees exactly
    // which questions they got right/wrong, not just a total.
    const subjectId = body.subject_id || null
    const relevantQuestions = (olympiad.questions || []).filter((q: any) => !subjectId || !q.subject_id || q.subject_id === subjectId)
    let score = 0
    const questionResults = relevantQuestions.map((q: any) => {
      if (q.type === 'mcq') {
        const isCorrect = answers[q.id] === q.correct_option_id
        if (isCorrect) score += (q.marks || 1)
        const chosen = (q.options || []).find((o: any) => o.id === answers[q.id])
        const correct = (q.options || []).find((o: any) => o.id === q.correct_option_id)
        return {
          question_id: q.id, question_text: q.text, type: q.type,
          student_answer: chosen?.text ?? null, correct_answer: correct?.text ?? null,
          is_correct: isCorrect, marks_awarded: isCorrect ? (q.marks || 1) : 0, marks_possible: q.marks || 1,
        }
      }
      if (q.type === 'photo') {
        return {
          question_id: q.id, question_text: q.text, type: q.type,
          student_answer: answers[q.id] || null, correct_answer: null,
          is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
        }
      }
      return {
        question_id: q.id, question_text: q.text, type: q.type,
        student_answer: answers[q.id] || null, correct_answer: null,
        is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
      }
    })

    const newSubmissions = [...submissions, {
      member_id, answers, submitted_at: new Date().toISOString(),
      score, question_results: questionResults,
    }]
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

    if (error) return apiError(error, 400)
    return apiOk({ state: updated, is_complete: isComplete })
  }

  // ── ASSIGN SUBJECT ────────────────────────────────────────────
  if (action === 'assign_subject') {
    const { member_id, subject_id } = body
    if (!member_id || !subject_id) return apiError('member_id and subject_id required', 400)

    // Check subject not already taken by another member in same registration
    const { data: existing } = await supabaseAdmin
      .from('team_subject_assignments')
      .select('member_id')
      .eq('registration_id', registration_id)
      .eq('olympiad_id', olympiad_id)
      .eq('subject_id', subject_id)
      .maybeSingle()

    if (existing && existing.member_id !== member_id) {
      return apiError('This subject has already been taken by another team member.', 409)
    }

    // Upsert
    const { data, error } = await supabaseAdmin
      .from('team_subject_assignments')
      .upsert({ registration_id, member_id, olympiad_id, subject_id }, { onConflict: 'registration_id,member_id,olympiad_id' })
      .select()
      .single()

    if (error) return apiError(error, 400)
    return apiOk({ assignment: data })
  }

  return apiError('Unknown action.', 400)
}
