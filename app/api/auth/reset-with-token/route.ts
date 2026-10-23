import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { checkRateLimitShared, clientIp, tooManyRequests } from '@/lib/api/rateLimit'

// POST /api/auth/reset-with-token  { token_hash, new_password }
//
// Finishes the email-link reset started by /api/auth/request-reset. The one-time token is verified
// against Supabase Auth (POST /auth/v1/verify) with a plain fetch - NOT supabaseAdmin.auth.verifyOtp,
// which would store the user's session on the shared admin client and make later admin calls run as
// that user. The password is then set with the admin API and every existing session is revoked.

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const BAD_LINK = 'This reset link is invalid or has expired. Please request a new one.'

export async function POST(req: NextRequest) {
  try {
    if (IS_LOCAL) {
      return apiError('Email reset is not available in local dev. Set EASY_PASSWORD_RESET=true instead.', 501)
    }

    const tIp = await checkRateLimitShared(`reset-with-token:ip:${clientIp(req)}`, 20, 60 * 60 * 1000, true)
    if (!tIp.ok) return tooManyRequests(tIp.retryAfterSec)

    if (Number(req.headers.get('content-length') || 0) > 4 * 1024) return apiError('Invalid request.', 413)
    let body: any
    try { body = await req.json() } catch { return apiError('Invalid request.', 400) }

    const tokenHash = body?.token_hash
    const newPassword = body?.new_password
    if (typeof tokenHash !== 'string' || tokenHash.length < 16 || tokenHash.length > 256) return apiError(BAD_LINK, 400)
    if (typeof newPassword !== 'string' || newPassword.length < 8) return apiError('Password must be at least 8 characters.', 400)
    if (newPassword.length > 72) return apiError('Password must be at most 72 characters.', 400)

    // 1) Verify + consume the one-time token.
    const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'recovery', token_hash: tokenHash }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null)
    if (!vr) return apiError('Could not reach the auth server. Please try again.', 503)
    const session: any = await vr.json().catch(() => null)
    const userId: string | undefined = session?.user?.id
    if (!vr.ok || !userId) return apiError(BAD_LINK, 400)

    // 2) Set the new password.
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
    if (updErr) return apiError(updErr.message || 'Could not update the password.', 400)

    // 3) Sign out everywhere (best effort): anyone holding an old session loses it.
    try {
      if (session?.access_token) await supabaseAdmin.auth.admin.signOut(session.access_token, 'global')
    } catch { /* password is already changed; don't fail the request over this */ }

    return apiOk({ success: true, message: 'Password updated. You can now log in.' })
  } catch {
    return apiError('Server error. Please try again.', 500)
  }
}
