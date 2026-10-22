import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { claimTeamRegistrations } from '@/lib/server/claimRegistrations'
import { checkRateLimit } from '@/lib/api/rateLimitCore'
import { clientIp, tooManyRequests } from '@/lib/api/rateLimit'
import { verifyTurnstile } from '@/lib/api/turnstile'
import { validateRegister, type RegisterInput } from '@/lib/api/registerValidation'

// Member registration.
//
// Open to all students. Users provide basic information to create an account.
// NDC students can apply for Club Membership from their dashboard profile.
//
// Two paths:
//   - Production (default): create a Supabase Auth user via the admin
//     API, then insert the matching row in the `users` table (everyone who signs up is a user; club members are added to `members` only after admin approval).
//   - Local dev (SUPABASE_ENV=local): skip GoTrue entirely. We don't
//     have it in the docker-compose stack, so we generate a uuid
//     locally and store a salted SHA-256 hash of the password in
//     `users.password_hash`. The login route branches the same way.
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
    // 1) Cheapest checks first, so a flood costs us almost no CPU.
    //    Blanket per-IP throttle (a whole classroom may share one IP, hence 20/h).
    const ip = clientIp(req)
    const t = checkRateLimit(`register:ip:${ip}`, 20, 60 * 60 * 1000)
    if (!t.ok) return tooManyRequests(t.retryAfterSec, 'Too many sign-ups from your network. Please try again later.')

    // Reject oversized bodies before parsing them.
    const declaredLen = Number(req.headers.get('content-length') || 0)
    if (declaredLen > 8 * 1024) return apiError('Invalid request.', 413)

    let body: any
    try { body = await req.json() } catch { return apiError('Invalid request.', 400) }

    // 2) Honeypot: the real form has a hidden "website" field humans never fill.
    //    Pretend success so the bot doesn't learn anything and keeps wasting time.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return apiOk({ success: true, message: 'Registration successful! You can now log in to your account.' })
    }

    // 3) Validate + normalise every field (email lower-cased, lengths capped…).
    const v = validateRegister(body)
    if (!v.ok) return apiError(v.error || 'Invalid request.', 400)
    const { email, password, full_name, institution, education_level, phone } = v.value as RegisterInput

    // 4) Captcha — verified on the server with the secret key. Only now do we
    //    touch Supabase, which is the expensive part.
    const captcha = await verifyTurnstile(body.turnstile_token, ip)
    if (!captcha.ok) {
      if (captcha.reason === 'not_configured') {
        process.stderr.write('[auth/register] TURNSTILE_SECRET_KEY is not set — refusing registrations\n')
        return apiError('Registration is temporarily unavailable. Please try again later.', 503)
      }
      if (captcha.reason === 'unreachable') {
        return apiError('Could not verify you are human right now. Please try again.', 503)
      }
      return apiError('Please complete the human verification and try again.', 400)
    }

    if (IS_LOCAL) {
      // Local dev: no GoTrue, write straight to users with a hashed
      // password. The id is a random uuid; we don't try to keep it
      // matching any auth.users id (there are none). users.id has no
      // default (schema.sql: "== auth.users.id, no default"), so it must
      // be generated here explicitly or the insert violates the not-null
      // constraint.
      const salt = randomBytes(8).toString('hex')
      const password_hash = hashPasswordLocal(password, salt)
      const { data: created, error: dbError } = await supabaseAdmin
        .from('users')
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
      await claimTeamRegistrations(created.id, email)   // auto-enroll into teams that already list this e-mail
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
      .from('users')
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

    await claimTeamRegistrations(authData.user.id, email)   // auto-enroll into teams that already list this e-mail

    return apiOk({
      success: true,
      message: 'Registration successful! You can now log in to your account.',
    })
  } catch (err) {
    return apiError('Server error. Please try again.', 500)
  }
}
