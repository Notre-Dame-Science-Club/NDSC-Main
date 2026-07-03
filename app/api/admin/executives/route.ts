import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const panel = searchParams.get('panel')

  let query = supabaseAdmin
    .from('executives')
    .select('*')
    .order('display_order', { ascending: true })

  if (panel) query = query.eq('panel', panel)

  const { data, error } = await query
  if (error) return apiError(error, 400)
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('executives')
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
    .from('executives')
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
    .from('executives')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
