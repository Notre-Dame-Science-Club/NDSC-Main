// Pure in-memory counters (no framework imports so they can be unit-tested).
// In-memory fallback only; use checkRateLimitShared (rateLimit.ts) for anything abuse-sensitive.
// See rateLimit.ts for the request-aware helpers used by routes.

// In-memory rate limiting for auth-style endpoints.
//
// LIMITATION: state lives in this process's memory. That is fine for a single
// long-lived Node process or a single serverless instance, but on Vercel each
// instance/region has its own Map, so the effective limit is per-instance.
// If the app runs on several instances, swap the two Maps below for a shared
// store (Upstash Redis / Vercel KV) — the exported function signatures are
// designed so callers don't need to change.

type Bucket = { count: number; resetAt: number }
type Fail = { n: number; until: number; lastAt: number }

const buckets = new Map<string, Bucket>()
const fails = new Map<string, Fail>()

const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000
const FAIL_FORGET_MS = 15 * 60 * 1000 // failures older than this (and not locked) are forgotten
const SWEEP_THRESHOLD = 5000

function sweep(now: number) {
  if (buckets.size + fails.size < SWEEP_THRESHOLD) return
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  for (const [k, f] of fails) if (f.until <= now && now - f.lastAt > FAIL_FORGET_MS) fails.delete(k)
}

/**
 * Fixed-window counter: allows `limit` calls per `windowMs` for `key`.
 * Every call counts, so use it as a blanket throttle (e.g. per IP).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  sweep(now)
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  return { ok: true, retryAfterSec: 0 }
}

/** Is `key` currently locked out after too many failed attempts? */
export function isLocked(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now()
  const f = fails.get(key)
  if (f && f.until > now) return { locked: true, retryAfterSec: Math.ceil((f.until - now) / 1000) }
  return { locked: false, retryAfterSec: 0 }
}

/** Record a failed attempt; the 5th failure locks `key` for 15 minutes. */
export function recordFailure(key: string): void {
  const now = Date.now()
  sweep(now)
  const prev = fails.get(key)
  // An expired lock, or failures older than the forget window, start the count over.
  const lockExpired = !!prev && prev.until !== 0 && prev.until <= now
  const stale = !!prev && prev.until === 0 && now - prev.lastAt > FAIL_FORGET_MS
  const n = !prev || lockExpired || stale ? 1 : prev.n + 1
  fails.set(key, { n, until: n >= MAX_FAILS ? now + LOCK_MS : 0, lastAt: now })
}

/** Clear failures after a successful login. */
export function clearFailures(key: string): void {
  fails.delete(key)
}

/** Test helper. */
export function __resetRateLimitsForTests() {
  buckets.clear()
  fails.clear()
}
