import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { createHash, randomBytes } from 'crypto'

// Member registration.
//
// Two paths:
//   - Production (default): create a Supabase Auth user via the admin
//     API, then insert the matching row in the `members` table.
//   - Local dev (SUPABASE_ENV=local): skip GoTrue entirely. We don't
//     have it in the docker-compose stack, so we generate a uuid
//     locally and store a salted SHA-256 hash of the password in
//     `members.password_hash`. The login route branches the same way.
//
// The session side of the auth flow on local is handled by the
// shim in lib/supabase.ts — it rewrites client-side `supabase.auth.*`
// calls into /api/auth/* calls so the rest of the app works without
// changes.

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

// Local-only password hash. SHA-256 with a per-row salt; not bcrypt, but
// fine for a dev stack where the threat model is "did I make a typo"
// rather than "is an attacker trying to log in as another user".
function hashPasswordLocal(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}::${password}`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      password,
      full_name,
      phone,
      ndsc_id,
      college_roll,
      batch,
      payment_slip_url,
    } = await req.json()

    // Basic validation
    if (!email || !password || !full_name) {
      return apiError('Name, email, and password are required.', 400)
    }

    // College roll is the site's primary identifier for members — required
    // for everyone, with the exact-8-digits rule applying because NDSC
    // membership is specifically for Notre Dame College students.
    const rollError = validateCollegeRoll('Notre Dame College', college_roll)
    if (rollError) {
      return apiError(rollError, 400)
    }

    if (!payment_slip_url) {
      return apiError('Please upload a photo of your membership slip.', 400)
    }

    if (IS_LOCAL) {
      // Local dev: no GoTrue, write straight to members with a hashed
      // password. The id is a random uuid; we don't try to keep it
      // matching any auth.users id (there are none).
      const salt = randomBytes(8).toString('hex')
      const password_hash = hashPasswordLocal(password, salt)
      const { data: created, error: dbError } = await supabaseAdmin
        .from('members')
        .insert({
          email,
          full_name,
          phone: phone || null,
          ndsc_id: ndsc_id || null,
          college_roll: String(college_roll),
          batch: batch || null,
          payment_slip_url,
          is_verified: false,
          password_hash: `${salt}$${password_hash}`,
        })
        .select('id')
        .single()
      if (dbError) return apiError(dbError.message || 'Failed to register.', 400)
      return apiOk({
        success: true,
        member_id: created.id,
        message: 'Registration successful! Your membership will be reviewed by an admin shortly.',
      })
    }

    // Production path — Supabase Auth.
    const { data: authData, error: authError } = await supabaseAdmin
      .auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return apiError(authError.message, 400)
    }

    const { error: dbError } = await supabaseAdmin
      .from('members')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        ndsc_id: ndsc_id || null,
        college_roll: String(college_roll),
        batch: batch || null,
        payment_slip_url,
        is_verified: false,
      })

    if (dbError) {
      // DB insert fail হলে auth user delete করে দাও যাতে orphan account না থাকে
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return apiError(dbError.message, 400)
    }

    return apiOk({
      success: true,
      message: 'Registration successful! Your membership will be reviewed by an admin shortly.',
    })
  } catch (err) {
    return apiError('Server error. Please try again.', 500)
  }
}
