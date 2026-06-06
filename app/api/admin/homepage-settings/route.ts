import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function checkAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('homepage_settings')
    .select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // key-value object হিসেবে return করো
  const obj: Record<string, string> = {}
  for (const row of data || []) obj[row.key] = row.value
  return NextResponse.json(obj)
}

export async function PUT(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() // { key: string, value: string }
  const { error } = await supabaseAdmin
    .from('homepage_settings')
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}