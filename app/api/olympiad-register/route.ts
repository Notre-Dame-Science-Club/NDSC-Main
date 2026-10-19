import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { checkWindow } from '@/lib/segmentAccess'

// GET is used to resume a student's session after a page refresh or closed
// tab — the public olympiad page stores the registration id in the URL and
// in localStorage, then calls this on load to fetch both the registration
// and its parent olympiad so it can jump straight back to the right phase
// (dashboard / exam-in-progress / done) instead of losing all progress.
//
// Like the existing PUT handler below, this route is intentionally public —
// a registration id is an unguessable UUID, so knowing it is treated as
// equivalent to "this is the student's own registration", the same trust
// model the PUT handler already uses for submitting answers.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Missing id', 400)

  const { data: registration, error: regError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('*')
    .eq('id', id)
    .single()

  if (regError || !registration) {
    return apiError('Registration not found.', 404)
  }

  const { data: olympiad, error: olyError } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('id', registration.olympiad_id)
    .single()

  if (olyError || !olympiad) {
    return apiError('Olympiad not found.', 404)
  }

  return apiOk({ registration, olympiad })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return apiError('Missing id', 400)

  // Whitelist allowed fields for student updates
  // Students can only update their answers and exam state, NOT scores or results
  const allowedFields = [
    'mcq_answers', 'short_answers', 'photo_answers', 'answer_sheet_url',
    'exam_started_at', 'exam_submitted_at'
  ]

  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (rest[key] !== undefined) {
      updates[key] = rest[key]
    }
  }

  // Prevent updates if nothing valid was provided
  if (Object.keys(updates).length === 0) {
    return apiError('No valid fields to update', 400)
  }

  const { data: existing } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('exam_started_at, exam_submitted_at, olympiad_id')
    .eq('id', id)
    .single()
  if (!existing) return apiError('Registration not found.', 404)

  const { data: olympiad } = await supabaseAdmin
    .from('olympiads')
    .select('allow_resubmission, scheduled_start_at, scheduled_end_at')
    .eq('id', existing.olympiad_id)
    .single()

  // S8: the exam window is enforced on the server.
  const w = checkWindow(new Date(), { opens_at: olympiad?.scheduled_start_at, closes_at: olympiad?.scheduled_end_at })
  if (w === 'not_open') return apiError('The exam has not started yet.', 403)
  if (w === 'closed') return apiError('Exam time is over.', 403)

  // Once submitted, olympiads that disable resubmission accept no further writes.
  // (Olympiads that never set the flag keep today's behaviour.)
  if (existing.exam_submitted_at && olympiad?.allow_resubmission === false) {
    return apiError('This olympiad has already received your submission and does not allow resubmission.', 409)
  }

  // S8: timestamps are SERVER-controlled. A client "start"/"submit" signal is
  // honoured, but the value is always the server clock, and exam_started_at is
  // never moved once set.
  const wantsStart = updates.exam_started_at !== undefined
  const wantsSubmit = updates.exam_submitted_at !== undefined
  delete updates.exam_started_at
  delete updates.exam_submitted_at
  if (wantsStart && !existing.exam_started_at) updates.exam_started_at = new Date().toISOString()
  if (wantsSubmit) updates.exam_submitted_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('olympiad_registrations')
    .update(updates)
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}

