import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { verifyPayload } from '@/lib/api/sign'
import { guardLogin } from '@/lib/api/rateLimit'
import { createHash, randomBytes } from 'crypto'

// POST /api/auth/reset-password
// Resets password using a verified reset token
export async function POST(req: NextRequest) {
  // Check if Easy_Password_reset is enabled (default: true)
  const easyResetEnabled = process.env.EASY_PASSWORD_RESET !== 'false'

  if (!easyResetEnabled) {
    return apiError('Password reset via phone is disabled.', 403)
  }

  const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

  // Per-IP throttle (no identifier: the token is signed, so guessing is moot,
  // but this stops hammering the endpoint).
  const limited = guardLogin('reset-password', req, '', { limit: 20 })
  if (limited) return limited

  try {
    const { reset_token, new_password } = await req.json()

    if (!reset_token || !new_password) {
      return apiError('Reset token and new password are required.', 400)
    }

    if (new_password.length < 6) {
      return apiError('Password must be at least 6 characters.', 400)
    }

    // Verify the reset token's signature (returns null if unsigned, tampered or malformed)
    const tokenData = typeof reset_token === 'string'
      ? verifyPayload<{ id?: string; email?: string; source?: string; exp?: string }>(reset_token)
      : null
    if (!tokenData) {
      return apiError('Invalid reset token.', 401)
    }

    // Check if token is expired
    if (new Date(tokenData.exp) < new Date()) {
      return apiError('Reset token has expired. Please try again.', 401)
    }

    const { id } = tokenData

    if (IS_LOCAL) {
      // Local dev: update password_hash in members/users table
      const salt = randomBytes(8).toString('hex')
      const password_hash = createHash('sha256')
        .update(`${salt}::${new_password}`)
        .digest('hex')

      // Tokens issued before the users/members split may say source: 'members';
      // every account now lives in `users`.
      const { error } = await supabaseAdmin
        .from('users')
        .update({ password_hash: `${salt}$${password_hash}` })
        .eq('id', id)

      if (error) {
        return apiError('Failed to reset password.', 500)
      }

      return apiOk({
        success: true,
        message: 'Password reset successful! You can now log in with your new password.'
      })
    }

    // Production: use Supabase Auth to update password
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: new_password
    })

    if (authError) {
      return apiError(authError.message || 'Failed to reset password.', 500)
    }

    return apiOk({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    })
  } catch (err: any) {
    console.error('[reset-password] error:', err)
    return apiError('Server error. Please try again.', 500)
  }
}
