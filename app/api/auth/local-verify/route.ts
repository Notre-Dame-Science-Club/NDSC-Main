// Local-stack-only "verify bearer" endpoint.
//
// The Supabase JS client's `auth.getUser(jwt)` makes a GET to
// `<authUrl>/user` with `Authorization: Bearer <jwt>`. On a real Supabase
// project that hits GoTrue, which decodes the JWT and returns the user
// row. On the local stack there's no GoTrue, so the `localFetch` shim
// in lib/supabase.ts rewrites the URL to this endpoint. We then verify
// the bearer as a local token (lib/localAuth.ts) and return a
// Supabase-shaped user object so the rest of the app keeps working
// without changes.
//
// This route is ONLY mounted on the local stack — it's reached via the
// `localFetch` shim, and `localFetch` only fires when the request URL
// is the local PostgREST URL. On production the real GoTrue handles
// this and we never get here.
//
// Response shape matches GoTrue's `/user` (the `_userResponse` wrapper
// in @supabase/auth-js just puts whatever we return under
// `data.user`, so the minimum is `{ id, email, ... }`).
import { NextRequest } from 'next/server'
import { verifyLocalToken, getBearerFromAuthHeader } from '@/lib/localAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

export async function GET(req: NextRequest) {
  if (!IS_LOCAL) {
    return apiError('Not found.', 404)
  }

  const token = getBearerFromAuthHeader(req.headers.get('authorization'))
  if (!token) {
    return apiError('Missing bearer token.', 401)
  }
  const payload = verifyLocalToken(token)
  if (!payload) {
    return apiError('Invalid or expired token.', 401)
  }

  // Look the member up so the caller can read `data.user.email` etc.
  // without a second round-trip. The members table is the source of
  // truth in local mode (no auth.users table to join against).
  const { data: member, error } = await supabaseAdmin
    .from('members')
    .select('id, email, full_name, is_verified')
    .eq('id', payload.mid)
    .single()

  if (error || !member) {
    return apiError('Member not found.', 404)
  }

  // Return a User-shaped object. We only fill the fields the rest of
  // the app reads off `data.user.*` — id, email, role, aud.
  return apiOk({
    id: member.id,
    email: member.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'local' },
    user_metadata: { full_name: member.full_name },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  })
}
