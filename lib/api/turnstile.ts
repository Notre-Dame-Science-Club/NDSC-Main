// Server-side check for Cloudflare Turnstile tokens.
//
// The browser widget (components/auth/TurnstileWidget.tsx) hands the form a
// one-time token. We must verify it HERE, on the server, with the secret key —
// a token that is only checked in the browser protects nothing, because a bot
// calls /api/auth/register directly and never loads the form.
//
// Env:
//   TURNSTILE_SECRET_KEY            (server only)  — from the Cloudflare dashboard
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (public)       — used by the widget
//
// If the secret is missing in production we FAIL CLOSED (registration is
// refused) — a forgotten env var must not silently re-open the door to bots.
// In development / SUPABASE_ENV=local the check is skipped so local work still runs.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Flat type (not a union): the project's tsconfig is not `strict`, so unions don't narrow.
export type TurnstileResult = { ok: boolean; reason?: 'missing' | 'invalid' | 'not_configured' | 'unreachable' }

export async function verifyTurnstile(token: unknown, remoteIp?: string): Promise<TurnstileResult> {
  const isLocal = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    if (isLocal || process.env.NODE_ENV !== 'production') return { ok: true }
    return { ok: false, reason: 'not_configured' }
  }

  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    return { ok: false, reason: 'missing' }
  }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true ? { ok: true } : { ok: false, reason: 'invalid' }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
