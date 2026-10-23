import type { NextRequest } from 'next/server'
import { apiError } from '@/lib/api/response'
import { supabaseAdmin } from '@/lib/supabase'
import { checkRateLimit, isLocked } from './rateLimitCore'

export { checkRateLimit, isLocked, recordFailure, clearFailures } from './rateLimitCore'

/**
 * Best-effort client IP. ndscbd.net sits behind Cloudflare, so Vercel only sees
 * Cloudflare's edge IPs in x-forwarded-for — the real visitor is in
 * cf-connecting-ip. (Anyone who bypasses Cloudflare could forge this header, so
 * treat per-IP limits as a speed bump; Turnstile is the real gate.)
 * Without Cloudflare in front, Vercel overwrites x-real-ip / the first
 * x-forwarded-for entry with the true client IP, so those are the fallbacks.
 */
export function clientIp(req: NextRequest | Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0].trim()
    if (first) return first
  }
  return 'unknown'
}

/** Cross-instance fixed-window limiter. Fails OPEN on DB error (logs it) so an outage
 *  doesn't lock out real users; use failClosed=true for signup/reset routes. */
export async function checkRateLimitShared(
  key: string, limit: number, windowMs: number, failClosed = false
): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
      p_key: key, p_limit: limit, p_window_sec: Math.ceil(windowMs / 1000),
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return { ok: !!row?.ok, retryAfterSec: row?.retry_after_sec ?? 1 }
  } catch (e) {
    console.error('[rateLimit] shared limiter failed:', e)
    return failClosed ? { ok: false, retryAfterSec: 30 } : { ok: true, retryAfterSec: 0 }
  }
}

export function tooManyRequests(retryAfterSec: number, message = 'Too many attempts. Please try again later.') {
  const res = apiError(message, 429)
  res.headers.set('Retry-After', String(retryAfterSec))
  return res
}

/**
 * Convenience guard for login-style routes. Returns a 429 response when `ip`
 * is over the blanket throttle or the `ip + identifier` pair is locked out,
 * otherwise null. Pair it with recordFailure()/clearFailures() on the same
 * `lockKey(scope, req, identifier)`.
 */
export function lockKey(scope: string, req: NextRequest | Request, identifier = ''): string {
  return `${scope}:${clientIp(req)}:${identifier.toLowerCase().slice(0, 200)}`
}

export function guardLogin(
  scope: string,
  req: NextRequest | Request,
  identifier = '',
  opts: { limit?: number; windowMs?: number } = {}
) {
  const ip = clientIp(req)
  // Blanket per-IP throttle so one IP can't spray many identifiers.
  const t = checkRateLimit(`${scope}:ip:${ip}`, opts.limit ?? 30, opts.windowMs ?? 15 * 60 * 1000)
  if (!t.ok) return tooManyRequests(t.retryAfterSec)
  const l = isLocked(lockKey(scope, req, identifier))
  if (l.locked) {
    return tooManyRequests(l.retryAfterSec, 'Too many wrong attempts. Please try again in a few minutes.')
  }
  return null
}

/**
 * Same as guardLogin, but the per-IP blanket throttle is shared across instances.
 * TODO: isLocked/recordFailure (the wrong-password lockout) is still in-memory per instance.
 */
export async function guardLoginShared(
  scope: string,
  req: NextRequest | Request,
  identifier = '',
  opts: { limit?: number; windowMs?: number } = {}
) {
  const ip = clientIp(req)
  const t = await checkRateLimitShared(`${scope}:ip:${ip}`, opts.limit ?? 30, opts.windowMs ?? 15 * 60 * 1000)
  if (!t.ok) return tooManyRequests(t.retryAfterSec)
  // TODO: move the lockout to the shared store too.
  const l = isLocked(lockKey(scope, req, identifier))
  if (l.locked) {
    return tooManyRequests(l.retryAfterSec, 'Too many wrong attempts. Please try again in a few minutes.')
  }
  return null
}
