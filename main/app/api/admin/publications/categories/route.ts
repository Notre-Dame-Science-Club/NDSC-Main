// Admin: get / set the list of Publication categories shown in the
// "Publications" admin form's category dropdown + "add category" box.
//
// This route was missing entirely — the admin/publications page has been
// calling GET/PUT on this path since the category-picker was built, and
// every call 404'd. Because of that:
//   - Categories were never actually persisted anywhere. The page fell back
//     to re-deriving the dropdown from whatever `category` values already
//     existed across ALL saved publications every time the page loaded, so
//     old/typo'd categories kept reappearing ("random categories we didn't
//     create") and a newly-typed category vanished on refresh (nothing to
//     delete or manage — it was never saved).
//
// No new table needed: we reuse the existing homepage_settings key/value
// store (same pattern as /api/admin/homepage-settings and
// /api/admin/appearance-settings) under a single key, storing the
// categories array as a JSON string.

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

const SETTINGS_KEY = 'publications_categories'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('homepage_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!data?.value) return apiOk([])
  try {
    const parsed = JSON.parse(data.value)
    return apiOk(Array.isArray(parsed) ? parsed : [])
  } catch {
    return apiOk([])
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.categories)) {
    return apiError('categories must be an array.', 400)
  }
  // De-dupe by value (last one wins) so a stray double-save can't leave two
  // entries with the same `value` pointing at different labels.
  const map = new Map<string, { value: string; label: string }>()
  for (const c of body.categories) {
    if (c && typeof c.value === 'string' && c.value) {
      map.set(c.value, { value: c.value, label: typeof c.label === 'string' ? c.label : c.value })
    }
  }
  const categories = Array.from(map.values())
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(categories), updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true, categories })
}

// Remove one category by value. Note: if any publication is still saved
// with this category, the admin page's own load() will re-derive it back
// into the list on next refresh (by design — a category still in use
// shouldn't silently disappear from the picker). Re-assign or delete those
// publications first if you want the category gone for good.
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  const value = body?.value
  if (!value || typeof value !== 'string') return apiError('value is required.', 400)

  const { data, error: readErr } = await supabaseAdmin
    .from('homepage_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (readErr) return apiError(readErr, 400)

  let current: { value: string; label: string }[] = []
  try { current = data?.value ? JSON.parse(data.value) : [] } catch { current = [] }
  const next = current.filter(c => c?.value !== value)

  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true, categories: next })
}
