import { supabase } from '@/lib/supabase'

import { apiOk } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabase
    .from('activity_types')
    .select('id, name, slug, icon')
    .order('display_order', { ascending: true })

  if (error) return apiOk([], { status: 200 })
  return apiOk(data || [])
}