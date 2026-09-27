import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { makeSlug } from '@/lib/utils/slug'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('activities')
    .select('*')
    .order('date', { ascending: false })

  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const slug = makeSlug(body.title)
  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert({ ...body, slug })
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
    .from('activities')
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
    .from('activities')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
