// Short-lived, signed permission to use the phone-number password reset ("easy reset") for ONE
// email address, issued by /api/auth/request-reset only when the reset EMAIL could not be sent
// (Brevo down / out of quota / send error). It exists so that:
//   - the weak phone flow is not open to everyone all the time (EASY_PASSWORD_RESET stays false), and
//   - an attacker cannot just call /api/auth/verify-phone directly: they would need a token that the
//     server only hands out when email delivery really failed, for that exact address.
// Signed with SESSION_SECRET (lib/api/sign.ts). Distinct `purpose` values keep it from being
// accepted anywhere else (session cookies, the phone-verified reset token...).

import { signPayload, verifyPayload } from './sign.ts'

export const FALLBACK_PURPOSE = 'phone-reset-fallback'
export const FALLBACK_TTL_MS = 15 * 60 * 1000

type FallbackPayload = { purpose?: string; email?: string; exp?: string }

export function issueFallbackToken(email: string, now = Date.now()): string {
  return signPayload({
    purpose: FALLBACK_PURPOSE,
    email: email.trim().toLowerCase(),
    exp: new Date(now + FALLBACK_TTL_MS).toISOString(),
  })
}

export function verifyFallbackToken(token: unknown, email: string, now = Date.now()): boolean {
  if (typeof token !== 'string' || !token) return false
  const p = verifyPayload<FallbackPayload>(token)
  if (!p || p.purpose !== FALLBACK_PURPOSE || !p.email || !p.exp) return false
  if (p.email !== email.trim().toLowerCase()) return false
  const exp = Date.parse(p.exp)
  return Number.isFinite(exp) && exp > now
}

/** Master switch for the automatic fallback (default ON). Set EASY_PASSWORD_RESET_FALLBACK=false to disable. */
export function fallbackEnabled(): boolean {
  return process.env.EASY_PASSWORD_RESET_FALLBACK !== 'false'
}
