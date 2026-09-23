import { supabaseAdmin } from '@/lib/supabase'
import { apiOk } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('glance_gallery')
    .select('slot_key, image_url, desktop_focal_x, desktop_focal_y, mobile_focal_x, mobile_focal_y, learn_more_url, is_active')
    .eq('is_active', true)
  if (error) return apiOk([], { status: 200 })
  return apiOk(data || [])
}
