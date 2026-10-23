/**
 * lib/email/transactional.ts - one-off transactional email (password reset etc.).
 *
 * Sends through the same Brevo account pool as the welcome emails / campaigns (email_accounts,
 * migration 26: lowest sent_today first, skip accounts out of daily quota). If no Brevo account
 * can send, falls back to Resend (lib/email.ts, needs RESEND_API_KEY). Never throws.
 *
 * Why not Supabase's own mailer: the built-in SMTP is for testing only (tiny hourly limit, and it
 * only delivers to your own team's addresses), so production auth emails must go through our own
 * sender.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/crypto'
import { sendBrevoBatch } from './brevo'
import { sendEmail as sendViaResend } from '@/lib/email'

// Same daily-quota rule as welcome.ts / campaign-runner (Asia/Dhaka day).
async function pickAccount(): Promise<any | null> {
  const dhakaNow = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayDhaka = dhakaNow.split(',')[0]

  await supabaseAdmin
    .from('email_accounts')
    .update({ sent_today: 0, quota_date: todayDhaka })
    .neq('quota_date', todayDhaka)

  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sent_today', { ascending: true })

  return (accounts || []).find((a: any) => a.sent_today < a.daily_limit) || null
}

/**
 * Cheap pre-check (no email is sent): can ANY sender work right now? True when a Brevo account is
 * active with quota left, or Resend is configured. Used by the password reset to decide up front
 * whether to fall back to the phone flow.
 */
export async function isEmailChannelAvailable(): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (await pickAccount()) return { ok: true }
  } catch (e: any) {
    if (!process.env.RESEND_API_KEY) return { ok: false, reason: `Brevo account lookup failed: ${e?.message || 'unknown error'}` }
  }
  if (process.env.RESEND_API_KEY) return { ok: true }
  return { ok: false, reason: 'No active Brevo account with remaining daily quota, and RESEND_API_KEY is not set.' }
}

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  let brevoError = ''
  try {
    const account = await pickAccount()
    if (account) {
      const [result] = await sendBrevoBatch(
        decrypt(account.api_key_encrypted),
        { email: account.sender_email, name: account.sender_name },
        subject,
        html,
        [{ email: to, name: to }],
      )
      if (result.ok) {
        await supabaseAdmin
          .from('email_accounts')
          .update({ sent_today: account.sent_today + 1 })
          .eq('id', account.id)
        return { ok: true }
      }
      brevoError = result.error || 'Brevo send failed.'
    } else {
      brevoError = 'No active Brevo account with remaining daily quota.'
    }
  } catch (e: any) {
    brevoError = e?.message || 'Brevo send failed.'
  }

  // Fallback: Resend, if configured.
  if (process.env.RESEND_API_KEY) {
    const r = await sendViaResend(to, subject, html)
    if (r.ok) return { ok: true }
    return { ok: false, error: `${brevoError} | resend: ${r.error || 'failed'}` }
  }
  return { ok: false, error: brevoError }
}
