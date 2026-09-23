import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/activity-session-appearance?session_id=…
//   Returns the per-session appearance row (or null if none yet).
// PUT /api/admin/activity-session-appearance
//   Body: { session_id, ...appearance-fields }. Upserts by session_id.

const APPEARANCE_COLUMNS = [
  'form_title',
  'form_subtitle',
  'form_cover_photo_url',
  'form_cover_aspect_ratio',
  'form_bg_theme',
  'form_bg_color',
  'form_bg_image_url',
  'form_font_family',
  'form_auto_pull_title',
  'form_auto_pull_description',
  'form_auto_pull_cover',
  'form_contact_persons',
] as const

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return apiBadRequest('session_id is required.')

  const { data, error } = await supabaseAdmin
    .from('activity_session_form_appearance')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) return apiError(error, 400)
  return apiOk({ appearance: data })
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body?.session_id) return apiBadRequest('session_id is required.')

  // Only real columns go to Postgres.
  const packed: Record<string, any> = { session_id: body.session_id }
  for (const col of APPEARANCE_COLUMNS) {
    if (body[col] !== undefined) packed[col] = body[col]
  }
  packed.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('activity_session_form_appearance')
    .upsert(packed, { onConflict: 'session_id' })
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ appearance: data })
}
