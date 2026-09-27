// lib/localAuth.ts
//
// Local-stack-only bearer token signing/verification.
//
// The local dev stack (SUPABASE_ENV=local) has no Supabase Auth / GoTrue,
// so the standard `supabase.auth.signInWithPassword` / `getUser` flow
// doesn't work. The login route (`app/api/auth/login/route.ts`) hands
// back a self-signed JWT-shaped token instead, and every server route
// that calls `supabaseAdmin.auth.getUser(bearer)` needs that call to
// resolve back to the right member row.
//
// We do that by making `getUser` a no-op against GoTrue on local — the
// `localFetch` shim in lib/supabase.ts rewrites `/auth/v1/user` URLs to
// our own `/api/auth/local-verify` route, which decodes the token below
// and returns a Supabase-shaped user object. That's the only piece of
// the surface we need to fake for the rest of the app to keep working.
//
// The token format is intentionally NOT a real JWT — it's a
// `<payload>.<sig>` pair where `sig = HMAC-SHA256(SECRET, payload)` and
// `payload = base64url(JSON.stringify({mid, exp}))`. Keeps the file
// small and dependency-free.

import { createHmac, timingSafeEqual } from 'crypto'

// Same dev secret as scripts/dev-jwt.js / docker-compose.local.yml.
// The point is to be consistent across the stack; it's not a real
// security boundary (the whole stack runs in dev containers and JWTs
// are checked at the PostgREST layer, not here).
const SECRET = 'dev-only-not-a-real-secret-change-me-in-real-life'

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlDecode(input: string): Buffer {
  // restore padding
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export interface LocalTokenPayload {
  /** member id (the row id in `members`) */
  mid: string
  /** issued at (seconds since epoch) */
  iat: number
  /** expires at (seconds since epoch) */
  exp: number
  /** email captured at sign-in; the verify route echoes it back so
   *  callers reading `data.user.email` keep working without a
   *  follow-up DB read. */
  email?: string
}

/**
 * Sign a token for the given member. The token is a `<payload>.<sig>`
 * pair, base64url-encoded throughout so it's safe to put in a
 * `Authorization: Bearer ...` header without further escaping.
 */
export function signLocalToken(memberId: string, email: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: LocalTokenPayload = { mid: memberId, iat: now, exp: now + ttlSeconds, email }
  const encoded = b64urlEncode(JSON.stringify(payload))
  const sig = b64urlEncode(createHmac('sha256', SECRET).update(encoded).digest())
  return `${encoded}.${sig}`
}

/**
 * Verify a token and return its payload, or null if the signature
 * doesn't match, the token is malformed, or it's expired.
 *
 * Uses timingSafeEqual on the signature to avoid leaking length /
 * byte differences through timing.
 */
export function verifyLocalToken(token: string | null | undefined): LocalTokenPayload | null {
  if (!token || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot < 1 || dot === token.length - 1) return null
  const payloadB64 = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)

  let expected: Buffer
  let actual: Buffer
  try {
    expected = createHmac('sha256', SECRET).update(payloadB64).digest()
    actual = b64urlDecode(sigB64)
  } catch {
    return null
  }
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null

  let payload: LocalTokenPayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload.mid !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

/**
 * Pulls the bearer out of an Authorization header (or returns null if
 * absent). Centralized here so route handlers don't have to repeat the
 * regex.
 */
export function getBearerFromAuthHeader(header: string | null | undefined): string | null {
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}
