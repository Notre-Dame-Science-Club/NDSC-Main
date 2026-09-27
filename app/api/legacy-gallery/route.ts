import { supabaseAdmin } from '@/lib/supabase'
import { apiOk } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('legacy_gallery')
    .select('id, image_url, year_label, desktop_focal_x, desktop_focal_y, mobile_focal_x, mobile_focal_y, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) return apiOk([], { status: 200 })
  return apiOk(data || [])
}
