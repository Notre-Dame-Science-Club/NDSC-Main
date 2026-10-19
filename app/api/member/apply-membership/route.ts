import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'
import { isNDCStudent } from '@/types/database'

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function POST(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request.', 400)

  const { college_roll, batch, department, payment_slip_url } = body

  // Validate required fields
  if (!college_roll || !batch || !payment_slip_url) {
    return apiError('College roll, batch, and payment slip URL are required.', 400)
  }

  // Validate college roll (8 digits for NDC students)
  const rollError = validateCollegeRoll('Notre Dame College', college_roll)
  if (rollError) return apiError(rollError, 400)

  // Validate batch
  const trimmedBatch = String(batch).trim()
  if (!trimmedBatch) {
    return apiError('Batch is required.', 400)
  }

  // Validate payment_slip_url
  const trimmedSlipUrl = String(payment_slip_url).trim()
  if (!trimmedSlipUrl) {
    return apiError('Payment slip URL is required.', 400)
  }

  // Fetch the user's account
  const { data: account, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError || !account) {
    return apiError('Account record not found.', 404)
  }

  // Only Notre Dame College students can apply
  if (!isNDCStudent(account)) {
    return apiError('Only Notre Dame College students can apply for club membership.', 403)
  }

  // Already a member, or an application is already waiting for review?
  if (account.membership_status === 'approved' || account.membership_status === 'pending') {
    return apiError(
      `Cannot apply for membership. Current status: ${account.membership_status}.`,
      400
    )
  }

  // 1. Record the application (the DB keeps users.membership_status in sync via a trigger,
  //    and allows only one pending application per user).
  const { error: applyError } = await supabaseAdmin
    .from('membership_applications')
    .insert({
      user_id: user.id,
      college_roll,
      batch: trimmedBatch,
      department: department || null,
      payment_slip_url: trimmedSlipUrl,
      status: 'pending',
    })

  if (applyError) return apiError(applyError, 400)

  // 2. Keep the submitted details on the profile too (dashboard + registrations read them)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      college_roll,
      batch: trimmedBatch,
      department: department || null,
      payment_slip_url: trimmedSlipUrl,
    })
    .eq('id', user.id)

  if (updateError) return apiError(updateError, 400)

  const { data: updatedUser } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // `member` key kept so the existing dashboard code keeps working
  return apiOk({ member: updatedUser })
}
