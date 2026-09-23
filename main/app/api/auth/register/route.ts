import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { createHash, randomBytes, randomUUID } from 'crypto'

// Member registration.
//
// Open to all students. Users provide basic information to create an account.
// NDC students can apply for Club Membership from their dashboard profile.
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
      institution,
      education_level,
      phone,
    } = await req.json()

    // Basic validation
    if (!email || !password || !full_name || !institution || !education_level || !phone) {
      return apiError('All fields are required.', 400)
    }

    if (password.length < 6) {
      return apiError('Password must be at least 6 characters.', 400)
    }

    if (IS_LOCAL) {
      // Local dev: no GoTrue, write straight to members with a hashed
      // password. The id is a random uuid; we don't try to keep it
      // matching any auth.users id (there are none). members.id has no
      // default (schema.sql: "== auth.users.id, no default"), so it must
      // be generated here explicitly or the insert violates the not-null
      // constraint.
      const salt = randomBytes(8).toString('hex')
      const password_hash = hashPasswordLocal(password, salt)
      const { data: created, error: dbError } = await supabaseAdmin
        .from('members')
        .insert({
          id: randomUUID(),
          email,
          full_name,
          institution,
          education_level,
          phone,
          membership_status: 'none',
          is_verified: false,
          password_hash: `${salt}$${password_hash}`,
        })
        .select('id')
        .single()
      if (dbError) return apiError(dbError.message || 'Failed to register.', 400)
      return apiOk({
        success: true,
        member_id: created.id,
        message: 'Registration successful! You can now log in to your account.',
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
        institution,
        education_level,
        phone,
        membership_status: 'none',
        is_verified: false,
      })

    if (dbError) {
      // DB insert fail হলে auth user delete করে দাও যাতে orphan account না থাকে
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return apiError(dbError.message, 400)
    }

    return apiOk({
      success: true,
      message: 'Registration successful! You can now log in to your account.',
    })
  } catch (err) {
    return apiError('Server error. Please try again.', 500)
  }
}
