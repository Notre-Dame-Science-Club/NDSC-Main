import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

// Appearance settings are stored as extra rows in the existing homepage_settings
// key/value table (keys: default_theme, font_family, font_google_url,
// header_size, accent_color) — no separate table needed since it's the same
// generic key/value shape.
//
// GET is intentionally public (no requireAdmin) — every page on the site
// fetches this on load to apply the site-wide theme/font/header size/accent.
const APPEARANCE_KEYS = ['default_theme', 'font_family', 'font_google_url', 'header_size', 'accent_color']

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('homepage_settings')
    .select('*')
    .in('key', APPEARANCE_KEYS)
  if (error) return apiError(error, 400)
  const obj: Record<string, string> = {}
  for (const row of data || []) obj[row.key] = row.value
  return apiOk(obj)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json() // { key: string, value: string }
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}

