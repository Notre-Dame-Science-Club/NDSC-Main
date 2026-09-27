import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/activity-updates?sessionId=UUID — newest first
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_updates')
    .select('*')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return apiError(error, 400)
  return apiOk({ updates: data ?? [] })
}

// POST { activity_session_id, title, body, link_url? }
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  if (!body?.activity_session_id) return apiError('activity_session_id is required.', 400)
  if (!body?.title?.trim()) return apiError('Title is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_updates')
    .insert({
      activity_session_id: body.activity_session_id,
      title: body.title.trim(),
      body: body.body?.trim() || '',
      link_url: body.link_url?.trim() || null,
    })
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ update: data })
}

// DELETE { id }
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json().catch(() => ({}))
  if (!id) return apiError('id is required.', 400)

  const { error } = await supabaseAdmin.from('activity_updates').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
