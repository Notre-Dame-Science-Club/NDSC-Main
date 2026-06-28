// Shared helper for sending a single transactional email via Resend — used
// by team-member registration notifications, admin-to-member direct emails,
// etc. Distinct from /api/admin/send-announcement's batch/BCC logic, which
// is for one-to-many announcements; this is one-to-one.

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not configured.' }

  const from = process.env.ANNOUNCEMENT_FROM || 'NDSC <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (res.ok) return { ok: true }
    const text = await res.text()
    return { ok: false, error: text }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error sending email.' }
  }
}
