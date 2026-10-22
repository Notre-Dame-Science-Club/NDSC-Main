import type { NextRequest } from 'next/server'
import { apiError } from '@/lib/api/response'
import { checkRateLimit, isLocked } from './rateLimitCore'

export { checkRateLimit, isLocked, recordFailure, clearFailures } from './rateLimitCore'

/**
 * Best-effort client IP. ndscbd.net sits behind Cloudflare, so Vercel only sees
 * Cloudflare's edge IPs in x-forwarded-for — the real visitor is in
 * cf-connecting-ip. (Anyone who bypasses Cloudflare could forge this header, so
 * treat per-IP limits as a speed bump; Turnstile is the real gate.)
 */
export function clientIp(req: NextRequest | Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0].trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
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

