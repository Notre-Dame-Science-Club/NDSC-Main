import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const adminView = searchParams.get('admin') === '1'

  let query = supabaseAdmin
    .from('publications')
    .select('*')
    .order('published_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (!adminView) query = query.eq('is_published', true)

  const { data, error } = await query
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('publications')
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
    .from('publications')
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
    .from('publications')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
