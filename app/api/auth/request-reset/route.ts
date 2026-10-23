import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { checkRateLimitShared, clientIp, tooManyRequests } from '@/lib/api/rateLimit'
import { verifyTurnstile } from '@/lib/api/turnstile'
import { isEmailChannelAvailable, sendTransactionalEmail } from '@/lib/email/transactional'
import { issueFallbackToken, fallbackEnabled } from '@/lib/api/resetFallback'
import { serverAlert, maskEmail } from '@/lib/api/serverAlert'
import { site } from '@/lib/config/site'

// POST /api/auth/request-reset  { email, turnstile_token }
//
// Emails a one-time password-reset link through OUR mailer (Brevo pool, Resend fallback), not
// Supabase's built-in SMTP (testing only). auth.admin.generateLink({ type: 'recovery' }) makes the
// token WITHOUT sending anything; we put its hashed_token in a link to our own /reset-password
// page, which finishes the reset via /api/auth/reset-with-token.
//
// AUTOMATIC FALLBACK: if the email cannot be sent (no Brevo account / quota and no Resend, or the
// send errors), the response carries { fallback: 'phone', fallback_token } and the page switches to
// the phone-number reset for that address (verify-phone accepts the signed, 15-minute,
// per-address token). Every such event is logged LOUDLY via serverAlert. Disable with
// EASY_PASSWORD_RESET_FALLBACK=false.
//
// ANTI-SPAM (this route must never become a bulk-email cannon):
//   - exactly ONE recipient per send: the requested address itself, and only if it has an account;
//   - fixed template: nothing the visitor types ends up in the email body or headers;
//   - Turnstile captcha + shared per-IP limit (10/h) + per-address limit (3/day) + 60s per-address
//     cooldown + a GLOBAL daily cap on reset emails (RESET_EMAIL_DAILY_CAP, default 100), so even a
//     botnet cannot exceed the cap or exhaust the Brevo quota that campaigns/welcome mails need.
//   - when the global cap is hit we answer "busy", we do NOT fall back to the phone flow: forcing
//     the weak flow on must not be achievable just by flooding requests.
// Always answers the same generic success whether or not the email has an account.

const IS_LOCAL = (process.env.SUPABASE_ENV || '').toLowerCase() === 'local'
const GENERIC_OK = 'If an account exists for that email, we have sent a link to reset your password.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  try {
    if (IS_LOCAL) {
      return apiError('Email reset is not available in local dev (no Supabase Auth). Set EASY_PASSWORD_RESET=true instead.', 501)
    }

    const ip = clientIp(req)
    const tIp = await checkRateLimitShared(`reset-request:ip:${ip}`, 10, 60 * 60 * 1000, true)
    if (!tIp.ok) return tooManyRequests(tIp.retryAfterSec)

    if (Number(req.headers.get('content-length') || 0) > 4 * 1024) return apiError('Invalid request.', 413)
    let body: any
    try { body = await req.json() } catch { return apiError('Invalid request.', 400) }

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return apiError('Enter a valid email address.', 400)
    }

    const captcha = await verifyTurnstile(body?.turnstile_token, ip)
    if (!captcha.ok) {
      if (captcha.reason === 'not_configured') {
        process.stderr.write('[auth/request-reset] TURNSTILE_SECRET_KEY is not set - refusing\n')
        return apiError('Password reset is temporarily unavailable. Please try again later.', 503)
      }
      if (captcha.reason === 'unreachable') {
        return apiError('Could not verify you are human right now. Please try again.', 503)
      }
      return apiError('Please complete the human verification and try again.', 400)
    }

    // Per-address caps, only after the captcha passes (so a bot can't use up someone's allowance).
    const tEmail = await checkRateLimitShared(`reset-request:email:${email}`, 3, 24 * 60 * 60 * 1000, true)
    if (!tEmail.ok) return tooManyRequests(tEmail.retryAfterSec)
    // 60s cooldown per address: repeat clicks get the same generic answer but no second email.
    const cool = await checkRateLimitShared(`reset-request:email:cool:${email}`, 1, 60 * 1000, true)
    if (!cool.ok) return apiOk({ success: true, message: GENERIC_OK })

    const fallbackReply = (why: string) => {
      // Only the phone flow for THIS address, via a signed 15-minute token.
      serverAlert('PASSWORD RESET', 'Email could not be sent -> offering PHONE reset fallback', `${why} (account: ${maskEmail(email)})`)
      return apiOk({
        success: true,
        fallback: 'phone',
        fallback_token: issueFallbackToken(email),
        message: "We couldn't send the reset email right now. You can verify with the phone number you registered with instead.",
      })
    }
    const unavailable = () =>
      apiError('Password reset by email is temporarily unavailable. Please try again later.', 503)

    // 1) Is any email channel usable at all? Checked BEFORE looking the account up, so when email
    //    is down every address gets the same answer (no account enumeration through the outage).
    const channel = await isEmailChannelAvailable()
    if (!channel.ok) {
      serverAlert('EMAIL DOWN', 'Password-reset emails cannot be sent (no working sender)', channel.reason)
      return fallbackEnabled() ? fallbackReply(channel.reason || 'no email channel') : unavailable()
    }

    // 2) Unknown email -> generateLink errors; we swallow it and answer exactly the same.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
    const tokenHash = (data as any)?.properties?.hashed_token as string | undefined
    if (error || !tokenHash) return apiOk({ success: true, message: GENERIC_OK })

    // 3) Global daily budget for reset emails. Counted only for REAL sends (account exists), so
    //    junk addresses can't drain it. Over budget = "busy", never the weak phone fallback.
    const cap = Math.max(1, Number(process.env.RESET_EMAIL_DAILY_CAP) || 100)
    const budget = await checkRateLimitShared('reset-request:global', cap, 24 * 60 * 60 * 1000, true)
    if (!budget.ok) {
      serverAlert('POSSIBLE ABUSE', `Daily password-reset email cap (${cap}) reached - refusing more reset emails`, 'Check logs for request floods; raise RESET_EMAIL_DAILY_CAP only if traffic is legitimate.')
      return unavailable()
    }

    // 4) Send. Link always points at our configured site URL, never at the request's Host header.
    const link = `${site.url}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px">Reset your ${site.shortName} password</h2>
        <p>We got a request to reset the password for your ${site.name} account.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a>
        </p>
        <p style="font-size:13px;color:#555">This link works once and expires soon. If the button doesn't work, copy this address into your browser:<br>${link}</p>
        <p style="font-size:13px;color:#555">If you didn't ask for this, you can ignore this email; your password will not change.</p>
      </div>`
    const sent = await sendTransactionalEmail(email, `Reset your ${site.shortName} password`, html)
    if (!sent.ok) {
      serverAlert('EMAIL FAILED', 'Password-reset email failed to send', `${sent.error} (to: ${maskEmail(email)})`)
      return fallbackEnabled() ? fallbackReply(sent.error || 'send failed') : apiOk({ success: true, message: GENERIC_OK })
    }
    return apiOk({ success: true, message: GENERIC_OK })
  } catch (err) {
    serverAlert('PASSWORD RESET', 'Unexpected error in /api/auth/request-reset', err)
    return apiError('Server error. Please try again.', 500)
  }
}
