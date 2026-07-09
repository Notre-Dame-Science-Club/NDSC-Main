import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/form-configs?form_key=xxx  OR  GET all
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const key = req.nextUrl.searchParams.get('form_key')
  if (key) {
    const { data, error } = await supabaseAdmin.from('form_configs').select('*').eq('form_key', key).maybeSingle()
    if (error) return apiError(error, 400)
    return apiOk({ config: data || null })
  }
  const { data, error } = await supabaseAdmin.from('form_configs').select('*').order('form_key')
  if (error) return apiError(error, 400)
  return apiOk({ configs: data || [] })
}

// Public GET (no admin) for form_key — used by register pages to load config
export async function HEAD() { return new NextResponse(null, { status: 200 }) }

// PUT /api/admin/form-configs — upsert by form_key
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json().catch(() => null)
  if (!body?.form_key) return apiError('form_key is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('form_configs')
    .upsert({ ...body, updated_at: new Date().toISOString() }, { onConflict: 'form_key' })
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ config: data })
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
