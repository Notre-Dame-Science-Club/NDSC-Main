/**
 * lib/email/brevo.ts — Brevo transactional email integration.
 *
 * This file contains two separate systems:
 * 1. `sendSurveyEmail` — single global BREVO_API_KEY for survey notifications (legacy)
 * 2. Multi-account sender functions for the new mass-emailing system (accounts stored encrypted in DB)
 *
 * Both coexist — do NOT remove `sendSurveyEmail`, it's used by app/api/admin/surveys/send-email/route.ts
 */

export type EmailRecipient = { email: string; name?: string }

export type SendEmailResult = { sent: number; error: string | null; configured: boolean }

// Brevo batches — keep conservative for reliability
const BREVO_BATCH_SIZE = 50

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

// ============================================================================
// MULTI-ACCOUNT MASS-EMAILING FUNCTIONS
// ============================================================================

/**
 * Verifies a Brevo API key by calling GET /v3/account.
 * Returns { ok: true } if valid, { ok: false, error: '...' } otherwise.
 */
export async function verifyBrevoApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: text || `Brevo API returned ${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error verifying API key.' }
  }
}

/**
 * Sends a batch of personalized emails via Brevo's transactional API.
 * Chunks recipients into batches of BREVO_BATCH_SIZE and calls the API.
 * Returns a per-recipient result array.
 */
export async function sendBrevoBatch(
  apiKey: string,
  sender: { email: string; name: string },
  subject: string,
  html: string,
  recipients: { email: string; name?: string }[]
): Promise<{ email: string; ok: boolean; error?: string }[]> {
  const results: { email: string; ok: boolean; error?: string }[] = []

  // Chunk recipients into batches
  for (let i = 0; i < recipients.length; i += BREVO_BATCH_SIZE) {
    const batch = recipients.slice(i, i + BREVO_BATCH_SIZE)

    // Brevo expects messageVersions array for personalized sends
    const messageVersions = batch.map(r => ({
      to: [{ email: r.email, name: r.name || r.email }],
    }))

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: sender.email, name: sender.name },
          subject,
          htmlContent: html,
          messageVersions,
        }),
      })

      if (res.ok) {
        // All recipients in this batch succeeded
        batch.forEach(r => results.push({ email: r.email, ok: true }))
      } else {
        const text = await res.text().catch(() => '')
        const error = text || `Brevo API returned ${res.status}`
        // Mark all in this batch as failed
        batch.forEach(r => results.push({ email: r.email, ok: false, error }))
      }
    } catch (e: any) {
      const error = e?.message || 'Network error'
      batch.forEach(r => results.push({ email: r.email, ok: false, error }))
    }
  }

  return results
}
