import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { apiError, apiOk } from '@/lib/api/response'
import { setSessionCookie, HOURS } from '@/lib/api/session-cookie'
import { authCookies } from '@/lib/config/site'
import { guardLoginShared, lockKey, recordFailure, clearFailures } from '@/lib/api/rateLimit'

// Compare via SHA-256 digests so the buffers are always equal length
// (timingSafeEqual throws on unequal lengths) and length isn't leaked.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(req: NextRequest) {
  // Shared admin password — must be set in the environment (ADMIN_PASSWORD).
  // There is deliberately no hardcoded fallback: if it's missing, refuse to
  // authenticate anyone.
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error('[admin/login] ADMIN_PASSWORD is not set; admin login is disabled.')
    return apiError('Admin login is not configured.', 503)
  }

  const body = await req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const limited = await guardLoginShared('admin-login', req, email)
  if (limited) return limited
  const key = lockKey('admin-login', req, email)

  if (!safeEqual(password, adminPassword)) {
    recordFailure(key)
    return apiError('Invalid credentials', 401)
  }

  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !data) {
    recordFailure(key)
    return apiError('Access denied. Not an admin.', 403)
  }

  clearFailures(key)
  const res = apiOk({ success: true })
  return setSessionCookie(res, authCookies.admin, { email, role: data.role }, 8 * HOURS)
}
