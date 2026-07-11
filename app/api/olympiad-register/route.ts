import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'

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

export async function POST(req: NextRequest) {
  const body = await req.json()

  const rollError = validateCollegeRoll(body.college, body.college_roll)
  if (rollError) return apiError(rollError, 400)

  const { data, error } = await supabaseAdmin
    .from('olympiad_registrations')
    .insert(body)
    .select('id')
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return apiError('Missing id', 400)
  const { error } = await supabaseAdmin
    .from('olympiad_registrations')
    .update(rest)
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}

