import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { setSessionCookie, HOURS } from '@/lib/api/session-cookie'
import { authCookies } from '@/lib/config/site'

// Simple password — store this in .env as ADMIN_PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (password !== ADMIN_PASSWORD) {
    return apiError('Invalid credentials', 401)
  }

  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !data) {
    return apiError('Access denied. Not an admin.', 403)
  }

  const res = apiOk({ success: true })
  return setSessionCookie(res, authCookies.admin, { email, role: data.role }, 8 * HOURS)
}
