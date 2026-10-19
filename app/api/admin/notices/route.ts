import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminEmail, requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { countAudience, noticeStatus, parseNoticeInput } from '@/lib/notices'
import { fetchAudienceUsers } from '@/lib/server/noticeAudience'

// Admin CRUD for dashboard notices. Bare array / bare row / id-in-body for PUT + DELETE,
// like the sibling /api/admin/surveys route. Unlike that route, the body is whitelisted and
// validated (lib/notices.ts) rather than spread straight into the table.

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data: notices, error } = await supabaseAdmin
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)

  const { users, error: usersError } = await fetchAudienceUsers()
  if (usersError) return apiError(usersError, 400)

  // Per notice: how many accounts match right now, and how many have already closed it.
  const dismissed = await Promise.all(
    (notices || []).map(n =>
      supabaseAdmin.from('notice_dismissals').select('notice_id', { count: 'exact', head: true }).eq('notice_id', n.id)
    )
  )

  const now = new Date()
  return apiOk(
    (notices || []).map((n, i) => ({
      ...n,
      status: noticeStatus(n, now),
      reach: countAudience(n, users),
      dismissed_count: dismissed[i].count ?? 0,
    }))
  )
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const parsed = parseNoticeInput(await req.json().catch(() => null))
  if (!parsed.ok) return apiError(parsed.error, 400)

  const { data, error } = await supabaseAdmin
    .from('notices')
    .insert({ ...parsed.value, created_by: await getAdminEmail(), updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return apiError('Missing id', 400)

  const parsed = parseNoticeInput(body, { partial: true })
  if (!parsed.ok) return apiError(parsed.error, 400)
  if (Object.keys(parsed.value).length === 0) return apiError('Nothing to update.', 400)

  const { data, error } = await supabaseAdmin
    .from('notices')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!data) return apiError('Notice not found.', 404)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return apiError('Missing id', 400)

  // notice_dismissals rows go with it (ON DELETE CASCADE).
  const { error } = await supabaseAdmin.from('notices').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
