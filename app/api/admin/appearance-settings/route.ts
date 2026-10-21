import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'
import { validateAppearanceSetting } from '@/lib/safeStyle'

// Appearance settings are stored as extra rows in the existing homepage_settings
// key/value table (keys: default_theme, theme_switcher_enabled,
// theme_switcher_themes, font_family, font_google_url, header_size,
// accent_color, about_hero_video_url, about_hero_poster_url) — no separate
// table needed since it's the same generic key/value shape.
//
// GET is intentionally public (no requireAdmin) — every page on the site
// fetches this on load to apply the site-wide theme/font/header size/accent.
const APPEARANCE_KEYS = [
  'default_theme',
  // Which theme model the public switcher may offer, and whether it shows at
  // all. Stored as '1'/'0' and a comma list ('dark,light,cosmos').
  'theme_switcher_enabled',
  'theme_switcher_themes',
  'font_family',
  'font_google_url',
  'header_size',
  'accent_color',
  'about_hero_video_url',
  'about_hero_poster_url',
]

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
  // Only the known appearance keys may be written through this route.
  if (typeof body.key !== 'string' || !APPEARANCE_KEYS.includes(body.key)) {
    return apiError('Invalid key', 400)
  }
  // Every value is checked against an allowlist for its key (font stack, hex
  // colour, Google Fonts URL, theme id, allowed-host image URL...).
  const checked = validateAppearanceSetting(body.key, body.value)
  if (!checked.ok) return apiError(checked.error, 400)
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: body.key, value: checked.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}

