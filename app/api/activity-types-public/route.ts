import { supabaseAdmin } from '@/lib/supabase'

import { apiOk, apiError } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_types')
    .select('id, name, slug, icon, description, display_order')
    .order('display_order', { ascending: true })

  if (error) return apiError(error, 500)

  // Map results and ensure group_by_version has a fallback value
  const mappedData = (data || []).map(item => ({
    ...item,
    group_by_version: item.group_by_version ?? false
  }))

  return apiOk(mappedData)
}