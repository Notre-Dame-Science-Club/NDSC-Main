import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

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
  const body = await req.json() // { key: string, value: string }
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
