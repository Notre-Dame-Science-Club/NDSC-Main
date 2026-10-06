// Find-or-create the website account (a `members` row, + Supabase Auth user in production) for a
// participant. Used by the activity CSV import. Mirrors /api/auth/register so accounts created here
// behave exactly like self-signups: same table, same local-dev password scheme, same defaults.
//
// Existing accounts are NEVER modified (no password reset, no profile overwrite).
import { createHash, randomBytes, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { claimTeamRegistrations } from '@/lib/server/claimRegistrations'

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

const hashPasswordLocal = (password: string, salt: string) =>
  createHash('sha256').update(`${salt}::${password}`).digest('hex')

// ilike treats % and _ as wildcards; emails legitimately contain "_".
const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

export async function findWebsiteAccount(email: string): Promise<{ id: string } | null> {
  const e = email.trim().toLowerCase()
  const { data } = await supabaseAdmin.from('members').select('id').ilike('email', escapeLike(e)).limit(1)
  return data && data.length ? { id: (data[0] as any).id } : null
}

export type AccountInput = {
  email: string
  full_name: string
  phone: string
  institution: string
  password: string
}

export async function ensureWebsiteAccount(
  input: AccountInput,
): Promise<{ ok: true; id: string; created: boolean } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase()
  const existing = await findWebsiteAccount(email)
  if (existing) return { ok: true, id: existing.id, created: false }

  const base = {
    email,
    full_name: input.full_name,
    phone: input.phone,
    institution: input.institution,
    education_level: '<not set>',
    membership_status: 'none',
    is_verified: false,
  }

  if (IS_LOCAL) {
    const salt = randomBytes(8).toString('hex')
    const id = randomUUID()
    const { error } = await supabaseAdmin.from('members').insert({
      id, ...base, password_hash: `${salt}$${hashPasswordLocal(input.password, salt)}`,
    })
    if (error) return { ok: false, error: error.message }
    await claimTeamRegistrations(id, email)
    return { ok: true, id, created: true }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password: input.password, email_confirm: true,
  })
  if (authError || !authData?.user) {
    const msg = authError?.message || 'Could not create the login'
    // An auth user with no `members` row (e.g. half-deleted) can't be adopted automatically.
    return { ok: false, error: /already|registered|exists/i.test(msg)
      ? `A login for ${email} already exists but has no member profile — fix it in Supabase Auth.` : msg }
  }
  const { error: dbError } = await supabaseAdmin.from('members').insert({ id: authData.user.id, ...base })
  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)   // no orphan logins
    return { ok: false, error: dbError.message }
  }
  await claimTeamRegistrations(authData.user.id, email)
  return { ok: true, id: authData.user.id, created: true }
}
