import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
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
