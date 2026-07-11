import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// Distinct from /api/admin/send-announcement (one-to-many, BCC). This is
// admin sending a direct, individual email to one specific member from
// their row in the Members admin page.

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const memberId = body?.member_id
  const subject = body?.subject?.trim()
  const message = body?.message?.trim()

  if (!memberId || !subject || !message) {
    return apiError('member_id, subject, and message are all required.', 400)
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('email, full_name')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return apiError('Member not found.', 404)
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${member.full_name},</p>
      <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/</g, '&lt;')}</p>
      <p style="font-size:12px;color:#888;margin-top:24px;">Notre Dame Science Club — ndscbd.net</p>
    </div>
  `

  const result = await sendEmail(member.email, subject, html)
  if (!result.ok) {
    return apiError(result.error || 'Could not send the email.', 502)
  }

  return apiOk({ success: true })
}
