import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — searches across every published activity session by title
// and description, regardless of which type/tab it belongs to. Returns
// enough info (slug + parent type) for the UI to link straight to the
// session and, if useful, jump to the right tab.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return apiOk([])

  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug, description, cover_image_url, session_date, activity_type_id, is_published')
    .eq('is_published', true)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order('session_date', { ascending: false })
    .limit(20)

  if (error) return apiError(error, 400)

  // Attach the parent type's slug/name so the UI can show "in Workshops" etc.
  const typeIds = Array.from(new Set((data || []).map(s => s.activity_type_id).filter(Boolean)))
  let typesById: Record<string, { name: string; slug: string }> = {}
  if (typeIds.length > 0) {
    const { data: types } = await supabaseAdmin
      .from('activity_types')
      .select('id, name, slug')
      .in('id', typeIds)
    typesById = Object.fromEntries((types || []).map(t => [t.id, { name: t.name, slug: t.slug }]))
  }

  const results = (data || []).map(s => ({
    ...s,
    type_name: typesById[s.activity_type_id]?.name || null,
    type_slug: typesById[s.activity_type_id]?.slug || null,
  }))

  return apiOk(results)
}
