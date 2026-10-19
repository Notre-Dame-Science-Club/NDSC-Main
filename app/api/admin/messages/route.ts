import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminEmail, requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { MESSAGE_STATUSES, parseMessageUpdate } from '@/lib/notices'

// The admin inbox for the dashboard message box. Each message comes back with who sent it
// (name, contact, college, batch, college roll) so it can be acted on without opening
// another page. `{ messages, counts }` like the sibling `{ members: [...] }` routes.

const LIST_LIMIT = 300
const IN_CHUNK = 100   // keep `in.(...)` URLs short

async function senders(ids: string[]) {
  const byId = new Map<string, any>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, phone, institution, batch, college_roll, is_verified')
      .in('id', ids.slice(i, i + IN_CHUNK))
    for (const u of data || []) byId.set(u.id, u)
  }
  return byId
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const status = new URL(req.url).searchParams.get('status') || 'all'
  if (status !== 'all' && !MESSAGE_STATUSES.some(s => s.value === status)) return apiError('Unknown status.', 400)

  let query = supabaseAdmin.from('member_messages').select('*').order('created_at', { ascending: false }).limit(LIST_LIMIT)
  if (status !== 'all') query = query.eq('status', status)

  const [{ data, error }, ...counted] = await Promise.all([
    query,
    ...MESSAGE_STATUSES.map(s =>
      supabaseAdmin.from('member_messages').select('id', { count: 'exact', head: true }).eq('status', s.value)
    ),
  ])
  if (error) return apiError(error, 400)

  const ids = [...new Set((data || []).map((m: any) => m.user_id).filter(Boolean))] as string[]
  const users = await senders(ids)

  const counts: Record<string, number> = {}
  MESSAGE_STATUSES.forEach((s, i) => { counts[s.value] = counted[i].count ?? 0 })
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0)

  return apiOk({
    messages: (data || []).map((m: any) => ({ ...m, sender: m.user_id ? users.get(m.user_id) ?? null : null })),
    counts,
  })
}

// Change status and/or write the reply the member will see on their dashboard.
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return apiError('Missing id', 400)

  const parsed = parseMessageUpdate(body)
  if (!parsed.ok) return apiError(parsed.error, 400)

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { ...parsed.value, updated_at: now }
  if (parsed.value.status === 'resolved') {
    patch.resolved_by = await getAdminEmail()
    patch.resolved_at = now
  } else if (parsed.value.status) {
    patch.resolved_by = null     // re-opened: no longer "resolved by" anyone
    patch.resolved_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('member_messages')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!data) return apiError('Message not found.', 404)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return apiError('Missing id', 400)

  const { error } = await supabaseAdmin.from('member_messages').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
