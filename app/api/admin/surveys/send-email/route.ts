import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { matchesAudience, type SurveyRow } from '@/lib/survey'
import { sendSurveyEmail } from '@/lib/email/brevo'
import { site } from '@/lib/config/site'

// Admin-triggered "send now" for a survey's notification email — mirrors
// the explicit-action pattern of /api/admin/send-announcement rather than
// firing automatically whenever `send_email` is toggled on, since resending
// isn't idempotent (you don't want a typo'd save to re-email everyone).
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { survey_id } = await req.json().catch(() => ({}))
  if (!survey_id) return apiError('Missing survey_id', 400)

  const { data: survey, error } = await supabaseAdmin
    .from('surveys')
    .select('*')
    .eq('id', survey_id)
    .single()
  if (error || !survey) return apiError('Survey not found.', 404)
  const s = survey as SurveyRow
  if (!s.send_email) return apiError('This survey has "Send email" turned off.', 400)

  const { data: members, error: memberError } = await supabaseAdmin
    .from('members')
    .select('id, email, full_name, batch, is_organizer, is_executive')
    .eq('is_verified', true)
  if (memberError) return apiError(memberError, 400)

  const recipients = (members || [])
    .filter((m: any) => matchesAudience(s.audience_type, s.audience_config, m))
    .filter((m: any) => typeof m.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email))
    .map((m: any) => ({ email: m.email, name: m.full_name }))

  if (recipients.length === 0) {
    return apiError('No recipients match this survey\u2019s audience.', 400)
  }

  const subject = s.notification_title || s.title
  const message = s.notification_message || s.description || 'A new survey is open — we\u2019d love your input.'
  const surveyUrl = `${site.url}/survey/${s.id}`
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0066cc;">${subject}</h2>
      <p style="white-space: pre-wrap; line-height:1.6; color:#222;">${message.replace(/</g, '&lt;')}</p>
      <p style="margin:24px 0;"><a href="${surveyUrl}" style="background:#0066cc;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Take the Survey</a></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
      <p style="font-size:12px;color:#888;">${site.name} — ${site.url}</p>
    </div>
  `

  const result = await sendSurveyEmail(recipients, subject, html)

  await supabaseAdmin
    .from('surveys')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', survey_id)

  if (!result.configured) {
    // Not a hard failure — the survey/notification is still fully saved.
    return apiOk({ success: false, configured: false, totalRecipients: recipients.length, message: result.error })
  }
  if (result.sent === 0) {
    return apiError(result.error || 'Could not send the survey email.', 502)
  }
  return apiOk({ success: true, configured: true, sentCount: result.sent, totalRecipients: recipients.length })
}
