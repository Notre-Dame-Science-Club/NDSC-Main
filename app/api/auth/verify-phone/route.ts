import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { signPayload } from '@/lib/api/sign'
import { guardLoginShared, lockKey, recordFailure, clearFailures } from '@/lib/api/rateLimit'
import { verifyFallbackToken } from '@/lib/api/resetFallback'

// GET /api/auth/verify-phone -> { enabled } so the forgot-password page can pick the right flow
export async function GET() {
  return apiOk({ enabled: process.env.EASY_PASSWORD_RESET === 'true' })
}

// POST /api/auth/verify-phone
// Verifies that a phone number matches the one registered with an email
export async function POST(req: NextRequest) {
  // Phone-based reset is OFF unless EASY_PASSWORD_RESET is explicitly 'true', OR the caller holds a
  // signed fallback_token for this exact email (issued by /api/auth/request-reset only when the
  // reset email could not be sent). Without either, refuse.
  const easyResetEnabled = process.env.EASY_PASSWORD_RESET === 'true'

  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const phone = String(body.phone || '').trim()

    if (!easyResetEnabled && !verifyFallbackToken(body.fallback_token, email)) {
      return apiError('Password reset via phone is disabled.', 403)
    }

    if (!email || !phone) {
      return apiError('Email and phone number are required.', 400)
    }

    // Phone numbers are low-entropy, so brute-force protection matters here.
    const limited = await guardLoginShared('verify-phone', req, email)
    if (limited) return limited
    const failKey = lockKey('verify-phone', req, email)

    // Look up the account by email (every website account lives in `users`)
    const { data: account } = await supabaseAdmin
      .from('users')
      .select('id, email, phone')
      .ilike('email', email.replace(/[\\%_]/g, c => '\\' + c))
      .maybeSingle()

    if (!account) {
      // Return generic error to prevent email enumeration
      recordFailure(failKey)
      return apiError('Invalid email or phone number.', 401)
    }

    // Verify phone matches. Compare only the last 10 digits so that
    // 01712345678, +8801712345678, 8801712345678 and "017-1234 5678"
    // all count as the same number.
    const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10)
    const inputPhone = normalizePhone(phone)
    const storedPhone = normalizePhone(account.phone || '')

    if (!storedPhone || inputPhone !== storedPhone) {
      recordFailure(failKey)
      return apiError('Invalid email or phone number.', 401)
    }

    clearFailures(failKey)

    // Temporary reset token (valid for 15 minutes). It is HMAC-signed with
    // SESSION_SECRET so it cannot be hand-crafted or tampered with; the
    // reset-password route verifies it with verifyPayload().
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const tokenData = signPayload({
      purpose: 'phone-reset',
      id: account.id,
      email: account.email,
      source: 'users',
      exp: expiresAt,
    })

    return apiOk({
      success: true,
      reset_token: tokenData,
      message: 'Phone verified. You can now reset your password.'
    })
  } catch (err: any) {
    console.error('[verify-phone] error:', err)
    return apiError('Server error. Please try again.', 500)
  }
}
