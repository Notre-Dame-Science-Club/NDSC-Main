import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return apiError('Unauthorized', 401)

  // field: present when this submission has multiple photo answers (e.g. the
  // form has "gp1"/"gp2"/"gp3" photo questions) and the organizer just marked
  // up one specific one — then `annotations` holds only that photo's marks
  // and must be merged into the others' rather than overwriting the column.
  const { regId, score, annotations, organizer_note, field, olympiadId } = await req.json().catch(() => ({}))

  if (!regId || typeof regId !== 'string') {
    return apiError('regId is required.', 400)
  }
  if (score === undefined || score === null || Number.isNaN(Number(score))) {
    return apiError('A valid numeric score is required.', 400)
  }

  // Try the existing path first: look up regId in olympiad_registrations
  const { data: reg, error: regError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('id, olympiad_id, annotations')
    .eq('id', regId)
    .maybeSingle()

  if (reg) {
    // Found in olympiad_registrations — use existing flow
    if (!session.olympiadIds.includes(reg.olympiad_id)) {
      return apiError('Forbidden.', 403)
    }

    const updatePayload: Record<string, any> = {
      final_score: Number(score),
      review_status: 'reviewed',
    }
    let savedAnnotations = reg.annotations
    if (annotations !== undefined) {
      if (field && typeof field === 'string') {
        const existing = reg.annotations && !Array.isArray(reg.annotations) ? reg.annotations : {}
        savedAnnotations = { ...existing, [field]: annotations }
      } else {
        savedAnnotations = annotations
      }
      updatePayload.annotations = savedAnnotations
    }
    if (organizer_note !== undefined) updatePayload.organizer_note = organizer_note

    const { error: updateError } = await supabaseAdmin
      .from('olympiad_registrations')
      .update(updatePayload)
      .eq('id', regId)

    if (updateError) {
      return apiError('Could not save score.', 500)
    }

    return apiOk({ success: true, annotations: savedAnnotations })
  }

  // Not found in olympiad_registrations — treat regId as activity_registrations.id
  if (!olympiadId) {
    return apiError('olympiadId is required for activity-linked olympiads.', 400)
  }
  if (!session.olympiadIds.includes(olympiadId)) {
    return apiError('Forbidden.', 403)
  }

  // Try relay_exam_state first (for live relay-type exams)
  const { data: relayState } = await supabaseAdmin
    .from('relay_exam_state')
    .select('id, annotations')
    .eq('registration_id', regId)
    .eq('olympiad_id', olympiadId)
    .maybeSingle()

  if (relayState) {
    // Found in relay_exam_state — use existing flow
    const updatePayload: Record<string, any> = {
      organizer_score: Number(score),
      review_status: 'reviewed',
    }
    let savedAnnotations = relayState.annotations
    if (annotations !== undefined) {
      if (field && typeof field === 'string') {
        const existing = relayState.annotations && !Array.isArray(relayState.annotations) ? relayState.annotations : {}
        savedAnnotations = { ...existing, [field]: annotations }
      } else {
        savedAnnotations = annotations
      }
      updatePayload.annotations = savedAnnotations
    }
    if (organizer_note !== undefined) updatePayload.organizer_note = organizer_note

    const { error: updateError } = await supabaseAdmin
      .from('relay_exam_state')
      .update(updatePayload)
      .eq('id', relayState.id)

    if (updateError) {
      return apiError('Could not save score.', 500)
    }

    return apiOk({ success: true, annotations: savedAnnotations })
  }

  // Not in relay_exam_state — check activity_submissions (for submission-type child olympiads)
  // First verify the registration exists
  const { data: activityReg } = await supabaseAdmin
    .from('activity_registrations')
    .select('id')
    .eq('id', regId)
    .maybeSingle()

  if (!activityReg) {
    return apiError('Registration not found.', 404)
  }

  // Look up or create the activity_submission
  const { data: existingSubmission } = await supabaseAdmin
    .from('activity_submissions')
    .select('id, answers')
    .eq('registration_id', regId)
    .eq('is_final', true)
    .maybeSingle()

  if (!existingSubmission) {
    return apiError('No submission found for this registration.', 404)
  }

  // Store score and annotations in the submission's answers object
  const updatedAnswers = { ...(existingSubmission.answers || {}) }

  // Store organizer scoring metadata
  updatedAnswers.__organizer_score = Number(score)
  updatedAnswers.__review_status = 'reviewed'

  if (annotations !== undefined) {
    if (field && typeof field === 'string') {
      const existing = updatedAnswers.__annotations || {}
      updatedAnswers.__annotations = { ...existing, [field]: annotations }
    } else {
      updatedAnswers.__annotations = annotations
    }
  }

  if (organizer_note !== undefined) {
    updatedAnswers.__organizer_note = organizer_note
  }

  const { error: updateError } = await supabaseAdmin
    .from('activity_submissions')
    .update({ answers: updatedAnswers, updated_at: new Date().toISOString() })
    .eq('id', existingSubmission.id)

  if (updateError) {
    return apiError('Could not save score.', 500)
  }

  return apiOk({ success: true, annotations: updatedAnswers.__annotations })
}
