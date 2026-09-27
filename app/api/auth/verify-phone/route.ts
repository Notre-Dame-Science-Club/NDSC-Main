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
    const { email, phone } = await req.json()

    if (!email || !phone) {
      return apiError('Email and phone number are required.', 400)
    }

    // Look up the user by email (check both members and users tables)
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, email, phone')
      .ilike('email', email)
      .maybeSingle()

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, phone')
      .ilike('email', email)
      .maybeSingle()

    const account = member || user

    if (!account) {
      // Return generic error to prevent email enumeration
      return apiError('Invalid email or phone number.', 401)
    }

    // Verify phone matches (case-insensitive, trim whitespace)
    const normalizePhone = (p: string) => (p || '').trim().replace(/\s+/g, '').toLowerCase()
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
      source: member ? 'members' : 'users',
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
