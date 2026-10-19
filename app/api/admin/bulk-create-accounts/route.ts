import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { validateCollegeRoll } from '@/lib/validation'
import { canonicalCollege, NDC_NAME } from '@/lib/college'
import { createHash, randomBytes } from 'crypto'

// Bulk account creation for admin panel.
//
// Two modes, nothing in between:
//   - "member": added as an NDSC club member. Notre Dame College is implied, an 8-digit
//     roll and a batch are required, and the account is approved straight away
//     (users row + admin_set_membership('approved')).
//   - "user": added as a plain website user (membership_status stays 'none'). The college is
//     whatever the CSV says. A user from Notre Dame College sees "Become a Club Member" on
//     their dashboard and can apply there with the normal payment-slip form.
//
// Every account is a row in `users` (Supabase Auth user in prod, password_hash locally).
// All accounts in one request share the same default password; the admin hands it out.

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'

function hashPasswordLocal(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}::${password}`).digest('hex')
}

type AccountData = {
  email: string
  full_name: string
  phone?: string
  college_roll?: string
  batch?: string
  department?: string
  college?: string
  hsc_session?: string
}

type CreateResult = {
  email: string
  status: 'success' | 'failed'
  reason?: string
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const body = await req.json()
    const { account_type, default_password, accounts } = body

    if (account_type !== 'member' && account_type !== 'user') {
      return apiError('account_type must be either "member" or "user"', 400)
    }
    if (!default_password || typeof default_password !== 'string' || default_password.length < 6) {
      return apiError('default_password must be at least 6 characters', 400)
    }
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return apiError('accounts array is required and must not be empty', 400)
    }
    if (accounts.length > 100) {
      return apiError('Maximum 100 accounts per batch', 400)
    }

    const isMember = account_type === 'member'
    const results: CreateResult[] = []

    for (const raw of accounts as AccountData[]) {
      const email = (raw.email || '').trim().toLowerCase()
      const fail = (reason: string) => results.push({ email: email || 'unknown', status: 'failed', reason })

      try {
        const full_name = (raw.full_name || '').trim()
        if (!email || !full_name) { fail('Email and full name are required'); continue }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail('Invalid email format'); continue }

        const { data: existing } = await supabaseAdmin
          .from('users').select('id').ilike('email', email).maybeSingle()
        if (existing) { fail('An account with this email already exists'); continue }

        // Members are always Notre Dame College; users carry whatever college was given
        // (NDC spelling variants are stored under the one canonical name so the dashboard
        // recognises them as eligible to apply for membership).
        const institution = isMember ? NDC_NAME : (canonicalCollege(raw.college) || null)
        const college_roll = (raw.college_roll || '').trim() || null
        const batch = (raw.batch || '').trim() || null

        if (isMember) {
          if (!college_roll) { fail('College roll is required for members'); continue }
          if (!batch) { fail('Batch is required for members'); continue }
        }
        if (college_roll) {
          const rollError = validateCollegeRoll(institution, college_roll)
          if (rollError) { fail(rollError); continue }
        }

        const profile = {
          email,
          full_name,
          phone: (raw.phone || '').trim() || null,
          institution,
          college_roll,
          batch,
          department: isMember ? ((raw.department || '').trim() || null) : null,
          hsc_session: isMember ? null : ((raw.hsc_session || '').trim() || null),
          is_active: true,
        }

        let userId: string
        let authCreated = false
        const extra: Record<string, unknown> = {}

        if (IS_LOCAL) {
          const salt = randomBytes(8).toString('hex')
          userId = crypto.randomUUID()
          extra.password_hash = `${salt}$${hashPasswordLocal(default_password, salt)}`
        } else {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email, password: default_password, email_confirm: true,
          })
          if (authError || !authData?.user) { fail(authError?.message || 'Could not create auth user'); continue }
          userId = authData.user.id
          authCreated = true
        }

        const rollback = async () => {
          await supabaseAdmin.from('users').delete().eq('id', userId)
          if (authCreated) await supabaseAdmin.auth.admin.deleteUser(userId)
        }

        const { error: insertError } = await supabaseAdmin.from('users').insert({ id: userId, ...profile, ...extra })
        if (insertError) {
          if (authCreated) await supabaseAdmin.auth.admin.deleteUser(userId)
          fail(insertError.message)
          continue
        }

        if (isMember) {
          const { error: approveError } = await supabaseAdmin.rpc('admin_set_membership', {
            p_user_id: userId, p_status: 'approved', p_admin: 'admin',
          })
          if (approveError) { await rollback(); fail(approveError.message); continue }
        }

        results.push({ email, status: 'success' })
      } catch (err: any) {
        fail(err.message || 'Unknown error')
      }
    }

    return apiOk({
      total: accounts.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    })
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500)
  }
}
