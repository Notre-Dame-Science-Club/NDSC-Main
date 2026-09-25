import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'
import { apiError, apiOk } from '@/lib/api/response'
import { getOlympiadActivityLink } from '@/lib/server/olympiadActivityLink'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return apiError('Unauthorized', 401)

  const olympiadId = req.nextUrl.searchParams.get('olympiadId')
  if (!olympiadId) return apiError('olympiadId is required.', 400)

  // Make sure this organizer's session was actually granted access to this olympiad
  if (!session.olympiadIds.includes(olympiadId)) {
    return apiError('Forbidden.', 403)
  }

  // Check if this olympiad is activity-linked
  const link = await getOlympiadActivityLink(olympiadId)

  if (!link) {
    // Standalone olympiad — use existing flow
    const { data, error } = await supabaseAdmin
      .from('olympiad_registrations')
      .select('*')
      .eq('olympiad_id', olympiadId)
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Could not load registrations.', 500)
    }

    return apiOk({ registrations: data || [] })
  }

  // Activity-linked olympiad — query activity_registrations + relay_exam_state + activity_submissions
  const { data: activityRegs, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, full_name, team_name, team_members, custom_answers, created_at')
    .eq('form_node_id', link.category_id)
    .order('created_at', { ascending: false })

  if (regError) {
    return apiError('Could not load registrations.', 500)
  }

  const regIds = (activityRegs || []).map(r => r.id)

  // Query relay_exam_state for these registrations
  const { data: relayStates } = await supabaseAdmin
    .from('relay_exam_state')
    .select('registration_id, member_submissions, review_status, annotations, organizer_note')
    .eq('olympiad_id', olympiadId)
    .in('registration_id', regIds.length > 0 ? regIds : ['00000000-0000-0000-0000-000000000000'])

  const relayByRegId = new Map((relayStates || []).map(r => [r.registration_id, r]))

  // Query activity_submissions for these registrations
  const { data: submissions } = await supabaseAdmin
    .from('activity_submissions')
    .select('registration_id, answers')
    .in('registration_id', regIds.length > 0 ? regIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_final', true)

  const submissionByRegId = new Map((submissions || []).map(s => [s.registration_id, s]))

  // Normalize to the shape app/organizer/page.tsx expects
  const normalized = (activityRegs || []).map(reg => {
    const relay = relayByRegId.get(reg.id)
    const submission = submissionByRegId.get(reg.id)
    const teamMembers = reg.team_members || []

    // Start with registration-time custom_answers
    const custom_answers: Record<string, unknown> = { ...(reg.custom_answers || {}) }

    // Merge relay member submissions if exists
    if (relay?.member_submissions) {
      for (const sub of relay.member_submissions) {
        const prefix = teamMembers.length > 0 ? `${sub.member_id}__` : ''
        for (const [qId, val] of Object.entries(sub.answers || {})) {
          custom_answers[`${prefix}${qId}`] = val
        }
      }
    }

    // Merge activity_submissions answers if exists
    if (submission?.answers) {
      Object.assign(custom_answers, submission.answers)
    }

    // Calculate final_score: sum of all member submission scores if all expected members submitted
    let final_score: number | null = null
    if (relay?.member_submissions) {
      const expectedCount = Math.max(teamMembers.length, 1)
      if (relay.member_submissions.length === expectedCount) {
        final_score = relay.member_submissions.reduce((sum, sub: any) => sum + (sub.score || 0), 0)
      }
    }

    // For submission-type olympiads, pull score/status/annotations from activity_submissions
    let review_status = relay?.review_status || 'pending'
    let annotations = relay?.annotations || null
    let organizer_note = relay?.organizer_note || null

    if (submission?.answers) {
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
      full_name: reg.team_name || reg.full_name,
      custom_answers,
      final_score,
      review_status,
      annotations,
      organizer_note,
      created_at: reg.created_at,
    }
  })

  return apiOk({ registrations: normalized })
}
