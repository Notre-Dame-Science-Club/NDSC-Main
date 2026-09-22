import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { setSessionCookie, HOURS } from '@/lib/api/session-cookie'
import { authCookies } from '@/lib/config/site'

// Organizer auth is fully server-side now.
// Previously the client fetched ALL olympiads + their plaintext organizer_password
// directly via the anon Supabase client and compared it in the browser — this leaked
// every olympiad's organizer password to anyone who opened devtools, even before login.
// Now the password check happens here with the service-role client, and only the
// minimal safe fields (id, name, mode) are ever sent back to the browser.
//
// Username + password: admins issue an organizer_username/organizer_password pair per
// olympiad from Admin → Olympiads. A row with no organizer_username set (legacy data,
// or an admin who just hasn't bothered) is matched on password alone — see the filter
// below — so this stays backward compatible with olympiads configured before usernames
// existed.

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({ username: '', password: '' }))

  if (!password || typeof password !== 'string') {
    return apiError('Password is required.', 400)
  }
  const uname = typeof username === 'string' ? username.trim() : ''

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, organizer_username, organizer_password, result_published, annotations_published')
    .eq('is_active', true)

  if (error) {
    return apiError('Could not verify password.', 500)
  }

  const matches = (data || []).filter((o: any) => {
    if (!o.organizer_password || o.organizer_password !== password) return false
    // If this olympiad has a username set, the entered username must match it.
    // If it doesn't (legacy row), password alone is enough.
    if (o.organizer_username) return o.organizer_username === uname
    return true
  })

  if (matches.length === 0) {
    return apiError('Incorrect organizer username or password.', 401)
  }

  const olympiadIds = matches.map((o: any) => o.id)

  const res = apiOk({
    success: true,
    olympiads: matches.map((o: any) => ({
      id: o.id, name: o.name, mode: o.mode,
      result_published: o.result_published, annotations_published: o.annotations_published,
    })),
  })

  return setSessionCookie(res, authCookies.organizer, { olympiadIds }, 12 * HOURS)
}
