/**
 * lib/email/welcome.ts — per-event "welcome" email.
 *
 * Sent once, right when a registration's form path is fully complete (see
 * the `isDone` branch in app/api/public/form-graph/submit/route.ts),
 * regardless of payment status. Config lives per-event on
 * activity_sessions / olympiads (welcome_email_enabled / _subject / _body
 * — migration 33), off by default so nothing sends until an admin opts an
 * event in via Admin → Activities/Olympiads → edit → "Welcome email".
 *
 * Sending reuses the existing email_accounts pool (migration 26) — the
 * same accounts/quotas the bulk campaign runner
 * (lib/email/campaign-runner.ts) uses — so no separate sender setup is
 * needed. Account selection mirrors campaign-runner's rule (lowest
 * sent_today first, skip accounts out of quota for the day); there's no
 * round-robin loop here since a welcome email is always exactly one
 * recipient.
 *
 * Idempotency: welcome_email_sent_at on the registration row. Checked
 * here (not just relied on at the call site) so this function is safe to
 * call more than once for the same registration — e.g. if a terminal node
 * were somehow submitted twice.
 *
 * Never throws: a welcome email failing must never fail the registration
 * itself. Errors are swallowed and recorded on welcome_email_error
 * instead, so an admin can see "wasn't sent, here's why" without the
 * registrant's request ever seeing a 500.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/crypto'
import { sendBrevoBatch } from './brevo'

type WelcomeTable = 'activity_registrations' | 'olympiad_registrations'

// Very small mustache-style substitution — {{key}}, whitespace-tolerant.
// Unknown keys resolve to '' rather than being left in the output, so a
// typo'd placeholder doesn't leak "{{typo}}" into a sent email.
function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => vars[key] ?? '')
}

// Plain-text admin input (a <textarea>, no rich editor) → simple HTML.
// Blank-line-separated chunks become <p>, single newlines within a chunk
// become <br>, so an admin typing normal paragraphs gets normal paragraphs.
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

// Resets any stale daily quota (Asia/Dhaka, same rule as
// campaign-runner's resetStaleQuotas) then picks the active account with
// the most headroom left today. Returns null if every account is inactive
// or exhausted.
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

  return (accounts || []).find(a => a.sent_today < a.daily_limit) || null
}

/**
 * Sends the per-event welcome email for a just-completed registration, if
 * that event has it turned on. Safe to call unconditionally from the
 * submit route once a path is `isDone` — this is a no-op (not an error)
 * when the event hasn't enabled welcome emails, has no subject/body
 * configured, the registrant has no email on file, or one was already
 * sent for this row.
 */
export async function sendWelcomeEmailIfEnabled(table: WelcomeTable, registrationId: string): Promise<void> {
  try {
    const isOlympiad = table === 'olympiad_registrations'
    const { data: reg } = await supabaseAdmin
      .from(table)
      .select(`id, full_name, email, college, welcome_email_sent_at, ${isOlympiad ? 'olympiad_id' : 'activity_session_id'}`)
      .eq('id', registrationId)
      .maybeSingle()

    if (!reg) return
    if ((reg as any).welcome_email_sent_at) return // already sent — idempotent
    if (!reg.email) return // nothing to send to

    const eventTable = isOlympiad ? 'olympiads' : 'activity_sessions'
    const eventId = isOlympiad ? (reg as any).olympiad_id : (reg as any).activity_session_id
    if (!eventId) return

    const { data: event } = await supabaseAdmin
      .from(eventTable)
      .select('welcome_email_enabled, welcome_email_subject, welcome_email_body, title, name')
      .eq('id', eventId)
      .maybeSingle()

    if (!event || !(event as any).welcome_email_enabled) return
    const subjectTpl = (event as any).welcome_email_subject as string | null
    const bodyTpl = (event as any).welcome_email_body as string | null
    if (!subjectTpl || !bodyTpl) return // enabled but not filled in yet — nothing to send

    const eventName = (event as any).title || (event as any).name || 'the event'
    const vars = {
      full_name: reg.full_name || '',
      email: reg.email || '',
      college: (reg as any).college || '',
      event_name: eventName,
    }
    const subject = fillTemplate(subjectTpl, vars)
    const html = textToHtml(fillTemplate(bodyTpl, vars))

    const account = await pickAccount()
    if (!account) {
      await supabaseAdmin
        .from(table)
        .update({ welcome_email_error: 'No active email account with remaining daily quota.' })
        .eq('id', registrationId)
      return
    }

    const apiKey = decrypt(account.api_key_encrypted)
    const [result] = await sendBrevoBatch(
      apiKey,
      { email: account.sender_email, name: account.sender_name },
      subject,
      html,
      [{ email: reg.email, name: reg.full_name || reg.email }],
    )

    if (result.ok) {
      await supabaseAdmin
        .from(table)
        .update({ welcome_email_sent_at: new Date().toISOString(), welcome_email_error: null })
        .eq('id', registrationId)
      await supabaseAdmin
        .from('email_accounts')
        .update({ sent_today: account.sent_today + 1 })
        .eq('id', account.id)
    } else {
      await supabaseAdmin
        .from(table)
        .update({ welcome_email_error: result.error || 'Send failed.' })
        .eq('id', registrationId)
    }
  } catch (err: any) {
    // Best-effort error note only — the registration this was triggered
    // from has already succeeded and must stay that way.
    try {
      await supabaseAdmin
        .from(table)
        .update({ welcome_email_error: err?.message || 'Unexpected error sending welcome email.' })
        .eq('id', registrationId)
    } catch {
      /* swallow — nothing more we can do */
    }
  }
}
