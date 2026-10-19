import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getMemberFromRequest } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { MESSAGES_PER_DAY, parseMessageInput } from '@/lib/notices'

// The dashboard's message box ("professional obligation" / "report a problem" / "tell us
// something"). Any logged-in account can write to us — it does not require club membership,
// since people who are not members yet are the ones most likely to need help.
// Admins read and resolve these from /admin/messages.

const PUBLIC_COLUMNS = 'id, category, subject, message, status, admin_reply, created_at, resolved_at'
const HISTORY_LIMIT = 20

// The member's own messages, newest first, with their status and our reply (if any).
export async function GET(req: NextRequest) {
  const me = await getMemberFromRequest(req)
  if (!me) return apiError('Unauthorized. Please log in again.', 401)

  const { data, error } = await supabaseAdmin
    .from('member_messages')
    .select(PUBLIC_COLUMNS)
    .eq('user_id', me.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) return apiError(error, 400)
  return apiOk({ messages: data || [] })
}

export async function POST(req: NextRequest) {
  const me = await getMemberFromRequest(req)
  if (!me) return apiError('Unauthorized. Please log in again.', 401)

  const parsed = parseMessageInput(await req.json().catch(() => null))
  if (!parsed.ok) return apiError(parsed.error, 400)

  // Light flood guard: N messages per rolling 24 hours per account.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabaseAdmin
    .from('member_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me.id)
    .gte('created_at', since)
  if (countError) return apiError(countError, 400)
  if ((count ?? 0) >= MESSAGES_PER_DAY) {
    return apiError('You have sent a lot of messages today. Please wait for our reply before sending more.', 429)
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email')
    .eq('id', me.id)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('member_messages')
    .insert({
      user_id: profile ? me.id : null,   // FK to users: only link when the profile row exists
      sender_name: profile?.full_name ?? null,
      sender_email: profile?.email ?? me.email ?? null,
      ...parsed.value,
    })
    .select(PUBLIC_COLUMNS)
    .single()
  if (error) return apiError(error, 400)

  return apiOk({ message: data })
}
