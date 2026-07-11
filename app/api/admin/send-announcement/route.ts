import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'
import { contact } from '@/lib/config/site'

// This route previously did not exist at all, even though the Olympiad admin
// page had a "Send Announcement Email" box wired up to call it — so every
// attempt to send an announcement was silently 500-ing.
//
// What it does now:
//   1. Auth-check the admin session (same cookie every other /api/admin/* route checks).
//   2. Work out the recipient email list based on `target`:
//      - 'members'      -> verified members only
//      - 'non_members'  -> distinct emails from olympiad_registrations that are
//                          NOT already a verified member's email
//      - 'all'          -> the union of both
//   3. Send the email via Resend (see RESEND_API_KEY below).
//   4. Insert a row into the `announcements` table so it also shows up in the
//      member dashboard's "Announcements" feed (the dashboard already reads
//      from this table — nothing was writing to it before this route existed).
//
// Required env vars (new — add these in Vercel project settings):
//   RESEND_API_KEY        - from https://resend.com (free tier is enough to start)
//   ANNOUNCEMENT_FROM      - e.g. "NDSC <announcements@ndscbd.net>" (must be a
//                            domain you've verified in Resend; falls back to
//                            Resend's shared "onboarding@resend.dev" sender if unset,
//                            which works immediately but looks less official)

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Target = 'all' | 'members' | 'non_members'

function isValidEmail(e: unknown): e is string {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

async function getRecipients(target: Target): Promise<{ email: string; name?: string }[]> {
  const { data: members } = await supabaseAdmin
    .from('members')
    .select('email, full_name')
    .eq('is_verified', true)

  const memberEmails = new Set(
    (members || []).filter((m: any) => isValidEmail(m.email)).map((m: any) => m.email.toLowerCase())
  )

  if (target === 'members') {
    return (members || [])
      .filter((m: any) => isValidEmail(m.email))
      .map((m: any) => ({ email: m.email, name: m.full_name }))
  }

  const { data: regs } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('email, full_name')
    .not('email', 'is', null)

  const nonMemberMap = new Map<string, string>()
  for (const r of regs || []) {
    if (!isValidEmail(r.email)) continue
    const lower = r.email.toLowerCase()
    if (memberEmails.has(lower)) continue // already counted as a member
    if (!nonMemberMap.has(lower)) nonMemberMap.set(lower, r.full_name)
  }
  const nonMembers = Array.from(nonMemberMap.entries()).map(([email, name]) => ({ email, name }))

  if (target === 'non_members') return nonMembers

  // target === 'all'
  const memberList = (members || [])
    .filter((m: any) => isValidEmail(m.email))
    .map((m: any) => ({ email: m.email, name: m.full_name }))
  return [...memberList, ...nonMembers]
}

async function sendViaResend(to: string[], subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: 0, error: 'RESEND_API_KEY is not configured.' }

  const from = process.env.ANNOUNCEMENT_FROM || contact.announcementFallbackSender

  // Resend allows up to 50 "to" addresses per call in most plans; batch to be safe
  // and so one bad address doesn't fail the whole list.
  const BATCH_SIZE = 40
  let sent = 0
  let lastError: string | null = null

  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const batch = to.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: from, // visible "to" stays the sender, recipients are BCC'd so they can't see each other
          bcc: batch,
          subject,
          html,
        }),
      })
      if (res.ok) {
        sent += batch.length
      } else {
        const text = await res.text()
        lastError = text
      }
    } catch (e: any) {
      lastError = e?.message || 'Network error sending email batch'
    }
  }

  return { sent, error: sent === 0 ? lastError : null }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const target: Target = ['all', 'members', 'non_members'].includes(body.target) ? body.target : 'all'
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'NDSC Announcement'

  if (!message) {
    return apiError('Message is required.', 400)
  }

  const recipients = await getRecipients(target)
  const emails = recipients.map(r => r.email)

  if (emails.length === 0) {
    return apiError('No recipients found for this target.', 400)
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0066cc;">${title}</h2>
      <p style="white-space: pre-wrap; line-height:1.6; color:#222;">${message.replace(/</g, '&lt;')}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
      <p style="font-size:12px;color:#888;">Notre Dame Science Club — ndscbd.net</p>
    </div>
  `

  const { sent, error: sendError } = await sendViaResend(emails, title, html)

  // Log it for the member dashboard's Announcements feed, regardless of email
  // delivery outcome — the in-app feed is still useful even if email config
  // is wrong, and we don't want to silently lose the admin's message.
  const { error: dbError } = await supabaseAdmin
    .from('announcements')
    .insert({ title, body: message, target })

  if (sent === 0) {
    return apiOk(
      { error: sendError || 'Could not send the announcement email.', loggedToFeed: !dbError },
      { status: 502 }
    )
  }

  return apiOk({
    success: true,
    sentCount: sent,
    totalRecipients: emails.length,
    loggedToFeed: !dbError,
  })
}
