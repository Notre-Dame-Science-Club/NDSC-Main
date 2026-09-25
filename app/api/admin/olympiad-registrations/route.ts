import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { getOlympiadActivityLink } from '@/lib/server/olympiadActivityLink'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { searchParams } = new URL(req.url)
  const olympiadId = searchParams.get('olympiad_id')
  if (!olympiadId) return apiError('Missing olympiad_id', 400)

  // Check if this olympiad is activity-linked
  const link = await getOlympiadActivityLink(olympiadId)

  if (!link) {
    // Standalone olympiad — use existing flow
    const { data, error } = await supabaseAdmin
      .from('olympiad_registrations')
      .select('*')
      .eq('olympiad_id', olympiadId)
      .order('created_at', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk(data)
  }

  // Activity-linked olympiad — query activity_registrations + relay_exam_state + activity_submissions
  // NOTE: the built-in identity columns (phone/email/college/college_roll/hsc_session)
  // are real columns on activity_registrations, populated at registration time —
  // they must be selected explicitly here or the admin UI has nothing to show
  // for a child olympiad's registrants beyond full_name.
  const { data: activityRegs, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, full_name, phone, email, college, college_roll, hsc_session, team_name, team_members, custom_answers, created_at')
    .eq('form_node_id', link.category_id)
    .order('created_at', { ascending: false })

  if (regError) {
    return apiError('Could not load registrations.', 500)
  }

  const regIds = (activityRegs || []).map(r => r.id)

  // Query relay_exam_state for these registrations
  const { data: relayStates } = await supabaseAdmin
    .from('relay_exam_state')
    .select('registration_id, member_submissions, review_status, annotations, organizer_note, organizer_score')
    .eq('olympiad_id', olympiadId)
    .in('registration_id', regIds.length > 0 ? regIds : ['00000000-0000-0000-0000-000000000000'])

  const relayByRegId = new Map((relayStates || []).map(r => [r.registration_id, r]))

  // Query activity_submissions for these registrations
  const { data: submissions } = await supabaseAdmin
    .from('activity_submissions')
    .select('registration_id, submitted_by, answers')
    .in('registration_id', regIds.length > 0 ? regIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_final', true)

  // A registration can have more than one final submission (one per team
  // member, when submission_who is 'any_member') — group by registration_id
  // instead of collapsing to a single row, or every submission after the
  // first silently overwrote the previous one.
  const submissionsByRegId = new Map<string, any[]>()
  for (const s of submissions || []) {
    const list = submissionsByRegId.get(s.registration_id) || []
    list.push(s)
    submissionsByRegId.set(s.registration_id, list)
  }

  // Normalize to the shape the admin UI expects
  const normalized = (activityRegs || []).map(reg => {
    const relay = relayByRegId.get(reg.id)
    const regSubmissions = submissionsByRegId.get(reg.id) || []
    const teamMembers = (reg.team_members || []).map((m: any) => ({ ...m, custom_answers: { ...(m.custom_answers || {}) } }))
    const teamMemberById = new Map<string, any>(teamMembers.map((m: any): [string, any] => [m.id, m]))

    // Start with registration-time custom_answers (the leader's own, collected
    // at the linking node itself — usually empty beyond identity fields).
    const custom_answers: Record<string, unknown> = { ...(reg.custom_answers || {}) }

    // Merge relay member submissions — attribute each member's answers to
    // *their own* custom_answers bucket rather than always landing in one
    // blob on the leader's row, so a member's card shows their own answers.
    if (relay?.member_submissions) {
      for (const sub of relay.member_submissions) {
        const target = sub.member_id && sub.member_id !== 'leader' ? teamMemberById.get(sub.member_id) : null
        const bucket: Record<string, unknown> = target ? target.custom_answers : custom_answers
        for (const [qId, val] of Object.entries(sub.answers || {})) {
          bucket[qId] = val
        }
      }
    }

    // Merge activity_submissions answers — same per-submitter attribution.
    for (const submission of regSubmissions) {
      const submittedBy = submission.submitted_by
      const target = submittedBy && submittedBy !== 'leader' ? teamMemberById.get(submittedBy) : null
      const bucket: Record<string, unknown> = target ? target.custom_answers : custom_answers
      if (submission.answers) Object.assign(bucket, submission.answers)
    }

    // Merge all member submissions' question_results into one array
    // For teams, prefix question_id and question_text with member identifier
    const question_results: any[] = []
    if (relay?.member_submissions) {
      for (const sub of relay.member_submissions) {
        if (Array.isArray(sub.question_results)) {
          const memberLabel = teamMembers.length > 0
            ? teamMembers.find((m: any) => m.id === sub.member_id)?.name || sub.member_id
            : null

          for (const qr of sub.question_results) {
            question_results.push({
              ...qr,
              // Prefix question_id with member_id to avoid collisions in setMarks lookups
              question_id: teamMembers.length > 0 ? `${sub.member_id}__${qr.question_id}` : qr.question_id,
              // Prefix question_text with member name for clarity
              question_text: memberLabel ? `${memberLabel} — ${qr.question_text}` : qr.question_text,
            })
          }
        }
      }
    }

    // Calculate final_score: sum of all member submission scores if all expected members submitted
    let final_score: number | null = null
    if (relay?.member_submissions) {
      const expectedCount = Math.max(teamMembers.length, 1)
      if (relay.member_submissions.length === expectedCount) {
        final_score = relay.member_submissions.reduce((sum, sub: any) => sum + (sub.score || 0), 0)
      }
    }

    // Use organizer_score if set, otherwise use calculated final_score
    if (relay?.organizer_score !== null && relay?.organizer_score !== undefined) {
      final_score = relay.organizer_score
    }

    // For submission-type olympiads, pull score/status/annotations from activity_submissions
    let review_status = relay?.review_status || 'pending'
    let annotations = relay?.annotations || null
    let organizer_note = relay?.organizer_note || null

    for (const submission of regSubmissions) {
      if (!submission.answers) continue
      if (submission.answers.__organizer_score !== undefined) {
        final_score = submission.answers.__organizer_score
      }
      if (submission.answers.__review_status !== undefined) {
        review_status = submission.answers.__review_status
      }
      if (submission.answers.__annotations !== undefined) {
        annotations = submission.answers.__annotations
      }
      if (submission.answers.__organizer_note !== undefined) {
        organizer_note = submission.answers.__organizer_note
      }
    }

    return {
      id: reg.id,
      olympiad_id: olympiadId,
      full_name: reg.team_name || reg.full_name,
      phone: reg.phone,
      email: reg.email,
      college: reg.college,
      college_roll: reg.college_roll,
      hsc_session: reg.hsc_session,
      team_members: teamMembers,
      custom_answers,
      question_results,
      final_score,
      review_status,
      annotations,
      organizer_note,
      created_at: reg.created_at,
    }
  })

  return apiOk(normalized)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { id, olympiad_id, ...rest } = body
  if (!id) return apiError('Missing id', 400)

  // Try standalone olympiad first
  const { data: reg, error: regError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (reg) {
    // Found in olympiad_registrations — update it
    const { data, error } = await supabaseAdmin
      .from('olympiad_registrations')
      .update(rest)
      .eq('id', id)
      .select()
      .single()
    if (error) return apiError(error, 400)
    return apiOk(data)
  }

  // Not found in olympiad_registrations — treat id as activity_registrations.id
  // For activity-linked registrations, registration_id (id) is globally unique,
  // so we don't need olympiad_id to find the relay_exam_state row.
  const { data: relayState, error: relayError } = await supabaseAdmin
    .from('relay_exam_state')
    .select('id, annotations, member_submissions, olympiad_id')
    .eq('registration_id', id)
    .maybeSingle()

  if (!relayState) {
    return apiError('Registration not found.', 404)
  }

  // Map admin fields to relay_exam_state columns
  const updatePayload: Record<string, any> = {}
  if (rest.review_status !== undefined) updatePayload.review_status = rest.review_status
  if (rest.organizer_note !== undefined) updatePayload.organizer_note = rest.organizer_note

  // Handle annotations (may include field-specific merge logic)
  if (rest.annotations !== undefined) {
    updatePayload.annotations = rest.annotations
  }

  // Handle question_results: write marks back into member_submissions
  if (Array.isArray(rest.question_results) && Array.isArray(relayState.member_submissions)) {
    const updatedSubmissions = relayState.member_submissions.map((sub: any) => {
      // Copy the submission and update its question_results
      const updatedSub = { ...sub }

      if (Array.isArray(sub.question_results)) {
        updatedSub.question_results = sub.question_results.map((qr: any) => {
          // Match by prefixed question_id (for teams) or bare question_id (for individuals)
          const prefixedId = `${sub.member_id}__${qr.question_id}`
          const incoming = rest.question_results.find((r: any) =>
            r.question_id === prefixedId || r.question_id === qr.question_id
          )

          if (incoming) {
            return {
              ...qr,
              marks_awarded: incoming.marks_awarded,
              is_correct: incoming.is_correct,
            }
          }
          return qr
        })
      }

      return updatedSub
    })

    updatePayload.member_submissions = updatedSubmissions

    // Recompute organizer_score: sum all marks_awarded across all members
    let totalScore = 0
    let allMarksAwarded = true

    for (const sub of updatedSubmissions) {
      if (Array.isArray(sub.question_results)) {
        for (const qr of sub.question_results) {
          if (qr.marks_awarded !== null && qr.marks_awarded !== undefined) {
            totalScore += qr.marks_awarded
          } else {
            allMarksAwarded = false
          }
        }
      }
    }

    updatePayload.organizer_score = totalScore

    // Update review_status based on whether all questions are marked
    updatePayload.review_status = allMarksAwarded ? 'reviewed' : 'pending'
  } else if (rest.final_score !== undefined) {
    // Fallback: if question_results not provided, just use final_score directly
    updatePayload.organizer_score = rest.final_score
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('relay_exam_state')
    .update(updatePayload)
    .eq('id', relayState.id)
    .select()
    .single()

  if (updateError) {
    return apiError('Could not update registration.', 500)
  }

  // Return in the shape admin expects
  return apiOk({
    id,
    olympiad_id,
    final_score: updatePayload.organizer_score,
    review_status: updatePayload.review_status,
    ...rest,
  })
}
