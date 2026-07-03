import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type_id = searchParams.get('type_id')

  let query = supabaseAdmin
    .from('activity_versions')
    .select('*')
    .order('version_number', { ascending: false })

  if (type_id) query = query.eq('activity_type_id', type_id)

  const { data, error } = await query
  if (error) return apiError(error, 400)
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
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
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
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
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from('activity_versions')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
