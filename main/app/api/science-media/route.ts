import { supabaseAdmin } from '@/lib/supabase'

import { apiOk } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('science_media')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) return apiOk([], { status: 200 })
  return apiOk(data || [])
}