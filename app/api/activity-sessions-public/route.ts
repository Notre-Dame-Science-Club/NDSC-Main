import { supabaseAdmin } from '@/lib/supabase'

import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiOk } from '@/lib/api/response'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .select(`
      id, title, slug, cover_image_url, session_date, youtube_url,
      is_upcoming, registration_enabled, registration_note, event_dates,
      activity_types ( name, slug )
    `)
    .eq('is_published', true)
    .order('session_date', { ascending: false })
    .limit(25)

  if (error) return apiOk([], { status: 200 })

  // Normalize all cover URLs
  const normalized = (data || []).map((s: any) => ({
    ...s,
    cover_image_url: normalizeUploadUrl(s.cover_image_url),
  }))

  return apiOk(normalized)
}
