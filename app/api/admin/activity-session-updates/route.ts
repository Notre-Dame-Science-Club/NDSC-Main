import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET ?sessionId=UUID — short timestamped updates admin has posted for one
// activity session (e.g. "venue changed", "round 2 starts Friday"), newest
// first. Deliberately NOT gated behind requireAdmin: this same endpoint is
// read by the member-facing "My Events" dashboard (1.4) to show updates
// under the matching event card, so read access has to be public. Only
// POST/DELETE (actually posting or removing an update) require admin.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_session_updates')
    .select('*')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return apiError(error, 400)
  return apiOk({ updates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)

  if (!body?.activity_session_id) return apiError('activity_session_id is required.', 400)
  if (!body?.title?.trim() || !body?.body?.trim()) return apiError('Title and body are required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_session_updates')
    .insert({
      activity_session_id: body.activity_session_id,
      title: body.title.trim(),
      body: body.body.trim(),
      link: body.link?.trim() || null,
    })
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json().catch(() => ({}))
  if (!id) return apiError('id is required.', 400)

  const { error } = await supabaseAdmin
    .from('activity_session_updates')
    .delete()
    .eq('id', id)

  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
