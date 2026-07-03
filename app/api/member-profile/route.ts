import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'

// Lets a logged-in member edit their own basic info from the dashboard.
// Same Bearer-token auth pattern as /api/member-achievements and
// /api/member-shoutbox — the session lives in browser localStorage, not an
// HTTP cookie the server would see automatically.
//
// Deliberately does NOT allow editing: is_verified, department,
// achievements, payment_slip_url, ndsc_id — those stay admin-controlled.

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

const EDITABLE_FIELDS = ['full_name', 'phone', 'college_roll', 'batch']

export async function PUT(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request.', 400)

  const patch: Record<string, any> = {}
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  if (patch.college_roll !== undefined) {
    const rollError = validateCollegeRoll('Notre Dame College', patch.college_roll)
    if (rollError) return apiError(rollError, 400)
  }
  if (patch.full_name !== undefined && !String(patch.full_name).trim()) {
    return apiError('Name cannot be empty.', 400)
  }

  const { data, error } = await supabaseAdmin
    .from('members')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ member: data })
}
