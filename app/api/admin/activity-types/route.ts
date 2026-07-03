import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/admin/activity-types — public read, admin write
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_types')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) return apiError(error, 400)
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('activity_types')
    .insert(body)
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
  const { data, error } = await supabaseAdmin
    .from('activity_types')
    .update(rest)
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
    .from('activity_types')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
