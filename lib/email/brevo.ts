/**
 * lib/email/brevo.ts — placeholder sender for survey notification emails.
 *
 * The "send email: yes/no" option on a survey is wired end-to-end (saved on
 * the survey, recipient list resolved via the same audience logic as the
 * web notification, an admin "Send Now" action calls this) — the one thing
 * missing on purpose is the actual Brevo API call, since that account isn't
 * set up yet. Swap the body of `sendSurveyEmail` for a real
 * `fetch('https://api.brevo.com/v3/smtp/email', ...)` call once
 * `BREVO_API_KEY` exists; the call site (app/api/admin/surveys/send-email/route.ts)
 * doesn't need to change.
 *
 * Required env var once this is wired up:
 *   BREVO_API_KEY - from https://app.brevo.com/settings/keys/api
 */

export type EmailRecipient = { email: string; name?: string }

export type SendEmailResult = { sent: number; error: string | null; configured: boolean }

export type VerifyResult = { ok: boolean; error?: string }

/**
 * Verify a Brevo API key by making a test call to the Brevo API.
 * Returns { ok: true } if valid, { ok: false, error: '...' } otherwise.
 */
export async function verifyBrevoApiKey(apiKey: string): Promise<VerifyResult> {
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, error: 'API key is required' }
  }

  try {
    // Call Brevo account endpoint to verify the key
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { ok: false, error: 'Invalid API key' }
      }
      return { ok: false, error: `Brevo API error: ${response.status}` }
    }

    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to verify API key' }
  }
}

export async function sendSurveyEmail(
  recipients: EmailRecipient[],
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return {
      sent: 0,
      configured: false,
      error: 'Email sending isn\u2019t configured yet (BREVO_API_KEY missing) — the survey was saved and its web notification (if enabled) is live, but no email was sent.',
    }
  }

  // Not implemented yet — this branch only runs once BREVO_API_KEY is set.
  // Brevo's transactional email API accepts up to 50 "to" recipients per
  // call; batch the same way app/api/admin/send-announcement/route.ts
  // batches Resend calls, and BCC-equivalent via individual `to` entries
  // (Brevo doesn't support a bulk BCC field the way Resend does — send each
  // recipient their own `to` array entry per batch instead).
  return { sent: 0, configured: true, error: 'Brevo integration not implemented yet.' }
}
