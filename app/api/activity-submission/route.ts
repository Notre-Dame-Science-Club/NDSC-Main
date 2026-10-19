import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { authorizeSegmentAccess, denyResponse } from '@/lib/server/registrationAccess'

// S3: GET returns a registration's submissions only to its leader / team
// members (verified bearer or signed team token). No window/enabled check here
// so people can still READ what they submitted after the window closes.
// GET /api/activity-submission?registration_id=UUID
export async function GET(req: NextRequest) {
  const regId = req.nextUrl.searchParams.get('registration_id')
  if (!regId) return apiError('registration_id required', 400)

  const access = await authorizeSegmentAccess(req, regId, { need: 'view' })
  if (access.ok === false) return denyResponse(access)

  const { data, error } = await supabaseAdmin
    .from('activity_submissions')
    .select('*')
    .eq('registration_id', regId)
    .order('created_at', { ascending: false })

  if (error) return apiError(error, 400)
  return apiOk({ submissions: data || [] })
}

// S2: POST is gated by the shared helper (complete registration, caller on the
// team, ancestors enabled, payment settled, submission enabled and inside its
// opens_at/closes_at window). `submitted_by` is DERIVED from the verified
// caller, never taken from the body. Required-field validation applies to
// final submits only; drafts may be partial.
// Body: { registration_id, answers, is_final }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.registration_id) {
    return apiError('registration_id is required.', 400)
  }

  const access = await authorizeSegmentAccess(req, body.registration_id, { need: 'submission' })
  if (access.ok === false) return denyResponse(access)

  const reg: any = access.registration
  const sub: any = access.node?.behavior?.submission || {}
  const submissionConfig: any[] = Array.isArray(sub.fields) ? sub.fields : []
  const submissionWho: string | undefined = sub.who || undefined

  // Verified identity: 'leader' or the caller's team_members[].id.
  const submittedBy = access.role === 'leader' ? 'leader' : access.participantId
  if (!submittedBy) {
    return apiError("We couldn't match you to a team member entry on this registration.", 403)
  }

  if (submissionWho === 'leader' && access.role !== 'leader') {
    return apiError('Only the team leader can submit for this segment.', 403)
  }

  const isFinal = body.is_final === true
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}

  if (isFinal) {
    for (const field of submissionConfig) {
      if (field.required) {
        const val = answers[field.id]
        if (!val || (Array.isArray(val) && val.length === 0)) {
          return apiError(`"${field.title}" is required.`, 400)
        }
      }
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('activity_submissions')
    .select('id, is_final')
    .eq('registration_id', reg.id)
    .eq('submitted_by', submittedBy)
    .maybeSingle()

  if (existing?.is_final) {
    return apiError('This submission has already been finalised and cannot be changed.', 403)
  }

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('activity_submissions')
      .update({ answers, is_final: isFinal, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return apiError(error, 400)
    return apiOk({ submission: data })
  }
  const { data, error } = await supabaseAdmin
    .from('activity_submissions')
    .insert({
      registration_id: reg.id,
      category_id: reg.category_id ?? null,
      activity_session_id: reg.activity_session_id,
      submitted_by: submittedBy,
      answers,
      is_final: isFinal,
    })
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk({ submission: data })
}
