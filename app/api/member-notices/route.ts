import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getMemberFromRequest } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { defaultLinkLabel, isNoticeLive, matchesNoticeAudience } from '@/lib/notices'

// The notices a logged-in member should see on their dashboard: active, inside their
// schedule window, aimed at this member's college/batch, and not already dismissed.
//
// Targeting is decided HERE, on the server, from the member's own profile row — the browser
// never receives notices (or links, e.g. a batch's private WhatsApp invite) meant for
// someone else. Auth is the same Bearer-token pattern as /api/member-profile.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const me = await getMemberFromRequest(req)
  if (!me) return apiError('Unauthorized. Please log in again.', 401)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('institution, batch')
    .eq('id', me.id)
    .maybeSingle()
  if (profileError) return apiError(profileError, 400)

  const { data: rows, error } = await supabaseAdmin
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)

  const now = new Date()
  const eligible = (rows || []).filter(n => isNoticeLive(n, now) && matchesNoticeAudience(n, profile))

  let dismissed = new Set<string>()
  if (eligible.length > 0) {
    const { data: done, error: dismissError } = await supabaseAdmin
      .from('notice_dismissals')
      .select('notice_id')
      .eq('user_id', me.id)
      .in('notice_id', eligible.map(n => n.id))
    if (dismissError) return apiError(dismissError, 400)
    dismissed = new Set((done || []).map((d: any) => d.notice_id))
  }

  // Only what the dashboard renders — the audience configuration stays private.
  const notices = eligible
    .filter(n => !dismissed.has(n.id))
    .map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link_url: n.link_url,
      link_label: n.link_label || (n.link_url ? defaultLinkLabel(n.link_url) : null),
      tone: n.tone,
      dismissible: n.dismissible,
      created_at: n.created_at,
    }))

  return apiOk({ notices })
}

// Dismiss: remember on the account (not in the browser) that this member closed a notice,
// so it stays closed on their phone, laptop, everywhere.
export async function POST(req: NextRequest) {
  const me = await getMemberFromRequest(req)
  if (!me) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  const noticeId = typeof body?.notice_id === 'string' ? body.notice_id : ''
  if (!UUID_RE.test(noticeId)) return apiError('Invalid notice.', 400)

  const { data: notice, error: fetchError } = await supabaseAdmin
    .from('notices')
    .select('id, dismissible')
    .eq('id', noticeId)
    .maybeSingle()
  if (fetchError) return apiError(fetchError, 400)
  if (!notice) return apiError('Notice not found.', 404)
  if (!notice.dismissible) return apiError('This notice cannot be dismissed.', 403)

  const { error } = await supabaseAdmin
    .from('notice_dismissals')
    .upsert({ notice_id: noticeId, user_id: me.id }, { onConflict: 'notice_id,user_id', ignoreDuplicates: true })
  if (error) return apiError(error, 400)

  return apiOk({ success: true })
}
