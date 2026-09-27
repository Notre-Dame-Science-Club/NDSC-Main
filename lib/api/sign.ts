import { createHmac, timingSafeEqual } from 'crypto'

// Signs/verifies session-cookie payloads so a value in the cookie jar can't
// be tampered with or hand-crafted — see lib/api/session-cookie.ts for how
// this is actually used to set/read the cookie.
//
// Format: base64(JSON payload).base64(HMAC-SHA256 of that JSON, keyed by
// SESSION_SECRET). Both halves are base64 (not base64url) since cookie
// values are otherwise unconstrained here and this keeps the encoding
// simple and reversible.

// Fallback used only when SESSION_SECRET isn't set in the environment.
// This is a hardcoded dev convenience, NOT safe for production — anyone with
// this source can forge session cookies. Set SESSION_SECRET in .env before
// deploying anywhere real.
const FALLBACK_SESSION_SECRET = 'dev-insecure-fallback-session-secret-change-me'

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    console.warn(
      'SESSION_SECRET is not set — falling back to a hardcoded dev secret. ' +
        'This is insecure and must not be used in production.'
    )
    return FALLBACK_SESSION_SECRET
  }
  return secret
}

/** Signs a JSON-serializable payload, returning the full cookie value. */
export function signPayload(payload: unknown): string {
  const secret = getSecret()
  const json = JSON.stringify(payload)
  const payloadB64 = Buffer.from(json, 'utf8').toString('base64')
  const hmac = createHmac('sha256', secret).update(payloadB64).digest('base64')
  return `${payloadB64}.${hmac}`
}

/**
 * Verifies a signed cookie value and returns the decoded payload, or null on
 * any mismatch, malformed value, or parse failure — never throws for a bad
 * cookie (only when SESSION_SECRET itself is missing).
 */
export function verifyPayload<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null
  const secret = getSecret()

  const dotIndex = value.lastIndexOf('.')
  if (dotIndex === -1) return null
  const payloadB64 = value.slice(0, dotIndex)
  const providedHmac = value.slice(dotIndex + 1)
  if (!payloadB64 || !providedHmac) return null

  const expectedHmac = createHmac('sha256', secret).update(payloadB64).digest('base64')

  const expectedBuf = Buffer.from(expectedHmac, 'utf8')
  const providedBuf = Buffer.from(providedHmac, 'utf8')
  if (expectedBuf.length !== providedBuf.length) return null
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null

  try {
    const json = Buffer.from(payloadB64, 'base64').toString('utf8')
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
