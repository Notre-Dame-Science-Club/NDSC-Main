import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api/response'
import { signLocalToken } from '@/lib/localAuth'

// Member login.
//
// Two paths, branched on SUPABASE_ENV:
//   - Production (default): sign in via Supabase Auth (GoTrue), then
//     look the matching row up in `members` to enforce is_verified.
//   - Local dev: there is no GoTrue in the docker stack, so we verify
//     the password against the salted SHA-256 hash stored in
//     members.password_hash (written by /api/auth/register on the same
//     branch) and hand back a self-signed bearer token. The token
//     passes through everywhere the rest of the app expects a
//     Supabase session — the `localFetch` shim in lib/supabase.ts
//     rewrites the `auth.getUser` URL to /api/auth/local-verify, which
//     decodes the same token. The client shim handles getSession /
//     signOut / etc. on the browser side.

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

// Same hash function as /api/auth/register's local path. Kept inline
// (not imported) so each route can be read independently.
import { createHash } from 'crypto'
function verifyPasswordLocal(password: string, stored: string): boolean {
  if (!stored || typeof stored !== 'string') return false
  const sep = stored.indexOf('$')
  if (sep < 1) return false
  const salt = stored.slice(0, sep)
  const hash = stored.slice(sep + 1)
  const candidate = createHash('sha256').update(`${salt}::${password}`).digest('hex')
  // length check + constant-time compare (the shapes always match when
  // the hash is well-formed — the ctime is the paranoia layer for
  // pathological inputs)
  if (hash.length !== candidate.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ candidate.charCodeAt(i)
  return diff === 0
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return apiOk(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    if (IS_LOCAL) {
      // Look up the member by email (case-insensitive index added in
      // db/migration_member_password_07.sql). We pull the columns
      // both the local and prod members table have in common —
      // `role` and `avatar_url` don't exist in the local table, so
      // they're intentionally omitted.
      const { data: member, error: lookupError } = await supabaseAdmin
        .from('members')
        .select('id, email, full_name, wing, department, college_roll, batch, is_verified, password_hash')
        .ilike('email', email)
        .maybeSingle()

      if (lookupError) {
        process.stderr.write(`[auth/login] lookup error: ${lookupError.message}\n`)
        return apiOk({ error: 'Server error. Please try again.' }, { status: 500 })
      }
      if (!member || !member.password_hash || !verifyPasswordLocal(password, member.password_hash)) {
        return apiOk({ error: 'Incorrect email or password.' }, { status: 401 })
      }

      if (!member.is_verified) {
        return apiOk(
          { error: 'Your account has not been approved yet. Please wait for admin approval.' },
          { status: 403 }
        )
      }

      // Mint a local token. The verify route reads the same `mid` and
      // echoes the email back so `supabase.auth.getUser(token).then(u =>
      // u.data.user.email)` keeps working.
      const access_token = signLocalToken(member.id, member.email)
      // The "refresh token" is a no-op in local mode — we don't track
      // refresh, and the client shim ignores it. We still hand back a
      // value so supabase.auth.setSession() (when it doesn't go through
      // our shim) doesn't blow up.
      const refresh_token = 'local-' + member.id

      return apiOk({
        success: true,
        // The local-mode client shim in lib/supabase.ts reads these
        // directly off the response and skips the
        // `supabase.auth.setSession` round-trip.
        session: {
          access_token,
          refresh_token,
          expires_in: 60 * 60 * 24 * 7,
          token_type: 'bearer',
          user: {
            id: member.id,
            email: member.email,
            aud: 'authenticated',
            role: 'authenticated',
          },
        },
        member: {
          id: member.id,
          full_name: member.full_name,
          email: member.email,
          // role column doesn't exist in the local members table;
          // default to 'member' so the dashboard's `m.role` reads
          // still get a string. (Prod has the real role; this only
          // affects the local-dev path.)
          role: 'member',
          wing: member.wing,
          department: member.department,
          college_roll: member.college_roll,
          batch: member.batch,
          // avatar_url column doesn't exist in the local members
          // table. Default to null so the dashboard's `m.avatar_url`
          // reads don't break. (Prod has the real value.)
          avatar_url: null,
        },
      })
    }

    // Production path — Supabase Auth.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return apiOk(
        { error: 'Incorrect email or password.' },
        { status: 401 }
      )
    }

    // members table থেকে info আনো
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (memberError || !member) {
      return apiOk(
        { error: 'Member record not found.' },
        { status: 404 }
      )
    }

    // Verified কিনা check
    if (!member.is_verified) {
      return apiOk(
        { error: 'Your account has not been approved yet. Please wait for admin approval.' },
        { status: 403 }
      )
    }

    return apiOk({
      success: true,
      session: data.session,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
        wing: member.wing,
        department: member.department,
        college_roll: member.college_roll,
        batch: member.batch,
        avatar_url: member.avatar_url,
      }
    })

  } catch (err) {
    return apiOk(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    )
  }
}
