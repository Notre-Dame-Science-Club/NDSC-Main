import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { searchParams } = new URL(req.url)
  const olympiadId = searchParams.get('olympiad_id')
  if (!olympiadId) return apiError('Missing olympiad_id', 400)
  const { data, error } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('*')
    .eq('olympiad_id', olympiadId)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return apiError('Missing id', 400)
  const { data, error } = await supabaseAdmin
    .from('olympiad_registrations')
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}
