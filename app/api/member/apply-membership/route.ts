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

  // Fetch member record
  const { data: member, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError || !member) {
    return apiError('Member record not found.', 404)
  }

  // Check if member is an NDC student
  if (!isNDCStudent(member)) {
    return apiError('Only Notre Dame College students can apply for club membership.', 403)
  }

  // Check membership status
  if (
    member.membership_status !== 'none' &&
    member.membership_status !== 'rejected' &&
    member.membership_status !== null
  ) {
    return apiError(
      `Cannot apply for membership. Current status: ${member.membership_status}.`,
      400
    )
  }

  // Update member record
  const { data: updatedMember, error: updateError } = await supabaseAdmin
    .from('members')
    .update({
      college_roll,
      batch: trimmedBatch,
      department: department || null,
      payment_slip_url: trimmedSlipUrl,
      membership_status: 'pending',
      is_verified: false,
    })
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) return apiError(updateError, 400)

  return apiOk({ member: updatedMember })
}
