import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { packFormConfigBody, unpackFormConfigRow } from '@/lib/formConfig'

// GET /api/admin/form-configs?form_key=xxx  OR  GET all
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const key = req.nextUrl.searchParams.get('form_key')
  if (key) {
    const { data, error } = await supabaseAdmin.from('form_configs').select('*').eq('form_key', key).maybeSingle()
    if (error) return apiError(error, 400)
    return apiOk({ config: data ? unpackFormConfigRow(data) : null })
  }
  const { data, error } = await supabaseAdmin.from('form_configs').select('*').order('form_key')
  if (error) return apiError(error, 400)
  return apiOk({ configs: (data || []).map(unpackFormConfigRow) })
}

// Public GET (no admin) for form_key — used by register pages to load config
export async function HEAD() { return new NextResponse(null, { status: 200 }) }

// PUT /api/admin/form-configs — upsert by form_key
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  if (!body?.form_key) return apiError('form_key is required.', 400)

  // Only real columns go to Postgres — use_ec_page/ec_ids (flat, editor-side
  // convenience fields) get folded into contact_persons here instead of
  // being sent as-is, since there's no such column for either of them.
  const { data, error } = await supabaseAdmin
    .from('form_configs')
    .upsert({ ...packFormConfigBody(body), updated_at: new Date().toISOString() }, { onConflict: 'form_key' })
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ config: unpackFormConfigRow(data) })
}

// DELETE /api/admin/form-configs { form_key }
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { form_key } = await req.json().catch(() => ({}))
  if (!form_key) return apiError('form_key required', 400)
  const { error } = await supabaseAdmin.from('form_configs').delete().eq('form_key', form_key)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
