// app/api/auth/oauth/complete/route.ts
//
// Creates the `members` row for a user who signed in via OAuth (Google) and
// therefore has a Supabase Auth identity but no membership record yet.
//
// Security: the caller must present a valid Bearer token for the OAuth
// session. The row's id is pinned to that user (auth.users.id), so a
// user can only ever create their own row — no admin access required.
//
// This endpoint is idempotent: if the row already exists (double-submit,
// or the user registered with email/password under the same auth id), we
// return success without touching the database.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { getBearerFromAuthHeader } from '@/lib/localAuth'

export async function POST(req: NextRequest) {
  try {
    // ── Identify the caller ───────────────────────────────────────────
    const token = getBearerFromAuthHeader(req.headers.get('authorization'))
    if (!token) {
      return apiError('Please sign in to complete your registration.', 401)
    }
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !authUser?.user) {
      return apiError('Your session has expired. Please sign in again.', 401)
    }
    const userId = authUser.user.id
    const userEmail = authUser.user.email

    // ── Parse and validate body ───────────────────────────────────────
    const body = await req.json()
    const full_name = (body.full_name || '').trim()
    const phone = (body.phone || '').trim() || null
    const ndsc_id = (body.ndsc_id || '').trim() || null
    const college_roll = (body.college_roll || '').trim()
    const batch = (body.batch || '').trim() || null
    const payment_slip_url = body.payment_slip_url || null

    if (!full_name) {
      return apiError('Full name is required.', 400)
    }

    const rollError = validateCollegeRoll('Notre Dame College', college_roll)
    if (rollError) {
      return apiError(rollError, 400)
    }

    // ── Idempotency: row already exists for this auth user ────────────
    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) {
      return apiOk({
        success: true,
        member_id: existing.id,
        already: true,
        message: 'Your membership record already exists.',
      })
    }

    // ── Insert ────────────────────────────────────────────────────────
    const { data: created, error: insertError } = await supabaseAdmin
      .from('members')
      .insert({
        id: userId,
        email: userEmail || null,
        full_name,
        phone,
        ndsc_id,
        college_roll,
        batch,
        payment_slip_url,
        is_verified: false,
      })
      .select('id')
      .single()

    if (insertError) {
      // A unique/duplicate error usually means another member already
      // owns this email or college_roll. The user likely registered via
      // email/password earlier and is trying to create a second row
      // through OAuth with a different auth id.
      if (/(email|duplicate|unique|conflict)/i.test(insertError.message)) {
        return apiError(
          'An account with this email already exists. Please sign in with your email and password instead.',
          409,
        )
      }
      return apiError(insertError.message || 'Failed to complete registration.', 400)
    }

    return apiOk({
      success: true,
      member_id: created.id,
      message: 'Welcome to NDSC! Your membership will be reviewed by an admin shortly.',
    })
  } catch (err) {
    return apiError('Server error. Please try again.', 500)
  }
}
