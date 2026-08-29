import { supabaseAdmin } from '@/lib/supabase'

import { apiOk, apiError } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_types')
    .select('id, name, slug, icon, description, display_order, group_by_version')
    .order('display_order', { ascending: true })

  if (error) return apiError(error, 500)
  return apiOk(data || [])
}