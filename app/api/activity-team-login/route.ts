import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { verifyPassword } from '@/lib/password'
import { apiError, apiOk } from '@/lib/api/response'

// Team members aren't real Supabase Auth users — their credentials live
// inside their leader's registration row (team_members jsonb array), set by
// the leader at registration time. This route lets a team member log in
// with the email + password they were emailed, without needing a real
// account. On success it returns the registration + which team_member
// entry is theirs, so the dashboard can render their own view.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = body?.email?.trim()
  const password = body?.password

  if (!email || !password) {
    return apiError('Email and password are required.', 400)
  }

  // Filtering "team_members is not an empty array" reliably via PostgREST's
  // jsonb equality comparison is fiddly and easy to get subtly wrong (jsonb
  // `[]` vs the literal string "[]" don't always compare the way you'd
  // expect through the JS client's .eq()/.not() filters). At the realistic
  // scale this runs at (a few hundred registrations per event, not
  // millions), it's simpler and more reliably correct to just fetch
  // everything with a non-null team_members column and filter precisely in
  // application code below.
  const { data: registrations, error } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, category_id, activity_session_id, team_members')
    .not('team_members', 'is', null)

  if (error) return apiError(error, 400)

  for (const reg of registrations || []) {
    const members = (reg.team_members || []) as any[]
    if (members.length === 0) continue
    const match = members.find(m => m.email?.toLowerCase() === email.toLowerCase())
    if (match && verifyPassword(password, match.password_hash)) {
      return apiOk({
        registration_id: reg.id,
        category_id: reg.category_id,
        activity_session_id: reg.activity_session_id,
        team_member_id: match.id,
      })
    }
  }

  return apiError('Incorrect email or password.', 401)
}
