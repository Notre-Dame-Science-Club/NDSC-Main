import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { validateCollegeRoll } from '@/lib/validation'
import { createHash, randomBytes } from 'crypto'

// Bulk account creation for admin panel.
//
// Creates multiple member or user accounts from CSV data. Each account gets:
//   - A Supabase Auth user (prod) or password_hash (local dev)
//   - A row in the `members` or `users` table
//
// Members = NDSC club members with verification workflow
// Users = Event participants (non-members) who need login access
//
// All accounts created in one batch use the same default password. The admin
// should communicate this password to the account holders securely.

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
    const { account_type, default_password, auto_verify, accounts } = body

    // Validation
    if (!account_type || (account_type !== 'member' && account_type !== 'user')) {
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

    const results: CreateResult[] = []

    // Process each account
    for (const account of accounts as AccountData[]) {
      try {
        // Validate required fields
        if (!account.email || !account.full_name) {
          results.push({
            email: account.email || 'unknown',
            status: 'failed',
            reason: 'Email and full name are required'
          })
          continue
        }

        // Email format validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
          results.push({
            email: account.email,
            status: 'failed',
            reason: 'Invalid email format'
          })
          continue
        }

        // Check for duplicate email in target table
        if (account_type === 'member') {
          const { data: existing } = await supabaseAdmin
            .from('members')
            .select('id')
            .eq('email', account.email)
            .maybeSingle()

          if (existing) {
            results.push({
              email: account.email,
              status: 'failed',
              reason: 'Email already exists in members table'
            })
            continue
          }

          // Validate college roll for members
          if (!account.college_roll) {
            results.push({
              email: account.email,
              status: 'failed',
              reason: 'College roll is required for members'
            })
            continue
          }

          const rollError = validateCollegeRoll('Notre Dame College', account.college_roll)
          if (rollError) {
            results.push({
              email: account.email,
              status: 'failed',
              reason: rollError
            })
            continue
          }
        } else {
          const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', account.email)
            .maybeSingle()

          if (existing) {
            results.push({
              email: account.email,
              status: 'failed',
              reason: 'Email already exists in users table'
            })
            continue
          }

          // Validate college roll for users if provided
          if (account.college_roll) {
            const rollError = validateCollegeRoll(account.college, account.college_roll)
            if (rollError) {
              results.push({
                email: account.email,
                status: 'failed',
                reason: rollError
              })
              continue
            }
          }
        }

        // Create account
        if (IS_LOCAL) {
          // Local dev: create password hash and insert directly
          const salt = randomBytes(8).toString('hex')
          const password_hash = hashPasswordLocal(default_password, salt)
          const userId = crypto.randomUUID()

          if (account_type === 'member') {
            const { error } = await supabaseAdmin.from('members').insert({
              id: userId,
              email: account.email,
              full_name: account.full_name,
              phone: account.phone || null,
              college_roll: account.college_roll!,
              batch: account.batch || null,
              department: account.department || null,
              is_verified: auto_verify || false,
              password_hash: `${salt}$${password_hash}`,
            })

            if (error) {
              results.push({
                email: account.email,
                status: 'failed',
                reason: error.message
              })
              continue
            }
          } else {
            const { error } = await supabaseAdmin.from('users').insert({
              id: userId,
              email: account.email,
              full_name: account.full_name,
              phone: account.phone || null,
              college: account.college || null,
              college_roll: account.college_roll || null,
              hsc_session: account.hsc_session || null,
              batch: account.batch || null,
              is_active: true,
              password_hash: `${salt}$${password_hash}`,
            })

            if (error) {
              results.push({
                email: account.email,
                status: 'failed',
                reason: error.message
              })
              continue
            }
          }

          results.push({
            email: account.email,
            status: 'success'
          })
        } else {
          // Production: create Supabase Auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: account.email,
            password: default_password,
            email_confirm: true,
          })

          if (authError) {
            results.push({
              email: account.email,
              status: 'failed',
              reason: authError.message
            })
            continue
          }

          // Insert into target table
          let dbError: any = null

          if (account_type === 'member') {
            const { error } = await supabaseAdmin.from('members').insert({
              id: authData.user.id,
              email: account.email,
              full_name: account.full_name,
              phone: account.phone || null,
              college_roll: account.college_roll!,
              batch: account.batch || null,
              department: account.department || null,
              is_verified: auto_verify || false,
            })
            dbError = error
          } else {
            const { error } = await supabaseAdmin.from('users').insert({
              id: authData.user.id,
              email: account.email,
              full_name: account.full_name,
              phone: account.phone || null,
              college: account.college || null,
              college_roll: account.college_roll || null,
              hsc_session: account.hsc_session || null,
              batch: account.batch || null,
              is_active: true,
            })
            dbError = error
          }

          if (dbError) {
            // Cleanup: delete the auth user if DB insert failed
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            results.push({
              email: account.email,
              status: 'failed',
              reason: dbError.message
            })
            continue
          }

          results.push({
            email: account.email,
            status: 'success'
          })
        }
      } catch (err: any) {
        results.push({
          email: account.email || 'unknown',
          status: 'failed',
          reason: err.message || 'Unknown error'
        })
      }
    }

    const successful = results.filter(r => r.status === 'success')
    const failed = results.filter(r => r.status === 'failed')

    return apiOk({
      total: accounts.length,
      successful: successful.length,
      failed: failed.length,
      results
    })
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500)
  }
}
