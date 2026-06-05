import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function isAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type_id = searchParams.get('type_id')

  let query = supabaseAdmin
    .from('activity_versions')
    .select('*')
    .order('version_number', { ascending: false })

  if (type_id) query = query.eq('activity_type_id', type_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  
  // map type_id → activity_type_id
  const insertData: any = {
    activity_type_id: body.type_id || body.activity_type_id,
    version_label: body.version_label || `Version ${body.version_number || 1}`,
    version_number: body.version_number,
    year_start: body.year_start,
    year_end: body.year_end || null,
    description: body.description || '',
  }

  const { data, error } = await supabaseAdmin
    .from('activity_versions')
    .insert(insertData)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  
  const updateData: any = { ...rest }
  if (rest.type_id) {
    updateData.activity_type_id = rest.type_id
    delete updateData.type_id
  }

  const { data, error } = await supabaseAdmin
    .from('activity_versions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from('activity_versions')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
