import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { isNDCName } from '@/lib/college'
import { validateCollegeRoll } from '@/lib/validation'

// Lets a logged-in member edit their own basic info from the dashboard.
// Same Bearer-token auth pattern as /api/member-achievements and
// /api/member-shoutbox — the session lives in browser localStorage, not an
// HTTP cookie the server would see automatically.
//
// Deliberately does NOT allow editing: is_verified, department,
// achievements, payment_slip_url, ndsc_id — those stay admin-controlled.
//
// college_roll IS editable: for Notre Dame College students it is the one thing that
// identifies them uniquely, and sign-up does not ask for it. See the college_roll block below.

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Primary fields: essential identity fields
// Secondary fields: optional profile enhancement fields
const EDITABLE_FIELDS = [
  'full_name',
  'institution',
  'education_level',
  'phone',
  'gender',
  'blood_group',
  'address',
  'secondary_phone',
  'avatar_url',
  'college_roll',
]

export async function PUT(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request.', 400)

  const patch: Record<string, any> = {}
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  // Validate full_name if provided
  if (patch.full_name !== undefined && !String(patch.full_name).trim()) {
    return apiError('Name cannot be empty.', 400)
  }

  // Validate phone if provided
  if (patch.phone !== undefined && patch.phone !== null) {
    const phoneStr = String(patch.phone).trim()
    if (phoneStr && !/^\d{11}$/.test(phoneStr)) {
      return apiError('Phone number must be 11 digits.', 400)
    }
  }

  // Validate secondary_phone if provided
  if (patch.secondary_phone !== undefined && patch.secondary_phone !== null) {
    const phoneStr = String(patch.secondary_phone).trim()
    if (phoneStr && !/^\d{11}$/.test(phoneStr)) {
      return apiError('Secondary phone number must be 11 digits.', 400)
    }
  }

  // College roll — validated against the college the account will have AFTER this save
  // (so changing institution and roll together is checked consistently).
  if (patch.college_roll !== undefined) {
    const roll = String(patch.college_roll ?? '').trim()
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('institution, college_roll')
      .eq('id', user.id)
      .maybeSingle()
    const institution = patch.institution !== undefined ? patch.institution : existing?.institution
    const isNDC = !String(institution ?? '').trim() || isNDCName(institution)
    const hadRoll = !!String(existing?.college_roll ?? '').trim()

    if (!roll) {
      // Nothing to save (an empty box on an account that never had a roll), or an attempt to
      // wipe the roll. NDC students can't: the roll is how we identify them.
      if (!hadRoll) delete patch.college_roll
      else if (isNDC) return apiError('Notre Dame College students need a college roll — it is how we identify you. To correct it, send us a message from the Contact tab.', 400)
      else patch.college_roll = null
    } else {
      const rollError = validateCollegeRoll(institution, roll)
      if (rollError) return apiError(rollError, 400)

      if (isNDC) {
        // Every NDC roll is unique, so a roll already on another NDC account means a typo
        // or someone else's number. (Rolls from other colleges can legitimately repeat.)
        const { data: clashes, error: clashError } = await supabaseAdmin
          .from('users')
          .select('id, institution')
          .eq('college_roll', roll)
          .neq('id', user.id)
        if (clashError) return apiError(clashError, 400)
        if ((clashes || []).some((r: any) => isNDCName(r.institution))) {
          return apiError('This roll number is already linked to another account. If it is yours, send us a message from the Contact tab and we will sort it out.', 409)
        }
      }
      patch.college_roll = roll
    }
  }

  if (Object.keys(patch).length === 0) return apiError('Nothing to update.', 400)

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ member: data })
}
