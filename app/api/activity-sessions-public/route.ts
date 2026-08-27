import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const version_id = searchParams.get('version_id')
  const type_id = searchParams.get('type_id')

  let query = supabaseAdmin
    .from('activity_sessions')
    .select(`
      id, title, slug, cover_image_url, session_date, youtube_url,
      is_upcoming, registration_enabled, registration_note, event_dates,
      image_display_mode, reg_status, reg_deadline, description, location,
      pdf_url, gallery_urls, activity_type_id, activity_version_id,
      activity_types ( name, slug )
    `)
    .eq('is_published', true)
    .order('session_date', { ascending: false })

  // Apply filters if provided
  if (version_id) {
    query = query.eq('activity_version_id', version_id)
  }
  if (type_id) {
    query = query.eq('activity_type_id', type_id)
  }

  // Only apply limit when no specific filters are provided (backward compatibility)
  if (!version_id && !type_id) {
    query = query.limit(25)
  }

  const { data, error } = await query

  if (error) return apiOk([], { status: 200 })

  // Normalize all cover URLs
  const normalized = (data || []).map((s: any) => ({
    ...s,
    cover_image_url: normalizeUploadUrl(s.cover_image_url),
  }))

  return apiOk(normalized)
}
