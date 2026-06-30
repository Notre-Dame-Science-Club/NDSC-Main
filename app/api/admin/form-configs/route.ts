import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function isAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')
}

// GET /api/admin/form-configs?form_key=xxx  OR  GET all
export async function GET(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = req.nextUrl.searchParams.get('form_key')
  if (key) {
    const { data, error } = await supabaseAdmin.from('form_configs').select('*').eq('form_key', key).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ config: data || null })
  }
  const { data, error } = await supabaseAdmin.from('form_configs').select('*').order('form_key')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ configs: data || [] })
}

// Public GET (no admin) for form_key — used by register pages to load config
export async function HEAD() { return new NextResponse(null, { status: 200 }) }

// PUT /api/admin/form-configs — upsert by form_key
export async function PUT(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body?.form_key) return NextResponse.json({ error: 'form_key is required.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('form_configs')
    .upsert({ ...body, updated_at: new Date().toISOString() }, { onConflict: 'form_key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ config: data })
}

// DELETE /api/admin/form-configs { form_key }
export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { form_key } = await req.json().catch(() => ({}))
  if (!form_key) return NextResponse.json({ error: 'form_key required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('form_configs').delete().eq('form_key', form_key)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
