import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'
import { isAppearanceKey, validateAppearanceSetting } from '@/lib/safeStyle'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('homepage_settings')
    .select('*')
  if (error) return apiError(error, 400)
  // Flatten the key/value rows into a single settings object.
  const obj: Record<string, string> = {}
  for (const row of data || []) obj[row.key] = row.value
  return apiOk(obj)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null) // { key: string, value: string }
  if (!body || typeof body.key !== 'string' || !body.key) return apiError('Invalid key', 400)
  // This generic route used to accept ANY key/value, which bypassed the checks in
  // /api/admin/appearance-settings. Appearance keys go through the same validator.
  let value = body.value
  if (isAppearanceKey(body.key)) {
    const checked = validateAppearanceSetting(body.key, body.value)
    if (!checked.ok) return apiError(checked.error, 400)
    value = checked.value
  } else if (typeof value !== 'string' || value.length > 2000) {
    return apiError('Value must be text (max 2000 characters).', 400)
  }
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: body.key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
