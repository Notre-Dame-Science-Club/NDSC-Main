import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// POST /api/auth/verify-phone
// Verifies that a phone number matches the one registered with an email
export async function POST(req: NextRequest) {
  // Check if Easy_Password_reset is enabled (default: true)
  const easyResetEnabled = process.env.EASY_PASSWORD_RESET !== 'false'

  if (!easyResetEnabled) {
    return apiError('Password reset via phone is disabled.', 403)
  }

  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const phone = String(body.phone || '').trim()

    if (!email || !phone) {
      return apiError('Email and phone number are required.', 400)
    }

    // Look up the account by email (every website account lives in `users`)
    const { data: account } = await supabaseAdmin
      .from('users')
      .select('id, email, phone')
      .ilike('email', email.replace(/[\\%_]/g, c => '\\' + c))
      .maybeSingle()

    if (!account) {
      // Return generic error to prevent email enumeration
      return apiError('Invalid email or phone number.', 401)
    }

    // Verify phone matches. Compare only the last 10 digits so that
    // 01712345678, +8801712345678, 8801712345678 and "017-1234 5678"
    // all count as the same number.
    const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10)
    const inputPhone = normalizePhone(phone)
    const storedPhone = normalizePhone(account.phone || '')

    if (!storedPhone || inputPhone !== storedPhone) {
      return apiError('Invalid email or phone number.', 401)
    }

    // Generate a temporary reset token (valid for 15 minutes)
    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Store token in a temporary table or in-memory (for simplicity, we'll return it)
    // In production, you'd want to store this in a password_reset_tokens table
    // For now, we'll encode the info in a JWT-like token
    const tokenData = Buffer.from(JSON.stringify({
      id: account.id,
      email: account.email,
      source: 'users',
      exp: expiresAt,
      nonce: resetToken
    })).toString('base64')

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
