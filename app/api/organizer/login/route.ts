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

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))

  if (!password || typeof password !== 'string') {
    return apiError('Password is required.', 400)
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, organizer_password')
    .eq('is_active', true)

  if (error) {
    return apiError('Could not verify password.', 500)
  }

  const matches = (data || []).filter(
    (o: any) => o.organizer_password && o.organizer_password === password
  )

  if (matches.length === 0) {
    return apiError('Incorrect organizer password.', 401)
  }

  const olympiadIds = matches.map((o: any) => o.id)

  const res = apiOk({
    success: true,
    olympiads: matches.map((o: any) => ({ id: o.id, name: o.name, mode: o.mode })),
  })

  return setSessionCookie(res, authCookies.organizer, { olympiadIds }, 12 * HOURS)
}
